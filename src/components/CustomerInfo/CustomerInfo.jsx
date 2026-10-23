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
  faAddressBook,
  faSearch,
  faTimes,
  faLink,
  faCheck,
  faSpinner,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import styles from "./CustomerInfo.module.css";
import { getProjects } from "../../services/projectService";
import {
  getCustomers,
  getCustomer,
  findOrCreateCustomer,
  updateCustomer,
} from "../../services/customerService";
import {
  formatUSPhone,
  isValidUSPhone,
  normalizeUSPhone,
} from "../../utilities/phone";
import {
  DIRECTIONS,
  STREET_TYPES,
  parseStreetAddress,
  constructStreetAddress,
} from "../../utilities/address";
import {
  buildContactPayload,
  buildProjectCustomerFields,
  isContactPayloadComplete,
  diffContactFields,
  describeContactChanges,
} from "../../utilities/contactPayload";
import { isValidEmail } from "../../utilities/contactRules";

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

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  icon,
  children,
  isOpen,
  toggleOpen,
  errorCount = 0,
}) => (
  <div
    className={`${styles.section} ${
      errorCount > 0 ? styles.sectionWithWarning : ""
    }`}
  >
    <button
      className={styles.sectionHeader}
      onClick={toggleOpen}
      aria-expanded={isOpen}
      aria-controls={`section-${title.toLowerCase().replace(/\s/g, "-")}`}
      type="button"
    >
      <div className={styles.sectionTitle}>
        <FontAwesomeIcon icon={icon} className={styles.sectionIcon} />
        <h3>{title}</h3>
        {errorCount > 0 && (
          <span
            className={styles.sectionWarningBadge}
            title={`${errorCount} required or invalid item(s) in this section`}
          >
            <FontAwesomeIcon icon={faExclamationTriangle} /> {errorCount}
          </span>
        )}
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
  onImportContact,
  // Fires with the Contacts-directory _id whenever this component changes
  // which saved contact the current customer is linked to: the new id right
  // after a successful "Save to Contacts" / "Update Contact", or `null`
  // right after "Unlink". The parent (HomePage) uses this to keep its own
  // `customerId` state — the id it syncs projects against — from ever
  // drifting out of sync with what's actually linked here. Without this,
  // saving a brand-new contact here and then saving the project from
  // HomePage would create a second, duplicate contact.
  onContactLinkChange,
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

  // Import Contact states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [importSearchTerm, setImportSearchTerm] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Save-to-Contacts states — lets this form push its info back to the
  // shared Contacts directory, the other half of the Import Contact flow.
  const [contactSaveState, setContactSaveState] = useState("idle"); // idle | saving | saved | error
  const [contactSaveError, setContactSaveError] = useState("");

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

  // Section error counts for badges and warnings
  const sectionErrors = {
    personal:
      (!customer.firstName?.trim() ? 1 : 0) +
      (!customer.lastName?.trim() ? 1 : 0),
    address:
      ((!addressComponents.addressNumber?.trim() || !addressComponents.streetName?.trim()) && !customer.street?.trim() ? 1 : 0) +
      (!customer.city?.trim() ? 1 : 0) +
      (!customer.state?.trim() ? 1 : 0) +
      (!customer.zipCode?.trim() || !/^\d{5}$/.test(String(customer.zipCode).trim()) ? 1 : 0),
    contact:
      (!customer.phone?.trim() || !isValidUSPhone(customer.phone) ? 1 : 0) +
      (!customer.email?.trim() || !isValidEmail(customer.email) ? 1 : 0),
    project:
      (!customer.projectName?.trim() ? 1 : 0),
    dates:
      (!customer.startDate ? 1 : 0) +
      (customer.startDate && customer.finishDate && safeParseDate(customer.finishDate) < safeParseDate(customer.startDate) ? 1 : 0),
  };

  useEffect(() => {
    const fetchBusyDates = async () => {
      try {
        const projects = await getProjects();
        const detailedBusyDates = projects
          .filter(
            (project) =>
              project.workflowStatus !== "draft" &&
              (project.customerInfo?.startDate ||
                project.customerInfo?.finishDate),
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

  const validateEmail = (email) => isValidEmail(email);

  const validatePhone = (phone) => {
    return isValidUSPhone(phone);
  };

  // Handle phone change from PhoneInput (react-phone-input-2)
  // Strips the +1 country code so customer.phone only stores pure 10-digit national number
  const handlePhoneInputChange = (value, countryData) => {
    if (disabled) return;
    const dialCode = countryData?.dialCode || "1";
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith(dialCode)) {
      digits = digits.slice(dialCode.length);
    }
    if (digits.length === 10 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    setCustomer({ ...customer, phone: digits });
  };

  // Prepares the value for react-phone-input-2:
  // react-phone-input-2 with country="us" requires dialCode "1" prepended to display +1 (XXX) XXX-XXXX
  const getPhoneInputValue = (phone) => {
    const digits = normalizeUSPhone(phone).slice(0, 10);
    return digits ? `1${digits}` : "";
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

  const openImportModal = async () => {
    setIsImportModalOpen(true);
    setLoadingCustomers(true);
    try {
      const data = await getCustomers();
      setCustomersList(data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleImportSelect = (selected) => {
    setContactSaveState("idle");
    setContactSaveError("");
    const contactFields = buildProjectCustomerFields(selected);
    if (onImportContact) {
      onImportContact({
        ...customer,
        ...contactFields,
        _id: selected._id, // preserve the contact ID
      });
    } else {
      setCustomer({
        ...customer,
        ...contactFields,
        _id: selected._id,
      });
    }
    setIsImportModalOpen(false);
  };

  const filteredCustomers = customersList.filter(
    (c) =>
      `${c.firstName || ""} ${c.lastName || ""}`
        .toLowerCase()
        .includes(importSearchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(importSearchTerm)) ||
      (c.email &&
        c.email.toLowerCase().includes(importSearchTerm.toLowerCase())),
  );

  // Is this customer's contact-relevant info complete enough to save?
  // Delegates to the shared utility so this check can never drift from what
  // HomePage's auto-sync (or the Contacts directory) considers valid.
  const isContactReadyToSave = isContactPayloadComplete(customer);

  const isLinkedToContact = Boolean(customer._id);

  // Pushes the current contact-relevant fields to the Contacts directory:
  // creates a new contact if this customer isn't linked to one yet, or
  // updates the existing one if it is. buildContactPayload() intentionally
  // leaves out project-only fields (project name, dates, payment type,
  // notes, type, status) so this never overwrites a contact's own notes or
  // other fields with project-specific data — the same shared payload
  // builder is used by HomePage's auto-sync for the same reason.
  const handleSaveContact = async () => {
    if (disabled || !isContactReadyToSave || contactSaveState === "saving")
      return;

    setContactSaveState("saving");
    setContactSaveError("");
    try {
      const payload = buildContactPayload(customer);
      let saved;

      if (customer._id) {
        // LINKED → "Update Contact". Never blindly push this form over the
        // contact: load the contact's CURRENT data, show exactly what would
        // change, and send only those fields. This stops an old project from
        // silently overwriting a newer phone/email/address.
        const current = await getCustomer(customer._id);
        const { changes, patch } = diffContactFields(current, payload);

        if (Object.keys(changes).length === 0) {
          saved = current; // already identical — nothing to write
        } else {
          const ok = window.confirm(
            `Update the saved contact for ${current.firstName} ${current.lastName}?\n\n` +
              `${describeContactChanges(changes)}\n\n` +
              `This changes the Contacts directory (and what other projects see when they re-import it).`,
          );
          if (!ok) {
            setContactSaveState("idle");
            return;
          }
          saved = await updateCustomer(customer._id, patch, {
            expectedUpdatedAt: current.updatedAt,
          });
        }
      } else {
        // NOT LINKED → "Save to Contacts". Duplicate-safe: reuses the same
        // person if already saved, asks before creating a look-alike.
        let result = await findOrCreateCustomer(payload);
        if (result.needsDecision) {
          const m = result.matches[0];
          const useExisting = window.confirm(
            `A saved contact already matches this ${m.matchedOn}:\n\n` +
              `${m.firstName} ${m.lastName} — ${m.email}\n\n` +
              `OK = link to that existing contact (it will not be changed)\n` +
              `Cancel = save this as a separate new contact`,
          );
          result = useExisting
            ? { customer: m }
            : await findOrCreateCustomer(payload, { allowDuplicate: true });
        }
        saved = result.customer;
      }

      setCustomer({ ...customer, _id: saved._id });
      // Tell the parent (HomePage) which contact this now is, so its own
      // customerId state can't fall out of sync and cause a duplicate
      // contact to be created on the next project save/autosave.
      onContactLinkChange?.(saved._id);
      setContactSaveState("saved");
      setTimeout(() => setContactSaveState("idle"), 2500);
    } catch (err) {
      console.error("Error saving contact:", err);
      setContactSaveError(
        err.status === 409
          ? "This contact was changed elsewhere while you were editing. Click Update Contact again to review the latest version."
          : err.message || "Could not save this contact.",
      );
      setContactSaveState("error");
    }
  };

  // Detaches this project's customer info from the saved contact record.
  // After this, edits made here won't be pushed anywhere until "Save to
  // Contacts" is used again (which will then create a brand-new contact).
  const handleUnlinkContact = () => {
    if (disabled) return;
    const { _id, ...rest } = customer;
    setCustomer(rest);
    // Mirror the unlink up to the parent so a stale customerId there can't
    // cause the next autosave to silently re-link (or overwrite) the old
    // contact.
    onContactLinkChange?.(null);
    setContactSaveState("idle");
    setContactSaveError("");
  };

  return (
    <div className={styles.customerInfo}>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <h2 className={styles.title}>Customer Information</h2>
          {isLinkedToContact && (
            <span
              className={styles.linkedBadge}
              title="This project's info is linked to a saved contact — use Update Contact to push edits, or unlink to keep them separate"
            >
              <FontAwesomeIcon icon={faLink} /> Linked to contact
              {!disabled && (
                <button
                  type="button"
                  className={styles.unlinkButton}
                  onClick={handleUnlinkContact}
                  aria-label="Unlink from saved contact"
                  title="Unlink this project from the saved contact"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </span>
          )}
        </div>
        {!disabled && (
          <div className={styles.headerActions}>
            <button
              className={styles.importButton}
              onClick={openImportModal}
              type="button"
            >
              <FontAwesomeIcon icon={faAddressBook} /> Import Contact
            </button>
            <button
              className={styles.saveContactButton}
              onClick={handleSaveContact}
              type="button"
              disabled={!isContactReadyToSave || contactSaveState === "saving"}
              title={
                !isContactReadyToSave
                  ? "Fill in name, address, phone, and email to save this contact"
                  : isLinkedToContact
                  ? "Push these edits to the saved contact"
                  : "Save this person to your Contacts directory"
              }
            >
              <FontAwesomeIcon
                icon={
                  contactSaveState === "saving"
                    ? faSpinner
                    : contactSaveState === "saved"
                    ? faCheck
                    : faAddressBook
                }
                spin={contactSaveState === "saving"}
              />
              {contactSaveState === "saving"
                ? "Saving..."
                : contactSaveState === "saved"
                ? "Saved!"
                : isLinkedToContact
                ? "Update Contact"
                : "Save to Contacts"}
            </button>
          </div>
        )}
      </div>

      {contactSaveState === "error" && (
        <div className={styles.contactSaveError} role="alert">
          {contactSaveError}
        </div>
      )}

      {isImportModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3>Import a Contact</h3>
                <p className={styles.modalSubtitle}>
                  Selecting a contact fills in the fields below. You can still
                  edit them for this project — the saved contact only changes if
                  you click "Update Contact" afterward.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsImportModalOpen(false)}
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className={styles.searchBar}>
              <FontAwesomeIcon
                icon={faSearch}
                className={styles.searchBarIcon}
              />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={importSearchTerm}
                onChange={(e) => setImportSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.customersList}>
              {loadingCustomers ? (
                <div className={styles.modalLoading}>
                  <FontAwesomeIcon icon={faSpinner} spin /> Loading contacts...
                </div>
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
                  const isCurrent = isLinkedToContact && customer._id === c._id;
                  const initials = `${(c.firstName || "?")[0] || "?"}${
                    (c.lastName || "")[0] || ""
                  }`.toUpperCase();
                  return (
                    <div
                      key={c._id}
                      className={`${styles.customerItem} ${
                        isCurrent ? styles.customerItemActive : ""
                      }`}
                      onClick={() => handleImportSelect(c)}
                    >
                      <div className={styles.customerAvatar}>{initials}</div>
                      <div className={styles.customerItemBody}>
                        <div className={styles.customerName}>
                          {c.firstName} {c.lastName}
                          {isCurrent && (
                            <span className={styles.currentTag}>
                              Currently linked
                            </span>
                          )}
                        </div>
                        <div className={styles.customerDetails}>
                          {c.phone && (
                            <span>
                              <FontAwesomeIcon
                                icon={faPhone}
                                className={styles.icon}
                              />{" "}
                              {formatUSPhone(c.phone)}
                            </span>
                          )}
                          {c.email && (
                            <span>
                              <FontAwesomeIcon
                                icon={faEnvelope}
                                className={styles.icon}
                              />{" "}
                              {c.email}
                            </span>
                          )}
                          {(c.city || c.state) && (
                            <span>
                              <FontAwesomeIcon
                                icon={faMapMarkerAlt}
                                className={styles.icon}
                              />{" "}
                              {[c.city, c.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.useContactButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportSelect(c);
                        }}
                      >
                        Use
                      </button>
                    </div>
                  );
                })
              ) : customersList.length === 0 ? (
                <div className={styles.modalEmpty}>
                  <FontAwesomeIcon
                    icon={faAddressBook}
                    className={styles.modalEmptyIcon}
                  />
                  <p>No contacts saved yet.</p>
                  <p className={styles.modalEmptyHint}>
                    Fill in this form and click "Save to Contacts" below, or add
                    one from the Contacts directory.
                  </p>
                </div>
              ) : (
                <div className={styles.modalEmpty}>
                  <p>No contacts match &ldquo;{importSearchTerm}&rdquo;.</p>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsImportModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.form}>
        {/* Personal Information */}
        <CollapsibleSection
          title="Personal Information"
          icon={faUser}
          isOpen={openSections.personal}
          toggleOpen={() => toggleSection("personal")}
          errorCount={disabled ? 0 : sectionErrors.personal}
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
            {!customer.firstName?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> First name is required
              </span>
            )}
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
            {!customer.lastName?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Last name is required
              </span>
            )}
          </div>
        </CollapsibleSection>

        {/* Address Information */}
        <CollapsibleSection
          title="Address Information"
          icon={faMapMarkerAlt}
          isOpen={openSections.address}
          toggleOpen={() => toggleSection("address")}
          errorCount={disabled ? 0 : sectionErrors.address}
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
                    handleAddressComponentChange(
                      "addressNumber",
                      e.target.value,
                    )
                  }
                  className={`${styles.input} ${styles.compactInput} ${
                    !addressComponents.addressNumber &&
                    !disabled &&
                    styles.error
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
            {(!addressComponents.addressNumber?.trim() || !addressComponents.streetName?.trim()) && !customer.street?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Street number and name are required
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faHome} className={styles.icon} /> Unit /
              Apt
            </label>
            <input
              type="text"
              value={customer.unit || ""}
              onChange={(e) =>
                setCustomer({ ...customer, unit: e.target.value })
              }
              className={styles.input}
              disabled={disabled}
              placeholder="Unit, suite, or apt #"
            />
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
            {!customer.city?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> City is required
              </span>
            )}
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
            {!customer.state?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> State is required
              </span>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <FontAwesomeIcon icon={faMapMarkerAlt} className={styles.icon} />{" "}
              ZIP Code <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={customer.zipCode || ""}
              onChange={(e) =>
                setCustomer({ ...customer, zipCode: e.target.value })
              }
              className={`${styles.input} ${
                (!customer.zipCode || !/^\d{5}$/.test(String(customer.zipCode).trim())) &&
                !disabled &&
                styles.error
              }`}
              disabled={disabled}
              placeholder="Enter ZIP code (5 digits)"
            />
            {!customer.zipCode?.trim() && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> ZIP code is required
              </span>
            ) : customer.zipCode && !/^\d{5}$/.test(String(customer.zipCode).trim()) && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> ZIP Code must be exactly 5 digits
              </span>
            ) : null}
          </div>
        </CollapsibleSection>

        {/* Contact Information */}
        <CollapsibleSection
          title="Contact Information"
          icon={faPhone}
          isOpen={openSections.contact}
          toggleOpen={() => toggleSection("contact")}
          errorCount={disabled ? 0 : sectionErrors.contact}
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
              value={getPhoneInputValue(customer.phone)}
              onChange={handlePhoneInputChange}
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
            {!customer.phone?.trim() && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Phone number is required
              </span>
            ) : customer.phone && !validatePhone(customer.phone) && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Please enter a valid 10-digit US phone number
              </span>
            ) : null}
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
            {!customer.email?.trim() && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Email address is required
              </span>
            ) : customer.email && !validateEmail(customer.email) && !disabled ? (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Please enter a valid email address
              </span>
            ) : null}
          </div>
        </CollapsibleSection>

        {/* Project Information */}
        <CollapsibleSection
          title="Project Information"
          icon={faHome}
          isOpen={openSections.project}
          toggleOpen={() => toggleSection("project")}
          errorCount={disabled ? 0 : sectionErrors.project}
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
            {!customer.projectName?.trim() && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Project name is required
              </span>
            )}
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
          errorCount={disabled ? 0 : sectionErrors.dates}
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
            {!customer.startDate && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Start date is required
              </span>
            )}
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
            {customer.startDate && customer.finishDate && safeParseDate(customer.finishDate) < safeParseDate(customer.startDate) && !disabled && (
              <span className={styles.fieldWarning}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Finish date cannot be earlier than start date
              </span>
            )}
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
