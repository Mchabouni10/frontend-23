// src/components/HomePage/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faUndo, faArrowLeft, faEdit, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { CategoriesProvider, useCategories } from '../../context/CategoriesContext';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';
import { WorkTypeProvider, useWorkType } from '../../context/WorkTypeContext';
import { CalculatorEngine } from '../Calculator/engine/CalculatorEngine';
import CustomerInfo from '../CustomerInfo/CustomerInfo';
import Calculator from '../Calculator/Calculator';
import CostBreakdown from '../Calculator/CostBreakdown/CostBreakdown';
import styles from './HomePage.module.css';
import { saveProject, updateProject, getProject } from '../../services/projectService';
import ErrorBoundary from '../ErrorBoundary';

// Validate project before saving
const validateProjectData = (customer) => {
  const requiredFields = ['firstName', 'lastName', 'street', 'phone', 'startDate', 'zipCode', 'email', 'projectName'];
  const missing = requiredFields.filter((field) => {
    if (field === 'startDate') {
      return !customer[field] || (customer[field] instanceof Date && isNaN(customer[field].getTime()));
    }
    return !customer[field]?.trim();
  });

  if (missing.length > 0) return `Please fill in all required fields: ${missing.join(', ')}`;

  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return 'Please enter a valid email address.';

  if (!/^\d{5}$/.test(customer.zipCode)) return 'ZIP Code must be exactly 5 digits.';

  return null;
};

// Sanitize categories using CalculatorEngine (simplified)
const sanitizeCategoriesWithEngine = (categories) => {
  if (!Array.isArray(categories)) return [];

  const sanitized = categories.map((category) => {
    if (!category || typeof category !== 'object') return null;

    const workItems = Array.isArray(category.workItems)
      ? category.workItems.map((item) => {
          if (!item || typeof item !== 'object') return null;
          // Remove manual measurementType setting - let WorkItem handle it
          const surfaces = Array.isArray(item.surfaces) ? item.surfaces.filter(Boolean) : [];
          return { ...item, surfaces };
        }).filter(Boolean)
      : [];

    return { ...category, workItems };
  }).filter(Boolean);

  return sanitized;
};

