// src/components/CustomerInfo/CustomerInfo.jsx
import React, { useState, useEffect } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomerInfo.module.css";
import { getProjects } from "../../services/projectService";

// Utility function to safely parse dates
const safeParseDate = (date) => {
  if (!date) return null;
  if (date instanceof Date && !isNaN(date.getTime())) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (typeof date === "string" || typeof date === "number") {
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
  if (!street)
    return { addressNumber: "", direction: "", streetName: "", streetType: "" };

  const parts = street.trim().split(" ");
  if (parts.length === 0)
    return { addressNumber: "", direction: "", streetName: "", streetType: "" };

  let addressNumber = "";
  let direction = "";
  let streetName = "";
  let streetType = "";

  // First part is always the address number
  if (parts.length > 0 && /^\d+$/.test(parts[0])) {
    addressNumber = parts[0];
  }

  // Look for direction (N, S, E, W, NE, NW, SE, SW)
  const directions = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
  let startIndex = addressNumber ? 1 : 0;

  if (
    parts.length > startIndex &&
    directions.includes(parts[startIndex].toUpperCase())
  ) {
    direction = parts[startIndex];
    startIndex++;
  }

  // Last part might be street type
  const streetTypes = [
    "St",
    "Ave",
    "Blvd",
    "Dr",
    "Rd",
    "Ln",
    "Ct",
    "Cir",
    "Pl",
    "Way",
    "Pkwy",
    "Ter",
    "Trail",
  ];
  let endIndex = parts.length;

  if (
    parts.length > startIndex &&
    streetTypes.includes(parts[parts.length - 1])
  ) {
    streetType = parts[parts.length - 1];
    endIndex = parts.length - 1;
  }

  // Everything in between is the street name
  if (startIndex < endIndex) {
    streetName = parts.slice(startIndex, endIndex).join(" ");
  }

  return { addressNumber, direction, streetName, streetType };
};

// Utility function to construct street address
const constructStreetAddress = ({
  addressNumber,
  direction,
  streetName,
  streetType,
}) => {
  const parts = [
    addressNumber?.trim(),
    direction?.trim(),
    streetName?.trim(),
    streetType?.trim(),
  ].filter(Boolean); // Remove empty or undefined parts
  return parts.join(" ");
};

// Address direction options
const DIRECTIONS = [
  { value: "", label: "Dir" },
  { value: "N", label: "N" },
  { value: "S", label: "S" },
  { value: "E", label: "E" },
  { value: "W", label: "W" },
  { value: "NE", label: "NE" },
  { value: "NW", label: "NW" },
  { value: "SE", label: "SE" },
  { value: "SW", label: "SW" },
];

// Street type options
const STREET_TYPES = [
  { value: "", label: "Type" },
  { value: "St", label: "St" },
  { value: "Ave", label: "Ave" },
  { value: "Blvd", label: "Blvd" },
  { value: "Dr", label: "Dr" },
  { value: "Rd", label: "Rd" },
  { value: "Ln", label: "Ln" },
  { value: "Ct", label: "Ct" },
  { value: "Cir", label: "Cir" },
  { value: "Pl", label: "Pl" },
  { value: "Way", label: "Way" },
  { value: "Pkwy", label: "Pkwy" },
  { value: "Ter", label: "Ter" },
  { value: "Trail", label: "Trail" },
];

// Collapsible Section Component
const CollapsibleSection = ({ title, icon, children, isOpen, toggleOpen }) => (
  <div className={styles.section}>
    <button
      className={styles.sectionHeader}
      onClick={toggleOpen}
      aria-expanded={isOpen}
      aria-controls={`section-${title.toLowerCase().replace(/\s/g, "-")}`}
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
        id={`section-${title.toLowerCase().replace(/\s/g, "-")}`}
        className={styles.sectionContent}
      >
        {children}
      </div>
    )}
  </div>
);

