//src/components/EstimateSummary/EstimateSummary.jsx
import { useRef, useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faArrowLeft, faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons';
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
  const [customer, setCustomer] = useState(null);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  const { getMeasurementType, isValidSubtype, getWorkTypeDetails } = useWorkType();

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'N/A';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numValue);
  };

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
          wasteEntries: [],
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

  const wasteEntriesTotal = useMemo(() => {
    const wasteEntries = settings?.wasteEntries || [];
    return wasteEntries.reduce((total, entry) => {
      const surfaceCost = parseFloat(entry.surfaceCost) || 0;
      const wasteFactor = parseFloat(entry.wasteFactor) || 0;
      return total + (surfaceCost * wasteFactor);
    }, 0);
  }, [settings?.wasteEntries]);

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
                quantity: units,
                unitType: unitLabel,
                costPerUnit: parseFloat(item.materialCost) || 0,
                total: materialCost,
              });
            }

            if (parseFloat(laborCost) > 0) {
              laborItems.push({
                item: item.name,
                category: category.name,
                description: item.description || '',
                quantity: units,
                unitType: unitLabel,
                costPerUnit: parseFloat(item.laborCost) || 0,
                total: laborCost,
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

  const miscFeesTotal = useMemo(() => {
    return parseFloat(totals.miscFeesTotal) || 0;
  }, [totals.miscFeesTotal]);

  const baseMaterialCost = parseFloat(totals.materialCost) || 0;
  const baseLaborCost = parseFloat(totals.laborCost) || 0;
  const laborDiscount = parseFloat(totals.laborDiscount) || 0;
  const baseSubtotal = parseFloat(totals.subtotal) || 0;
  const taxAmount = parseFloat(totals.taxAmount) || 0;
  const markupAmount = parseFloat(totals.markupAmount) || 0;
  const transportationFee = parseFloat(totals.transportationFee) || 0;
  const grandTotal = parseFloat(totals.total) || 0;
  
  const depositAmount = settings?.deposit || 0;
  const adjustedGrandTotal = Math.max(0, grandTotal - depositAmount);
  const remainingBalance = Math.max(0, adjustedGrandTotal - paymentDetails.totalPaid);
  const overpayment = paymentDetails.totalPaid > adjustedGrandTotal ? paymentDetails.totalPaid - adjustedGrandTotal : 0;

  const wasteEntries = settings?.wasteEntries || [];

  const toggleDescription = (index, type) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [`${type}-${index}`]: !prev[`${type}-${index}`]
    }));
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const canvas = await html2canvas(componentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Estimate_${id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) {
    return <div className={styles.loadingSpinner}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!customer) {
    return <div className={styles.error}>No project data available</div>;
  }

  return (
    <main className={styles.mainContent}>
      <div className={styles.headerSection}>
        <h1 className={styles.title}>Detailed Project Estimate</h1>
        <div className={styles.actionButtons}>
          <button
            className={styles.actionButton}
            onClick={() => navigate('/home/customers')}
            disabled={isPrinting}
          >
            <FontAwesomeIcon icon={faArrowLeft} className={styles.icon} />
            Back to Customers
          </button>
          <button
            className={styles.actionButton}
            onClick={handlePrint}
            disabled={isPrinting}
          >
            <FontAwesomeIcon icon={faPrint} className={styles.icon} />
            {isPrinting ? 'Generating PDF...' : 'Print Estimate'}
          </button>
        </div>
        <p className={styles.printInstructions}>
          Use your browser's print function for a quick preview or download as PDF
        </p>
      </div>

      <div className={styles.container} ref={componentRef}>
        <div className={styles.document}>
          <header className={styles.documentHeader}>
            <div className={styles.companyHeader}>
              <div className={styles.logoContainer}>
                <img src={logoImage} alt="Company Logo" className={styles.logo} />
              </div>
              <div className={styles.companyInfo}>
                <h2 className={styles.companyName}>Rawdah Remodeling Company</h2>
                <div className={styles.contactInfo}>
                  <p className={styles.address}>
                    1234 Example St, Suite 567, Chicago, IL 60601
                  </p>
                  <p className={styles.contact}>
                    <FontAwesomeIcon icon={faPhone} /> (224) 817-3264
                  </p>
                  <p className={styles.contact}>
                    <FontAwesomeIcon icon={faEnvelope} /> info@rawdahremodeling.com
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.projectHeader}>
              <h3 className={styles.projectTitle}>{customer.projectName || 'Project Estimate'}</h3>
              <p className={styles.projectNumber}>Estimate #{id}</p>
              <div className={styles.dateInfo}>
                <span>Estimate Date: {new Date().toLocaleDateString()}</span>
                <span className={styles.separator}>|</span>
                <span>Valid Until: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString()}</span>
              </div>
            </div>
          </header>

          <section className={styles.customerSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Customer Information</h3>
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoColumn}>
                <div className={styles.infoGroup}>
                  <h4 className={styles.infoHeader}>Customer Details</h4>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Name:</span>
                    <span className={styles.value}>
                      {customer.firstName} {customer.lastName}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Phone:</span>
                    <span className={styles.value}>{formatPhoneNumber(customer.phone)}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Email:</span>
                    <span className={styles.value}>{customer.email || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className={styles.infoColumn}>
                <div className={styles.infoGroup}>
                  <h4 className={styles.infoHeader}>Project Details</h4>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Address:</span>
                    <span className={styles.value}>
                      {customer.street}
                      {customer.unit ? `, ${customer.unit}` : ''}, {customer.state} {customer.zipCode}
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Type:</span>
                    <span className={styles.value}>{customer.type}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Payment:</span>
                    <span className={styles.value}>{customer.paymentType}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Start:</span>
                    <span className={styles.value}>{customer.startDate || 'TBD'}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>Finish:</span>
                    <span className={styles.value}>{customer.finishDate || 'TBD'}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {categoryBreakdowns.length > 0 && (
            <section className={styles.categorySection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Category Summary</h3>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.summaryTable} aria-label="Category Summary">
                  <thead>
                    <tr>
                      <th className={styles.tableHeader}>Category</th>
                      <th className={styles.tableHeader}>Items</th>
                      <th className={styles.tableHeader}>Material Cost</th>
                      <th className={styles.tableHeader}>Labor Cost</th>
                      <th className={styles.tableHeader}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdowns.map((category, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableCell}>{category.name}</td>
                        <td className={styles.tableCell}>{category.itemCount}</td>
                        <td className={styles.tableCell}>{formatCurrency(category.materialCost)}</td>
                        <td className={styles.tableCell}>{formatCurrency(category.laborCost)}</td>
                        <td className={styles.tableCellRight}>{formatCurrency(category.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className={styles.tableTotalRow}>
                      <td className={styles.tableCell}>Total</td>
                      <td className={styles.tableCell}>
                        {categoryBreakdowns.reduce((sum, cat) => sum + cat.itemCount, 0)}
                      </td>
                      <td className={styles.tableCell}>{formatCurrency(baseMaterialCost)}</td>
                      <td className={styles.tableCell}>{formatCurrency(baseLaborCost)}</td>
                      <td className={styles.tableCellRight}>{formatCurrency(baseSubtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Detailed Cost Breakdown</h3>
            </div>
            <div className={styles.tableContainer}>
              {materialBreakdown.length > 0 && (
                <>
                  <h4 className={styles.sectionTitle}>Material Costs</h4>
                  <table className={styles.detailTable} aria-label="Material Cost Breakdown">
                    <thead>
                      <tr>
                        <th className={styles.tableHeader}>Item</th>
                        <th className={styles.tableHeader}>Category</th>
                        <th className={styles.tableHeader}>Quantity</th>
                        <th className={styles.tableHeader}>Unit Cost</th>
                        <th className={styles.tableHeader}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialBreakdown.map((item, index) => (
                        <tr key={index} className={styles.tableRow}>
                          <td className={styles.tableCell}>{item.item}</td>
                          <td className={styles.tableCell}>{item.category}</td>
                          <td className={styles.tableCell}>
                            {(item.quantity || 0).toFixed(2)} {item.unitType}
                          </td>
                          <td className={styles.tableCell}>{formatCurrency(item.costPerUnit)}</td>
                          <td className={styles.tableCellRight}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {laborBreakdown.length > 0 && (
                <>
                  <h4 className={styles.sectionTitle}>Labor Costs</h4>
                  <table className={styles.detailTable} aria-label="Labor Cost Breakdown">
                    <thead>
                      <tr>
                        <th className={styles.tableHeader}>Item</th>
                        <th className={styles.tableHeader}>Category</th>
                        <th className={styles.tableHeader}>Description</th>
                        <th className={styles.tableHeader}>Quantity</th>
                        <th className={styles.tableHeader}>Unit Cost</th>
                        <th className={styles.tableHeader}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laborBreakdown.map((item, index) => (
                        <tr key={index} className={styles.tableRow}>
                          <td className={styles.tableCell}>{item.item}</td>
                          <td className={styles.tableCell}>{item.category}</td>
                          <td className={styles.descriptionCell}>
                            <span 
                              className={styles.descriptionText} 
                              title={item.description || 'No description'}
                            >
                              {expandedDescriptions[`labor-${index}`] || item.description.length <= 50 
                                ? item.description || '-' 
                                : `${item.description.slice(0, 50)}...`}
                            </span>
                            {item.description.length > 50 && (
                              <button
                                className={styles.toggleDescriptionButton}
                                onClick={() => toggleDescription(index, 'labor')}
                              >
                                {expandedDescriptions[`labor-${index}`] ? 'Less' : 'More'}
                              </button>
                            )}
                          </td>
                          <td className={styles.tableCell}>
                            {(item.quantity || 0).toFixed(2)} {item.unitType}
                          </td>
                          <td className={styles.tableCell}>{formatCurrency(item.costPerUnit)}</td>
                          <td className={styles.tableCellRight}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </section>

          <section className={styles.calculationSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Cost Calculation</h3>
            </div>
            <div className={styles.tableContainer}>
              <table className={styles.calculationTable} aria-label="Cost Calculation">
                <tbody>
                  <tr className={styles.calculationRow}>
                    <td className={styles.calculationLabel}>Base Material Cost</td>
                    <td className={styles.calculationValue}>{formatCurrency(baseMaterialCost)}</td>
                  </tr>
                  <tr className={styles.calculationRow}>
                    <td className={styles.calculationLabel}>Base Labor Cost</td>
                    <td className={styles.calculationValue}>{formatCurrency(baseLaborCost)}</td>
                  </tr>
                  {laborDiscount > 0 && (
                    <tr className={styles.calculationRow}>
                      <td className={styles.calculationLabel}>Less: Labor Discount</td>
                      <td className={styles.calculationValueNegative}>-{formatCurrency(laborDiscount)}</td>
                    </tr>
                  )}
                  <tr className={styles.subtotalRow}>
                    <td className={styles.calculationLabel}><strong>Base Subtotal</strong></td>
                    <td className={styles.calculationValue}><strong>{formatCurrency(baseSubtotal)}</strong></td>
                  </tr>
                  {wasteEntries.length > 0 && (
                    <>
                      <tr className={styles.calculationRow}>
                        <td className={styles.calculationLabel}>Waste Factor by Surface:</td>
                        <td className={styles.calculationValue}>{formatCurrency(wasteEntriesTotal)}</td>
                      </tr>
                      {wasteEntries.map((entry, index) => {
                        const surfaceCost = parseFloat(entry.surfaceCost) || 0;
                        const wasteFactor = parseFloat(entry.wasteFactor) || 0;
                        const wasteCost = surfaceCost * wasteFactor;
                        
                        return (
                          <tr key={index} className={styles.calculationSubRow}>
                            <td className={styles.calculationSubLabel}>
                              • {entry.surfaceName} (${surfaceCost.toFixed(2)} × {(wasteFactor * 100).toFixed(0)}%)
                            </td>
                            <td className={styles.calculationSubValue}>{formatCurrency(wasteCost)}</td>
                          </tr>
                        );
                      })}
                    </>
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

          <section className={styles.paymentSection}>
            <div className={styles.sectionHeader}>
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

          <section className={styles.termsSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Terms & Conditions</h3>
            </div>
            <div className={styles.termsContent}>
              <div className={styles.termsItem}>
                <strong>Payment Schedule:</strong> A 50% deposit is required upon contract signing to initiate the project. An additional 30% is due upon delivery of materials to the project site, as confirmed by the project manager. The remaining 20% is payable upon satisfactory completion of the project, subject to final inspection and client approval. Payments align with the agreed project schedule, and material delivery will be coordinated to minimize delays, subject to supplier availability.
              </div>
              <div className={styles.termsItem}>
                <strong>Payment Policy:</strong> We accept payments via checks, QuickPay, Zelle, and all major credit and debit cards. A 4% processing fee will be applied to all credit and debit card transactions. Materials will not be released or delivered to the project site until the corresponding payment has been fully cleared, without exception. All payments must be made in accordance with the agreed payment schedule to ensure timely project progression.
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

          {customer.notes && (
            <section className={styles.notesSection}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Special Instructions</h3>
              </div>
              <div className={styles.notesContent}>
                <p>{customer.notes}</p>
              </div>
            </section>
          )}

          <section className={styles.authorizationSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Authorization & Acceptance</h3>
            </div>
            <div className={styles.authorizationContent}>
              <p className={styles.authorizationText}>
                By signing below, I/We acknowledge that I/We have read and agree to the terms and conditions outlined above. 
                I/We authorize Rawdah Remodeling Company to proceed with the work described at the total contract price of{' '}
                <strong className={styles.contractAmount}>{formatCurrency(grandTotal)}</strong>.
              </p>
              <div className={styles.signatureContainer}>
                <div className={styles.signatureBlock}>
                  <div className={styles.signatureLabel}>Customer Signature:</div>
                  <div className={styles.signatureLine}></div>
                  <div className={styles.signatureInfo}>
                    <span>Printed Name: _______________________________</span>
                    <span>Date: _______________</span>
                  </div>
                </div>
                <div className={styles.signatureBlock}>
                  <div className={styles.signatureLabel}>Contractor Signature:</div>
                  <div className={styles.signatureLine}></div>
                  <div className={styles.signatureInfo}>
                    <span>Printed Name & Sign: _______________________________</span>
                    <span>Date: _______________</span>
                  </div>
                </div>
              </div>
              <p className={styles.contractorName}>Rawdah Remodeling Company Representative</p>
            </div>
          </section>

          <footer className={styles.documentFooter}>
            <div className={styles.footerContent}>
              <p className={styles.footerText}>Thank you for choosing Rawdah Remodeling Company</p>
              <p className={styles.footerTextSmall}>
                This document serves as your official estimate. For questions, contact us at (224) 817-3264.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}