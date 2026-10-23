// src/components/CustomerDirectory/CustomerDirectory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faMapMarkerAlt,
  faRoad,
  faCity,
  faPhone,
  faEnvelope,
  faStickyNote,
  faSearch,
  faTimes,
  faPlus,
  faEdit,
  faTrash,
  faSave,
  faUndo,
  faAddressBook,
  faEye,
  faSpinner,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import {
  findOrCreateCustomer,
  deleteCustomer,
  getCustomers,
  getCustomerProjects,
  updateCustomer,
  syncCustomersFromProjects,
} from "../../services/customerService";
import {
  formatUSPhone,
  isValidUSPhone,
  normalizeUSPhone,
} from "../../utilities/phone";
import styles from "./CustomerDirectory.module.css";
// Shared with CustomerInfo.jsx and HomePage.jsx so a contact saved here has
// the same street/addressNumber/direction/streetName/streetType shape used
// everywhere else, and edits to an existing contact roundtrip cleanly no
// matter which screen made them.
import {
  DIRECTIONS,
  STREET_TYPES,
  parseStreetAddress,
  constructStreetAddress,
} from "../../utilities/address";
import { buildProjectCustomerFields } from "../../utilities/contactPayload";
import { isValidEmail, isValidZip } from "../../utilities/contactRules";

const emptyAddress = {
  addressNumber: "",
  direction: "",
  streetName: "",
  streetType: "",
};
const emptyForm = {
  firstName: "",
  lastName: "",
  unit: "",
  city: "",
  state: "IL",
  zipCode: "",
  phone: "",
  email: "",
  notes: "",
};

// send-request already folds the server's `details` into err.message.
const errorText = (err, fallback) => err?.message || fallback;

