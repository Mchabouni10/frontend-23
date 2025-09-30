// src/components/CustomerInfo/CustomerInfo.jsx
import React, { useState, useEffect } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faEnvelope,
  faPhone,
  faMapMarkerAlt,
  faHome,
  faCreditCard,
  faCalendarAlt,
  faStickyNote,
  faChevronDown,
  faChevronUp,
  faRoad,
  faCity,
} from '@fortawesome/free-solid-svg-icons';
import styles from './CustomerInfo.module.css';
import { getProjects } from '../../services/projectService';

// Utility function to safely parse dates
const safeParseDate = (date) => {
  if (!date) return null;
  if (date instanceof Date && !isNaN(date.getTime())) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }
  return null;
};

// Utility function to parse street address into components
const parseStreetAddress = (street) => {
  if (!street) return { addressNumber: '', direction: '', streetName: '', streetType: '' };
  
  const parts = street.trim().split(' ');
  if (parts.length === 0) return { addressNumber: '', direction: '', streetName: '', streetType: '' };
  
  let addressNumber = '';
  let direction = '';
  let streetName = '';
  let streetType = '';
  
  // First part is always the address number
  if (parts.length > 0 && /^\d+$/.test(parts[0])) {
    addressNumber = parts[0];
  }
  
  // Look for direction (N, S, E, W, NE, NW, SE, SW)
  const directions = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
  let startIndex = addressNumber ? 1 : 0;
  
  if (parts.length > startIndex && directions.includes(parts[startIndex].toUpperCase())) {
    direction = parts[startIndex];
    startIndex++;
  }
  
  // Last part might be street type
  const streetTypes = ['St', 'Ave', 'Blvd', 'Dr', 'Rd', 'Ln', 'Ct', 'Cir', 'Pl', 'Way', 'Pkwy', 'Ter', 'Trail'];
  let endIndex = parts.length;
  
  if (parts.length > startIndex && streetTypes.includes(parts[parts.length - 1])) {
    streetType = parts[parts.length - 1];
    endIndex = parts.length - 1;
  }
  
  // Everything in between is the street name
  if (startIndex < endIndex) {
    streetName = parts.slice(startIndex, endIndex).join(' ');
  }
  
  return { addressNumber, direction, streetName, streetType };
};

// Utility function to construct street address
const constructStreetAddress = ({ addressNumber, direction, streetName, streetType }) => {
  const parts = [
    addressNumber?.trim(),
    direction?.trim(),
    streetName?.trim(),
    streetType?.trim(),
  ].filter(Boolean); // Remove empty or undefined parts
  return parts.join(' ');
};

// Address direction options
const DIRECTIONS = [
  { value: '', label: 'Select Direction' },
  { value: 'N', label: 'North (N)' },
  { value: 'S', label: 'South (S)' },
  { value: 'E', label: 'East (E)' },
  { value: 'W', label: 'West (W)' },
  { value: 'NE', label: 'Northeast (NE)' },
  { value: 'NW', label: 'Northwest (NW)' },
  { value: 'SE', label: 'Southeast (SE)' },
  { value: 'SW', label: 'Southwest (SW)' },
];

// Street type options
const STREET_TYPES = [
  { value: '', label: 'Select Type' },
  { value: 'St', label: 'Street (St)' },
  { value: 'Ave', label: 'Avenue (Ave)' },
  { value: 'Blvd', label: 'Boulevard (Blvd)' },
  { value: 'Dr', label: 'Drive (Dr)' },
  { value: 'Rd', label: 'Road (Rd)' },
  { value: 'Ln', label: 'Lane (Ln)' },
  { value: 'Ct', label: 'Court (Ct)' },
  { value: 'Cir', label: 'Circle (Cir)' },
  { value: 'Pl', label: 'Place (Pl)' },
  { value: 'Way', label: 'Way' },
  { value: 'Pkwy', label: 'Parkway (Pkwy)' },
  { value: 'Ter', label: 'Terrace (Ter)' },
  { value: 'Trail', label: 'Trail' },
];

