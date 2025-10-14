// src/components/CustomersList/useCustomers.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, deleteProject } from '../../services/projectService';
import { CalculatorEngine } from '../Calculator/engine/CalculatorEngine';
import { formatPhoneNumber, formatDate } from '../Calculator/utils/customerhelper';
import { useWorkType } from '../../context/WorkTypeContext';

// Constants
const DUE_SOON_DAYS = 7;
const OVERDUE_THRESHOLD = -1;
const ITEMS_PER_PAGE = 10;
const DEBOUNCE_DELAY = 300;
const CACHE_MAX_SIZE = 1000;
const AMOUNT_REMAINING_THRESHOLD = 10000;

export const useCustomers = ({ viewMode = 'table' } = {}) => {
  // State management
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projectErrors, setProjectErrors] = useState(new Map());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Refs for performance optimization
  const calculationCacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  const navigate = useNavigate();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Create a local reference to avoid the warning
      const cache = calculationCacheRef.current;
      if (cache) {
        cache.clear();
      }
    };
  }, []); // No dependencies needed as this is only for unmount cleanup

  /**
   * Generate unique project identifier
   */
  const getProjectId = useCallback((project) => {
    return project._id || project.id || JSON.stringify(project.customerInfo);
  }, []);

  /**
   * Calculate project totals with caching and error handling
   */
  const projectTotals = useCallback((project) => {
    const projectId = getProjectId(project);
    const cache = calculationCacheRef.current;
    
    // Return cached result if available
    if (cache.has(projectId)) {
      return cache.get(projectId);
    }

    try {
      const engine = new CalculatorEngine(
        project.categories || [],
        project.settings || {},
        { getMeasurementType, isValidSubtype, getWorkTypeDetails }
      );

      const calculationResult = engine.calculateTotals();
      const paymentResult = engine.calculatePaymentDetails();

      const errors = [
        ...(calculationResult.errors || []),
        ...(paymentResult.errors || []),
      ];

      // Store errors if any exist
      if (errors.length > 0) {
        setProjectErrors((prev) => {
          const newMap = new Map(prev);
          newMap.set(projectId, errors);
          return newMap;
        });
      }

      const grandTotal = parseFloat(calculationResult.total || 0);
      const totalPaid = parseFloat(paymentResult.totalPaid || 0);

      const result = {
        grandTotal,
        amountRemaining: Math.max(0, grandTotal - totalPaid),
        calculationErrors: calculationResult.errors || [],
        paymentErrors: paymentResult.errors || [],
      };

      // Manage cache size to prevent memory issues
      if (cache.size >= CACHE_MAX_SIZE) {
        // Remove oldest entries (first 100)
        const entries = Array.from(cache.entries());
        entries.slice(0, 100).forEach(([key]) => cache.delete(key));
      }
      
      cache.set(projectId, result);
      return result;
    } catch (err) {
      const errorMessage = `Calculation error for project ${project.customerInfo?.projectName || projectId}: ${err.message}`;
      
      setProjectErrors((prev) => {
        const newMap = new Map(prev);
        newMap.set(projectId, [{ message: errorMessage }]);
        return newMap;
      });
      
      console.error(errorMessage, err);
      
      return { 
        grandTotal: 0, 
        amountRemaining: 0, 
        calculationErrors: [errorMessage], 
        paymentErrors: [] 
      };
    }
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails, getProjectId]);

  /**
   * Determine project/customer status based on dates and payment
   */
  const determineStatus = useCallback((projectsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let earliestStart = null;
    let latestFinish = null;
    let totalAmountRemaining = 0;
    let hasValidDates = false;

    projectsList.forEach((project) => {
      const startDate = project.customerInfo?.startDate 
        ? new Date(project.customerInfo.startDate) 
        : null;
      const finishDate = project.customerInfo?.finishDate 
        ? new Date(project.customerInfo.finishDate) 
        : null;
      const { amountRemaining } = projectTotals(project);

      if (startDate && !isNaN(startDate.getTime())) {
        hasValidDates = true;
        earliestStart = earliestStart 
          ? new Date(Math.min(earliestStart, startDate)) 
          : startDate;
      }
      
      if (finishDate && !isNaN(finishDate.getTime())) {
        hasValidDates = true;
        latestFinish = latestFinish 
          ? new Date(Math.max(latestFinish, finishDate)) 
          : finishDate;
      }
      
      totalAmountRemaining += amountRemaining;
    });

    if (!hasValidDates) return 'Unknown';

    const daysToStart = earliestStart 
      ? (earliestStart - today) / (1000 * 60 * 60 * 24) 
      : Infinity;
    const daysToFinish = latestFinish 
      ? (latestFinish - today) / (1000 * 60 * 60 * 24) 
      : Infinity;

    // Status determination logic
    if (daysToFinish <= OVERDUE_THRESHOLD) {
      return totalAmountRemaining > 0 ? 'Overdue' : 'Completed';
    }
    if (daysToFinish <= DUE_SOON_DAYS && daysToFinish > OVERDUE_THRESHOLD) {
      return 'Due Soon';
    }
    if (daysToStart <= 0) {
      return 'In Progress';
    }
    if (daysToStart <= DUE_SOON_DAYS) {
      return 'Starting Soon';
    }
    if (daysToStart > DUE_SOON_DAYS) {
      return 'Not Started';
    }
    
    return 'In Progress';
  }, [projectTotals]);

  /**
   * Fetch projects from API
   */
  const refreshProjects = useCallback(async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const fetchedProjects = await getProjects();
      
      // Check if request was aborted
      if (abortControllerRef.current.signal.aborted) {
        return;
      }

      setProjects(fetchedProjects || []);
      setLastUpdated(new Date());
      setProjectErrors(new Map());
      calculationCacheRef.current.clear();
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errorMessage = `Failed to fetch projects: ${err.message}`;
        setError(errorMessage);
        console.error(errorMessage, err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  /**
   * Group projects by customer
   */
  const groupAndSetCustomers = useCallback((projectsList) => {
    const customerMap = new Map();

    projectsList.forEach((project) => {
      const key = `${project.customerInfo?.firstName || ''}|${project.customerInfo?.lastName || ''}|${project.customerInfo?.phone || ''}`;
      
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customerInfo: { ...project.customerInfo },
          projects: [],
          totalGrandTotal: 0,
          totalAmountRemaining: 0,
          earliestStartDate: null,
          latestFinishDate: null,
        });
      }

      const customer = customerMap.get(key);
      customer.projects.push(project);

      const { grandTotal, amountRemaining } = projectTotals(project);
      customer.totalGrandTotal += grandTotal;
      customer.totalAmountRemaining += amountRemaining;

      const startDate = project.customerInfo?.startDate 
        ? new Date(project.customerInfo.startDate) 
        : null;
      const finishDate = project.customerInfo?.finishDate 
        ? new Date(project.customerInfo.finishDate) 
        : null;

      if (startDate && !isNaN(startDate.getTime())) {
        customer.earliestStartDate = customer.earliestStartDate
          ? new Date(Math.min(customer.earliestStartDate, startDate))
          : startDate;
      }

      if (finishDate && !isNaN(finishDate.getTime())) {
        customer.latestFinishDate = customer.latestFinishDate
          ? new Date(Math.max(customer.latestFinishDate, finishDate))
          : finishDate;
      }
    });

    return Array.from(customerMap.values()).map((customer) => ({
      ...customer,
      status: determineStatus(customer.projects),
    }));
  }, [projectTotals, determineStatus]);

  const customers = useMemo(
    () => groupAndSetCustomers(projects), 
    [projects, groupAndSetCustomers]
  );

  /**
   * Filter and sort customers
   */
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Apply search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      result = result.filter((customer) => {
        const firstName = (customer.customerInfo.firstName || '').toLowerCase();
        const lastName = (customer.customerInfo.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const phone = (customer.customerInfo.phone || '').toLowerCase();
        const status = customer.status.toLowerCase();

        return fullName.includes(query) || 
               firstName.includes(query) || 
               lastName.includes(query) || 
               phone.includes(query) || 
               status.includes(query);
      });
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter((customer) => customer.status === statusFilter);
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'startDate':
            aValue = a.earliestStartDate || new Date(0);
            bValue = b.earliestStartDate || new Date(0);
            break;
          case 'amountRemaining':
            aValue = a.totalAmountRemaining;
            bValue = b.totalAmountRemaining;
            break;
          case 'lastName':
            aValue = (a.customerInfo.lastName || '').toLowerCase();
            bValue = (b.customerInfo.lastName || '').toLowerCase();
            break;
          default:
            aValue = (a[sortConfig.key] || a.customerInfo[sortConfig.key] || '');
            bValue = (b[sortConfig.key] || b.customerInfo[sortConfig.key] || '');
        }

        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [customers, debouncedSearchQuery, sortConfig, statusFilter]);

  /**
   * Pagination
   */
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, customer) => ({
        grandTotal: acc.grandTotal + (customer.totalGrandTotal || 0),
        amountRemaining: acc.amountRemaining + (customer.totalAmountRemaining || 0),
      }),
      { grandTotal: 0, amountRemaining: 0 }
    );
  }, [filteredCustomers]);

  /**
   * Generate notifications for overdue, due soon, and errors
   */
  const notifications = useMemo(() => {
    const notificationList = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const seenMessages = new Set();

    filteredCustomers.forEach((customer) => {
      customer.projects.forEach((project) => {
        const projectId = getProjectId(project);
        const customerName = `${project.customerInfo?.firstName || ''} ${project.customerInfo?.lastName || ''}`.trim();

        // Calculation errors
        if (projectErrors.has(projectId)) {
          const errors = projectErrors.get(projectId);
          errors.forEach((err) => {
            const message = `${customerName}: ${err.message}`;
            if (!seenMessages.has(message)) {
              notificationList.push({
                message,
                overdue: true,
                nearDue: false,
                type: 'error',
              });
              seenMessages.add(message);
            }
          });
        }

        const startDate = project.customerInfo?.startDate 
          ? new Date(project.customerInfo.startDate) 
          : null;
        const finishDate = project.customerInfo?.finishDate 
          ? new Date(project.customerInfo.finishDate) 
          : null;

        // Starting soon notifications
        if (startDate && !isNaN(startDate.getTime())) {
          const daysToStart = (startDate - today) / (1000 * 60 * 60 * 24);
          if (daysToStart <= DUE_SOON_DAYS && daysToStart > 0) {
            const message = `${customerName}'s project starts soon on ${formatDate(startDate)}`;
            if (!seenMessages.has(message)) {
              notificationList.push({
                message,
                overdue: false,
                nearDue: true,
                type: 'start-soon',
              });
              seenMessages.add(message);
            }
          }
        }

        // Due soon and overdue notifications
        if (finishDate && !isNaN(finishDate.getTime())) {
          const daysToFinish = (finishDate - today) / (1000 * 60 * 60 * 24);
          const { amountRemaining } = projectTotals(project);

          if (daysToFinish <= DUE_SOON_DAYS && daysToFinish > OVERDUE_THRESHOLD) {
            const message = `${customerName}'s project due soon on ${formatDate(finishDate)}`;
            if (!seenMessages.has(message)) {
              notificationList.push({
                message,
                overdue: false,
                nearDue: true,
                type: 'due-soon',
              });
              seenMessages.add(message);
            }
          } else if (daysToFinish <= OVERDUE_THRESHOLD && amountRemaining > 0) {
            const message = `${customerName}'s project overdue since ${formatDate(finishDate)} ($${amountRemaining.toFixed(2)} remaining)`;
            if (!seenMessages.has(message)) {
              notificationList.push({
                message,
                overdue: true,
                nearDue: false,
                type: 'overdue',
              });
              seenMessages.add(message);
            }
          }
        }
      });
    });

    // High remaining balance notification
    if (totals.amountRemaining > AMOUNT_REMAINING_THRESHOLD) {
      notificationList.push({
        message: `Total outstanding balance: $${totals.amountRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        overdue: true,
        nearDue: false,
        type: 'high-balance',
      });
    }

    // Sort notifications: errors first, then overdue, then due soon
    return notificationList.sort((a, b) => {
      if (a.type === 'error' && b.type !== 'error') return -1;
      if (a.type !== 'error' && b.type === 'error') return 1;
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return 0;
    });
  }, [filteredCustomers, projectTotals, totals.amountRemaining, projectErrors, getProjectId]);

  /**
   * Event handlers
   */
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleDetails = useCallback((customerProjects) => {
    if (!customerProjects || customerProjects.length === 0) {
      setError('No projects available to view');
      return;
    }
    navigate('/home/customer-projects', { state: { projects: customerProjects } });
  }, [navigate]);

  const handleEdit = useCallback((projectId) => {
    if (!projectId) {
      setError('Please select a specific project to edit');
      return;
    }
    navigate(`/home/edit/${projectId}`);
  }, [navigate]);

  const handleDelete = useCallback(async (projectId) => {
    if (!projectId) {
      setError('Please select a specific project to delete');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this project? This action cannot be undone.'
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      await deleteProject(projectId);
      await refreshProjects();
      setError(null);
    } catch (err) {
      const errorMessage = `Failed to delete project: ${err.message}`;
      setError(errorMessage);
      console.error(errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshProjects]);

  const handleNewProject = useCallback((customerInfo) => {
    navigate('/home/customer', { state: { customerInfo } });
  }, [navigate]);

  const handleExportCSV = useCallback((selectedFields = [
    'First Name', 
    'Last Name', 
    'Phone Number', 
    'Project Count',
    'Earliest Start Date', 
    'Latest Finish Date', 
    'Status',
    'Total Amount Remaining', 
    'Total Grand Total'
  ]) => {
    const fieldMap = {
      'First Name': (customer) => customer.customerInfo.firstName || 'N/A',
      'Last Name': (customer) => customer.customerInfo.lastName || 'N/A',
      'Phone Number': (customer) => formatPhoneNumber(customer.customerInfo.phone) || 'N/A',
      'Project Count': (customer) => customer.projects.length,
      'Earliest Start Date': (customer) => 
        customer.earliestStartDate ? formatDate(customer.earliestStartDate) : 'N/A',
      'Latest Finish Date': (customer) => 
        customer.latestFinishDate ? formatDate(customer.latestFinishDate) : 'N/A',
      'Status': (customer) => customer.status,
      'Total Amount Remaining': (customer) => customer.totalAmountRemaining.toFixed(2),
      'Total Grand Total': (customer) => customer.totalGrandTotal.toFixed(2),
    };

    try {
      const headers = selectedFields;
      const rows = filteredCustomers.map((customer) =>
        selectedFields.map((field) => {
          const value = fieldMap[field]?.(customer) ?? 'N/A';
          return String(value).replace(/"/g, '""');
        })
      );

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.href = url;
      link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setError('Failed to export CSV file');
    }
  }, [filteredCustomers]);

  return {
    // Data
    projects,
    filteredCustomers,
    paginatedCustomers,
    totals,
    notifications,
    
    // Pagination
    totalPages,
    currentPage,
    setCurrentPage,
    
    // Search & Filter
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortConfig,
    
    // Loading & Error states
    isLoading,
    setIsLoading,
    error,
    projectErrors,
    lastUpdated,
    
    // UI state
    isNotificationsOpen,
    setIsNotificationsOpen,
    
    // Handlers
    handleSort,
    handleDetails,
    handleEdit,
    handleDelete,
    handleNewProject,
    handleExportCSV,
    refreshProjects,
    
    // Utilities
    formatPhoneNumber,
    formatDate,
    navigate,
  };
};