// Main HomePage content - now properly wrapped with providers
function HomePageContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialCustomerInfo = location.pathname === '/home/new-customer-project' ? {} : location.state?.customerInfo || {};

  const { categories, setCategories } = useCategories();
  const { settings, setSettings } = useSettings();
  
  // Use the WorkType hook directly - now properly available
  const workTypeContext = useWorkType();
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = workTypeContext;
  
  const [customer, setCustomer] = useState({
    firstName: initialCustomerInfo.firstName || '',
    lastName: initialCustomerInfo.lastName || '',
    street: initialCustomerInfo.street || '',
    unit: initialCustomerInfo.unit || '',
    city: initialCustomerInfo.city || '',
    state: initialCustomerInfo.state || 'IL',
    zipCode: initialCustomerInfo.zipCode || '',
    phone: initialCustomerInfo.phone || '',
    email: initialCustomerInfo.email || '',
    projectName: initialCustomerInfo.projectName || '',
    type: initialCustomerInfo.type || 'Residential',
    paymentType: initialCustomerInfo.paymentType || 'Cash',
    startDate: initialCustomerInfo.startDate ? new Date(initialCustomerInfo.startDate) : '',
    finishDate: initialCustomerInfo.finishDate ? new Date(initialCustomerInfo.finishDate) : '',
    notes: initialCustomerInfo.notes || '',
  });

  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCustomerInfoVisible, setIsCustomerInfoVisible] = useState(true);

  const isDetailsMode = location.pathname.startsWith('/home/customer/') && id;
  const isEditMode = location.pathname.startsWith('/home/edit/') && id;
  const isNewMode = location.pathname === '/home/customer' || location.pathname === '/home/new-customer-project';

  // Check if workType functions are ready
  const workTypeFunctionsReady = !!(getMeasurementType && isValidSubtype && getWorkTypeDetails);

  // Validation for required customer fields
  const validateCustomerFields = useCallback(() => {
    const requiredFields = [
      'firstName',
      'lastName', 
      'street',
      'city',
      'zipCode',
      'phone',
      'email',
      'projectName',
      'startDate'
    ];

    // Check if all required fields are filled
    const missingFields = requiredFields.filter(field => {
      if (field === 'startDate') {
        return !customer[field] || (customer[field] instanceof Date && isNaN(customer[field].getTime()));
      }
      return !customer[field] || !customer[field].toString().trim();
    });

    // Additional validations
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return false;
    }

    if (customer.zipCode && !/^\d{5}$/.test(customer.zipCode)) {
      return false;
    }

    if (customer.phone) {
      const cleaned = customer.phone.replace(/\D/g, '');
      if (!(cleaned.length === 11 && cleaned.startsWith('1'))) {
        return false;
      }
    }

    return missingFields.length === 0;
  }, [customer]);

  const isCustomerDataValid = validateCustomerFields();

  // Load project data from server
  useEffect(() => {
    const loadProject = async () => {
      if (id && (isEditMode || isDetailsMode) && workTypeFunctionsReady) {
        setLoading(true);
        try {
          const project = await getProject(id);
          setProjectId(project._id);

          const normalizedCustomer = {
            firstName: project.customerInfo?.firstName || '',
            lastName: project.customerInfo?.lastName || '',
            street: project.customerInfo?.street || '',
            unit: project.customerInfo?.unit || '',
            city: project.customerInfo?.city || '',
            state: project.customerInfo?.state || 'IL',
            zipCode: project.customerInfo?.zipCode || '',
            phone: project.customerInfo?.phone || '',
            email: project.customerInfo?.email || '',
            projectName: project.customerInfo?.projectName || '',
            type: project.customerInfo?.type || 'Residential',
            paymentType: project.customerInfo?.paymentType || 'Cash',
            startDate: project.customerInfo?.startDate ? new Date(project.customerInfo.startDate) : '',
            finishDate: project.customerInfo?.finishDate ? new Date(project.customerInfo.finishDate) : '',
            notes: project.customerInfo?.notes || '',
          };
          setCustomer(normalizedCustomer);

          // Simplified sanitization - no need to pass functions
          const sanitizedCategories = sanitizeCategoriesWithEngine(project.categories);
          setCategories(sanitizedCategories);

          const normalizedSettings = {
            taxRate: project.settings?.taxRate || 0,
            transportationFee: project.settings?.transportationFee || 0,
            wasteFactor: project.settings?.wasteFactor || 0,
            miscFees: project.settings?.miscFees || [],
            deposit: project.settings?.deposit || 0,
            depositDate: project.settings?.depositDate || null,
            payments: project.settings?.payments || [],
            markup: project.settings?.markup || 0,
            laborDiscount: project.settings?.laborDiscount || 0,
          };
          setSettings(normalizedSettings);
        } catch (err) {
          console.error('Error loading project:', err);
          alert('Failed to load project.');
          navigate('/home/customers');
        } finally {
          setLoading(false);
        }
      }
    };
    
    if (workTypeFunctionsReady) {
      loadProject();
    }
  }, [id, isEditMode, isDetailsMode, navigate, workTypeFunctionsReady, setCategories, setSettings]);

  // Save or update project using CalculatorEngine
  const saveOrUpdateProject = async () => {
    console.log('Save button clicked, workTypeFunctionsReady:', workTypeFunctionsReady);
    
    if (!workTypeFunctionsReady) {
      alert('System not ready. Please wait a moment and try again.');
      console.error('WorkType functions not ready:', { getMeasurementType: !!getMeasurementType, isValidSubtype: !!isValidSubtype, getWorkTypeDetails: !!getWorkTypeDetails });
      return;
    }

    const validationError = validateProjectData(customer);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Simplified sanitization
    const sanitizedCategories = sanitizeCategoriesWithEngine(categories);

    try {
      // Instantiate CalculatorEngine with context functions
      const engine = new CalculatorEngine(sanitizedCategories, settings, workTypeContext);

      // Recalculate totals, breakdowns, payments
      const totals = engine.calculateTotals();
      const breakdowns = engine.calculateBreakdowns();
      const paymentDetails = engine.calculatePaymentDetails();

      // Build project payload
      const projectData = {
        customerInfo: {
          ...customer,
          startDate: customer.startDate instanceof Date && !isNaN(customer.startDate.getTime())
            ? customer.startDate.toISOString().split('T')[0]
            : customer.startDate,
          finishDate: customer.finishDate instanceof Date && !isNaN(customer.finishDate.getTime())
            ? customer.finishDate.toISOString().split('T')[0]
            : customer.finishDate,
        },
        categories: sanitizedCategories,
        settings: {
          ...settings,
          payments: (settings.payments || []).map(payment => ({
            ...payment,
            date: payment.date instanceof Date ? payment.date.toISOString().split('T')[0] : payment.date,
            amount: Number(payment.amount),
            method: payment.method || 'Cash',
            note: payment.note || '',
            isPaid: Boolean(payment.isPaid),
          })),
          deposit: Number(settings.deposit) || 0,
          depositDate: settings.depositDate ? new Date(settings.depositDate).toISOString().split('T')[0] : null,
        },
        totals,
        breakdowns,
        paymentDetails,
      };

      console.log('Project data to save:', projectData);

      setLoading(true);
      
      if (isEditMode && projectId) {
        await updateProject(projectId, projectData);
        alert('Project updated successfully!');
        navigate('/home/customers');
      } else if (isNewMode) {
        const newProject = await saveProject(projectData);
        setProjectId(newProject._id);
        alert('Project saved successfully!');
        navigate('/home/customers');
      }
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Failed to save/update project: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    if (window.confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      setCustomer({
        firstName: '',
        lastName: '',
        street: '',
        unit: '',
        city: '',
        state: 'IL',
        zipCode: '',
        phone: '',
        email: '',
        projectName: '',
        type: 'Residential',
        paymentType: 'Cash',
        startDate: '',
        finishDate: '',
        notes: '',
      });
      setCategories([]);
      setSettings({
        taxRate: 0,
        transportationFee: 0,
        wasteFactor: 0,
        miscFees: [],
        deposit: 0,
        depositDate: null,
        payments: [],
        markup: 0,
        laborDiscount: 0,
      });
      setProjectId(null);
      alert('All data reset.');
    }
  };

  const handleEditClick = () => {
    if (id) navigate(`/home/edit/${id}`);
  };

  const toggleCustomerInfo = () => setIsCustomerInfoVisible(prev => !prev);

  if (loading && !workTypeFunctionsReady) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText}>Initializing system...</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText}>Loading project data...</p>
        </div>
      </main>
    );
  }

  console.log('Render - workTypeFunctionsReady:', workTypeFunctionsReady, 'loading:', loading, 'isCustomerDataValid:', isCustomerDataValid);

  return (
    <main className={`${styles.mainContent} ${!isCustomerInfoVisible ? styles.mainContentCompact : ''}`}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {isDetailsMode ? 'Project Details' : isEditMode ? 'Edit Project' : 'New Project'}
          </h1>
          {isDetailsMode && (
            <button onClick={handleEditClick} className={styles.editButton}>
              <FontAwesomeIcon icon={faEdit} className={styles.buttonIcon} />
              Edit Project
            </button>
          )}
        </div>
        <div className={styles.content}>
          <div className={`${styles.topRow} ${!isCustomerInfoVisible ? styles.customerHidden : ''}`}>
            {!isDetailsMode && (
              <button
                onClick={toggleCustomerInfo}
                className={`${styles.toggleArrow} ${isCustomerInfoVisible ? styles.toggleArrowRight : styles.toggleArrowLeft}`}
                disabled={loading}
                aria-label={isCustomerInfoVisible ? 'Hide customer information' : 'Show customer information'}
                aria-expanded={isCustomerInfoVisible}
                aria-controls="customer-section"
              >
                <FontAwesomeIcon icon={isCustomerInfoVisible ? faChevronLeft : faChevronRight} className={styles.toggleIcon} />
              </button>
            )}
            <section className={`${styles.customerSection} ${!isCustomerInfoVisible ? styles.customerSectionHidden : ''}`} id="customer-section">
              <div className={styles.slideWrapper} style={{ transform: isCustomerInfoVisible ? 'translateX(0)' : 'translateX(-100%)' }} aria-hidden={!isCustomerInfoVisible}>
                <CustomerInfo customer={customer} setCustomer={setCustomer} disabled={isDetailsMode} />
              </div>
            </section>
            <section className={`${styles.calculatorSection} ${!isCustomerInfoVisible ? styles.calculatorExpanded : ''}`}>
              <Calculator disabled={isDetailsMode} />
            </section>
          </div>
          <section className={styles.costBreakdownSection}>
            <CostBreakdown />
          </section>
        </div>
        <div className={styles.buttonGroup}>
          {isDetailsMode ? (
            <button onClick={() => navigate('/home/customers')} className={styles.backButton}>
              <FontAwesomeIcon icon={faArrowLeft} className={styles.buttonIcon} />
              Back to Customers
            </button>
          ) : (
            <>
              <button 
                onClick={saveOrUpdateProject} 
                className={styles.saveButton} 
                disabled={loading || !workTypeFunctionsReady || !isCustomerDataValid}
                title={
                  !workTypeFunctionsReady 
                    ? 'Waiting for system to initialize...' 
                    : !isCustomerDataValid 
                      ? 'Please fill in all required customer information fields'
                      : ''
                }
              >
                <FontAwesomeIcon icon={faSave} className={styles.buttonIcon} />
                {loading ? 'Saving...' : isEditMode && projectId ? 'Update Project' : 'Save Project'}
              </button>
              <button onClick={resetAll} className={styles.resetButton} disabled={loading}>
                <FontAwesomeIcon icon={faUndo} className={styles.buttonIcon} />
                Reset All
              </button>
              <button onClick={() => navigate('/home/customers')} className={styles.backButton} disabled={loading}>
                <FontAwesomeIcon icon={faArrowLeft} className={styles.buttonIcon} />
                Back to Customers
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// HomePage with providers - restructured for proper context access
export default function HomePage() {
  const { id } = useParams();
  const projectKey = id || 'new-project';

  return (
    <ErrorBoundary boundaryName="HomePage">
      <WorkTypeProvider>
        <CategoriesProvider key={`cat-${projectKey}`}>
          <SettingsProvider key={`set-${projectKey}`}>
            <HomePageContentWrapper />
          </SettingsProvider>
        </CategoriesProvider>
      </WorkTypeProvider>
    </ErrorBoundary>
  );
}

// Wrapper component to ensure proper context access timing
function HomePageContentWrapper() {
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();
  
  // Wait for context to be ready
  const isContextReady = !!(getMeasurementType && isValidSubtype && getWorkTypeDetails);
  
  if (!isContextReady) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText}>Initializing system...</p>
        </div>
      </main>
    );
  }
  
  return <HomePageContent />;
}