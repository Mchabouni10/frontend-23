// src/components/Calculator/Category/TaxonomyManager.jsx
/**
 * TaxonomyManager
 *
 * Professional taxonomy panel — fully integrated with the global design system.
 * Uses CSS variables from index.css (--primary, --secondary, --surface, etc.)
 * and Font Awesome icons to match CategoryList's visual language exactly.
 *
 * Features:
 *  - Add / Edit / Delete  categories, work types, and subtypes
 *  - Custom confirmation modal with cascade warnings (no window.confirm)
 *  - Inline duplicate-detection errors per field
 *  - 🔒 lock badge on built-in items, ★ badge on custom items
 *  - Toast notification stack for every action
 *  - Full dark-mode support via CSS custom properties
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./TaxonomyManager.module.css";

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal — replaces window.confirm with a branded, accessible modal
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({ config, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!config) return null;

  const {
    title,
    body,
    bullets,
    confirmLabel = "Delete",
    confirmVariant = "danger",
  } = config;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={styles.modal}>
        <div
          className={`${styles.modalIconWrap} ${
            styles[`modalIconWrap--${confirmVariant}`]
          }`}
        >
          <i
            className={`fas ${
              confirmVariant === "danger"
                ? "fa-exclamation-triangle"
                : "fa-info-circle"
            }`}
            aria-hidden="true"
          />
        </div>

        <h3 id="tm-modal-title" className={styles.modalTitle}>
          {title}
        </h3>

        {body && <p className={styles.modalBody}>{body}</p>}

        {bullets && bullets.length > 0 && (
          <ul className={styles.modalBullets}>
            {bullets.map((b, i) => (
              <li key={i}>
                <i
                  className="fas fa-circle"
                  aria-hidden="true"
                  style={{ fontSize: "6px" }}
                />
                {b}
              </li>
            ))}
          </ul>
        )}

        <p className={styles.modalFootnote}>
          <i className="fas fa-lock" aria-hidden="true" /> This action cannot be
          undone.
        </p>

        <div className={styles.modalActions}>
          <button
            ref={cancelRef}
            className={styles.modalBtnCancel}
            onClick={onCancel}
          >
            <i className="fas fa-times" aria-hidden="true" /> Cancel
          </button>
          <button
            className={`${styles.modalBtnConfirm} ${
              styles[`modalBtnConfirm--${confirmVariant}`]
            }`}
            onClick={onConfirm}
          >
            <i className="fas fa-trash-alt" aria-hidden="true" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification stack
// ─────────────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.toastStack} aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[`toast--${t.type}`]}`}
        >
          <i
            className={`fas ${
              t.type === "success"
                ? "fa-check-circle"
                : t.type === "error"
                ? "fa-exclamation-circle"
                : "fa-info-circle"
            }`}
            aria-hidden="true"
          />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineField — text input + save/cancel row + error display
// ─────────────────────────────────────────────────────────────────────────────

function InlineField({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  error,
  autoFocus,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={styles.inlineField}>
      <div
        className={`${styles.inlineRow} ${
          error ? styles.inlineRow__error : ""
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          className={styles.inlineInput}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <button
          className={styles.inlineSaveBtn}
          onClick={onSubmit}
          title="Save (Enter)"
          type="button"
        >
          <i className="fas fa-check" aria-hidden="true" />
        </button>
        <button
          className={styles.inlineCancelBtn}
          onClick={onCancel}
          title="Cancel (Escape)"
          type="button"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className={styles.fieldError} role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement type metadata
// ─────────────────────────────────────────────────────────────────────────────

const MEASURE_META = {
  "square-foot": { label: "Sq Ft", cls: "measure--sqft" },
  "linear-foot": { label: "Lin Ft", cls: "measure--linft" },
  "by-unit": { label: "By Unit", cls: "measure--unit" },
};

// ─────────────────────────────────────────────────────────────────────────────
// MeasurePicker — toggle-chip row for choosing measurement type
// ─────────────────────────────────────────────────────────────────────────────

function MeasurePicker({ value, onChange }) {
  return (
    <div className={styles.measurePickerRow}>
      <span className={styles.measurePickerLabel}>Measurement:</span>
      <div className={styles.measureChips}>
        {Object.entries(MEASURE_META).map(([val, meta]) => (
          <button
            key={val}
            type="button"
            className={`${styles.measureChip} ${
              value === val ? styles.measureChip__active : ""
            }`}
            onClick={() => onChange(val)}
          >
            {meta.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TaxonomyManager({
  taxonomy,
  onClose,
  createCategory,
  updateCategory,
  deleteCategory,
  createWorkType,
  updateWorkType,
  deleteWorkType,
  createSubtype,
  updateSubtype,
  deleteSubtype,
  setDefaultSubtype,
}) {
  // ── Tree expand state ────────────────────────────────────────────────────────
  const [expandedCats, setExpandedCats] = useState({});
  const [expandedWTs, setExpandedWTs] = useState({});
  const toggleCat = (key) => setExpandedCats((p) => ({ ...p, [key]: !p[key] }));
  const toggleWT = (key) => setExpandedWTs((p) => ({ ...p, [key]: !p[key] }));

  // ── Add-new form state ───────────────────────────────────────────────────────
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatError, setNewCatError] = useState("");

  const [addingWTFor, setAddingWTFor] = useState(null);
  const [newWTName, setNewWTName] = useState("");
  const [newWTMeasure, setNewWTMeasure] = useState("square-foot");
  const [newWTError, setNewWTError] = useState("");

  const [addingSTFor, setAddingSTFor] = useState(null);
  const [newSTValue, setNewSTValue] = useState("");
  const [newSTError, setNewSTError] = useState("");

  // ── Edit form state ──────────────────────────────────────────────────────────
  const [editingCat, setEditingCat] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatError, setEditCatError] = useState("");

  const [editingWT, setEditingWT] = useState(null);
  const [editWTName, setEditWTName] = useState("");
  const [editWTMeasure, setEditWTMeasure] = useState("square-foot");
  const [editWTError, setEditWTError] = useState("");

  const [editingST, setEditingST] = useState(null);
  const [editSTValue, setEditSTValue] = useState("");
  const [editSTError, setEditSTError] = useState("");

  // ── Global operation state ───────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, msg) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, type, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3800);
  }, []);

  const withSave = useCallback(
    async (fn, successMsg) => {
      setSaving(true);
      try {
        await fn();
        addToast("success", successMsg);
      } catch (err) {
        throw err; // re-throw so callers can show inline field errors
      } finally {
        setSaving(false);
      }
    },
    [addToast],
  );

  // ── Confirmation modal ───────────────────────────────────────────────────────
  const [modalConfig, setModalConfig] = useState(null);
  const [modalCallback, setModalCallback] = useState(null);

  const openConfirm = useCallback((config, onConfirm) => {
    setModalConfig(config);
    setModalCallback(() => onConfirm);
  }, []);

  const handleModalConfirm = useCallback(async () => {
    setModalConfig(null);
    if (modalCallback) await modalCallback();
    setModalCallback(null);
  }, [modalCallback]);

  const handleModalCancel = useCallback(() => {
    setModalConfig(null);
    setModalCallback(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Category operations
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      setNewCatError("Name is required.");
      return;
    }
    try {
      await withSave(
        () => createCategory({ name: newCatName.trim() }),
        `"${newCatName.trim()}" created.`,
      );
      setNewCatName("");
      setAddingCat(false);
      setNewCatError("");
    } catch (err) {
      setNewCatError(err.message);
    }
  };

  const startEditCat = (cat) => {
    setEditingCat(cat.key);
    setEditCatName(cat.name);
    setEditCatError("");
    setAddingCat(false);
    setAddingWTFor(null);
    setAddingSTFor(null);
  };

  const handleUpdateCategory = async (key) => {
    if (!editCatName.trim()) {
      setEditCatError("Name is required.");
      return;
    }
    try {
      await withSave(
        () => updateCategory(key, { name: editCatName.trim() }),
        "Category renamed.",
      );
      setEditingCat(null);
      setEditCatError("");
    } catch (err) {
      setEditCatError(err.message);
    }
  };

  const handleDeleteCategory = (cat) => {
    const wtCount = cat.workTypes?.length ?? 0;
    const stCount = (cat.workTypes ?? []).reduce(
      (n, wt) => n + (wt.subtypes?.length ?? 0),
      0,
    );
    openConfirm(
      {
        title: `Delete "${cat.name}" category?`,
        body: "This will permanently remove the category and all of its contents:",
        bullets: [
          `${wtCount} work type${wtCount !== 1 ? "s" : ""}`,
          `${stCount} subtype${stCount !== 1 ? "s" : ""}`,
        ],
        confirmLabel: "Yes, delete all",
        confirmVariant: "danger",
      },
      async () => {
        try {
          await withSave(
            () => deleteCategory(cat.key),
            `"${cat.name}" deleted.`,
          );
        } catch (err) {
          addToast("error", err.message);
        }
      },
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WorkType operations
  // ─────────────────────────────────────────────────────────────────────────────

  const startAddWT = (categoryKey) => {
    setAddingWTFor(categoryKey);
    setNewWTName("");
    setNewWTMeasure("square-foot");
    setNewWTError("");
    setAddingCat(false);
    setAddingSTFor(null);
    if (!expandedCats[categoryKey])
      setExpandedCats((p) => ({ ...p, [categoryKey]: true }));
  };

  const handleAddWorkType = async (categoryKey) => {
    if (!newWTName.trim()) {
      setNewWTError("Name is required.");
      return;
    }
    try {
      await withSave(
        () =>
          createWorkType({
            categoryKey,
            name: newWTName.trim(),
            measurementType: newWTMeasure,
          }),
        `"${newWTName.trim()}" added.`,
      );
      setAddingWTFor(null);
      setNewWTName("");
      setNewWTError("");
    } catch (err) {
      setNewWTError(err.message);
    }
  };

  const startEditWT = (wt) => {
    setEditingWT(wt.key);
    setEditWTName(wt.name);
    setEditWTMeasure(wt.measurementType || "square-foot");
    setEditWTError("");
    setAddingWTFor(null);
    setAddingSTFor(null);
  };

  const handleUpdateWorkType = async (key) => {
    if (!editWTName.trim()) {
      setEditWTError("Name is required.");
      return;
    }
    try {
      await withSave(
        () =>
          updateWorkType(key, {
            name: editWTName.trim(),
            measurementType: editWTMeasure,
          }),
        "Work type updated.",
      );
      setEditingWT(null);
      setEditWTError("");
    } catch (err) {
      setEditWTError(err.message);
    }
  };

  const handleDeleteWorkType = (wt) => {
    const stCount = wt.subtypes?.length ?? 0;
    openConfirm(
      {
        title: `Delete "${wt.name}"?`,
        body:
          stCount > 0
            ? `This will also permanently remove ${stCount} subtype${
                stCount !== 1 ? "s" : ""
              } under it.`
            : "This work type currently has no subtypes.",
        confirmLabel: "Yes, delete",
        confirmVariant: "danger",
      },
      async () => {
        try {
          await withSave(() => deleteWorkType(wt.key), `"${wt.name}" deleted.`);
        } catch (err) {
          addToast("error", err.message);
        }
      },
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Subtype operations
  // ─────────────────────────────────────────────────────────────────────────────

  const startAddST = (workTypeKey) => {
    setAddingSTFor(workTypeKey);
    setNewSTValue("");
    setNewSTError("");
    setAddingWTFor(null);
    setAddingCat(false);
    if (!expandedWTs[workTypeKey])
      setExpandedWTs((p) => ({ ...p, [workTypeKey]: true }));
  };

  const handleAddSubtype = async (workTypeKey) => {
    if (!newSTValue.trim()) {
      setNewSTError("Value is required.");
      return;
    }
    try {
      await withSave(
        () => createSubtype({ workTypeKey, value: newSTValue.trim() }),
        `"${newSTValue.trim()}" added.`,
      );
      setAddingSTFor(null);
      setNewSTValue("");
      setNewSTError("");
    } catch (err) {
      setNewSTError(err.message);
    }
  };

  const startEditST = (st) => {
    setEditingST(st._id);
    setEditSTValue(st.value);
    setEditSTError("");
  };

  const handleUpdateSubtype = async (wt, subtypeId) => {
    if (!editSTValue.trim()) {
      setEditSTError("Value is required.");
      return;
    }
    try {
      await withSave(
        () =>
          updateSubtype({
            workTypeKey: wt.key,
            subtypeId,
            value: editSTValue.trim(),
          }),
        "Subtype updated.",
      );
      setEditingST(null);
      setEditSTError("");
    } catch (err) {
      setEditSTError(err.message);
    }
  };

  const handleDeleteSubtype = (wt, st) => {
    openConfirm(
      {
        title: `Delete "${st.value}"?`,
        body: `Removes "${st.value}" from the "${wt.name}" work type.`,
        confirmLabel: "Yes, delete",
        confirmVariant: "danger",
      },
      async () => {
        try {
          await withSave(
            () => deleteSubtype({ workTypeKey: wt.key, subtypeId: st._id }),
            `"${st.value}" deleted.`,
          );
        } catch (err) {
          addToast("error", err.message);
        }
      },
    );
  };

  const handleSetDefault = async (wt, st) => {
    try {
      await withSave(
        () => setDefaultSubtype({ workTypeKey: wt.key, subtypeId: st._id }),
        `"${st.value}" set as default.`,
      );
    } catch (err) {
      addToast("error", err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Header stats
  // ─────────────────────────────────────────────────────────────────────────────

  const totalWT = taxonomy.reduce((n, c) => n + (c.workTypes?.length ?? 0), 0);
  const totalST = taxonomy.reduce(
    (n, c) =>
      n +
      (c.workTypes ?? []).reduce((m, w) => m + (w.subtypes?.length ?? 0), 0),
    0,
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.manager}>
      {/* ═══ Header ═══════════════════════════════════════════════════════════ */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconWrap}>
            <i className="fas fa-sitemap" aria-hidden="true" />
          </div>
          <div>
            <h3 className={styles.headerTitle}>Manage Work Types</h3>
            <div className={styles.headerStats}>
              <span>
                <i className="fas fa-layer-group" aria-hidden="true" />{" "}
                {taxonomy.length} categories
              </span>
              <span className={styles.statDot} aria-hidden="true">
                ·
              </span>
              <span>
                <i className="fas fa-tools" aria-hidden="true" /> {totalWT} work
                types
              </span>
              <span className={styles.statDot} aria-hidden="true">
                ·
              </span>
              <span>
                <i className="fas fa-tags" aria-hidden="true" /> {totalST}{" "}
                subtypes
              </span>
            </div>
          </div>
        </div>
        <button
          className={styles.headerCloseBtn}
          onClick={onClose}
          title="Close manager"
          aria-label="Close taxonomy manager"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>

      {/* ═══ Legend ═══════════════════════════════════════════════════════════ */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className="fas fa-lock" aria-hidden="true" /> Built-in (read-only)
        </span>
        <span className={styles.legendItem}>
          <i className="fas fa-star" aria-hidden="true" /> Custom (editable)
        </span>
        <span className={styles.legendItem}>
          <i className="fas fa-check-circle" aria-hidden="true" /> Default
          subtype
        </span>
      </div>

      {/* ═══ Tree ═════════════════════════════════════════════════════════════ */}
      <div className={styles.tree}>
        {taxonomy.length === 0 && (
          <div className={styles.emptyTree}>
            <i className="fas fa-folder-open" aria-hidden="true" />
            <p>No categories yet.</p>
            <span>Create your first category below.</span>
          </div>
        )}

        {taxonomy.map((cat) => {
          const catOpen = !!expandedCats[cat.key];
          return (
            <div key={cat.key} className={styles.catNode}>
              {/* ── Category row ─────────────────────────────────────────── */}
              <div
                className={`${styles.catRow} ${
                  catOpen ? styles.catRow__open : ""
                }`}
              >
                <button
                  className={styles.chevronBtn}
                  onClick={() => toggleCat(cat.key)}
                  aria-expanded={catOpen}
                  aria-label={`${catOpen ? "Collapse" : "Expand"} ${cat.name}`}
                >
                  <i
                    className={`fas fa-chevron-${catOpen ? "down" : "right"}`}
                    aria-hidden="true"
                  />
                </button>

                <i
                  className={`fas fa-folder${catOpen ? "-open" : ""} ${
                    styles.catFolderIcon
                  }`}
                  aria-hidden="true"
                />

                {editingCat === cat.key ? (
                  <div className={styles.editBlock}>
                    <InlineField
                      autoFocus
                      value={editCatName}
                      onChange={setEditCatName}
                      onSubmit={() => handleUpdateCategory(cat.key)}
                      onCancel={() => {
                        setEditingCat(null);
                        setEditCatError("");
                      }}
                      placeholder="Category name…"
                      error={editCatError}
                    />
                  </div>
                ) : (
                  <span className={styles.nodeLabel}>
                    {cat.name}
                    {cat.isCustom ? (
                      <span
                        className={styles.customBadge}
                        title="Custom category"
                      >
                        <i className="fas fa-star" />
                      </span>
                    ) : (
                      <span
                        className={styles.lockBadge}
                        title="Built-in category"
                      >
                        <i className="fas fa-lock" />
                      </span>
                    )}
                    <span className={styles.countPill}>
                      <i className="fas fa-tools" aria-hidden="true" />{" "}
                      {cat.workTypes?.length ?? 0}
                    </span>
                  </span>
                )}

                {editingCat !== cat.key && (
                  <div className={styles.rowActions}>
                    {cat.isCustom && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtn__edit}`}
                        onClick={() => startEditCat(cat)}
                        title="Rename this category"
                        disabled={saving}
                      >
                        <i className="fas fa-pencil-alt" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtn__add}`}
                      onClick={() => startAddWT(cat.key)}
                      title={`Add work type to "${cat.name}"`}
                      disabled={saving}
                    >
                      <i className="fas fa-plus" aria-hidden="true" />
                      <span>Work Type</span>
                    </button>
                    {cat.isCustom && (
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtn__delete}`}
                        onClick={() => handleDeleteCategory(cat)}
                        title="Delete this category"
                        disabled={saving}
                      >
                        <i className="fas fa-trash-alt" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ── WorkType list (category expanded) ────────────────────── */}
              {catOpen && (
                <div className={styles.wtList}>
                  {/* Add work type form */}
                  {addingWTFor === cat.key && (
                    <div className={styles.addForm}>
                      <div className={styles.addFormHeader}>
                        <i className="fas fa-tools" aria-hidden="true" />
                        <span>
                          New work type in <strong>{cat.name}</strong>
                        </span>
                      </div>
                      <InlineField
                        autoFocus
                        value={newWTName}
                        onChange={setNewWTName}
                        onSubmit={() => handleAddWorkType(cat.key)}
                        onCancel={() => {
                          setAddingWTFor(null);
                          setNewWTError("");
                        }}
                        placeholder="e.g. Flooring, Painting, Trim…"
                        error={newWTError}
                      />
                      <MeasurePicker
                        value={newWTMeasure}
                        onChange={setNewWTMeasure}
                      />
                    </div>
                  )}

                  {(cat.workTypes ?? []).length === 0 &&
                    addingWTFor !== cat.key && (
                      <p className={styles.emptyMsg}>
                        <i className="fas fa-info-circle" aria-hidden="true" />{" "}
                        No work types yet.
                      </p>
                    )}

                  {(cat.workTypes ?? []).map((wt) => {
                    const wtOpen = !!expandedWTs[wt.key];
                    const mm = MEASURE_META[wt.measurementType] ?? {
                      label: wt.measurementType,
                      cls: "",
                    };
                    return (
                      <div key={wt.key} className={styles.wtNode}>
                        {/* ── Work type row ─────────────────────────────── */}
                        <div
                          className={`${styles.wtRow} ${
                            wtOpen ? styles.wtRow__open : ""
                          }`}
                        >
                          <button
                            className={styles.chevronBtn}
                            onClick={() => toggleWT(wt.key)}
                            aria-expanded={wtOpen}
                            aria-label={`${wtOpen ? "Collapse" : "Expand"} ${
                              wt.name
                            }`}
                          >
                            <i
                              className={`fas fa-chevron-${
                                wtOpen ? "down" : "right"
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          <i
                            className={`fas fa-tools ${styles.wtTypeIcon}`}
                            aria-hidden="true"
                          />

                          {editingWT === wt.key ? (
                            <div className={styles.editBlock}>
                              <InlineField
                                autoFocus
                                value={editWTName}
                                onChange={setEditWTName}
                                onSubmit={() => handleUpdateWorkType(wt.key)}
                                onCancel={() => {
                                  setEditingWT(null);
                                  setEditWTError("");
                                }}
                                placeholder="Work type name…"
                                error={editWTError}
                              />
                              <MeasurePicker
                                value={editWTMeasure}
                                onChange={setEditWTMeasure}
                              />
                            </div>
                          ) : (
                            <span className={styles.nodeLabel}>
                              {wt.name}
                              {wt.isCustom ? (
                                <span
                                  className={styles.customBadge}
                                  title="Custom"
                                >
                                  <i className="fas fa-star" />
                                </span>
                              ) : (
                                <span
                                  className={styles.lockBadge}
                                  title="Built-in"
                                >
                                  <i className="fas fa-lock" />
                                </span>
                              )}
                              <span
                                className={`${styles.measureBadge} ${
                                  styles[mm.cls]
                                }`}
                              >
                                {mm.label}
                              </span>
                              <span className={styles.countPill}>
                                <i className="fas fa-tags" aria-hidden="true" />{" "}
                                {wt.subtypes?.length ?? 0}
                              </span>
                            </span>
                          )}

                          {editingWT !== wt.key && (
                            <div className={styles.rowActions}>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtn__edit}`}
                                onClick={() => startEditWT(wt)}
                                title="Edit this work type"
                                disabled={saving}
                              >
                                <i
                                  className="fas fa-pencil-alt"
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtn__add}`}
                                onClick={() => startAddST(wt.key)}
                                title="Add subtype"
                                disabled={saving}
                              >
                                <i className="fas fa-plus" aria-hidden="true" />
                                <span>Subtype</span>
                              </button>
                              {wt.isCustom && (
                                <button
                                  className={`${styles.actionBtn} ${styles.actionBtn__delete}`}
                                  onClick={() => handleDeleteWorkType(wt)}
                                  title="Delete this work type"
                                  disabled={saving}
                                >
                                  <i
                                    className="fas fa-trash-alt"
                                    aria-hidden="true"
                                  />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ── Subtype list (work type expanded) ─────────── */}
                        {wtOpen && (
                          <div className={styles.stList}>
                            {/* Add subtype form */}
                            {addingSTFor === wt.key && (
                              <div
                                className={`${styles.addForm} ${styles.addForm__st}`}
                              >
                                <div className={styles.addFormHeader}>
                                  <i
                                    className="fas fa-tag"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    New subtype for <strong>{wt.name}</strong>
                                  </span>
                                </div>
                                <InlineField
                                  autoFocus
                                  value={newSTValue}
                                  onChange={setNewSTValue}
                                  onSubmit={() => handleAddSubtype(wt.key)}
                                  onCancel={() => {
                                    setAddingSTFor(null);
                                    setNewSTError("");
                                  }}
                                  placeholder="e.g. Hardwood, Porcelain, GFCI…"
                                  error={newSTError}
                                />
                              </div>
                            )}

                            {(wt.subtypes ?? []).length === 0 &&
                              addingSTFor !== wt.key && (
                                <p className={styles.emptyMsg}>
                                  <i
                                    className="fas fa-info-circle"
                                    aria-hidden="true"
                                  />{" "}
                                  No subtypes yet.
                                </p>
                              )}

                            {(wt.subtypes ?? []).map((st) => (
                              <div
                                key={st._id}
                                className={`${styles.stRow} ${
                                  st.isDefault ? styles.stRow__default : ""
                                }`}
                              >
                                {editingST === st._id ? (
                                  <div
                                    className={styles.editBlock}
                                    style={{ flex: 1 }}
                                  >
                                    <InlineField
                                      autoFocus
                                      value={editSTValue}
                                      onChange={setEditSTValue}
                                      onSubmit={() =>
                                        handleUpdateSubtype(wt, st._id)
                                      }
                                      onCancel={() => {
                                        setEditingST(null);
                                        setEditSTError("");
                                      }}
                                      placeholder="Subtype value…"
                                      error={editSTError}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <i
                                      className={`fas fa-tag ${styles.stTagIcon}`}
                                      aria-hidden="true"
                                    />
                                    <span className={styles.stLabel}>
                                      {st.value}
                                      {st.isDefault && (
                                        <span className={styles.defaultBadge}>
                                          <i
                                            className="fas fa-check-circle"
                                            aria-hidden="true"
                                          />{" "}
                                          default
                                        </span>
                                      )}
                                      {st.isCustom ? (
                                        <span
                                          className={styles.customBadge}
                                          title="Custom"
                                        >
                                          <i className="fas fa-star" />
                                        </span>
                                      ) : (
                                        <span
                                          className={styles.lockBadge}
                                          title="Built-in"
                                        >
                                          <i className="fas fa-lock" />
                                        </span>
                                      )}
                                    </span>
                                    <div className={styles.rowActions}>
                                      <button
                                        className={`${styles.actionBtn} ${styles.actionBtn__edit}`}
                                        onClick={() => startEditST(st)}
                                        title="Edit subtype"
                                        disabled={saving}
                                      >
                                        <i
                                          className="fas fa-pencil-alt"
                                          aria-hidden="true"
                                        />
                                      </button>
                                      {!st.isDefault && (
                                        <button
                                          className={`${styles.actionBtn} ${styles.actionBtn__star}`}
                                          onClick={() =>
                                            handleSetDefault(wt, st)
                                          }
                                          title="Set as default"
                                          disabled={saving}
                                        >
                                          <i
                                            className="fas fa-star"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      )}
                                      {st.isCustom && (
                                        <button
                                          className={`${styles.actionBtn} ${styles.actionBtn__delete}`}
                                          onClick={() =>
                                            handleDeleteSubtype(wt, st)
                                          }
                                          title="Delete subtype"
                                          disabled={saving}
                                        >
                                          <i
                                            className="fas fa-trash-alt"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Add category area ─────────────────────────────────────────────── */}
        {addingCat ? (
          <div className={`${styles.addForm} ${styles.addForm__cat}`}>
            <div className={styles.addFormHeader}>
              <i className="fas fa-folder-plus" aria-hidden="true" />
              <span>New category</span>
            </div>
            <InlineField
              autoFocus
              value={newCatName}
              onChange={setNewCatName}
              onSubmit={handleAddCategory}
              onCancel={() => {
                setAddingCat(false);
                setNewCatName("");
                setNewCatError("");
              }}
              placeholder="e.g. Office, Garage, Basement…"
              error={newCatError}
            />
          </div>
        ) : (
          <button
            className={styles.addCategoryBtn}
            onClick={() => setAddingCat(true)}
            disabled={saving}
          >
            <i className="fas fa-plus" aria-hidden="true" />
            Add Category
          </button>
        )}
      </div>

      {/* ═══ Confirmation modal ═══════════════════════════════════════════════ */}
      <ConfirmModal
        config={modalConfig}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />

      {/* ═══ Toast stack ══════════════════════════════════════════════════════ */}
      <Toast toasts={toasts} />
    </div>
  );
}

TaxonomyManager.propTypes = {
  taxonomy: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  createCategory: PropTypes.func.isRequired,
  updateCategory: PropTypes.func.isRequired,
  deleteCategory: PropTypes.func.isRequired,
  createWorkType: PropTypes.func.isRequired,
  updateWorkType: PropTypes.func.isRequired,
  deleteWorkType: PropTypes.func.isRequired,
  createSubtype: PropTypes.func.isRequired,
  updateSubtype: PropTypes.func.isRequired,
  deleteSubtype: PropTypes.func.isRequired,
  setDefaultSubtype: PropTypes.func.isRequired,
};