export default function CustomerInfo({
  customer,
  setCustomer,
  disabled = false,
  isEditMode = false,
}) {
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
    addressNumber: "",
    direction: "",
    streetName: "",
    streetType: "",
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
          .filter(
            (project) =>
              project.customerInfo?.startDate ||
              project.customerInfo?.finishDate,
          )
          .map((project) => {
            const start = safeParseDate(project.customerInfo.startDate);
            const finish = safeParseDate(project.customerInfo.finishDate);
            if (start && finish && start <= finish) {
              return {
                customerName: `${project.customerInfo.firstName || ""} ${
                  project.customerInfo.lastName || ""
                }`.trim(),
                projectName:
                  project.customerInfo.projectName || "Unnamed Project",
                startDate: start,
                finishDate: finish,
              };
            }
            return null;
          })
          .filter(Boolean);
        setBusyDatesDetails(detailedBusyDates);
      } catch (err) {
        console.error("Error fetching busy dates:", err);
      }
    };

    fetchBusyDates();
  }, []);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleBusyDates = () => {
    setIsBusyDatesOpen((prev) => !prev);
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const validatePhone = (phone) => {
    // US phone number validation (10 digits)
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 11; // Including country code
  };

  const getBusyDateRanges = () => {
    return busyDatesDetails.map((busy) => ({
      start: busy.startDate,
      end: busy.finishDate,
    }));
  };

  const isDateBusy = (date) => {
    return busyDatesDetails.some((busy) => {
      const checkDate = safeParseDate(date);
      if (!checkDate) return false;
      return checkDate >= busy.startDate && checkDate <= busy.finishDate;
    });
  };

  const getBusyDateDetails = (date) => {
    const checkDate = safeParseDate(date);
    if (!checkDate) return [];

    return busyDatesDetails.filter(
      (busy) => checkDate >= busy.startDate && checkDate <= busy.finishDate,
    );
  };

  const renderDayContents = (day, date) => {
    const isBusy = isDateBusy(date);
    const details = getBusyDateDetails(date);

    if (isBusy) {
      const tooltipText = details
        .map((d) => `${d.customerName} - ${d.projectName}`)
        .join("\n");

      return (
        <div className={styles.dayWrapper} title={tooltipText}>
          <span className={styles.busyDay}>{day}</span>
          <div className={styles.busyIndicator}></div>
        </div>
      );
    }

    return <span>{day}</span>;
  };

  const handleDateChange = (field, date) => {
    if (disabled) return;

    const parsedDate = safeParseDate(date);

    if (field === "startDate") {
      setCustomer({
        ...customer,
        startDate: parsedDate,
        finishDate:
          parsedDate && customer.finishDate && customer.finishDate < parsedDate
            ? null
            : customer.finishDate,
      });
    } else if (field === "finishDate") {
      setCustomer({ ...customer, finishDate: parsedDate });
    }
  };

  const getDateValue = (date) => {
    const parsed = safeParseDate(date);
    return parsed && !isNaN(parsed.getTime()) ? parsed : null;
  };

  // Handle address component changes
  const handleAddressComponentChange = (field, value) => {
    const newComponents = { ...addressComponents, [field]: value };
    setAddressComponents(newComponents);
    const newStreet = constructStreetAddress(newComponents);
    setCustomer({ ...customer, street: newStreet });
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
          toggleOpen={() => toggleSection("personal")}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faUser} className={styles.icon} /> First
              Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.firstName || ""}
              onChange={(e) =>
                setCustomer({ ...customer, firstName: e.target.value })
              }
              className={`${styles.input} ${
                !customer.firstName && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholder="Enter first name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faUser} className={styles.icon} /> Last
              Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.lastName || ""}
              onChange={(e) =>
                setCustomer({ ...customer, lastName: e.target.value })
              }
              className={`${styles.input} ${
                !customer.lastName && !disabled && styles.error
              }`}
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
          toggleOpen={() => toggleSection("address")}
        >
          {/* Street Address Row - All in one line */}
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faRoad} className={styles.icon} /> Street
              Address <span className={styles.required}>*</span>
            </label>
            <div className={styles.addressRow}>
              <div className={styles.addressFieldSmall}>
                <input
                  type="text"
                  value={addressComponents.addressNumber}
                  onChange={(e) =>
                    handleAddressComponentChange("addressNumber", e.target.value)
                  }
                  className={`${styles.input} ${styles.compactInput} ${
                    !addressComponents.addressNumber && !disabled && styles.error
                  }`}
                  disabled={disabled}
                  placeholder="No."
                />
              </div>
              <div className={styles.addressFieldSmall}>
                <select
                  value={addressComponents.direction}
                  onChange={(e) =>
                    handleAddressComponentChange("direction", e.target.value)
                  }
                  className={`${styles.input} ${styles.compactInput}`}
                  disabled={disabled}
                >
                  {DIRECTIONS.map((dir) => (
                    <option key={dir.value} value={dir.value}>
                      {dir.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.addressFieldLarge}>
                <input
                  type="text"
                  value={addressComponents.streetName}
                  onChange={(e) =>
                    handleAddressComponentChange("streetName", e.target.value)
                  }
                  className={`${styles.input} ${styles.compactInput} ${
                    !addressComponents.streetName && !disabled && styles.error
                  }`}
                  disabled={disabled}
                  placeholder="Street Name"
                />
              </div>
              <div className={styles.addressFieldMedium}>
                <select
                  value={addressComponents.streetType}
                  onChange={(e) =>
                    handleAddressComponentChange("streetType", e.target.value)
                  }
                  className={`${styles.input} ${styles.compactInput} ${
                    !addressComponents.streetType && !disabled && styles.error
                  }`}
                  disabled={disabled}
                >
                  {STREET_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCity} className={styles.icon} /> City{" "}
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.city || ""}
              onChange={(e) =>
                setCustomer({ ...customer, city: e.target.value })
              }
              className={`${styles.input} ${
                !customer.city && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholder="Enter city"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} />{" "}
              State <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.state || ""}
              onChange={(e) =>
                setCustomer({ ...customer, state: e.target.value })
              }
              className={`${styles.input} ${
                !customer.state && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholder="Enter state"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} />{" "}
              ZIP Code <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.zipCode || ""}
              onChange={(e) => setCustomer({ ...customer, zipCode: e.target.value })}
              className={`${styles.input} ${
                !customer.zipCode && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholder="Enter ZIP code"
            />
          </div>
        </CollapsibleSection>

        {/* Contact Information */}
        <CollapsibleSection
          title="Contact Information"
          icon={faPhone}
          isOpen={openSections.contact}
          toggleOpen={() => toggleSection("contact")}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faPhone} className={styles.icon} /> Phone{" "}
              <span className={styles.required}>*</span>
            </label>
            <PhoneInput
              country={"us"}
              onlyCountries={["us"]}
              disableDropdown={true}
              countryCodeEditable={false}
              value={customer.phone || ""}
              onChange={(phone) =>
                !disabled && setCustomer({ ...customer, phone })
              }
              inputClass={`${styles.phoneInput} ${
                (customer.phone && !validatePhone(customer.phone)) ||
                (!customer.phone && !disabled)
                  ? styles.error
                  : ""
              }`}
              containerClass={styles.phoneContainer}
              disableCountryCode={false}
              specialLabel={""}
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
              <FontAwesomeIcon icon={faEnvelope} className={styles.icon} />{" "}
              Email <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              value={customer.email || ""}
              onChange={(e) =>
                setCustomer({ ...customer, email: e.target.value })
              }
              className={`${styles.input} ${
                (customer.email && !validateEmail(customer.email)) ||
                (!customer.email && !disabled)
                  ? styles.error
                  : ""
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
          toggleOpen={() => toggleSection("project")}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Project
              Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.projectName || ""}
              onChange={(e) =>
                setCustomer({ ...customer, projectName: e.target.value })
              }
              className={`${styles.input} ${
                !customer.projectName && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholder="Enter project name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Customer
              Type
            </label>
            <select
              value={customer.type || "Residential"}
              onChange={(e) =>
                setCustomer({ ...customer, type: e.target.value })
              }
              className={styles.input}
              disabled={disabled}
            >
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCreditCard} className={styles.icon} />{" "}
              Payment Type
            </label>
            <select
              value={customer.paymentType || "Cash"}
              onChange={(e) =>
                setCustomer({ ...customer, paymentType: e.target.value })
              }
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
          toggleOpen={() => toggleSection("dates")}
        >
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCalendarAlt} className={styles.icon} />{" "}
              Start Date <span className={styles.required}>*</span>
            </label>
            <DatePicker
              selected={getDateValue(customer.startDate)}
              onChange={(date) => handleDateChange("startDate", date)}
              minDate={isEditMode ? null : today}
              filterDate={(date) => (isEditMode ? true : date >= today)}
              highlightDates={getBusyDateRanges()}
              renderDayContents={renderDayContents}
              className={`${styles.dateInput} ${
                !customer.startDate && !disabled && styles.error
              }`}
              disabled={disabled}
              placeholderText="Select start date"
              dateFormat="MM/dd/yyyy"
              strictParsing
              onFocus={(e) => e.target.blur()}
              showPopperArrow={false}
              popperClassName={styles.calendarPopper}
              popperPlacement="auto"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faCalendarAlt} className={styles.icon} />{" "}
              Finish Date
            </label>
            <DatePicker
              selected={getDateValue(customer.finishDate)}
              onChange={(date) => handleDateChange("finishDate", date)}
              minDate={getDateValue(customer.startDate) || today}
              filterDate={(date) =>
                date >= (getDateValue(customer.startDate) || today)
              }
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
              popperPlacement="auto"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faStickyNote} className={styles.icon} />{" "}
              Notes
            </label>
            <textarea
              value={customer.notes || ""}
              onChange={(e) =>
                setCustomer({ ...customer, notes: e.target.value })
              }
              className={styles.input}
              rows="2"
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
              <FontAwesomeIcon
                icon={faCalendarAlt}
                className={styles.sectionIcon}
              />
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
                  <span className={styles.busyCustomer}>
                    {busy.customerName}
                  </span>
                  <span className={styles.busyProject}>
                    ({busy.projectName})
                  </span>
                  <span className={styles.busyRange}>
                    {busy.startDate.toLocaleDateString()} -{" "}
                    {busy.finishDate.toLocaleDateString()}
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
