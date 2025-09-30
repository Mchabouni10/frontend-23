//src/components/CustomersList/useCustomers.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects, deleteProject } from '../../services/projectService';
import { CalculatorEngine } from '../Calculator/engine/CalculatorEngine';
import { formatPhoneNumber, formatDate } from '../Calculator/utils/customerhelper';
import { useWorkType } from '../../context/WorkTypeContext';

const DUE_SOON_DAYS = 7;
const OVERDUE_THRESHOLD = -1;
const ITEMS_PER_PAGE = 10;

export const useCustomers = ({ viewMode = 'table' } = {}) => {
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
  const navigate = useNavigate();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Cache for CalculatorEngine results
  const calculationCache = useMemo(() => new Map(), []);

  const projectTotals = useCallback((project) => {
    const projectId = project._id || project.id || JSON.stringify(project.customerInfo);
    
    // Check if we have pre-calculated totals in the project data (use stored values for accuracy)
    if (project.totals && project.paymentDetails) {
      try {
        // Use stored values from database for accuracy
        const grandTotal = parseFloat(project.totals.total || project.totals.grandTotal || 0);
        const totalPaid = parseFloat(project.paymentDetails.totalPaid || 0);
        
        const result = {
          grandTotal,
          amountRemaining: Math.max(0, grandTotal - totalPaid),
          calculationErrors: [],
          paymentErrors: [],
        };

        // Cache the result
        if (calculationCache.size >= 1000) {
          calculationCache.clear();
        }
        calculationCache.set(projectId, result);
        return result;
      } catch (err) {
        console.warn('Failed to parse stored totals, falling back to calculation:', err);
      }
    }

    // Fallback to calculation if no stored totals or parsing failed
    if (calculationCache.has(projectId)) {
      return calculationCache.get(projectId);
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

      if (errors.length > 0) {
        setProjectErrors((prev) => new Map(prev).set(projectId, errors));
        setError((prev) => prev ? `${prev}\nErrors in project ${project.customerInfo?.projectName || projectId}` : `Errors in project ${project.customerInfo?.projectName || projectId}`);
      }

      const grandTotal = parseFloat(calculationResult.total || 0);
      const totalPaid = parseFloat(paymentResult.totalPaid || 0);

      const result = {
        grandTotal,
        amountRemaining: Math.max(0, grandTotal - totalPaid),
        calculationErrors: calculationResult.errors || [],
        paymentErrors: paymentResult.errors || [],
      };

      if (calculationCache.size >= 1000) {
        calculationCache.clear();
      }
      calculationCache.set(projectId, result);
      return result;
    } catch (err) {
      const errorMessage = `Calculation error for project ${project.customerInfo?.projectName || projectId}: ${err.message}`;
      setProjectErrors((prev) => new Map(prev).set(projectId, [{ message: errorMessage }]));
      setError((prev) => prev ? `${prev}\n${errorMessage}` : errorMessage);
      return { grandTotal: 0, amountRemaining: 0, calculationErrors: [err.message], paymentErrors: [] };
    }
  }, [getMeasurementType, isValidSubtype, getWorkTypeDetails, calculationCache]);

  const determineStatus = useCallback((projectsList) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let earliestStart = null;
    let latestFinish = null;
    let totalAmountRemaining = 0;

    projectsList.forEach((project) => {
      const startDate = project.customerInfo?.startDate ? new Date(project.customerInfo.startDate) : null;
      const finishDate = project.customerInfo?.finishDate ? new Date(project.customerInfo.finishDate) : null;
      const { amountRemaining } = projectTotals(project);

      if (startDate && !isNaN(startDate)) {
        earliestStart = earliestStart ? new Date(Math.min(earliestStart, startDate)) : startDate;
      }
      if (finishDate && !isNaN(finishDate)) {
        latestFinish = latestFinish ? new Date(Math.max(latestFinish, finishDate)) : finishDate;
      }
      totalAmountRemaining += amountRemaining;
    });

    if (!earliestStart && !latestFinish) return 'Unknown';
    const daysToStart = earliestStart ? (earliestStart - today) / (1000 * 60 * 60 * 24) : Infinity;
    const daysToFinish = latestFinish ? (latestFinish - today) / (1000 * 60 * 60 * 24) : Infinity;

    if (daysToStart > DUE_SOON_DAYS) return 'Not Started';
    if (daysToStart <= DUE_SOON_DAYS && daysToStart > 0) return 'Starting Soon';
    if (daysToStart <= 0 && (daysToFinish > DUE_SOON_DAYS || !latestFinish)) return 'In Progress';
    if (daysToFinish <= DUE_SOON_DAYS && daysToFinish > OVERDUE_THRESHOLD) return 'Due Soon';
    if (daysToFinish <= OVERDUE_THRESHOLD && totalAmountRemaining > 0) return 'Overdue';
    if (daysToFinish <= OVERDUE_THRESHOLD && totalAmountRemaining === 0) return 'Completed';
    return 'In Progress';
  }, [projectTotals]);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProjects = await getProjects();
      setProjects(fetchedProjects || []);
      setLastUpdated(new Date());
      setError(null);
      setProjectErrors(new Map());
      calculationCache.clear();
    } catch (err) {
      setError(`Failed to fetch projects: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [calculationCache]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const groupAndSetCustomers = useCallback((projectsList) => {
    const customerMap = projectsList.reduce((acc, project) => {
      const key = `${project.customerInfo?.firstName || ''}|${project.customerInfo?.lastName || ''}|${project.customerInfo?.phone || ''}`;
      if (!acc[key]) {
        acc[key] = {
          customerInfo: { ...project.customerInfo },
          projects: [],
          totalGrandTotal: 0,
          totalAmountRemaining: 0,
          earliestStartDate: null,
          latestFinishDate: null,
        };
      }
      acc[key].projects.push(project);
      const { grandTotal, amountRemaining } = projectTotals(project);
      acc[key].totalGrandTotal += grandTotal;
      acc[key].totalAmountRemaining += amountRemaining;
      const startDate = project.customerInfo?.startDate ? new Date(project.customerInfo.startDate) : null;
      const finishDate = project.customerInfo?.finishDate ? new Date(project.customerInfo.finishDate) : null;
      if (startDate && !isNaN(startDate)) {
        acc[key].earliestStartDate = acc[key].earliestStartDate
          ? new Date(Math.min(acc[key].earliestStartDate, startDate))
          : startDate;
      }
      if (finishDate && !isNaN(finishDate)) {
        acc[key].latestFinishDate = acc[key].latestFinishDate
          ? new Date(Math.max(acc[key].latestFinishDate, finishDate))
          : finishDate;
      }
      return acc;
    }, {});

    return Object.values(customerMap).map((customer) => ({
      ...customer,
      status: determineStatus(customer.projects),
    }));
  }, [projectTotals, determineStatus]);

  const customers = useMemo(() => groupAndSetCustomers(projects), [projects, groupAndSetCustomers]);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      result = customers.filter((customer) => {
        const name = `${customer.customerInfo.firstName || ''} ${customer.customerInfo.lastName || ''}`.toLowerCase();
        const phone = customer.customerInfo.phone?.toLowerCase() || '';
        const status = customer.status.toLowerCase();
        return name.includes(query) || phone.includes(query) || status.includes(query);
      });
    }
    if (statusFilter) {
      result = result.filter((customer) => customer.status === statusFilter);
    }
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aValue = a[sortConfig.key] || a.customerInfo[sortConfig.key] || '';
        let bValue = b[sortConfig.key] || b.customerInfo[sortConfig.key] || '';
        if (sortConfig.key === 'startDate') aValue = a.earliestStartDate;
        if (sortConfig.key === 'startDate') bValue = b.earliestStartDate;
        if (sortConfig.key === 'amountRemaining') aValue = a.totalAmountRemaining;
        if (sortConfig.key === 'amountRemaining') bValue = b.totalAmountRemaining;
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [customers, debouncedSearchQuery, sortConfig, statusFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    return filteredCustomers.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredCustomers, currentPage]);

  const totals = useMemo(() => {
    return filteredCustomers.reduce(
      (acc, customer) => ({
        grandTotal: acc.grandTotal + customer.totalGrandTotal,
        amountRemaining: acc.amountRemaining + customer.totalAmountRemaining,
      }),
      { grandTotal: 0, amountRemaining: 0 }
    );
  }, [filteredCustomers]);

  const generateNotifications = useCallback(() => {
    const AMOUNT_REMAINING_THRESHOLD = 10000;
    const notificationList = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredCustomers.forEach((customer) => {
      customer.projects.forEach((project) => {
        const projectId = project._id || project.id || JSON.stringify(project.customerInfo);
        if (projectErrors.has(projectId)) {
          notificationList.push({
            message: `Calculation errors in ${project.customerInfo.firstName} ${project.customerInfo.lastName}'s project: ${projectErrors.get(projectId).map(e => e.message).join('; ')}`,
            overdue: true,
            nearDue: false,
          });
        }
        const startDate = project.customerInfo?.startDate ? new Date(project.customerInfo.startDate) : null;
        const finishDate = project.customerInfo?.finishDate ? new Date(project.customerInfo.finishDate) : null;
        if (startDate && !isNaN(startDate)) {
          const daysToStart = (startDate - today) / (1000 * 60 * 60 * 24);
          if (daysToStart <= DUE_SOON_DAYS && daysToStart > 0) {
            notificationList.push({
              message: `${project.customerInfo.firstName} ${project.customerInfo.lastName}'s project starts soon on ${formatDate(startDate)}.`,
              overdue: false,
              nearDue: true,
            });
          }
        }
        if (finishDate && !isNaN(finishDate)) {
          const daysToFinish = (finishDate - today) / (1000 * 60 * 60 * 24);
          const { amountRemaining } = projectTotals(project);
          if (daysToFinish <= DUE_SOON_DAYS && daysToFinish > OVERDUE_THRESHOLD) {
            notificationList.push({
              message: `${project.customerInfo.firstName} ${project.customerInfo.lastName}'s project due soon on ${formatDate(finishDate)}.`,
              overdue: false,
              nearDue: true,
            });
          } else if (daysToFinish <= OVERDUE_THRESHOLD && amountRemaining > 0) {
            notificationList.push({
              message: `${project.customerInfo.firstName} ${project.customerInfo.lastName}'s project overdue since ${formatDate(finishDate)}.`,
              overdue: true,
              nearDue: false,
            });
          }
        }
      });
    });

    if (totals.amountRemaining > AMOUNT_REMAINING_THRESHOLD) {
      notificationList.push({
        message: `Total remaining exceeds $${AMOUNT_REMAINING_THRESHOLD.toLocaleString()}: $${totals.amountRemaining.toFixed(2)}.`,
        overdue: true,
        nearDue: false,
      });
    }
    return notificationList;
  }, [filteredCustomers, projectTotals, totals.amountRemaining, projectErrors]);

  const notifications = useMemo(() => generateNotifications(), [generateNotifications]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleDetails = useCallback((customerProjects) => {
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
    if (window.confirm('Are you sure you want to delete this project?')) {
      setIsLoading(true);
      try {
        await deleteProject(projectId);
        await refreshProjects();
        setError(null);
        alert('Project deleted successfully!');
      } catch (err) {
        setError(`Failed to delete project: ${err.message}`);
        alert('Failed to delete project.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [refreshProjects]);

  const handleNewProject = useCallback((customerInfo) => {
    navigate('/home/customer', { state: { customerInfo } });
  }, [navigate]);

  const handleExportCSV = useCallback((selectedFields = [
    'First Name', 'Last Name', 'Phone Number', 'Project Count',
    'Earliest Start Date', 'Latest Finish Date', 'Status',
    'Total Amount Remaining', 'Total Grand Total'
  ]) => {
    const fieldMap = {
      'First Name': customer => customer.customerInfo.firstName || 'N/A',
      'Last Name': customer => customer.customerInfo.lastName || 'N/A',
      'Phone Number': customer => formatPhoneNumber(customer.customerInfo.phone),
      'Project Count': customer => customer.projects.length,
      'Earliest Start Date': customer => customer.earliestStartDate ? formatDate(customer.earliestStartDate) : 'N/A',
      'Latest Finish Date': customer => customer.latestFinishDate ? formatDate(customer.latestFinishDate) : 'N/A',
      'Status': customer => customer.status,
      'Total Amount Remaining': customer => `$${customer.totalAmountRemaining.toFixed(2)}`,
      'Total Grand Total': customer => `$${customer.totalGrandTotal.toFixed(2)}`,
    };

    const headers = selectedFields;
    const rows = filteredCustomers.map((customer) =>
      selectedFields.map((field) => fieldMap[field](customer))
    );

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [filteredCustomers]);

  return {
    projects,
    searchQuery,
    setSearchQuery,
    filteredCustomers,
    paginatedCustomers,
    totalPages,
    currentPage,
    setCurrentPage,
    isLoading,
    setIsLoading,
    error,
    projectErrors,
    lastUpdated,
    totals,
    notifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    handleSort,
    handleDetails,
    handleEdit,
    handleDelete,
    handleNewProject,
    handleExportCSV,
    sortConfig,
    formatPhoneNumber,
    formatDate,
    navigate,
    refreshProjects,
    statusFilter,
    setStatusFilter,
  };
};