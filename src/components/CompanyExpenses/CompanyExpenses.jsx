// src/components/CompanyExpenses/CompanyExpenses.jsx
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faTrash, 
  faGasPump, 
  faPhone, 
  faGlobe, 
  faTools, 
  faHardHat, 
  faReceipt,
  faCalendarAlt,

  faTruck,
  faLaptop,
  faBullhorn,
  faShieldAlt,
  faUserTie,
  faClipboardList,
  faPaperclip,
  faBuilding,
  faRecycle,
  faFileInvoiceDollar,
  faUtensils
} from '@fortawesome/free-solid-svg-icons';
import styles from './CompanyExpenses.module.css';

const CATEGORIES = [
  { id: 'fuel', name: 'Fuel / Van', icon: faGasPump, color: '#e74c3c' },
  { id: 'vehicle_maint', name: 'Vehicle Maintenance', icon: faTruck, color: '#c0392b' },
  { id: 'phone', name: 'Phone Bill', icon: faPhone, color: '#3498db' },
  { id: 'website', name: 'Website / Hosting', icon: faGlobe, color: '#9b59b6' },
  { id: 'software', name: 'Software / Subscriptions', icon: faLaptop, color: '#8e44ad' },
  { id: 'marketing', name: 'Marketing / Ads', icon: faBullhorn, color: '#e67e22' },
  { id: 'insurance', name: 'Insurance', icon: faShieldAlt, color: '#2c3e50' },
  { id: 'tools', name: 'Tools', icon: faTools, color: '#f39c12' },
  { id: 'material', name: 'Materials', icon: faHardHat, color: '#2ecc71' },
  { id: 'subcontractors', name: 'Subcontractors', icon: faUserTie, color: '#16a085' },
  { id: 'permits', name: 'Permits / Licenses', icon: faClipboardList, color: '#27ae60' },
  { id: 'office', name: 'Office Supplies', icon: faPaperclip, color: '#7f8c8d' },
  { id: 'rent', name: 'Rent / Utilities', icon: faBuilding, color: '#34495e' },
  { id: 'disposal', name: 'Waste Disposal', icon: faRecycle, color: '#795548' },
  { id: 'taxes', name: 'Taxes / Fees', icon: faFileInvoiceDollar, color: '#607d8b' },
  { id: 'meals', name: 'Meals / Entertainment', icon: faUtensils, color: '#d35400' },
  { id: 'other', name: 'Other', icon: faReceipt, color: '#95a5a6' }
];

