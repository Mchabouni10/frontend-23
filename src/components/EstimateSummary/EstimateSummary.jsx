// src/components/EstimateSummary/EstimateSummary.jsx
import { useRef, useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faArrowLeft, faEnvelope, faPhone } from '@fortawesome/free-solid-svg-icons';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  
  // Separate deposit from other payments
  const depositPayment = settings?.payments?.find(p => p.method === 'Deposit') || null;
  const depositAmount = depositPayment ? parseFloat(depositPayment.amount) : 0;
  const otherPayments = settings?.payments?.filter(p => p.method !== 'Deposit' && p.isPaid) || [];
  const otherPaymentsTotal = otherPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  
  const adjustedGrandTotal = Math.max(0, grandTotal - depositAmount);
  const remainingBalance = Math.max(0, adjustedGrandTotal - otherPaymentsTotal);
  const overpayment = (depositAmount + otherPaymentsTotal) > grandTotal ? (depositAmount + otherPaymentsTotal - grandTotal) : 0;

  const wasteEntries = settings?.wasteEntries || [];
  const miscFees = settings?.miscFees || [];

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      const primaryColor = [0, 95, 115];
      const lightGray = [240, 240, 240];
      const darkGray = [51, 51, 51];

      const checkAddPage = (requiredSpace) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      try {
        pdf.addImage(logoImage, 'PNG', margin, yPosition, 20, 20);
      } catch (err) {
        console.warn('Logo not added to PDF:', err);
      }

      pdf.setFillColor(...primaryColor);
      pdf.rect(margin + 25, yPosition, pageWidth - 2 * margin - 25, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RAWDAH REMODELING COMPANY', margin + 30, yPosition + 7);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('1234 Example St, Suite 567, Chicago, IL 60601', margin + 30, yPosition + 12);
      pdf.text('(224) 817-3264 | info@rawdahremodeling.com', margin + 30, yPosition + 16);

      yPosition += 25;

      pdf.setFillColor(...lightGray);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 15, 'F');
      
      pdf.setTextColor(...darkGray);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(customer.projectName || 'Project Estimate', pageWidth / 2, yPosition + 6, { align: 'center' });
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Estimate #${id}`, pageWidth / 2, yPosition + 11, { align: 'center' });

      yPosition += 20;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...primaryColor);
      pdf.text('CUSTOMER INFORMATION', margin, yPosition);
      yPosition += 7;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Customer Details', 'Project Details']],
        body: [
          [
            `Name: ${customer.firstName} ${customer.lastName}\nPhone: ${formatPhoneNumber(customer.phone)}\nEmail: ${customer.email || 'N/A'}`,
            `Address: ${customer.street}${customer.unit ? `, ${customer.unit}` : ''}, ${customer.state} ${customer.zipCode}\nType: ${customer.type}\nPayment: ${customer.paymentType}\nStart: ${customer.startDate || 'TBD'}\nFinish: ${customer.finishDate || 'TBD'}`
          ]
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
        margin: { left: margin, right: margin }
      });

      yPosition = pdf.lastAutoTable.finalY + 10;

      if (categoryBreakdowns.length > 0) {
        checkAddPage(40);
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...primaryColor);
        pdf.text('CATEGORY SUMMARY', margin, yPosition);
        yPosition += 7;

        const categoryData = categoryBreakdowns.map(cat => [
          cat.name,
          cat.itemCount.toString(),
          formatCurrency(cat.materialCost),
          formatCurrency(cat.laborCost),
          formatCurrency(cat.subtotal)
        ]);

        categoryData.push([
          { content: 'TOTAL', styles: { fontStyle: 'bold' } },
          { content: categoryBreakdowns.reduce((sum, cat) => sum + cat.itemCount, 0).toString(), styles: { fontStyle: 'bold' } },
          { content: formatCurrency(baseMaterialCost), styles: { fontStyle: 'bold' } },
          { content: formatCurrency(baseLaborCost), styles: { fontStyle: 'bold' } },
          { content: formatCurrency(baseSubtotal), styles: { fontStyle: 'bold' } }
        ]);

        autoTable(pdf, {
          startY: yPosition,
          head: [['Category', 'Items', 'Material Cost', 'Labor Cost', 'Subtotal']],
          body: categoryData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 30 },
            3: { halign: 'right', cellWidth: 30 },
            4: { halign: 'right', cellWidth: 30 }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = pdf.lastAutoTable.finalY + 10;
      }

      if (materialBreakdown.length > 0) {
        checkAddPage(40);
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...primaryColor);
        pdf.text('MATERIAL COSTS', margin, yPosition);
        yPosition += 7;

        const materialData = materialBreakdown.map(item => [
          item.item,
          item.category,
          `${item.quantity.toFixed(2)} ${item.unitType}`,
          formatCurrency(item.total)
        ]);

        autoTable(pdf, {
          startY: yPosition,
          head: [['Item', 'Category', 'Quantity', 'Total']],
          body: materialData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40 },
            2: { halign: 'center', cellWidth: 35 },
            3: { halign: 'right', cellWidth: 35 }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = pdf.lastAutoTable.finalY + 10;
      }

      if (laborBreakdown.length > 0) {
        checkAddPage(40);
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...primaryColor);
        pdf.text('LABOR COSTS', margin, yPosition);
        yPosition += 7;

        const laborData = laborBreakdown.map(item => [
          item.item,
          item.category,
          item.description || '-',
          `${item.quantity.toFixed(2)} ${item.unitType}`,
          formatCurrency(item.total)
        ]);

        autoTable(pdf, {
          startY: yPosition,
          head: [['Item', 'Category', 'Description', 'Quantity', 'Total']],
          body: laborData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 30 },
            2: { cellWidth: 50 },
            3: { halign: 'center', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = pdf.lastAutoTable.finalY + 10;
      }

      checkAddPage(60);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...primaryColor);
      pdf.text('COST CALCULATION', margin, yPosition);
      yPosition += 7;

      const calculationData = [
        ['Base Material Cost', formatCurrency(baseMaterialCost)],
        ['Base Labor Cost', formatCurrency(baseLaborCost)]
      ];

      if (laborDiscount > 0) {
        calculationData.push(['Less: Labor Discount', `-${formatCurrency(laborDiscount)}`]);
      }

      calculationData.push([
        { content: 'Base Subtotal', styles: { fontStyle: 'bold' } },
        { content: formatCurrency(baseSubtotal), styles: { fontStyle: 'bold' } }
      ]);

      if (wasteEntriesTotal > 0) {
        calculationData.push(['Waste Factor by Surface', formatCurrency(wasteEntriesTotal)]);
        wasteEntries.forEach(entry => {
          const surfaceCost = parseFloat(entry.surfaceCost) || 0;
          const wasteFactor = parseFloat(entry.wasteFactor) || 0;
          const wasteCost = surfaceCost * wasteFactor;
          calculationData.push([
            `  • ${entry.surfaceName} ($${surfaceCost.toFixed(2)} × ${(wasteFactor * 100).toFixed(0)}%)`,
            formatCurrency(wasteCost)
          ]);
        });
      }

      if (taxAmount > 0) {
        calculationData.push([`Sales Tax (${((settings?.taxRate || 0) * 100).toFixed(1)}%)`, formatCurrency(taxAmount)]);
      }

      if (markupAmount > 0) {
        calculationData.push([`Profit Markup (${((settings?.markup || 0) * 100).toFixed(1)}%)`, formatCurrency(markupAmount)]);
      }

      if (transportationFee > 0) {
        calculationData.push(['Transportation Fee', formatCurrency(transportationFee)]);
      }

      if (miscFeesTotal > 0) {
        calculationData.push(['Miscellaneous Fees', formatCurrency(miscFeesTotal)]);
        // Add individual misc fee details
        miscFees.forEach(fee => {
          if (fee.amount > 0) {
            calculationData.push([
              `  • ${fee.name}`,
              formatCurrency(fee.amount)
            ]);
          }
        });
      }

      calculationData.push([
        { content: 'PROJECT TOTAL', styles: { fontStyle: 'bold', fontSize: 10, fillColor: lightGray } },
        { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', fontSize: 10, fillColor: lightGray } }
      ]);

      autoTable(pdf, {
        startY: yPosition,
        body: calculationData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { halign: 'right', cellWidth: 50 }
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          // Add subtle borders to all cells
          if (data.section === 'body') {
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.1);
            pdf.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      });

      yPosition = pdf.lastAutoTable.finalY + 10;

      checkAddPage(60);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...primaryColor);
      pdf.text('PAYMENT SUMMARY', margin, yPosition);
      yPosition += 7;

      const paymentData = [
        ['Project Total', formatCurrency(grandTotal)]
      ];

      if (depositAmount > 0) {
        paymentData.push([
          `Less: Deposit (${depositPayment.date ? new Date(depositPayment.date).toLocaleDateString() : 'N/A'})`,
          `-${formatCurrency(depositAmount)}`
        ]);
      }

      paymentData.push([
        { content: 'Amount Due After Deposit', styles: { fontStyle: 'bold' } },
        { content: formatCurrency(adjustedGrandTotal), styles: { fontStyle: 'bold' } }
      ]);

      if (otherPayments.length > 0) {
        paymentData.push([
          { content: 'Payments Made:', styles: { fontStyle: 'bold', fillColor: [250, 250, 250] } },
          { content: '', styles: { fillColor: [250, 250, 250] } }
        ]);
        
        otherPayments.forEach(payment => {
          const paymentDate = new Date(payment.date).toLocaleDateString();
          const paymentNote = payment.note ? ` - ${payment.note}` : '';
          paymentData.push([
            `  • ${paymentDate} (${payment.method})${paymentNote}`,
            `-${formatCurrency(payment.amount)}`
          ]);
        });
        
        paymentData.push([
          { content: 'Total Payments', styles: { fontStyle: 'bold' } },
          { content: `-${formatCurrency(otherPaymentsTotal)}`, styles: { fontStyle: 'bold' } }
        ]);
      }

      paymentData.push([
        { content: 'BALANCE DUE', styles: { fontStyle: 'bold', fontSize: 10, fillColor: lightGray } },
        { content: formatCurrency(remainingBalance), styles: { fontStyle: 'bold', fontSize: 10, fillColor: lightGray, textColor: remainingBalance > 0 ? [208, 0, 0] : [43, 147, 72] } }
      ]);

      if (overpayment > 0) {
        paymentData.push([
          { content: 'CREDIT BALANCE', styles: { fontStyle: 'bold' } },
          { content: formatCurrency(overpayment), styles: { fontStyle: 'bold', textColor: [43, 147, 72] } }
        ]);
      }

      autoTable(pdf, {
        startY: yPosition,
        body: paymentData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { halign: 'right', cellWidth: 50 }
        },
        margin: { left: margin, right: margin },
        didDrawCell: (data) => {
          // Add borders
          if (data.section === 'body') {
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.1);
            pdf.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      });

      yPosition = pdf.lastAutoTable.finalY + 10;

      checkAddPage(90);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...primaryColor);
      pdf.text('TERMS & CONDITIONS', margin, yPosition);
      yPosition += 7;

      const terms = [
        { 
          title: 'Payment Schedule:', 
          text: 'A 50% deposit is required upon contract signing to initiate the project. An additional 30% is due upon delivery of materials to the project site. The remaining 20% is payable upon satisfactory completion.' 
        },
        { 
          title: 'Payment Policy:', 
          text: 'We accept checks, QuickPay, Zelle, and all major cards. A 4% processing fee applies to card transactions. Materials will not be released until payment has cleared.' 
        },
        { 
          title: 'Materials:', 
          text: 'All materials subject to availability and price changes. Substitutions may be made with customer approval.' 
        },
        { 
          title: 'Warranty:', 
          text: '1-year workmanship warranty. Material warranties per manufacturer specifications.' 
        },
        { 
          title: 'Changes:', 
          text: 'Any changes to scope of work may result in additional charges. Written change orders required.' 
        },
        { 
          title: 'Acceptance:', 
          text: 'This estimate is valid for 30 days. Work to commence upon receipt of signed contract and deposit.' 
        }
      ];

      pdf.setFontSize(8);
      
      terms.forEach((term, index) => {
        if (checkAddPage(20)) {
          yPosition += 3;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...darkGray);
        pdf.text(term.title, margin, yPosition);
        
        yPosition += 4;
        
        pdf.setFont('helvetica', 'normal');
        const maxWidth = pageWidth - 2 * margin;
        const lines = pdf.splitTextToSize(term.text, maxWidth);
        pdf.text(lines, margin, yPosition);
        
        yPosition += lines.length * 3.5 + 3;
      });

      yPosition += 5;

      if (customer.notes) {
        checkAddPage(25);
        
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...primaryColor);
        pdf.text('SPECIAL INSTRUCTIONS', margin, yPosition);
        yPosition += 5;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...darkGray);
        const noteLines = pdf.splitTextToSize(customer.notes, pageWidth - 2 * margin);
        pdf.text(noteLines, margin, yPosition);
        yPosition += noteLines.length * 4 + 10;
      }

      checkAddPage(50);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...primaryColor);
      pdf.text('AUTHORIZATION & ACCEPTANCE', margin, yPosition);
      yPosition += 7;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...darkGray);
      const authText = `By signing below, I/We acknowledge that I/We have read and agree to the terms and conditions outlined above. I/We authorize Rawdah Remodeling Company to proceed with the work described at the total contract price of ${formatCurrency(grandTotal)}.`;
      const authLines = pdf.splitTextToSize(authText, pageWidth - 2 * margin);
      pdf.text(authLines, margin, yPosition);
      yPosition += authLines.length * 4 + 10;

      const sigWidth = (pageWidth - 3 * margin) / 2;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Customer Signature:', margin, yPosition);
      pdf.text('Contractor Signature:', margin + sigWidth + margin, yPosition);
      yPosition += 3;

      pdf.line(margin, yPosition + 10, margin + sigWidth, yPosition + 10);
      pdf.line(margin + sigWidth + margin, yPosition + 10, pageWidth - margin, yPosition + 10);
      yPosition += 15;

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Printed Name: _____________________', margin, yPosition);
      pdf.text('Printed Name: _____________________', margin + sigWidth + margin, yPosition);
      yPosition += 4;
      pdf.text('Date: _____________', margin, yPosition);
      pdf.text('Date: _____________', margin + sigWidth + margin, yPosition);

      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...darkGray);
      pdf.text('Thank you for choosing Rawdah Remodeling Company', pageWidth / 2, footerY, { align: 'center' });
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('For questions, contact us at (224) 817-3264', pageWidth / 2, footerY + 4, { align: 'center' });

      pdf.save(`Estimate_${id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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
            
            {materialBreakdown.length > 0 && (
              <div className={styles.tableContainer}>
                <h4 className={styles.subsectionTitle}>Material Costs</h4>
                <table className={styles.detailTable} aria-label="Material Cost Breakdown">
                  <thead>
                    <tr>
                      <th className={styles.tableHeader}>Item</th>
                      <th className={styles.tableHeader}>Category</th>
                      <th className={styles.tableHeader}>Quantity</th>
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
                        <td className={styles.tableCellRight}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {laborBreakdown.length > 0 && (
              <div className={styles.tableContainer}>
                <h4 className={styles.subsectionTitle}>Labor Costs</h4>
                <table className={styles.detailTable} aria-label="Labor Cost Breakdown">
                  <thead>
                    <tr>
                      <th className={styles.tableHeader}>Item</th>
                      <th className={styles.tableHeader}>Category</th>
                      <th className={styles.tableHeader}>Description</th>
                      <th className={styles.tableHeader}>Quantity</th>
                      <th className={styles.tableHeader}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborBreakdown.map((item, index) => (
                      <tr key={index} className={styles.tableRow}>
                        <td className={styles.tableCell}>{item.item}</td>
                        <td className={styles.tableCell}>{item.category}</td>
                        <td className={styles.descriptionCell} title={item.description || 'No description'}>
                          {item.description || '-'}
                        </td>
                        <td className={styles.tableCell}>
                          {(item.quantity || 0).toFixed(2)} {item.unitType}
                        </td>
                        <td className={styles.tableCellRight}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                    <>
                      <tr className={styles.calculationRow}>
                        <td className={styles.calculationLabel}>Miscellaneous Fees</td>
                        <td className={styles.calculationValue}>{formatCurrency(miscFeesTotal)}</td>
                      </tr>
                      {miscFees.map((fee, index) => {
                        if (fee.amount > 0) {
                          return (
                            <tr key={index} className={styles.calculationSubRow}>
                              <td className={styles.calculationSubLabel}>
                                • {fee.name}
                              </td>
                              <td className={styles.calculationSubValue}>{formatCurrency(fee.amount)}</td>
                            </tr>
                          );
                        }
                        return null;
                      })}
                    </>
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
                      <td className={styles.paymentLabel}>
                        Less: Deposit {depositPayment.date && `(${new Date(depositPayment.date).toLocaleDateString()})`}
                      </td>
                      <td className={styles.paymentValueNegative}>-{formatCurrency(depositAmount)}</td>
                    </tr>
                  )}
                  <tr className={styles.paymentRow}>
                    <td className={styles.paymentLabel}><strong>Amount Due After Deposit</strong></td>
                    <td className={styles.paymentValue}><strong>{formatCurrency(adjustedGrandTotal)}</strong></td>
                  </tr>
                  {otherPayments.length > 0 && (
                    <>
                      <tr className={styles.paymentHeaderRow}>
                        <td className={styles.paymentLabel} colSpan="2"><strong>Payments Made:</strong></td>
                      </tr>
                      {otherPayments.map((payment, index) => {
                        const paymentDate = new Date(payment.date).toLocaleDateString();
                        const paymentNote = payment.note ? ` - ${payment.note}` : '';
                        return (
                          <tr key={index} className={styles.paymentDetailRow}>
                            <td className={styles.paymentLabel}>
                              • {paymentDate} ({payment.method}){paymentNote}
                            </td>
                            <td className={styles.paymentValueNegative}>-{formatCurrency(payment.amount)}</td>
                          </tr>
                        );
                      })}
                      <tr className={styles.paymentRow}>
                        <td className={styles.paymentLabel}><strong>Total Payments</strong></td>
                        <td className={styles.paymentValueNegative}><strong>-{formatCurrency(otherPaymentsTotal)}</strong></td>
                      </tr>
                    </>
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
                <strong>Payment Schedule:</strong> A 50% deposit is required upon contract signing to initiate the project. An additional 30% is due upon delivery of materials to the project site, as confirmed by the project manager. The remaining 20% is payable upon satisfactory completion of the project, subject to final inspection and client approval.
              </div>
              <div className={styles.termsItem}>
                <strong>Payment Policy:</strong> We accept payments via checks, QuickPay, Zelle, and all major credit and debit cards. A 4% processing fee will be applied to all credit and debit card transactions. Materials will not be released or delivered to the project site until the corresponding payment has been fully cleared, without exception.
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