// Collapsible Section Component
const CollapsibleSection = ({ title, icon, children, isOpen, toggleOpen }) => (
  <div className={styles.section}>
    <button
      className={styles.sectionHeader}
      onClick={toggleOpen}
      aria-expanded={isOpen}
      aria-controls={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className={styles.sectionTitle}>
        <FontAwesomeIcon icon={icon} className={styles.sectionIcon} />
        <h3>{title}</h3>
      </div>
      <FontAwesomeIcon
        icon={isOpen ? faChevronUp : faChevronDown}
        className={styles.toggleIcon}
      />
    </button>
    {isOpen && (
      <div
        id={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
        className={styles.sectionContent}
      >
        {children}
      </div>
    )}
  </div>
);

export default function CustomerInfo({ customer, setCustomer, disabled = false }) {
  const today = safeParseDate(new Date()) || new Date();
  const [busyDatesDetails, setBusyDatesDetails] = useState([]);
  const [isBusyDatesOpen, setIsBusyDatesOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    personal: true,
    address: true,
    contact: true,
    project: true,
    dates: true,
  });

  // Parse street address into components when customer.street changes
  const [addressComponents, setAddressComponents] = useState({
    addressNumber: '',
    direction: '',
    streetName: '',
    streetType: ''
  });

  useEffect(() => {
    const components = parseStreetAddress(customer.street);
    setAddressComponents(components);
  }, [customer.street]);

  useEffect(() => {
    const fetchBusyDates = async () => {
      try {
        const projects = await getProjects();
        const detailedBusyDates = projects
          .filter((project) => project.customerInfo?.startDate || project.customerInfo?.finishDate)
          .map((project) => {
            const start = safeParseDate(project.customerInfo.startDate);
            const finish = safeParseDate(project.customerInfo.finishDate);
            if (start && finish && start <= finish) {
              return {
                customerName: `${project.customerInfo.firstName || ''} ${project.customerInfo.lastName || ''}`.trim(),
                projectName: project.customerInfo.projectName || 'Unnamed Project',
                startDate: start,
                finishDate: finish,
              };
            }
            return null;
          })
          .filter(Boolean);
        setBusyDatesDetails(detailedBusyDates);
      } catch (err) {
        console.error('Error fetching busy dates:', err);
      }
    };
    if (!disabled) fetchBusyDates();
  }, [disabled]);

  const isDateBusy = (date) => {
    if (!date) return false;
    const normalizedDate = safeParseDate(date);
    if (!normalizedDate) return false;
    return busyDatesDetails.some(
      (busy) => normalizedDate >= busy.startDate && normalizedDate <= busy.finishDate
    );
  };

  const getBusyDetailsForDate = (date) => {
    const normalizedDate = safeParseDate(date);
    if (!normalizedDate) return [];
    return busyDatesDetails.filter(
      (busy) => normalizedDate >= busy.startDate && normalizedDate <= busy.finishDate
    );
  };

  const getBusyDateRanges = () => {
    return busyDatesDetails.map((busy) => ({
      start: busy.startDate,
      end: busy.finishDate,
    }));
  };

  const handleDateChange = (field, date) => {
    if (disabled) return;
    const parsedDate = safeParseDate(date);
    if (!parsedDate) {
      setCustomer({ ...customer, [field]: null });
      return;
    }
    if (isDateBusy(parsedDate)) {
      const conflicts = getBusyDetailsForDate(parsedDate);
      const conflictDetails = conflicts
        .map((busy) => `${busy.customerName} - ${busy.projectName} (${busy.startDate.toLocaleDateString()} to ${busy.finishDate.toLocaleDateString()})`)
        .join('\n');
      alert(`Warning: ${parsedDate.toLocaleDateString()} overlaps with:\n${conflictDetails}`);
    }
    if (field === 'startDate') {
      setCustomer({
        ...customer,
        startDate: parsedDate,
        finishDate: customer.finishDate && parsedDate > safeParseDate(customer.finishDate) ? null : customer.finishDate,
      });
    } else {
      setCustomer({ ...customer, [field]: parsedDate });
    }
  };

  const handleZipChange = (value) => {
    if (disabled) return;
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length <= 5) {
      setCustomer({ ...customer, zipCode: numericValue });
    }
  };

  const handleZipBlur = () => {
    if (disabled) return;
    const zipRegex = /^\d{5}$/;
    if (customer.zipCode && !zipRegex.test(customer.zipCode)) {
      setCustomer({ ...customer, zipCode: '' });
      alert('ZIP Code must be exactly 5 digits.');
    }
  };

  const handleNameChange = (field, value) => {
    if (disabled) return;
    const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
    setCustomer({ ...customer, [field]: capitalized });
  };

  const handleAddressComponentChange = (component, value) => {
    if (disabled) return;
    
    let updatedComponents;
    if (component === 'addressNumber') {
      const numericValue = value.replace(/\D/g, '');
      updatedComponents = { ...addressComponents, [component]: numericValue };
    } else {
      updatedComponents = { ...addressComponents, [component]: value };
    }
    
    setAddressComponents(updatedComponents);
    
    // Update the combined street field
    const street = constructStreetAddress({
      ...updatedComponents,
      city: customer.city // Include city in the update
    });
    
    setCustomer({ 
      ...customer, 
      street,
      [component]: updatedComponents[component] // Also update individual component if needed
    });
  };

  const handleCityChange = (value) => {
    if (disabled) return;
    const formatted = value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    setCustomer({ ...customer, city: formatted });
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 11 && cleaned.startsWith('1');
  };

  const toggleBusyDates = () => setIsBusyDatesOpen(!isBusyDatesOpen);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const renderDayContents = (day, date) => {
    const isBusy = isDateBusy(date);
    const busyDetails = getBusyDetailsForDate(date);
    return (
      <div className={`${styles.dayWrapper} ${isBusy ? styles.busyDay : ''}`}>
        <span>{day}</span>
        {isBusy && (
          <>
            <div className={styles.busyIndicator} />
            <div className={styles.busyTooltip}>
              {busyDetails.map((busy, index) => (
                <div key={index} className={styles.tooltipItem}>
                  <span className={styles.tooltipCustomer}>{busy.customerName}</span>
                  <span className={styles.tooltipProject}>({busy.projectName})</span>
                  <span className={styles.tooltipRange}>
                    {busy.startDate.toLocaleDateString()} - {busy.finishDate.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const getDateValue = (date) => {
    return safeParseDate(date);
  };

  return (
    <div className={styles.customerInfo}>
      <h2 className={styles.title}>Customer Information</h2>
      <div className={styles.form}>
        {/* Personal Information */}
        <CollapsibleSection
          title="Personal Information"
          icon={faUser}
          isOpen={openSections.personal}
          toggleOpen={() => toggleSection('personal')}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faUser} className={styles.icon} /> First Name{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.firstName || ''}
              onChange={(e) => handleNameChange('firstName', e.target.value)}
              className={`${styles.input} ${!customer.firstName && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter first name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faUser} className={styles.icon} /> Last Name{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.lastName || ''}
              onChange={(e) => handleNameChange('lastName', e.target.value)}
              className={`${styles.input} ${!customer.lastName && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter last name"
            />
          </div>
        </CollapsibleSection>

        {/* Address Information */}
        <CollapsibleSection
          title="Address Information"
          icon={faMapMarkerAlt}
          isOpen={openSections.address}
          toggleOpen={() => toggleSection('address')}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faRoad} className={styles.icon} /> Address Number{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={addressComponents.addressNumber || ''}
              onChange={(e) => handleAddressComponentChange('addressNumber', e.target.value)}
              className={`${styles.input} ${!addressComponents.addressNumber && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter address number"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} /> Direction
            </label>
            <select
              value={addressComponents.direction || ''}
              onChange={(e) => handleAddressComponentChange('direction', e.target.value)}
              className={styles.input}
              disabled={disabled}
            >
              {DIRECTIONS.map((dir) => (
                <option key={dir.value} value={dir.value}>
                  {dir.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faRoad} className={styles.icon} /> Street Name{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={addressComponents.streetName || ''}
              onChange={(e) => handleAddressComponentChange('streetName', e.target.value)}
              className={`${styles.input} ${!addressComponents.streetName && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter street name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faRoad} className={styles.icon} /> Street Type{' '}
              <span className={styles.required}>*</span>
            </label>
            <select
              value={addressComponents.streetType || ''}
              onChange={(e) => handleAddressComponentChange('streetType', e.target.value)}
              className={`${styles.input} ${!addressComponents.streetType && !disabled && styles.error}`}
              disabled={disabled}
            >
              {STREET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCity} className={styles.icon} /> City{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.city || ''}
              onChange={(e) => handleCityChange(e.target.value)}
              className={`${styles.input} ${!customer.city && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter city name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Unit
            </label>
            <input
              type="text"
              value={customer.unit || ''}
              onChange={(e) => setCustomer({ ...customer, unit: e.target.value })}
              className={styles.input}
              disabled={disabled}
              placeholder="Enter unit (if any)"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} /> State
            </label>
            <select
              value={customer.state || 'IL'}
              onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
              className={styles.input}
              disabled={disabled}
            >
              <option value="IL">Illinois</option>
              <option value="IN">Indiana</option>
              <option value="WI">Wisconsin</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} /> ZIP Code{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.zipCode || ''}
              onChange={(e) => handleZipChange(e.target.value)}
              onBlur={handleZipBlur}
              className={`${styles.input} ${!customer.zipCode && !disabled && styles.error}`}
              maxLength="5"
              disabled={disabled}
              placeholder="Enter 5-digit ZIP"
            />
          </div>
        </CollapsibleSection>

        {/* Contact Information */}
        <CollapsibleSection
          title="Contact Information"
          icon={faPhone}
          isOpen={openSections.contact}
          toggleOpen={() => toggleSection('contact')}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faPhone} className={styles.icon} /> Phone{' '}
              <span className={styles.required}>*</span>
            </label>
            <PhoneInput
              country={'us'}
              onlyCountries={['us']}
              disableDropdown={true}
              countryCodeEditable={false}
              value={customer.phone || ''}
              onChange={(phone) => !disabled && setCustomer({ ...customer, phone })}
              inputClass={`${styles.phoneInput} ${
                (customer.phone && !validatePhone(customer.phone)) || (!customer.phone && !disabled)
                  ? styles.error
                  : ''
              }`}
              containerClass={styles.phoneContainer}
              disableCountryCode={false}
              specialLabel={''}
              disabled={disabled}
              placeholder="Enter phone number"
              inputProps={{
                required: true,
                autoFocus: false,
              }}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faEnvelope} className={styles.icon} /> Email{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              value={customer.email || ''}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className={`${styles.input} ${
                (customer.email && !validateEmail(customer.email)) || (!customer.email && !disabled)
                  ? styles.error
                  : ''
              }`}
              disabled={disabled}
              placeholder="Enter email address"
            />
          </div>
        </CollapsibleSection>

        {/* Project Information */}
        <CollapsibleSection
          title="Project Information"
          icon={faHome}
          isOpen={openSections.project}
          toggleOpen={() => toggleSection('project')}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Project Name{' '}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.projectName || ''}
              onChange={(e) => setCustomer({ ...customer, projectName: e.target.value })}
              className={`${styles.input} ${!customer.projectName && !disabled && styles.error}`}
              disabled={disabled}
              placeholder="Enter project name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Customer Type
            </label>
            <select
              value={customer.type || 'Residential'}
              onChange={(e) => setCustomer({ ...customer, type: e.target.value })}
              className={styles.input}
              disabled={disabled}
            >
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCreditCard} className={styles.icon} /> Payment Type
            </label>
            <select
              value={customer.paymentType || 'Cash'}
              onChange={(e) => setCustomer({ ...customer, paymentType: e.target.value })}
              className={styles.input}
              disabled={disabled}
            >
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
              <option value="Check">Check</option>
              <option value="Cash">Cash</option>
              <option value="Zelle">Zelle</option>
            </select>
          </div>
        </CollapsibleSection>

        {/* Date Information */}
        <CollapsibleSection
          title="Date Information"
          icon={faCalendarAlt}
          isOpen={openSections.dates}
          toggleOpen={() => toggleSection('dates')}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCalendarAlt} className={styles.icon} /> Start Date{' '}
              <span className={styles.required}>*</span>
            </label>
            <DatePicker
              selected={getDateValue(customer.startDate)}
              onChange={(date) => handleDateChange('startDate', date)}
              minDate={today}
              filterDate={(date) => date >= today}
              highlightDates={getBusyDateRanges()}
              renderDayContents={renderDayContents}
              className={`${styles.dateInput} ${!customer.startDate && !disabled && styles.error}`}
              disabled={disabled}
              placeholderText="Select start date"
              dateFormat="MM/dd/yyyy"
              strictParsing
              onFocus={(e) => e.target.blur()}
              showPopperArrow={false}
              popperClassName={styles.calendarPopper}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCalendarAlt} className={styles.icon} /> Finish Date
            </label>
            <DatePicker
              selected={getDateValue(customer.finishDate)}
              onChange={(date) => handleDateChange('finishDate', date)}
              minDate={getDateValue(customer.startDate) || today}
              filterDate={(date) => date >= (getDateValue(customer.startDate) || today)}
              highlightDates={getBusyDateRanges()}
              renderDayContents={renderDayContents}
              className={styles.dateInput}
              disabled={!customer.startDate || disabled}
              placeholderText="Select finish date"
              dateFormat="MM/dd/yyyy"
              strictParsing
              onFocus={(e) => e.target.blur()}
              showPopperArrow={false}
              popperClassName={styles.calendarPopper}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faStickyNote} className={styles.icon} /> Notes
            </label>
            <textarea
              value={customer.notes || ''}
              onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
              className={styles.input}
              rows="3"
              disabled={disabled}
              placeholder="Add any notes"
            />
          </div>
        </CollapsibleSection>
      </div>

      {/* Busy Dates Section */}
      {busyDatesDetails.length > 0 && !disabled && (
        <div className={styles.busyDatesSection}>
          <button
            className={styles.busyDatesHeader}
            onClick={toggleBusyDates}
            aria-expanded={isBusyDatesOpen}
            aria-controls="busy-dates-list"
          >
            <div className={styles.sectionTitle}>
              <FontAwesomeIcon icon={faCalendarAlt} className={styles.sectionIcon} />
              <h3>Busy Dates</h3>
            </div>
            <FontAwesomeIcon
              icon={isBusyDatesOpen ? faChevronUp : faChevronDown}
              className={styles.toggleIcon}
            />
          </button>
          {isBusyDatesOpen && (
            <ul id="busy-dates-list" className={styles.busyDatesList}>
              {busyDatesDetails.map((busy, index) => (
                <li key={index} className={styles.busyDateItem}>
                  <span className={styles.busyCustomer}>{busy.customerName}</span>
                  <span className={styles.busyProject}>({busy.projectName})</span>
                  <span className={styles.busyRange}>
                    {busy.startDate.toLocaleDateString()} - {busy.finishDate.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.busyDatesNote}>
            Note: Hover over busy dates in the calendar for details.
          </p>
        </div>
      )}
    </div>
  );
}
