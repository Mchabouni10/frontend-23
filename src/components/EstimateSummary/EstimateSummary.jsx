// src/components/EstimateSummary/EstimateSummary.jsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faArrowLeft, faEnvelope, faRuler, faTools, faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CalculatorEngine } from '../Calculator/engine/CalculatorEngine';
import { getProject } from '../../services/projectService';
import { useWorkType } from '../../context/WorkTypeContext';
import styles from './EstimateSummary.module.css';
import logoImage from '../../assets/CompanyLogo.png';

export default function EstimateSummary() {
  const componentRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        navigate('/home/customers');
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const project = await getProject(id);
        if (!project || !project.customerInfo) {
          throw new Error('Project data is incomplete');
        }

        const normalizedCustomer = {
          firstName: project.customerInfo.firstName || '',
          lastName: project.customerInfo.lastName || '',
          street: project.customerInfo.street || '',
          unit: project.customerInfo.unit || '',
          state: project.customerInfo.state || 'IL',
          zipCode: project.customerInfo.zipCode || '',
          phone: project.customerInfo.phone || '',
          email: project.customerInfo.email || '',
          projectName: project.customerInfo.projectName || '',
          type: project.customerInfo.type || 'Residential',
          paymentType: project.customerInfo.paymentType || 'Cash',
          startDate: project.customerInfo.startDate
            ? new Date(project.customerInfo.startDate).toISOString().split('T')[0]
            : '',
          finishDate: project.customerInfo.finishDate
            ? new Date(project.customerInfo.finishDate).toISOString().split('T')[0]
            : '',
          notes: project.customerInfo.notes || '',
        };

        setCustomer(normalizedCustomer);
        setCategories(Array.isArray(project.categories) ? project.categories : []);
        setSettings(project.settings || {
          taxRate: 0,
          transportationFee: 0,
          wasteFactor: 0,
          miscFees: [],
          deposit: 0,
          depositDate: '',
          depositMethod: '',
          payments: [],
          markup: 0,
          laborDiscount: 0,
        });
      } catch (err) {
        console.error('Error loading project:', err);
        setError('Failed to load project data');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id, navigate]);

  // Initialize calculator engine
  const calculatorEngine = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0 || !settings) {
      return null;
    }
    
    if (!getMeasurementType || !isValidSubtype || !getWorkTypeDetails) {
      console.warn('Work type functions not available');
      return null;
    }
    
    try {
      return new CalculatorEngine(categories, settings, {
        getMeasurementType,
        isValidSubtype,
        getWorkTypeDetails
      });
    } catch (error) {
      console.error('Failed to initialize CalculatorEngine:', error);
      return null;
    }
  }, [categories, settings, getMeasurementType, isValidSubtype, getWorkTypeDetails]);

  // Calculate category breakdowns
  const categoryBreakdowns = useMemo(() => {
    if (!calculatorEngine) {
      return [];
    }
    
    try {
      const result = calculatorEngine.calculateCategoryBreakdowns();
      if (result && Array.isArray(result.breakdowns)) {
        return result.breakdowns;
      }
      return [];
    } catch (error) {
      console.error('Error calculating category breakdowns:', error);
      return [];
    }
  }, [calculatorEngine]);

  // Calculate detailed breakdowns (like CostBreakdown component)
  const { materialBreakdown, laborBreakdown } = useMemo(() => {
    if (!calculatorEngine || !categories.length) {
      return { materialBreakdown: [], laborBreakdown: [] };
    }
    
    try {
      const materialItems = [];
      const laborItems = [];

      categories.forEach((category) => {
        (category.workItems || []).forEach((item) => {
          try {
            const { units } = calculatorEngine.calculateWorkUnits(item);
            const { materialCost, laborCost } = calculatorEngine.calculateWorkCost(item);

            const unitLabel = item.measurementType === 'linear-foot' ? 'linear ft' :
                             item.measurementType === 'by-unit' ? 'units' : 'sqft';

            if (parseFloat(materialCost) > 0) {
              materialItems.push({
                item: item.name,
                category: category.name,
                type: item.type,
                subtype: item.subtype || '',
                quantity: units,
                unitType: unitLabel,
                costPerUnit: (parseFloat(item.materialCost) || 0).toFixed(2),
                total: materialCost,
                units
              });
            }

            if (parseFloat(laborCost) > 0) {
              laborItems.push({
                item: item.name,
                category: category.name,
                type: item.type,
                subtype: item.subtype || '',
                quantity: units,
                unitType: unitLabel,
                costPerUnit: (parseFloat(item.laborCost) || 0).toFixed(2),
                total: laborCost,
                units
              });
            }
          } catch (error) {
            console.error('Error processing item for breakdown:', error);
          }
        });
      });

      return { 
        materialBreakdown: materialItems,
        laborBreakdown: laborItems
      };
    } catch (error) {
      console.error('Error calculating detailed breakdowns:', error);
      return { materialBreakdown: [], laborBreakdown: [] };
    }
  }, [calculatorEngine, categories]);

  // Calculate totals
  const totals = useMemo(() => {
    const defaultTotals = {
      materialCost: '0.00',
      laborCost: '0.00',
      laborCostBeforeDiscount: '0.00',
      laborDiscount: '0.00',
      wasteCost: '0.00',
      taxAmount: '0.00',
      markupAmount: '0.00',
      miscFeesTotal: '0.00',
      transportationFee: '0.00',
      subtotal: '0.00',
      total: '0.00',
    };

    if (!calculatorEngine) {
      return defaultTotals;
    }
    
    try {
      const result = calculatorEngine.calculateTotals();
      if (result) {
        const { errors, ...totalsData } = result;
        return { ...defaultTotals, ...totalsData };
      }
      return defaultTotals;
    } catch (error) {
      console.error('Error calculating totals:', error);
      return defaultTotals;
    }
  }, [calculatorEngine]);

  // Calculate payment details
  const paymentDetails = useMemo(() => {
    const defaultPayments = { totalPaid: 0, totalDue: 0, overduePayments: 0 };

    if (!calculatorEngine) {
      return defaultPayments;
    }
    
    try {
      const result = calculatorEngine.calculatePaymentDetails();
      if (result) {
        return {
          totalPaid: parseFloat(result.totalPaid) || 0,
          totalDue: parseFloat(result.totalDue) || 0,
          overduePayments: parseFloat(result.overduePayments) || 0,
        };
      }
      return defaultPayments;
    } catch (error) {
      console.error('Error calculating payment details:', error);
      return defaultPayments;
    }
  }, [calculatorEngine]);

  // Safe numeric parsing
  const miscFeesTotal = useMemo(() => {
    return parseFloat(totals.miscFeesTotal) || 0;
  }, [totals.miscFeesTotal]);

  const baseMaterialCost = parseFloat(totals.materialCost) || 0;
  const baseLaborCost = parseFloat(totals.laborCost) || 0;
  const laborDiscount = parseFloat(totals.laborDiscount) || 0;
  const preDiscountLaborCost = parseFloat(totals.laborCostBeforeDiscount) || 0;
  const baseSubtotal = parseFloat(totals.subtotal) || 0;
  const wasteCost = parseFloat(totals.wasteCost) || 0;
  const taxAmount = parseFloat(totals.taxAmount) || 0;
  const markupAmount = parseFloat(totals.markupAmount) || 0;
  const transportationFee = parseFloat(totals.transportationFee) || 0;
  const grandTotal = parseFloat(totals.total) || 0;
  
  const depositAmount = settings?.deposit || 0;
  const adjustedGrandTotal = Math.max(0, grandTotal - depositAmount);
  const remainingBalance = Math.max(0, adjustedGrandTotal - paymentDetails.totalPaid);
  const overpayment = paymentDetails.totalPaid > adjustedGrandTotal ? paymentDetails.totalPaid - adjustedGrandTotal : 0;

  // Utility functions
  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const generatePDF = async () => {
    if (!componentRef.current) throw new Error('Component not ready for PDF generation.');

    const element = componentRef.current;
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.width = '595px';
    element.style.padding = '8mm'; // Reduced padding for more content space
    element.style.boxSizing = 'border-box';

    const sections = element.querySelectorAll(`.${styles.section}`);
    sections.forEach((section, index) => {
      section.style.pageBreakInside = 'avoid';
      section.style.marginBottom = index < sections.length - 1 ? '6mm' : '0';
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      width: element.offsetWidth,
      height: element.scrollHeight,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    // Reset styles
    element.style.display = '';
    element.style.visibility = '';
    element.style.width = '';
    element.style.padding = '';

    return pdf;
  };

  const handlePrintClick = async () => {
    if (!customer || !Array.isArray(categories) || categories.length === 0) {
      alert('Nothing to print. Please ensure project data is loaded.');
      return;
    }

    setIsPrinting(true);
    try {
      const pdf = await generatePDF();
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl);
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(pdfUrl);
        };
      };
    } catch (error) {
      console.error('Error during printing:', error);
      alert('Error: Unable to print. Check console for details.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!customer?.email) {
      alert('Customer email is required to send the estimate.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const pdf = await generatePDF();
      const pdfName = `Estimate_${customer.projectName || 'Summary'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(pdfName);

      const subject = encodeURIComponent(`Project Estimate - ${customer.projectName || 'Your Project'}`);
      const body = encodeURIComponent(`Dear ${customer.firstName} ${customer.lastName},\n\nPlease find attached your detailed project estimate.\n\nBest regards,\nRawdah Remodeling Company`);
      const gmailUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodeURIComponent(customer.email)}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');

      alert('PDF downloaded successfully! Please attach the downloaded PDF to the email.');
    } catch (error) {
      console.error('Error preparing email:', error);
      alert('Error: Unable to prepare email. Check console for details.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Loading and error states
  if (loading) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading project data...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <div className={styles.errorContainer}>
            <h3>Error Loading Project</h3>
            <p>{error}</p>
            <button onClick={() => navigate('/home/customers')} className={styles.backButton}>
              <FontAwesomeIcon icon={faArrowLeft} /> Back to Customers
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>No customer data available</div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mainContent}>
      <div className={styles.container}>
        <header className={styles.headerSection}>
          <h1 className={styles.title}>Professional Estimate</h1>
          <div className={styles.actionButtons}>
            <button
              onClick={handlePrintClick}
              className={styles.actionButton}
              disabled={isPrinting}
              title={isPrinting ? 'Printing in progress' : 'Print Estimate'}
            >
              <FontAwesomeIcon icon={faPrint} className={styles.icon} />
              {isPrinting ? 'Printing...' : 'Print'}
            </button>
            <button
              onClick={handleSendEmail}
              className={styles.actionButton}
              disabled={isSendingEmail || !customer?.email}
              title={isSendingEmail ? 'Preparing Email' : 'Send Estimate by Email'}
            >
              <FontAwesomeIcon icon={faEnvelope} className={styles.icon} />
              {isSendingEmail ? 'Emailing...' : 'Email'}
            </button>
            <button
              onClick={() => navigate('/home/customers')}
              className={styles.actionButton}
              title="Back to Customers"
            >
              <FontAwesomeIcon icon={faArrowLeft} className={styles.icon} />
              Back
            </button>
          </div>
        </header>

        <div className={styles.document} ref={componentRef}>
          {/* Header Section */}
          <header className={styles.documentHeader}>
            <div className={styles.companyHeader}>
              <div className={styles.logoContainer}>
                <img src={logoImage} alt="Rawdah Remodeling Logo" className={styles.logo} />
              </div>
              <div className={styles.companyInfo}>
                <h2 className={styles.companyName}>RAWDAH REMODELING COMPANY</h2>
                <div className={styles.contactInfo}>
                  <p className={styles.address}>Lake in the Hills, IL 60156</p>
                  <p className={styles.contact}><FontAwesomeIcon icon={faDollarSign} className={styles.contactIcon} /> (224) 817-3264</p>
                  <p className={styles.contact}><FontAwesomeIcon icon={faEnvelope} className={styles.contactIcon} /> rawdahremodeling@gmail.com</p>
                </div>
              </div>
            </div>

            <div className={styles.projectHeader}>
              <h1 className={styles.projectTitle}>DETAILED PROJECT ESTIMATE</h1>
              <div className={styles.projectNumber}>Project # {id}</div>
              <div className={styles.dateInfo}>
                <span>Generated: {new Date().toLocaleDateString()}</span>
                <span>Valid for 30 days</span>
              </div>
            </div>
          </header>

          {/* Customer Information - Two Column Layout */}
          <section className={styles.customerSection}>
            <div className={styles.sectionHeader}>
              <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Customer & Project Information</h3>
            </div>
            
            <div className={styles.infoGrid}>
              <div className={styles.infoColumn}>
                <div className={styles.infoGroup}>
                  <h4 className={styles.infoHeader}>Customer Details</h4>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Name:</span>
                    <span className={styles.value}>{customer.firstName} {customer.lastName}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Address:</span>
                    <span className={styles.value}>{customer.street}{customer.unit ? `, Unit ${customer.unit}` : ''}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>City/State:</span>
                    <span className={styles.value}>{customer.state} {customer.zipCode}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Phone:</span>
                    <span className={styles.value}>{customer.phone || 'N/A'}</span>
                  </div>
                  {customer.email && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Email:</span>
                      <span className={styles.value}>{customer.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.infoColumn}>
                <div className={styles.infoGroup}>
                  <h4 className={styles.infoHeader}>Project Details</h4>
                  {customer.projectName && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>Project:</span>
                      <span className={styles.value}>{customer.projectName}</span>
                    </div>
                  )}
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Type:</span>
                    <span className={styles.value}>{customer.type}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Payment:</span>
                    <span className={styles.value}>{customer.paymentType}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Start Date:</span>
                    <span className={styles.value}>{formatDate(customer.startDate)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Est. Finish:</span>
                    <span className={styles.value}>{formatDate(customer.finishDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Category Breakdown */}
          {Array.isArray(categoryBreakdowns) && categoryBreakdowns.length > 0 && (
            <section className={styles.categorySection}>
              <div className={styles.sectionHeader}>
                <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Category Cost Summary</h3>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.summaryTable} aria-label="Category Cost Summary">
                  <thead>
                    <tr>
                      <th scope="col" className={styles.tableHeader}>Category</th>
                      <th scope="col" className={styles.tableHeader}>Items</th>
                      <th scope="col" className={styles.tableHeader}>Material Cost</th>
                      <th scope="col" className={styles.tableHeader}>Labor Cost</th>
                      <th scope="col" className={styles.tableHeader}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdowns.map((cat, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableCell}>{cat.name || 'Unnamed Category'}</td>
                        <td className={styles.tableCell}>{cat.itemCount || 0}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(parseFloat(cat.materialCost) || 0)}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(parseFloat(cat.laborCost) || 0)}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(parseFloat(cat.subtotal) || 0)}</td>
                      </tr>
                    ))}
                    <tr className={styles.tableTotalRow}>
                      <td className={styles.tableCell}><strong>TOTAL</strong></td>
                      <td className={styles.tableCell}><strong>{categoryBreakdowns.reduce((sum, cat) => sum + (cat.itemCount || 0), 0)}</strong></td>
                      <td className={styles.tableCellRight}><strong>{formatCurrency(baseMaterialCost)}</strong></td>
                      <td className={styles.tableCellRight}><strong>{formatCurrency(preDiscountLaborCost)}</strong></td>
                      <td className={styles.tableCellRight}><strong>{formatCurrency(baseSubtotal)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Detailed Material Breakdown */}
          {Array.isArray(materialBreakdown) && materialBreakdown.length > 0 && (
            <section className={styles.detailSection}>
              <div className={styles.sectionHeader}>
                <FontAwesomeIcon icon={faRuler} className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Material Cost Details</h3>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.detailTable} aria-label="Material Cost Breakdown">
                  <thead>
                    <tr>
                      <th scope="col" className={styles.tableHeader}>Category</th>
                      <th scope="col" className={styles.tableHeader}>Item Description</th>
                      <th scope="col" className={styles.tableHeader}>Qty</th>
                      <th scope="col" className={styles.tableHeader}>Unit</th>
                      <th scope="col" className={styles.tableHeader}>Unit Cost</th>
                      <th scope="col" className={styles.tableHeader}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialBreakdown.map((item, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableCell}>{item.category || 'N/A'}</td>
                        <td className={styles.tableCell}>
                          <div className={styles.itemDescription}>
                            <div className={styles.itemName}>{item.item || 'Unnamed Item'}</div>
                            <div className={styles.itemType}>
                              {item.type && <span>{item.type}</span>}
                              {item.subtype && <span className={styles.subtype}>- {item.subtype}</span>}
                            </div>
                          </div>
                        </td>
                        <td className={styles.tableCellRight}>{(item.quantity || 0).toFixed(2)}</td>
                        <td className={styles.tableCell}>{item.unitType || 'units'}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(item.costPerUnit || 0)}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(item.total || 0)}</td>
                      </tr>
                    ))}
                    <tr className={styles.tableTotalRow}>
                      <td colSpan={5} className={styles.tableCell}><strong>TOTAL MATERIAL COST</strong></td>
                      <td className={styles.tableCellRight}><strong>{formatCurrency(baseMaterialCost)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Detailed Labor Breakdown */}
          {Array.isArray(laborBreakdown) && laborBreakdown.length > 0 && (
            <section className={styles.detailSection}>
              <div className={styles.sectionHeader}>
                <FontAwesomeIcon icon={faTools} className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Labor Cost Details</h3>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.detailTable} aria-label="Labor Cost Breakdown">
                  <thead>
                    <tr>
                      <th scope="col" className={styles.tableHeader}>Category</th>
                      <th scope="col" className={styles.tableHeader}>Item Description</th>
                      <th scope="col" className={styles.tableHeader}>Qty</th>
                      <th scope="col" className={styles.tableHeader}>Unit</th>
                      <th scope="col" className={styles.tableHeader}>Unit Cost</th>
                      <th scope="col" className={styles.tableHeader}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborBreakdown.map((item, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableCell}>{item.category || 'N/A'}</td>
                        <td className={styles.tableCell}>
                          <div className={styles.itemDescription}>
                            <div className={styles.itemName}>{item.item || 'Unnamed Item'}</div>
                            <div className={styles.itemType}>
                              {item.type && <span>{item.type}</span>}
                              {item.subtype && <span className={styles.subtype}>- {item.subtype}</span>}
                            </div>
                          </div>
                        </td>
                        <td className={styles.tableCellRight}>{(item.quantity || 0).toFixed(2)}</td>
                        <td className={styles.tableCell}>{item.unitType || 'units'}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(item.costPerUnit || 0)}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(item.total || 0)}</td>
                      </tr>
                    ))}
                    <tr className={styles.tableTotalRow}>
                      <td colSpan={5} className={styles.tableCell}><strong>TOTAL LABOR COST</strong></td>
                      <td className={styles.tableCellRight}><strong>{formatCurrency(preDiscountLaborCost)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Cost Calculation Summary */}
          <section className={styles.calculationSection}>
            <div className={styles.sectionHeader}>
              <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Cost Calculation Summary</h3>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.calculationTable} aria-label="Cost Calculation Summary">
                <tbody>
                  <tr className={styles.calculationRow}>
                    <td className={styles.calculationLabel}>Base Material Cost</td>
                    <td className={styles.calculationValue}>{formatCurrency(baseMaterialCost)}</td>
                  </tr>
                  <tr className={styles.calculationRow}>
                    <td className={styles.calculationLabel}>Base Labor Cost</td>
                    <td className={styles.calculationValue}>{formatCurrency(preDiscountLaborCost)}</td>
                  </tr>
                  {laborDiscount > 0 && (
                    <tr className={styles.discountRow}>
                      <td className={styles.calculationLabel}>
                        Labor Discount ({((settings?.laborDiscount || 0) * 100).toFixed(1)}%)
                      </td>
                      <td className={styles.calculationValueNegative}>-{formatCurrency(laborDiscount)}</td>
                    </tr>
                  )}
                  <tr className={styles.subtotalRow}>
                    <td className={styles.calculationLabel}><strong>Base Subtotal</strong></td>
                    <td className={styles.calculationValue}><strong>{formatCurrency(baseSubtotal)}</strong></td>
                  </tr>
                  {wasteCost > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>
                        Waste Factor ({((settings?.wasteFactor || 0) * 100).toFixed(1)}%)
                      </td>
                      <td className={styles.calculationValue}>{formatCurrency(wasteCost)}</td>
                    </tr>
                  )}
                  {taxAmount > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>
                        Sales Tax ({((settings?.taxRate || 0) * 100).toFixed(1)}%)
                      </td>
                      <td className={styles.calculationValue}>{formatCurrency(taxAmount)}</td>
                    </tr>
                  )}
                  {markupAmount > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>
                        Profit Markup ({((settings?.markup || 0) * 100).toFixed(1)}%)
                      </td>
                      <td className={styles.calculationValue}>{formatCurrency(markupAmount)}</td>
                    </tr>
                  )}
                  {transportationFee > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>Transportation Fee</td>
                      <td className={styles.calculationValue}>{formatCurrency(transportationFee)}</td>
                    </tr>
                  )}
                  {miscFeesTotal > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>Miscellaneous Fees</td>
                      <td className={styles.calculationValue}>{formatCurrency(miscFeesTotal)}</td>
                    </tr>
                  )}
                  <tr className={styles.grandTotalRow}>
                    <td className={styles.calculationLabel}><strong>PROJECT TOTAL</strong></td>
                    <td className={styles.grandTotalValue}><strong>{formatCurrency(grandTotal)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Payment Summary */}
          <section className={styles.paymentSection}>
            <div className={styles.sectionHeader}>
              <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Payment Summary</h3>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.paymentTable} aria-label="Payment Summary">
                <tbody>
                  <tr className={styles.paymentRow}>
                    <td className={styles.paymentLabel}>Project Total</td>
                    <td className={styles.paymentValue}>{formatCurrency(grandTotal)}</td>
                  </tr>
                  {depositAmount > 0 && (
                    <tr className={styles.paymentRow}>
                      <td className={styles.paymentLabel}>Less: Deposit</td>
                      <td className={styles.paymentValueNegative}>-{formatCurrency(depositAmount)}</td>
                    </tr>
                  )}
                  <tr className={styles.paymentRow}>
                    <td className={styles.paymentLabel}><strong>Amount Due</strong></td>
                    <td className={styles.paymentValue}><strong>{formatCurrency(adjustedGrandTotal)}</strong></td>
                  </tr>
                  {paymentDetails.totalPaid > 0 && (
                    <tr className={styles.paymentRow}>
                      <td className={styles.paymentLabel}>Less: Payments Made</td>
                      <td className={styles.paymentValueNegative}>-{formatCurrency(paymentDetails.totalPaid)}</td>
                    </tr>
                  )}
                  <tr className={styles.balanceRow}>
                    <td className={styles.paymentLabel}><strong>BALANCE DUE</strong></td>
                    <td className={styles.balanceValue}>
                      <strong className={remainingBalance > 0 ? styles.balanceDue : styles.balancePaid}>
                        {formatCurrency(remainingBalance)}
                      </strong>
                    </td>
                  </tr>
                  {overpayment > 0 && (
                    <tr className={styles.paymentRow}>
                      <td className={styles.paymentLabel}><strong>CREDIT BALANCE</strong></td>
                      <td className={styles.paymentValuePositive}><strong>{formatCurrency(overpayment)}</strong></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Terms and Conditions */}
          <section className={styles.termsSection}>
            <div className={styles.sectionHeader}>
              <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Terms & Conditions</h3>
            </div>
            <div className={styles.termsContent}>
              <div className={styles.termsItem}>
                <strong>Payment Schedule:</strong> 50% deposit due upon contract signing, 30% upon material delivery, 20% upon project completion.
              </div>
              <div className={styles.termsItem}>
                <strong>Materials:</strong> All materials subject to availability and price changes. Substitutions may be made with customer approval.
              </div>
              <div className={styles.termsItem}>
                <strong>Warranty:</strong> 1-year workmanship warranty. Material warranties per manufacturer specifications.
              </div>
              <div className={styles.termsItem}>
                <strong>Changes:</strong> Any changes to scope of work may result in additional charges. Written change orders required.
              </div>
              <div className={styles.termsItem}>
                <strong>Acceptance:</strong> This estimate is valid for 30 days. Work to commence upon receipt of signed contract and deposit.
              </div>
            </div>
          </section>

          {/* Project Notes */}
          {customer.notes && (
            <section className={styles.notesSection}>
              <div className={styles.sectionHeader}>
                <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Special Instructions</h3>
              </div>
              <div className={styles.notesContent}>
                <p>{customer.notes}</p>
              </div>
            </section>
          )}

          {/* Authorization */}
          <section className={styles.authorizationSection}>
            <div className={styles.sectionHeader}>
              <FontAwesomeIcon icon={faDollarSign} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Authorization & Acceptance</h3>
            </div>
            <div className={styles.authorizationContent}>
              <p className={styles.authorizationText}>
                By signing below, I/We acknowledge that I/We have read and agree to the terms and conditions outlined above. 
                I/We authorize Rawdah Remodeling Company to proceed with the work described at the total contract price of{' '}
                <strong className={styles.contractAmount}>{formatCurrency(grandTotal)}</strong>.
              </p>
              
              <div className={styles.signatureContainer}>
                <div className={styles.signatureLine}>
                  <span className={styles.signatureLabel}>Customer Signature:</span>
                  <div className={styles.signatureBox}>_______________________________</div>
                  <span className={styles.signatureDate}>Date: _______________</span>
                </div>
                <div className={styles.signatureLine}>
                  <span className={styles.signatureLabel}>Printed Name:</span>
                  <div className={styles.signatureBox}>_______________________________</div>
                </div>
              </div>
              
              <div className={styles.contractorSignature}>
                <div className={styles.signatureLine}>
                  <span className={styles.signatureLabel}>Contractor Signature:</span>
                  <div className={styles.signatureBox}>_______________________________</div>
                  <span className={styles.signatureDate}>Date: _______________</span>
                </div>
                <p className={styles.contractorName}>Rawdah Remodeling Company Representative</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className={styles.documentFooter}>
            <div className={styles.footerContent}>
              <p className={styles.footerText}>Thank you for choosing Rawdah Remodeling Company</p>
              <p className={styles.footerTextSmall}>
                This document was generated electronically and serves as your official estimate. 
                For questions, please contact us at (224) 817-3264.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}