export default function CompanyExpenses() {
  // Load expenses from localStorage
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem('companyExpenses');
    return saved ? JSON.parse(saved) : [];
  });

  // Helper to get local date string YYYY-MM-DD
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    date: getLocalDate(),
    category: 'fuel',
    amount: '',
    description: ''
  });

  const [selectedMonth, setSelectedMonth] = useState(getLocalDate().slice(0, 7)); // YYYY-MM

  // Save to localStorage whenever expenses change
  useEffect(() => {
    localStorage.setItem('companyExpenses', JSON.stringify(expenses));
  }, [expenses]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) return;

    const newExpense = {
      id: Date.now(),
      ...formData,
      amount: parseFloat(formData.amount)
    };

    setExpenses([newExpense, ...expenses]);
    setFormData({
      date: getLocalDate(),
      category: 'fuel',
      amount: '',
      description: ''
    });
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      setExpenses(expenses.filter(exp => exp.id !== id));
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    const rows = expenses.map(exp => [
      exp.date,
      getCategoryName(exp.category),
      `"${exp.description || ''}"`,
      exp.amount.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate Totals
  const calculateTotals = () => {
    const now = new Date();
    const currentYear = String(now.getFullYear());
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentDay = String(now.getDate()).padStart(2, '0');
    
    const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;
    const thisMonthStr = `${currentYear}-${currentMonth}`;
    const thisYearStr = currentYear;

    // Calculate start/end of current week (Sunday to Saturday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    let yearly = 0;

    expenses.forEach(exp => {
      const amount = parseFloat(exp.amount);
      const expDateObj = new Date(exp.date + 'T00:00:00'); // Force local time interpretation

      // Daily (Exact match)
      if (exp.date === todayStr) daily += amount;

      // Weekly (Range check)
      if (expDateObj >= startOfWeek && expDateObj <= endOfWeek) weekly += amount;

      // Monthly (String match)
      if (exp.date.startsWith(thisMonthStr)) monthly += amount;

      // Yearly (String match)
      if (exp.date.startsWith(thisYearStr)) yearly += amount;
    });

    return { daily, weekly, monthly, yearly };
  };

  const totals = calculateTotals();

  // Calculate Category Breakdown
  const categoryBreakdown = CATEGORIES.map(cat => {
    const total = expenses
      .filter(exp => exp.category === cat.id)
      .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    return { ...cat, total };
  }).filter(cat => cat.total > 0).sort((a, b) => b.total - a.total);

  const totalSpending = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  const getCategoryColor = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat ? cat.color : '#95a5a6';
  };

  const getCategoryName = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat ? cat.name : catId;
  };

  const filteredExpenses = expenses.filter(exp => exp.date.startsWith(selectedMonth));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Company Expenses</h1>
          <p className="subtitle">Track and manage your business spending</p>
        </div>
        <div className="button button--secondary">
          <FontAwesomeIcon icon={faCalendarAlt} />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </header>

      {/* Dashboard Cards */}
      <div className={styles.dashboard}>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Daily Total</span>
          <span className={styles.cardAmount}>${totals.daily.toFixed(2)}</span>
          <span className={styles.cardTrend}>Today's spending</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Weekly Total</span>
          <span className={styles.cardAmount}>${totals.weekly.toFixed(2)}</span>
          <span className={styles.cardTrend}>This week</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Monthly Total</span>
          <span className={styles.cardAmount}>${totals.monthly.toFixed(2)}</span>
          <span className={styles.cardTrend}>This month</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Yearly Total</span>
          <span className={styles.cardAmount}>${totals.yearly.toFixed(2)}</span>
          <span className={styles.cardTrend}>This year</span>
        </div>
      </div>

      {/* Category Breakdown */}
      <section className={styles.breakdownSection}>
        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Spending by Category</h2>
        <div className={styles.breakdownGrid}>
          {categoryBreakdown.length === 0 ? (
             <p style={{ color: 'var(--text-light)' }}>No spending data available.</p>
          ) : (
            categoryBreakdown.map(cat => (
              <div key={cat.id} className={styles.breakdownItem}>
                <div className={styles.breakdownHeader}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FontAwesomeIcon icon={cat.icon} style={{ color: cat.color }} />
                    {cat.name}
                  </span>
                  <span>${cat.total.toFixed(2)} ({((cat.total / totalSpending) * 100).toFixed(1)}%)</span>
                </div>
                <div className={styles.breakdownBarBg}>
                  <div 
                    className={styles.breakdownBarFill} 
                    style={{ width: `${(cat.total / totalSpending) * 100}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add Expense Form */}
      <section className={styles.formSection}>
        <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Add New Expense</h2>
        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Date</label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleInputChange} 
              className="input" 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Category</label>
            <select 
              name="category" 
              value={formData.category} 
              onChange={handleInputChange} 
              className="select"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Amount ($)</label>
            <input 
              type="number" 
              name="amount" 
              value={formData.amount} 
              onChange={handleInputChange} 
              className="input" 
              placeholder="0.00" 
              step="0.01" 
              min="0" 
              required 
            />
          </div>

          <div className={styles.formGroup} style={{ flexGrow: 2 }}>
            <label className={styles.label}>Description</label>
            <input 
              type="text" 
              name="description" 
              value={formData.description} 
              onChange={handleInputChange} 
              className="input" 
              placeholder="e.g. Shell Gas Station" 
            />
          </div>

          <button type="submit" className="button button--primary" style={{ height: '46px' }}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Expense</span>
          </button>
        </form>
      </section>

      {/* Recent Expenses List */}
      <section className={styles.listSection}>
        <div className={styles.controls}>
          <h2 className="title" style={{ fontSize: '1.5rem' }}>Expense History</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className={styles.filterGroup}>
              <label className={styles.label}>Filter Month:</label>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="input"
                style={{ width: 'auto' }}
              />
            </div>
            <button onClick={handleExportCSV} className={styles.exportButton}>
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
              Export CSV
            </button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                    No expenses found for this month.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                    <td>
                      <span 
                        className={styles.categoryTag}
                        style={{ 
                          backgroundColor: `${getCategoryColor(exp.category)}20`, 
                          color: getCategoryColor(exp.category) 
                        }}
                      >
                        {getCategoryName(exp.category)}
                      </span>
                    </td>
                    <td>{exp.description || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>${exp.amount.toFixed(2)}</td>
                    <td>
                      <button 
                        onClick={() => handleDelete(exp.id)} 
                        className={styles.deleteButton}
                        title="Delete Expense"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
