import React, { useState, useEffect, useMemo } from 'react';
import { getProjects } from '../../services/projectService';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend } from 'chart.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartPie, 
  faChartLine, 
  faChartBar, 
  faDollarSign,
  faPercentage,
  faArrowTrendUp,  // Changed from faTrendUp
  faEye,
  faEyeSlash,
  faTimes,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import styles from './FinanceDashboard.module.css';

ChartJS.register(ArcElement, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Filler, Tooltip, Legend);

export default function FinanceDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('12');
  const [visibleCharts, setVisibleCharts] = useState({
    paymentMethods: true,
    collections: true,
    materialTypes: true,
    expenses: true,
    detailedExpenses: true,
    profit: true
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await getProjects();
        setProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load financial data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Generate months based on selected time range
  const months = useMemo(() => {
    const monthCount = parseInt(selectedTimeRange);
    return Array.from({ length: monthCount }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - monthCount + 1 + i);
      return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    });
  }, [selectedTimeRange]);

  // Calculate aggregated financial data
  const financialData = useMemo(() => {
    if (!projects.length) return null;

    const collectionsByMonth = months.map(() => 0);
    const paymentMethods = { Cash: 0, Credit: 0, Debit: 0, Check: 0, Zelle: 0, Deposit: 0 };
    const materialTypes = {};
    const expensesByMonth = months.map(() => ({
      material: 0,
      labor: 0,
      tax: 0,
      waste: 0,
      transportation: 0,
      misc: 0,
      markup: 0
    }));
    const expenseCategories = { Material: 0, Labor: 0, Tax: 0, Fees: 0 };
    const profitByProject = [];
    let totalMaterialCost = 0;
    let totalCollections = 0;
    let totalExpenses = 0;

    projects.forEach(project => {
      const payments = project.settings?.payments || [];
      const deposit = project.settings?.deposit || 0;
      const projectDate = new Date(project.customerInfo?.startDate || project.createdAt || new Date());
      const monthIndex = months.findIndex(m => {
        const [month, year] = m.split(' ');
        return projectDate.getMonth() === new Date(Date.parse(month + ' 1, ' + year)).getMonth() &&
               projectDate.getFullYear() === parseInt(year);
      });

      // Process collections
      if (deposit > 0) {
        if (monthIndex >= 0) {
          collectionsByMonth[monthIndex] += deposit;
          paymentMethods.Deposit += deposit;
        }
        totalCollections += deposit;
      }

      payments.forEach(payment => {
        if (payment.isPaid) {
          const paymentDate = new Date(payment.date);
          const paymentMonthIndex = months.findIndex(m => {
            const [month, year] = m.split(' ');
            return paymentDate.getMonth() === new Date(Date.parse(month + ' 1, ' + year)).getMonth() &&
                   paymentDate.getFullYear() === parseInt(year);
          });
          if (paymentMonthIndex >= 0) {
            collectionsByMonth[paymentMonthIndex] += payment.amount;
            paymentMethods[payment.method] = (paymentMethods[payment.method] || 0) + payment.amount;
          }
          totalCollections += payment.amount;
        }
      });

      // Calculate expenses
      let materialCost = 0;
      let laborCost = 0;

      (project.categories || []).forEach(cat => {
        (cat.workItems || []).forEach(item => {
          const units = (item.surfaces || []).reduce((sum, surf) => sum + (parseFloat(surf.sqft) || 0), 0) ||
                        parseFloat(item.linearFt) || parseFloat(item.units) || 0;
          const matCost = (parseFloat(item.materialCost) || 0) * units;
          const labCost = (parseFloat(item.laborCost) || 0) * units;
          materialCost += matCost;
          laborCost += labCost;
          const subtype = item.subtype || 'Other';
          materialTypes[subtype] = (materialTypes[subtype] || 0) + matCost;
        });
      });

      const baseSubtotal = materialCost + laborCost;
      const wasteCost = baseSubtotal * (project.settings?.wasteFactor || 0);
      const taxCost = baseSubtotal * (project.settings?.taxRate || 0);
      const markupCost = baseSubtotal * (project.settings?.markup || 0);
      const transportationCost = project.settings?.transportationFee || 0;
      const miscCost = (project.settings?.miscFees || []).reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);

      if (monthIndex >= 0) {
        expensesByMonth[monthIndex].material += materialCost;
        expensesByMonth[monthIndex].labor += laborCost;
        expensesByMonth[monthIndex].tax += taxCost;
        expensesByMonth[monthIndex].waste += wasteCost;
        expensesByMonth[monthIndex].transportation += transportationCost;
        expensesByMonth[monthIndex].misc += miscCost;
        expensesByMonth[monthIndex].markup += markupCost;
      }

      totalMaterialCost += materialCost;
      expenseCategories.Material += materialCost;
      expenseCategories.Labor += laborCost;
      expenseCategories.Tax += taxCost;
      expenseCategories.Fees += transportationCost + miscCost;
      
      const totalProjectExpenses = materialCost + laborCost + taxCost + wasteCost + transportationCost + miscCost + markupCost;
      totalExpenses += totalProjectExpenses;

      // Calculate profit
      const projectCollections = payments.reduce((sum, p) => sum + (p.isPaid ? parseFloat(p.amount) || 0 : 0), 0) + deposit;
      const profit = projectCollections - totalProjectExpenses;
      profitByProject.push({
        name: project.customerInfo?.projectName || `Project ${project._id}`,
        profit,
        details: {
          customer: `${project.customerInfo?.firstName || ''} ${project.customerInfo?.lastName || ''}`.trim(),
          collections: projectCollections,
          expenses: totalProjectExpenses,
          categories: project.categories || [],
          payments: payments,
          deposit
        }
      });
    });

    const totalProfit = totalCollections - totalExpenses;
    const profitMargin = totalCollections > 0 ? (totalProfit / totalCollections) * 100 : 0;

    return {
      collectionsByMonth,
      paymentMethods,
      materialTypes,
      expensesByMonth,
      expenseCategories,
      profitByProject: profitByProject.sort((a, b) => b.profit - a.profit),
      totalMaterialCost,
      totalCollections,
      totalExpenses,
      totalProfit,
      profitMargin
    };
  }, [projects, months]);

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { family: 'Poppins', size: 12, weight: 500 },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        bodyFont: { family: 'Poppins', size: 12 },
        titleFont: { family: 'Poppins', size: 14, weight: 600 },
        callbacks: {
          label: (context) => `$${context.parsed.y?.toLocaleString() || context.parsed.toLocaleString()}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          font: { family: 'Poppins', size: 11 },
          maxRotation: 45
        },
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          font: { family: 'Poppins', size: 11 },
          callback: (value) => `$${value.toLocaleString()}`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { family: 'Poppins', size: 12, weight: 500 },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (context) => `$${context.parsed.toLocaleString()}`
        }
      }
    },
    cutout: '60%'
  };

  // Generate chart data
  const getChartData = () => {
    if (!financialData) return {};

    return {
      paymentMethodData: {
        labels: Object.keys(financialData.paymentMethods).filter(method => financialData.paymentMethods[method] > 0),
        datasets: [{
          data: Object.values(financialData.paymentMethods).filter(amount => amount > 0),
          backgroundColor: ['#3498db', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },

      collectionsData: {
        labels: months,
        datasets: [{
          label: 'Monthly Collections',
          data: financialData.collectionsByMonth,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },

      materialTypeData: {
        labels: Object.keys(financialData.materialTypes).filter(type => financialData.materialTypes[type] > 0),
        datasets: [{
          data: Object.values(financialData.materialTypes).filter(amount => amount > 0),
          backgroundColor: ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },

      expenseCategoryData: {
        labels: Object.keys(financialData.expenseCategories).filter(cat => financialData.expenseCategories[cat] > 0),
        datasets: [{
          data: Object.values(financialData.expenseCategories).filter(amount => amount > 0),
          backgroundColor: ['#e74c3c', '#3498db', '#f39c12', '#2ecc71'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },

      detailedExpensesData: {
        labels: months,
        datasets: [
          { label: 'Material', data: financialData.expensesByMonth.map(e => e.material), backgroundColor: '#e74c3c', stack: 'Stack 0' },
          { label: 'Labor', data: financialData.expensesByMonth.map(e => e.labor), backgroundColor: '#3498db', stack: 'Stack 0' },
          { label: 'Tax', data: financialData.expensesByMonth.map(e => e.tax), backgroundColor: '#f39c12', stack: 'Stack 0' },
          { label: 'Waste', data: financialData.expensesByMonth.map(e => e.waste), backgroundColor: '#2ecc71', stack: 'Stack 0' },
          { label: 'Transportation', data: financialData.expensesByMonth.map(e => e.transportation), backgroundColor: '#9b59b6', stack: 'Stack 0' },
          { label: 'Misc Fees', data: financialData.expensesByMonth.map(e => e.misc), backgroundColor: '#1abc9c', stack: 'Stack 0' },
          { label: 'Markup', data: financialData.expensesByMonth.map(e => e.markup), backgroundColor: '#34495e', stack: 'Stack 0' }
        ]
      },

      profitData: {
        labels: financialData.profitByProject.map(p => p.name).slice(0, 10),
        datasets: [{
          label: 'Profit',
          data: financialData.profitByProject.map(p => p.profit).slice(0, 10),
          backgroundColor: financialData.profitByProject.map(p => p.profit >= 0 ? '#2ecc71' : '#e74c3c').slice(0, 10),
          borderColor: financialData.profitByProject.map(p => p.profit >= 0 ? '#27ae60' : '#c0392b').slice(0, 10),
          borderWidth: 2,
          borderRadius: 4
        }]
      }
    };
  };

  const chartData = getChartData();
  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);

  const toggleChartVisibility = (chartKey) => {
    setVisibleCharts(prev => ({
      ...prev,
      [chartKey]: !prev[chartKey]
    }));
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className={styles.loading}>
            <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingIcon} />
            <span>Loading financial data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className={styles.dashboard}>
        <div className="container">
          <div className={styles.noData}>
            <FontAwesomeIcon icon={faChartPie} className={styles.noDataIcon} />
            <h3>No Financial Data Available</h3>
            <p>Add some projects with payments to see financial analytics.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.dashboard}>
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">
              <FontAwesomeIcon icon={faChartPie} />
              Finance Dashboard
            </h1>
            <p className="subtitle">Comprehensive financial analytics and insights</p>
          </div>
          <div className={styles.controls}>
            <select 
              className="select"
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
            >
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="18">Last 18 months</option>
              <option value="24">Last 24 months</option>
            </select>
          </div>
        </header>

        {/* Key Metrics */}
        <section className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className={styles.metricContent}>
              <h3>Total Collections</h3>
              <p className={styles.metricValue}>{formatCurrency(financialData.totalCollections)}</p>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faChartLine} />
            </div>
            <div className={styles.metricContent}>
              <h3>Total Expenses</h3>
              <p className={styles.metricValue}>{formatCurrency(financialData.totalExpenses)}</p>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
            <div className={styles.metricContent}>
              <h3>Net Profit</h3>
              <p className={`${styles.metricValue} ${financialData.totalProfit >= 0 ? styles.positive : styles.negative}`}>
                {formatCurrency(financialData.totalProfit)}
              </p>
            </div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>
              <FontAwesomeIcon icon={faPercentage} />
            </div>
            <div className={styles.metricContent}>
              <h3>Profit Margin</h3>
              <p className={`${styles.metricValue} ${financialData.profitMargin >= 0 ? styles.positive : styles.negative}`}>
                {financialData.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </section>

        {/* Charts Grid */}
        <div className={styles.chartGrid}>
          {visibleCharts.paymentMethods && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Payment Methods
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('paymentMethods')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut data={chartData.paymentMethodData} options={donutOptions} />
              </div>
            </div>
          )}

          {visibleCharts.collections && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartLine} />
                  Monthly Collections
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('collections')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Line data={chartData.collectionsData} options={chartOptions} />
              </div>
            </div>
          )}

          {visibleCharts.materialTypes && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Material Types
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('materialTypes')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut data={chartData.materialTypeData} options={donutOptions} />
              </div>
            </div>
          )}

          {visibleCharts.expenses && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartPie} />
                  Expense Categories
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('expenses')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Doughnut data={chartData.expenseCategoryData} options={donutOptions} />
              </div>
            </div>
          )}

          {visibleCharts.detailedExpenses && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  Detailed Monthly Expenses
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('detailedExpenses')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Bar data={chartData.detailedExpensesData} options={chartOptions} />
              </div>
            </div>
          )}

          {visibleCharts.profit && (
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>
                  <FontAwesomeIcon icon={faChartBar} />
                  Top 10 Projects by Profit
                </h3>
                <button 
                  className={styles.toggleButton}
                  onClick={() => toggleChartVisibility('profit')}
                  title="Hide chart"
                >
                  <FontAwesomeIcon icon={faEyeSlash} />
                </button>
              </div>
              <div className={styles.chartWrapper}>
                <Bar 
                  data={chartData.profitData} 
                  options={{
                    ...chartOptions,
                    onClick: (event, elements) => {
                      if (elements.length > 0) {
                        const index = elements[0].index;
                        setModalData(financialData.profitByProject[index].details);
                        setShowModal(true);
                      }
                    }
                  }} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Hidden Charts Toggle */}
        {Object.values(visibleCharts).includes(false) && (
          <section className={styles.hiddenCharts}>
            <h3>Show Hidden Charts</h3>
            <div className={styles.hiddenChartsList}>
              {Object.entries(visibleCharts).map(([key, visible]) => (
                !visible && (
                  <button 
                    key={key}
                    className="button button--secondary"
                    onClick={() => toggleChartVisibility(key)}
                  >
                    <FontAwesomeIcon icon={faEye} />
                    Show {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </button>
                )
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Project Details</h3>
              <button 
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.projectInfo}>
                <h4>Customer: {modalData.customer}</h4>
                <div className={styles.financialSummary}>
                  <div className={styles.summaryItem}>
                    <span>Total Collections:</span>
                    <span>{formatCurrency(modalData.collections)}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span>Total Expenses:</span>
                    <span>{formatCurrency(modalData.expenses)}</span>
                  </div>
                  <div className={`${styles.summaryItem} ${styles.profitItem}`}>
                    <span>Net Profit:</span>
                    <span className={modalData.collections - modalData.expenses >= 0 ? styles.positive : styles.negative}>
                      {formatCurrency(modalData.collections - modalData.expenses)}
                    </span>
                  </div>
                </div>
              </div>

              {modalData.payments.length > 0 && (
                <div className={styles.paymentsSection}>
                  <h5>Payment History</h5>
                  <div className={styles.tableWrapper}>
                    <table className={styles.modalTable}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.deposit > 0 && (
                          <tr className={styles.depositRow}>
                            <td>Initial</td>
                            <td>{formatCurrency(modalData.deposit)}</td>
                            <td>Deposit</td>
                            <td><span className={styles.statusPaid}>Paid</span></td>
                            <td>Project deposit</td>
                          </tr>
                        )}
                        {modalData.payments.map((payment, i) => (
                          <tr key={i}>
                            <td>{new Date(payment.date).toLocaleDateString()}</td>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td>{payment.method || 'N/A'}</td>
                            <td>
                              <span className={payment.isPaid ? styles.statusPaid : styles.statusPending}>
                                {payment.isPaid ? 'Paid' : 'Pending'}
                              </span>
                            </td>
                            <td>{payment.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button 
                className="button button--secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}