export default function CustomerDirectory() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [address, setAddress] = useState(emptyAddress);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingUpdatedAt, setEditingUpdatedAt] = useState(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setCustomers(await getCustomers());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.city}`
        .toLowerCase()
        .includes(q),
    );
  }, [customers, query]);

  const change = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const changeAddress = (field, value) =>
    setAddress((p) => ({ ...p, [field]: value }));
  const changePhone = (e) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    } else if (digits.length === 10 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    setForm((p) => ({ ...p, phone: digits }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setAddress(emptyAddress);
    setEditingId(null);
    setEditingUpdatedAt(null);
    setError("");
  };

  const syncFromProjects = async () => {
    setIsSyncing(true);
    setError("");
    setNotice("");
    try {
      const result = await syncCustomersFromProjects();
      const skippedDetails = Array.isArray(result.skippedDetails)
        ? result.skippedDetails
        : [];
      await load();
      const details = skippedDetails.length
        ? ` Needs review: ${skippedDetails
            .map((item) => `${item.name} (${item.reasons.join(", ")})`)
            .join("; ")}`
        : "";
      setNotice(
        `Project contacts synchronized safely: ${result.created} added, ${result.linked} linked, ${result.skipped} skipped` +
          `${
            result.failed ? `, ${result.failed} failed` : ""
          }. Existing contact details were not overwritten.${details}`,
      );
    } catch (err) {
      setError(
        err.status === 404
          ? "Contact sync isn't available on this server version."
          : errorText(err, "Could not synchronize project contacts."),
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const street = constructStreetAddress(address);
    if (!form.firstName.trim() || !form.lastName.trim())
      return setError("First and last name are required.");
    if (!address.addressNumber.trim() || !address.streetName.trim())
      return setError("Enter a street number and name.");
    if (!form.city.trim()) return setError("City is required.");
    if (!isValidZip(form.zipCode))
      return setError("ZIP code must be exactly 5 digits.");
    if (!isValidUSPhone(form.phone))
      return setError("Enter a valid US phone number, such as (312) 555-0147.");
    if (!isValidEmail(form.email))
      return setError("Enter a valid email address.");

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        street,
        addressNumber: address.addressNumber,
        direction: address.direction,
        streetName: address.streetName,
        streetType: address.streetType,
        phone: normalizeUSPhone(form.phone),
      };

      if (editingId) {
        // Editing the master record. expectedUpdatedAt makes the server refuse
        // if this contact was changed elsewhere since it was opened here.
        const saved = await updateCustomer(editingId, payload, {
          expectedUpdatedAt: editingUpdatedAt,
        });
        setCustomers((prev) =>
          prev.map((c) => (c._id === saved._id ? { ...c, ...saved } : c)),
        );
        resetForm();
        return;
      }

      // New contact: don't silently create a duplicate.
      let result = await findOrCreateCustomer(payload);
      if (result.needsDecision) {
        const m = result.matches[0];
        const openExisting = window.confirm(
          `A saved contact already matches this ${m.matchedOn}:\n\n` +
            `${m.firstName} ${m.lastName} — ${m.email}\n\n` +
            `OK = open that existing contact instead\n` +
            `Cancel = add this as a separate new contact`,
        );
        if (openExisting) {
          const existing = customers.find((c) => c._id === m._id);
          if (existing) edit(existing);
          return;
        }
        result = await findOrCreateCustomer(payload, { allowDuplicate: true });
      } else if (result.reused) {
        const existing =
          customers.find((c) => c._id === result.customer._id) ||
          result.customer;
        edit(existing);
        setNotice(
          "This person is already saved — opened the existing contact.",
        );
        return;
      }
      setCustomers((prev) => [
        { ...result.customer, projectCount: 0 },
        ...prev,
      ]);
      resetForm();
    } catch (err) {
      setError(
        err.status === 409
          ? "This contact was changed elsewhere since you opened it. Close and reopen it to see the latest details."
          : errorText(err, "Could not save this contact."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (customer) => {
    setEditingId(customer._id);
    setEditingUpdatedAt(customer.updatedAt || null);
    setForm({
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      unit: customer.unit || "",
      city: customer.city || "",
      state: customer.state || "IL",
      zipCode: customer.zipCode || "",
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setAddress(parseStreetAddress(customer.street));
    setError("");
    setNotice("");
  };

  const finishRemove = (id) => {
    setCustomers((p) => p.filter((c) => c._id !== id));
    if (editingId === id) resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this customer record?")) return;
    try {
      await deleteCustomer(id);
      finishRemove(id);
    } catch (e) {
      if (e.status === 409) {
        // Linked to projects: offer to detach them (projects keep their own
        // copy of the customer details, so no project data is lost).
        const unlink = window.confirm(
          "This contact is linked to one or more projects.\n\n" +
            "OK = unlink those projects and delete the contact (the projects keep their customer details)\n" +
            "Cancel = keep the contact",
        );
        if (!unlink) return;
        try {
          await deleteCustomer(id, { unlinkProjects: true });
          finishRemove(id);
        } catch (err) {
          setError(errorText(err, "Could not delete this contact."));
        }
        return;
      }
      setError(errorText(e, "Could not delete this contact."));
    }
  };

  const viewProjects = async (customer) => {
    try {
      const projects = await getCustomerProjects(customer._id);
      navigate("/home/customer-projects", { state: { projects } });
    } catch (err) {
      setError(err.message || "Could not load this contact's projects.");
    }
  };

  return (
    <main className={styles.mainContent} role="main">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Contacts</h1>
            <p className={styles.subtitle}>
              Save callers once, then reuse their details on every project.
            </p>
          </div>
          <div className={styles.headerTools}>
            <button
              className={styles.syncButton}
              onClick={syncFromProjects}
              disabled={isSyncing}
              type="button"
            >
              <FontAwesomeIcon
                icon={isSyncing ? faSpinner : faSync}
                spin={isSyncing}
              />
              {isSyncing ? "Syncing projects…" : "Sync from projects"}
            </button>
            <div className={styles.searchWrapper}>
              <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, phone, or city..."
              />
              {query && (
                <button
                  className={styles.clearButton}
                  onClick={() => setQuery("")}
                  type="button"
                  aria-label="Clear search"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
            }}
          >
            {notice}
          </div>
        )}

        <div className={styles.layout}>
          {/* ── Form Panel ── */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <FontAwesomeIcon
                icon={editingId ? faEdit : faPlus}
                className={styles.panelIcon}
              />
              <h2 className={styles.panelTitle}>
                {editingId ? "Edit Contact" : "Add Contact"}
              </h2>
            </div>

            <form className={styles.form} onSubmit={save}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon icon={faUser} className={styles.icon} />{" "}
                    First Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    name="firstName"
                    value={form.firstName}
                    onChange={change}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon icon={faUser} className={styles.icon} />{" "}
                    Last Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    name="lastName"
                    value={form.lastName}
                    onChange={change}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  <FontAwesomeIcon icon={faRoad} className={styles.icon} />{" "}
                  Street Address <span className={styles.required}>*</span>
                </label>
                <div className={styles.addressRow}>
                  <input
                    className={`${styles.input} ${styles.compactInput}`}
                    value={address.addressNumber}
                    onChange={(e) =>
                      changeAddress("addressNumber", e.target.value)
                    }
                    placeholder="No."
                  />
                  <select
                    className={`${styles.input} ${styles.compactInput}`}
                    value={address.direction}
                    onChange={(e) => changeAddress("direction", e.target.value)}
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${styles.input} ${styles.compactInput} ${styles.addressFieldLarge}`}
                    value={address.streetName}
                    onChange={(e) =>
                      changeAddress("streetName", e.target.value)
                    }
                    placeholder="Street Name"
                  />
                  <select
                    className={`${styles.input} ${styles.compactInput}`}
                    value={address.streetType}
                    onChange={(e) =>
                      changeAddress("streetType", e.target.value)
                    }
                  >
                    {STREET_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Unit / Apt</label>
                <input
                  className={styles.input}
                  name="unit"
                  value={form.unit}
                  onChange={change}
                  placeholder="Unit, suite, or apt #"
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon icon={faCity} className={styles.icon} />{" "}
                    City <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    name="city"
                    value={form.city}
                    onChange={change}
                    placeholder="Enter city"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon
                      icon={faMapMarkerAlt}
                      className={styles.icon}
                    />{" "}
                    State
                  </label>
                  <input
                    className={styles.input}
                    name="state"
                    value={form.state}
                    onChange={change}
                    placeholder="State"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon
                      icon={faMapMarkerAlt}
                      className={styles.icon}
                    />{" "}
                    ZIP <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    name="zipCode"
                    value={form.zipCode}
                    onChange={change}
                    placeholder="Enter ZIP code"
                    maxLength={5}
                    required
                  />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon icon={faPhone} className={styles.icon} />{" "}
                    Phone <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    name="phone"
                    value={formatUSPhone(form.phone)}
                    onChange={changePhone}
                    placeholder="(555) 123-4567"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className={styles.icon}
                    />{" "}
                    Email <span className={styles.required}>*</span>
                  </label>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={change}
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  <FontAwesomeIcon
                    icon={faStickyNote}
                    className={styles.icon}
                  />{" "}
                  Notes
                </label>
                <textarea
                  className={styles.input}
                  name="notes"
                  value={form.notes}
                  onChange={change}
                  rows={2}
                  placeholder="Add any notes"
                />
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={isSaving}
                >
                  <FontAwesomeIcon
                    icon={isSaving ? faSpinner : faSave}
                    spin={isSaving}
                    className={styles.buttonIcon}
                  />
                  {isSaving
                    ? "Saving..."
                    : editingId
                    ? "Update Contact"
                    : "Save Contact"}
                </button>
                {editingId && (
                  <button
                    className={styles.resetButton}
                    type="button"
                    onClick={resetForm}
                  >
                    <FontAwesomeIcon
                      icon={faUndo}
                      className={styles.buttonIcon}
                    />
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* ── Directory Panel ── */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <FontAwesomeIcon
                icon={faAddressBook}
                className={styles.panelIcon}
              />
              <h2 className={styles.panelTitle}>
                Saved Contacts ({visible.length})
              </h2>
            </div>

            {isLoading ? (
              <div className={styles.loading}>
                <FontAwesomeIcon icon={faSpinner} spin /> Loading contacts...
              </div>
            ) : visible.length === 0 ? (
              <div className={styles.empty}>No contacts found.</div>
            ) : (
              <div className={styles.list}>
                {visible.map((c) => (
                  <article
                    className={`${styles.card} ${
                      editingId === c._id ? styles.cardActive : ""
                    }`}
                    key={c._id}
                  >
                    <div className={styles.cardBody}>
                      <div className={styles.name}>
                        {c.firstName} {c.lastName}
                        <span className={styles.projectCount}>
                          {c.projectCount || 0}{" "}
                          {(c.projectCount || 0) === 1 ? "project" : "projects"}
                        </span>
                      </div>
                      <div className={styles.details}>
                        <span>
                          <FontAwesomeIcon
                            icon={faPhone}
                            className={styles.icon}
                          />{" "}
                          {formatUSPhone(c.phone)}
                        </span>
                        <span>
                          <FontAwesomeIcon
                            icon={faEnvelope}
                            className={styles.icon}
                          />{" "}
                          {c.email}
                        </span>
                        <span>
                          <FontAwesomeIcon
                            icon={faMapMarkerAlt}
                            className={styles.icon}
                          />{" "}
                          {c.street}, {c.city}, {c.state} {c.zipCode}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.viewIconButton}
                        onClick={() => viewProjects(c)}
                        type="button"
                        disabled={!c.projectCount}
                        aria-label={`View projects for ${c.firstName} ${c.lastName}`}
                        title={
                          c.projectCount
                            ? "View projects"
                            : "No linked projects"
                        }
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                      <button
                        className={styles.newProjectIconButton}
                        onClick={() =>
                          navigate("/home/customer", {
                            state: {
                              customerInfo: buildProjectCustomerFields(c),
                              customerId: c._id,
                              freshProject: true,
                            },
                          })
                        }
                        type="button"
                        aria-label={`Create a project for ${c.firstName} ${c.lastName}`}
                        title="Create project"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                      <button
                        className={styles.editIconButton}
                        onClick={() => edit(c)}
                        type="button"
                        aria-label={`Edit ${c.firstName} ${c.lastName}`}
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button
                        className={styles.deleteIconButton}
                        onClick={() => remove(c._id)}
                        type="button"
                        aria-label={`Delete ${c.firstName} ${c.lastName}`}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
