// src/components/CompanyExpenses/Workers.jsx
import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faPlus,
  faPen,
  faTrash,
  faChevronDown,
  faChevronRight,
  faSearch,
  faFilter,
  faPhone,
  faLocationDot,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import * as workersAPI from "../../utilities/workers-api";
import {
  money,
  formatPhone,
  formatDate,
  getInitials,
  getProjectLabel,
} from "./expenseShared";
import styles from "./Workers.module.css";

const EMPTY_FORM = {
  name: "",
  phone: "",
  street: "",
  unit: "",
  city: "",
  state: "IL",
  zipCode: "",
};

const formatAddress = (a) => {
  // A bare default state with no street/city isn't a real address
  if (!a || (!a.street && !a.city)) return "";
  const line1 = [a.street, a.unit].filter(Boolean).join(", ");
  const line2 = [a.city, [a.state, a.zipCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [line1, line2].filter(Boolean).join(" · ");
};

const EMPTY_STATS = {
  payYear: 0,
  mealsYear: 0,
  payTotal: 0,
  mealsTotal: 0,
  lastPaid: "",
  owed: 0,
  projects: {},
};

export default function Workers({
  workers,
  assignments,
  expenses,
  projects,
  onWorkerSaved,
  onWorkerRemoved,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const projectLabelById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p._id, getProjectLabel(p)])),
    [projects],
  );

  // Per worker: pay / meals this year and all time, last payment, and the
  // agreed vs paid picture on each project.
  //
  // "Paid" against an agreed amount is Worker Pay only. Meals are a cost of
  // having the worker on the job, tracked separately.
  const stats = useMemo(() => {
    const byWorker = {};
    const entry = (workerId) => {
      if (!byWorker[workerId]) {
        byWorker[workerId] = { ...EMPTY_STATS, projects: {} };
      }
      return byWorker[workerId];
    };
    const projectEntry = (workerId, projectId) => {
      const w = entry(workerId);
      if (!w.projects[projectId]) {
        w.projects[projectId] = { agreed: 0, paid: 0, meals: 0 };
      }
      return w.projects[projectId];
    };

    assignments.forEach((a) => {
      projectEntry(a.workerId, a.projectId).agreed = a.agreedAmount;
    });

    expenses.forEach((e) => {
      if (!e.workerId) return;
      const isPay = e.category === "worker_pay";
      const isMeal = e.category === "crew_meals";
      if (!isPay && !isMeal) return;

      const w = entry(e.workerId);
      const inYear = e.date.startsWith(year);
      if (isPay) {
        w.payTotal += e.amount;
        if (inYear) w.payYear += e.amount;
        if (e.date > w.lastPaid) w.lastPaid = e.date;
      } else {
        w.mealsTotal += e.amount;
        if (inYear) w.mealsYear += e.amount;
      }
      if (e.projectId) {
        const p = projectEntry(e.workerId, e.projectId);
        if (isPay) p.paid += e.amount;
        else p.meals += e.amount;
      }
    });

    // Outstanding balance across projects that still exist
    Object.values(byWorker).forEach((w) => {
      w.owed = Object.entries(w.projects).reduce(
        (sum, [projectId, p]) =>
          projectLabelById[projectId]
            ? sum + Math.max(0, p.agreed - p.paid)
            : sum,
        0,
      );
    });
    return byWorker;
  }, [assignments, expenses, year, projectLabelById]);

  const getStats = (id) => stats[id] || EMPTY_STATS;

  const visibleWorkers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workers
      .filter((w) => showInactive || w.active !== false)
      .filter(
        (w) =>
          !term ||
          `${w.name} ${w.phone || ""} ${formatPhone(w.phone)} ${formatAddress(
            w.address,
          )}`
            .toLowerCase()
            .includes(term),
      )
      .sort((a, b) => {
        if (sortBy === "cost") {
          const sa = getStats(a._id);
          const sb = getStats(b._id);
          return sb.payTotal + sb.mealsTotal - (sa.payTotal + sa.mealsTotal);
        }
        if (sortBy === "owed")
          return getStats(b._id).owed - getStats(a._id).owed;
        return a.name.localeCompare(b.name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, showInactive, search, sortBy, stats]);

  const inactiveCount = workers.filter((w) => w.active === false).length;

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set([
          String(new Date().getFullYear()),
          ...expenses
            .map((e) => String(e.date || "").slice(0, 4))
            .filter(Boolean),
        ]),
      ).sort((a, b) => b.localeCompare(a)),
    [expenses],
  );

  const summary = useMemo(
    () =>
      workers.reduce(
        (out, w) => {
          const st = stats[w._id] || EMPTY_STATS;
          out.pay += st.payYear;
          out.meals += st.mealsYear;
          out.total += st.payTotal + st.mealsTotal;
          if (w.active !== false) {
            out.active += 1;
            out.owed += st.owed;
          }
          return out;
        },
        { pay: 0, meals: 0, total: 0, active: 0, owed: 0 },
      ),
    [workers, stats],
  );

  // ── Form handling ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (w) => {
    setEditingId(w._id);
    setForm({
      name: w.name || "",
      phone: formatPhone(w.phone),
      street: w.address?.street || "",
      unit: w.address?.unit || "",
      city: w.address?.city || "",
      state: w.address?.state || "",
      zipCode: w.address?.zipCode || "",
    });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "phone"
          ? formatPhone(value)
          : name === "state"
          ? value.toUpperCase().slice(0, 2)
          : name === "zipCode"
          ? value.replace(/\D/g, "").slice(0, 5)
          : value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!name) return setError("Please enter the worker's full name.");
    if (phoneDigits && phoneDigits.length !== 10) {
      return setError("Phone number must be 10 digits.");
    }
    if (form.zipCode && form.zipCode.length !== 5) {
      return setError("ZIP code must be 5 digits.");
    }
    if (form.state && form.state.length !== 2) {
      return setError("State must be a 2-letter code.");
    }

    const payload = {
      name,
      phone: phoneDigits,
      address: {
        street: form.street.trim(),
        unit: form.unit.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
      },
    };

    try {
      setSaving(true);
      setError(null);
      const saved = editingId
        ? await workersAPI.updateWorker(editingId, payload)
        : await workersAPI.createWorker(payload);
      onWorkerSaved(saved);
      closeForm();
    } catch (err) {
      console.error("Error saving worker:", err);
      setError("Could not save the worker. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (w) => {
    if (
      !window.confirm(
        `Remove ${w.name}? If they have recorded payments they will be set to inactive instead, so your history stays intact.`,
      )
    )
      return;
    try {
      setError(null);
      const result = await workersAPI.deleteWorker(w._id);
      if (result && result.deactivated) {
        onWorkerSaved({ ...w, active: false });
      } else {
        onWorkerRemoved(w._id);
      }
    } catch (err) {
      console.error("Error removing worker:", err);
      setError("Could not remove the worker. Please try again.");
    }
  };

  const handleReactivate = async (w) => {
    try {
      setError(null);
      const saved = await workersAPI.updateWorker(w._id, { active: true });
      onWorkerSaved(saved);
    } catch (err) {
      console.error("Error reactivating worker:", err);
      setError("Could not reactivate the worker. Please try again.");
    }
  };

  const field = (id, label, extra = {}) => (
    <div className={`${styles.field} ${extra.span || ""}`}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={extra.name}
        type={extra.type || "text"}
        inputMode={extra.inputMode}
        className={styles.input}
        value={form[extra.name]}
        onChange={handleChange}
        placeholder={extra.placeholder}
        autoFocus={extra.autoFocus}
      />
    </div>
  );

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <FontAwesomeIcon icon={faUsers} />
          Workers
        </h2>
        <div className={styles.headerActions}>
          {inactiveCount > 0 && (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive ({inactiveCount})
            </label>
          )}
          {!showForm && (
            <button type="button" className={styles.button} onClick={openAdd}>
              <FontAwesomeIcon icon={faPlus} /> Add worker
            </button>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span>Active workers</span>
          <strong>{summary.active}</strong>
          <small>Current roster</small>
        </div>
        <div className={styles.metric}>
          <span>{year} worker pay</span>
          <strong>{money(summary.pay)}</strong>
          <small>Direct payments, all projects</small>
        </div>
        <div className={styles.metric}>
          <span>{year} worker meals</span>
          <strong>{money(summary.meals)}</strong>
          <small>Lunches bought for named workers</small>
        </div>
        <div className={styles.metric}>
          <span>Owed to active workers</span>
          <strong
            className={summary.owed > 0 ? styles.warning : styles.positive}
          >
            {money(summary.owed)}
          </strong>
          <small>
            Agreed minus paid · {money(summary.total)} all-time cost
          </small>
        </div>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <h3 className={styles.formTitle}>
            <FontAwesomeIcon icon={editingId ? faPen : faUserPlus} />
            {editingId ? "Edit worker" : "New worker"}
          </h3>
          <div className={styles.formGrid}>
            {field("worker-name", "Full name", {
              name: "name",
              placeholder: "e.g. Ahmed Hassan",
              span: styles.spanName,
              autoFocus: true,
            })}
            {field("worker-phone", "Phone", {
              name: "phone",
              type: "tel",
              placeholder: "(312) 555-1234",
              span: styles.spanPhone,
            })}
            {field("worker-street", "Street address", {
              name: "street",
              span: styles.spanStreet,
            })}
            {field("worker-unit", "Unit / Apt", {
              name: "unit",
              span: styles.spanUnit,
            })}
            {field("worker-city", "City", {
              name: "city",
              span: styles.spanCity,
            })}
            {field("worker-state", "State", {
              name: "state",
              placeholder: "IL",
              span: styles.spanState,
            })}
            {field("worker-zip", "ZIP", {
              name: "zipCode",
              inputMode: "numeric",
              span: styles.spanZip,
            })}
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add worker"}
            </button>
            <button
              type="button"
              className={styles.buttonGhost}
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <FontAwesomeIcon icon={faSearch} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or address"
            aria-label="Search workers"
          />
        </div>
        <label className={styles.control}>
          <FontAwesomeIcon icon={faFilter} /> Year
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {availableYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="cost">Highest cost (all time)</option>
            <option value="owed">Most owed</option>
          </select>
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Worker</th>
              <th>Contact</th>
              <th className={styles.num}>Owed</th>
              <th className={styles.num}>Costs {year}</th>
              <th>Last paid</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visibleWorkers.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.empty}>
                  {workers.length === 0
                    ? "No workers yet. Add your first worker above."
                    : "No workers match your search."}
                </td>
              </tr>
            ) : (
              visibleWorkers.map((w) => {
                const st = getStats(w._id);
                const projectRows = Object.entries(st.projects);
                const expanded = expandedId === w._id;
                const inactive = w.active === false;
                const address = formatAddress(w.address);
                return (
                  <React.Fragment key={w._id}>
                    <tr className={inactive ? styles.inactiveRow : ""}>
                      <td>
                        <div className={styles.workerCell}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            title={expanded ? "Hide projects" : "Show projects"}
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedId(expanded ? null : w._id)
                            }
                          >
                            <FontAwesomeIcon
                              icon={expanded ? faChevronDown : faChevronRight}
                            />
                          </button>
                          <span className={styles.avatar}>
                            {getInitials(w.name)}
                          </span>
                          <div className={styles.workerName}>
                            <strong>
                              {w.name}
                              {inactive && (
                                <span className={styles.tag}>Inactive</span>
                              )}
                            </strong>
                            <small>
                              {projectRows.length}{" "}
                              {projectRows.length === 1
                                ? "project"
                                : "projects"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.contact}>
                          {w.phone ? (
                            <a
                              href={`tel:${w.phone}`}
                              className={styles.contactLink}
                            >
                              <FontAwesomeIcon icon={faPhone} />{" "}
                              {formatPhone(w.phone)}
                            </a>
                          ) : (
                            <span className={styles.muted}>No phone</span>
                          )}
                          {address && (
                            <span className={styles.address}>
                              <FontAwesomeIcon icon={faLocationDot} /> {address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={`${styles.num} ${
                          st.owed > 0 ? styles.warning : styles.muted
                        }`}
                      >
                        {st.owed > 0 ? money(st.owed) : "—"}
                      </td>
                      <td className={styles.num}>
                        <strong>{money(st.payYear + st.mealsYear)}</strong>
                        <small className={styles.breakdown}>
                          Pay {money(st.payYear)} · Meals {money(st.mealsYear)}
                        </small>
                      </td>
                      <td className={styles.nowrap}>
                        {st.lastPaid ? (
                          formatDate(st.lastPaid)
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td className={styles.actionsCell}>
                        {inactive ? (
                          <button
                            type="button"
                            className={styles.buttonGhost}
                            onClick={() => handleReactivate(w)}
                          >
                            Reactivate
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.iconButton}
                              title="Edit worker"
                              aria-label={`Edit ${w.name}`}
                              onClick={() => openEdit(w)}
                            >
                              <FontAwesomeIcon icon={faPen} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.dangerButton}`}
                              title="Remove worker"
                              aria-label={`Remove ${w.name}`}
                              onClick={() => handleRemove(w)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className={styles.detailsRow}>
                        <td colSpan="6">
                          <div className={styles.details}>
                            {projectRows.length === 0 ? (
                              <span className={styles.muted}>
                                Not on any project yet. Add them from Project
                                Profit below.
                              </span>
                            ) : (
                              <table className={styles.table}>
                                <thead>
                                  <tr>
                                    <th>Project</th>
                                    <th className={styles.num}>Agreed</th>
                                    <th className={styles.num}>Paid</th>
                                    <th className={styles.num}>Meals</th>
                                    <th className={styles.num}>Balance owed</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectRows.map(([projectId, p]) => {
                                    const balance = p.agreed - p.paid;
                                    return (
                                      <tr key={projectId}>
                                        <td>
                                          {projectLabelById[projectId] ||
                                            "Deleted project"}
                                        </td>
                                        <td className={styles.num}>
                                          {money(p.agreed)}
                                        </td>
                                        <td className={styles.num}>
                                          {money(p.paid)}
                                        </td>
                                        <td
                                          className={`${styles.num} ${styles.muted}`}
                                        >
                                          {p.meals > 0 ? money(p.meals) : "—"}
                                        </td>
                                        <td
                                          className={`${styles.num} ${
                                            balance < 0 ? styles.negative : ""
                                          }`}
                                        >
                                          {balance < 0
                                            ? `${money(
                                                Math.abs(balance),
                                              )} overpaid`
                                            : money(balance)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                            <p className={styles.note}>
                              All time: worker pay {money(st.payTotal)} · meals{" "}
                              {money(st.mealsTotal)} · total cost{" "}
                              {money(st.payTotal + st.mealsTotal)}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        “Costs {year}” adds up Worker Pay plus Crew Meals tagged to the worker,
        cash included, so you have it at tax time. “Owed” compares each agreed
        amount with Worker Pay only.
      </p>
    </section>
  );
}
