// src/components/HomePage/HomePage.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSave,
  faUndo,
  faArrowLeft,
  faEdit,
  faChevronLeft,
  faChevronRight,
  faExclamationTriangle,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import {
  CategoriesProvider,
  useCategories,
} from "../../context/CategoriesContext";
import { SettingsProvider, useSettings } from "../../context/SettingsContext";
import { useWorkType } from "../../context/WorkTypeContext";
import { CalculatorEngine } from "../Calculator/engine/CalculatorEngine";
import CustomerInfo from "../CustomerInfo/CustomerInfo";
import Calculator from "../Calculator/Calculator";
import CostBreakdown from "../Calculator/CostBreakdown/CostBreakdown";
import styles from "./HomePage.module.css";
import {
  saveProject,
  updateProject,
  getProject,
} from "../../services/projectService";
import { findOrCreateCustomer } from "../../services/customerService";
import {
  saveDraftLocally,
  getDraftLocally,
  clearDraftLocally,
} from "../../services/draftStorage";
import { isValidUSPhone, normalizeUSPhone } from "../../utilities/phone";
import { buildContactPayload } from "../../utilities/contactPayload";
import { isValidEmail } from "../../utilities/contactRules";
import { parseStreetAddress } from "../../utilities/address";
import ErrorBoundary from "../ErrorBoundary";

// Empty strings are not valid Mongo dates. New projects leave finishDate as
// "" until the user picks one; sending that string used to 400 the save.
function toDateOnly(value) {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  if (isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().split("T")[0];
}

function isMongoId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || ""));
}

function parseStoredDate(value) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? "" : parsed;
}

function formatSaveError(err) {
  const details = Array.isArray(err?.details) ? ` ${err.details.join(" ")}` : "";
  return (err?.message || err?.error || "Unknown error") + details;
}

// Sanitize categories using CalculatorEngine (simplified)
const sanitizeCategoriesWithEngine = (categories) => {
  if (!Array.isArray(categories)) return [];

  const sanitized = categories
    .map((category) => {
      if (!category || typeof category !== "object") return null;

      const workItems = Array.isArray(category.workItems)
        ? category.workItems
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const surfaces = Array.isArray(item.surfaces)
                ? item.surfaces.filter(Boolean)
                : [];
              return { ...item, surfaces };
            })
            .filter(Boolean)
        : [];

      return { ...category, workItems };
    })
    .filter(Boolean);

  return sanitized;
};

// Main HomePage content
function HomePageContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialCustomerInfo =
    location.pathname === "/home/new-customer-project"
      ? {}
      : location.state?.customerInfo || {};

  const { categories, setCategories, validateAllCategories } = useCategories();
  const { settings, setSettings, resetSettings } = useSettings();

  const workTypeContext = useWorkType();
  const {
    // ── FIX: use taxonomyReady (data actually loaded) instead of checking
    //    whether functions exist (they always exist immediately).
    taxonomyReady,
    taxonomyLoading,
    taxonomyError,
  } = workTypeContext;

  const [customer, setCustomer] = useState({
    _id: location.state?.customerId || initialCustomerInfo._id || undefined,
    firstName: initialCustomerInfo.firstName || "",
    lastName: initialCustomerInfo.lastName || "",
    street: initialCustomerInfo.street || "",
    unit: initialCustomerInfo.unit || "",
    city: initialCustomerInfo.city || "",
    state: initialCustomerInfo.state || "IL",
    zipCode: initialCustomerInfo.zipCode || "",
    phone: initialCustomerInfo.phone || "",
    email: initialCustomerInfo.email || "",
    projectName: initialCustomerInfo.projectName || "",
    type: initialCustomerInfo.type || "Residential",
    paymentType: initialCustomerInfo.paymentType || "Cash",
    startDate: initialCustomerInfo.startDate
      ? new Date(initialCustomerInfo.startDate)
      : "",
    finishDate: initialCustomerInfo.finishDate
      ? new Date(initialCustomerInfo.finishDate)
      : "",
    notes: initialCustomerInfo.notes || "",
  });

  const [projectId, setProjectId] = useState(null);
  const [customerId, setCustomerId] = useState(
    location.state?.customerId || initialCustomerInfo._id || null,
  );

  // Keeps `customerId` (this state) and `customer._id` (the field
  // CustomerInfo reads to decide whether it's showing a linked contact) as
  // one fact instead of two variables that can disagree. Every place that
  // used to call setCustomerId() directly now calls this instead, and it's
  // also handed to CustomerInfo as onContactLinkChange so a contact saved
  // or unlinked from *that* side updates the exact same state.
  const applyCustomerLink = useCallback((id) => {
    setCustomerId(id || null);
    setCustomer((prev) => {
      if (id) return prev._id === id ? prev : { ...prev, _id: id };
      if (!prev._id) return prev;
      const { _id, ...rest } = prev;
      return rest;
    });
  }, []);
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState("");
  const [draftFlushToken, setDraftFlushToken] = useState(0);
  const [isCustomerInfoVisible, setIsCustomerInfoVisible] = useState(true);
  const draftTimerRef = useRef(null);
  const draftSaveInFlightRef = useRef(false);
  const draftSaveQueuedRef = useRef(false);
  const restoredLocalDraftRef = useRef(false);
  // Last payload the server is known to have (used to skip no-op autosaves).
  const lastAutosaveRef = useRef(null);

  const isDetailsMode = location.pathname.startsWith("/home/customer/") && id;
  const isEditMode = location.pathname.startsWith("/home/edit/") && id;
  const isNewMode =
    location.pathname === "/home/customer" ||
    location.pathname === "/home/new-customer-project";
  const shouldStartFresh = isNewMode && location.state?.freshProject === true;
  // Validation for required customer fields
  const getCustomerValidationIssue = useCallback(
    (includeProjectFields = true) => {
      const requiredFields = [
        "firstName",
        "lastName",
        "street",
        "city",
        "state",
        "zipCode",
        "phone",
        "email",
        ...(includeProjectFields ? ["projectName", "startDate"] : []),
      ];

      const missingFields = requiredFields.filter((field) => {
        if (field === "startDate") {
          return !toDateOnly(customer[field]);
        }
        return !String(customer[field] || "").trim();
      });

      if (missingFields.length > 0) {
        return `Please fill in: ${missingFields.join(", ")}`;
      }

      if (customer.email && !isValidEmail(customer.email)) {
        return "Please enter a valid email address.";
      }

      if (
        customer.zipCode &&
        !/^\d{5}$/.test(String(customer.zipCode).trim())
      ) {
        return "ZIP Code must be exactly 5 digits.";
      }

      if (customer.phone && !isValidUSPhone(customer.phone)) {
        return "Please enter a valid 10-digit US phone number.";
      }

      return null;
    },
    [customer],
  );

  const draftValidationIssue = getCustomerValidationIssue(false);
  const isDraftDataValid = !draftValidationIssue;

  // Detailed validation inspection for user warnings
  const getDetailedValidationIssues = useCallback(() => {
    const customerMissing = [];
    const customerInvalid = [];
    const dateIssues = [];
    const categoryIssues = [];

    const FIELD_LABELS = {
      firstName: "First Name",
      lastName: "Last Name",
      street: "Street Address",
      city: "City",
      state: "State",
      zipCode: "ZIP Code",
      phone: "Phone Number",
      email: "Email Address",
      projectName: "Project Name",
      startDate: "Start Date",
    };

    const requiredFields = [
      "firstName",
      "lastName",
      "street",
      "city",
      "state",
      "zipCode",
      "phone",
      "email",
      "projectName",
      "startDate",
    ];

    requiredFields.forEach((field) => {
      if (field === "startDate") {
        if (!toDateOnly(customer[field])) customerMissing.push(FIELD_LABELS[field]);
      } else if (!String(customer[field] || "").trim()) {
        customerMissing.push(FIELD_LABELS[field]);
      }
    });

    if (customer.email && !isValidEmail(customer.email)) {
      customerInvalid.push("Email address is not valid");
    }

    if (customer.zipCode && !/^\d{5}$/.test(String(customer.zipCode).trim())) {
      customerInvalid.push("ZIP Code must be exactly 5 digits");
    }

    if (customer.phone && !isValidUSPhone(customer.phone)) {
      customerInvalid.push("Phone must be a valid 10-digit US number");
    }

    if (customer.startDate && customer.finishDate) {
      const s = new Date(customer.startDate);
      const f = new Date(customer.finishDate);
      if (!isNaN(s.getTime()) && !isNaN(f.getTime()) && f < s) {
        dateIssues.push("Finish date cannot be earlier than start date");
      }
    }

    // Categories validation (for active projects)
    if (!isNewMode || projectId) {
      if (!categories || categories.length === 0) {
        categoryIssues.push("Project must have at least one category");
      } else {
        categories.forEach((cat) => {
          if (!cat.workItems || cat.workItems.length === 0) {
            categoryIssues.push(`Category "${cat.name || "Unnamed"}" has no work items`);
          } else {
            cat.workItems.forEach((item, idx) => {
              if (!item.type || !item.type.trim()) {
                categoryIssues.push(`Item #${idx + 1} in "${cat.name || "Category"}" is missing a work type`);
              } else if (item.type === "custom-work-type" && !item.customWorkTypeName?.trim()) {
                categoryIssues.push(`Custom item in "${cat.name || "Category"}" is missing a custom name`);
              }
            });
          }
        });
      }
    }

    const hasCustomerIssues =
      customerMissing.length > 0 || customerInvalid.length > 0 || dateIssues.length > 0;
    const totalIssuesCount =
      customerMissing.length +
      customerInvalid.length +
      dateIssues.length +
      categoryIssues.length;

    return {
      customerMissing,
      customerInvalid,
      dateIssues,
      categoryIssues,
      hasCustomerIssues,
      totalIssuesCount,
    };
  }, [customer, categories, isNewMode, projectId]);

  const validationIssues = getDetailedValidationIssues();

  // Keep a local recovery point while the user is working. This runs even
  // before a server-side customer/project exists, so a refresh cannot erase
  // half an hour of data.
  useEffect(() => {
    if (!isNewMode || isDetailsMode || restoredLocalDraftRef.current) return;
    restoredLocalDraftRef.current = true;
    if (shouldStartFresh) {
      clearDraftLocally();
      return;
    }
    const localDraft = getDraftLocally();
    if (!localDraft) return;
    if (localDraft.customer)
      setCustomer((prev) => ({
        ...prev,
        ...localDraft.customer,
        startDate: parseStoredDate(localDraft.customer.startDate),
        finishDate: parseStoredDate(localDraft.customer.finishDate),
      }));
    if (Array.isArray(localDraft.categories) && localDraft.categories.length)
      setCategories(localDraft.categories);
    if (localDraft.settings)
      setSettings((prev) => ({ ...prev, ...localDraft.settings }));
    if (localDraft.projectId) setProjectId(localDraft.projectId);
    if (localDraft.customerId) applyCustomerLink(localDraft.customerId);
  }, [
    isNewMode,
    isDetailsMode,
    shouldStartFresh,
    applyCustomerLink,
    setCategories,
    setSettings,
  ]);

  useEffect(() => {
    if (isDetailsMode) return;
    if (isNewMode && !restoredLocalDraftRef.current) return;
    saveDraftLocally({ customer, categories, settings, projectId, customerId });
  }, [
    customer,
    categories,
    settings,
    projectId,
    customerId,
    isDetailsMode,
    isNewMode,
  ]);

  // ── FIX: Load project only after taxonomy is ready (data fetched from DB).
  // Previously this gated on workTypeFunctionsReady which checked whether
  // getMeasurementType/isValidSubtype/getWorkTypeDetails *exist* — they always
  // exist immediately (they're plain functions), so the project would load
  // before the taxonomy API call had returned any data. The category dropdowns
  // and work-type dropdowns would appear empty, and saved work types looked
  // "stale" because the taxonomy was still an empty array.
  useEffect(() => {
    const loadProject = async () => {
      if (id && (isEditMode || isDetailsMode) && taxonomyReady) {
        lastAutosaveRef.current = null; // re-baseline after this load
        setLoading(true);
        try {
          const project = await getProject(id);
          setProjectId(project._id);
          setCustomerId(project.customerId || null);

          const normalizedCustomer = {
            _id: project.customerId || undefined,
            firstName: project.customerInfo?.firstName || "",
            lastName: project.customerInfo?.lastName || "",
            street: project.customerInfo?.street || "",
            unit: project.customerInfo?.unit || "",
            city: project.customerInfo?.city || "",
            state: project.customerInfo?.state || "IL",
            zipCode: project.customerInfo?.zipCode || "",
            phone: project.customerInfo?.phone || "",
            email: project.customerInfo?.email || "",
            projectName: project.customerInfo?.projectName || "",
            type: project.customerInfo?.type || "Residential",
            paymentType: project.customerInfo?.paymentType || "Cash",
            startDate: project.customerInfo?.startDate
              ? new Date(project.customerInfo.startDate)
              : "",
            finishDate: project.customerInfo?.finishDate
              ? new Date(project.customerInfo.finishDate)
              : "",
            notes: project.customerInfo?.notes || "",
            status: project.status || "Not Started",
          };
          setCustomer(normalizedCustomer);

          const sanitizedCategories = sanitizeCategoriesWithEngine(
            project.categories,
          );
          setCategories(sanitizedCategories);

          const normalizedSettings = {
            taxRate: project.settings?.taxRate || 0,
            transportationFee: project.settings?.transportationFee || 0,
            wasteEntries: project.settings?.wasteEntries || [],
            miscFees: project.settings?.miscFees || [],
            deposit: project.settings?.deposit || 0,
            depositDate: project.settings?.depositDate || null,
            payments: project.settings?.payments || [],
            markup: project.settings?.markup || 0,
            laborDiscount: project.settings?.laborDiscount || 0,
          };
          setSettings(normalizedSettings);
        } catch (err) {
          console.error("Error loading project:", err);
          alert("Failed to load project.");
          navigate("/home/customers");
        } finally {
          setLoading(false);
        }
      }
    };

    // Only run when taxonomy is ready — not before.
    if (taxonomyReady) {
      loadProject();
    }
  }, [
    id,
    isEditMode,
    isDetailsMode,
    navigate,
    taxonomyReady, // ← was workTypeFunctionsReady
    setCategories,
    setSettings,
  ]);

  const buildProjectData = useCallback(
    (status = "active", customerIdOverride = customerId) => {
      const sanitizedCategories = sanitizeCategoriesWithEngine(categories);
      const engine = new CalculatorEngine(
        sanitizedCategories,
        settings,
        workTypeContext,
      );
      const totals = engine.calculateTotals();
      const breakdowns = engine.calculateBreakdowns();
      const paymentDetails = engine.calculatePaymentDetails();
      // `customer._id` (added so CustomerInfo/applyCustomerLink can track the
      // linked contact) is deliberately left out of customerInfo here — the
      // real relational link is the top-level customerId field below.
      const customerWithoutId = { ...customer };
      delete customerWithoutId._id;
      delete customerWithoutId.status;
      delete customerWithoutId.addressNumber;
      delete customerWithoutId.direction;
      delete customerWithoutId.streetName;
      delete customerWithoutId.streetType;
      const address = parseStreetAddress(customer.street);
      return {
        // `null` is intentional: it is how an explicit unlink is persisted
        // when an existing project is updated. Do not turn this into
        // `undefined`, which would leave the old relationship in MongoDB.
        customerId: customerIdOverride || null,
        contactLinkState: customerIdOverride ? "linked" : "unlinked",
        workflowStatus: status,
        customerInfo: {
          ...customerWithoutId,
          ...address,
          phone: normalizeUSPhone(customer.phone),
          zipCode: String(customer.zipCode || "").trim(),
          startDate: toDateOnly(customer.startDate) || new Date().toISOString().split("T")[0],
          projectName:
            customer.projectName ||
            (status === "draft" ? "Untitled Draft" : ""),
          finishDate: toDateOnly(customer.finishDate),
        },
        categories: sanitizedCategories,
        settings: {
          ...settings,
          payments: (settings.payments || []).map((payment) => ({
            ...payment,
            date:
              payment.date instanceof Date
                ? payment.date.toISOString().split("T")[0]
                : payment.date,
            amount: Number(payment.amount),
            method: payment.method || "Cash",
            note: payment.note || "",
            isPaid: Boolean(payment.isPaid),
          })),
          deposit: Number(settings.deposit) || 0,
          depositDate: settings.depositDate
            ? new Date(settings.depositDate).toISOString().split("T")[0]
            : null,
        },
        totals,
        breakdowns,
        paymentDetails,
      };
    },
    [categories, settings, workTypeContext, customer, customerId],
  );

  // Ensure a new project has a contact record to link to.
  //
  // Existing contacts are deliberately never updated here. A project is a
  // historical snapshot: its autosave must not silently change the shared
  // contact directory. CustomerInfo owns the explicit "Update Contact"
  // action for that direction of the relationship.
  const ensureContactForNewProject = useCallback(
    async (currentCustomerId) => {
      const effectiveId = currentCustomerId || customer._id;
      if (isMongoId(effectiveId)) return { _id: effectiveId };

      // Duplicate-safe: if this exact person is already saved we reuse them
      // (never modified); if a look-alike exists we ask instead of silently
      // creating a second record.
      const payload = buildContactPayload(customer);
      let result = await findOrCreateCustomer(payload);
      if (result.needsDecision) {
        const m = result.matches[0];
        const useExisting = window.confirm(
          `A saved contact already matches this ${m.matchedOn}:\n\n` +
            `${m.firstName} ${m.lastName} — ${m.email}\n\n` +
            `OK = use that existing contact (it will not be changed)\n` +
            `Cancel = create a separate new contact`,
        );
        result = useExisting
          ? { customer: m }
          : await findOrCreateCustomer(payload, { allowDuplicate: true });
      }
      return result.customer;
    },
    [customer],
  );

  // Create the customer and an empty server-side project draft before the
  // calculator work begins. From this point every change can be recovered.
  const startProjectDraft = async () => {
    if (!isDraftDataValid) {
      if (!isCustomerInfoVisible) {
        setIsCustomerInfoVisible(true);
      }
      const missing = validationIssues.customerMissing.filter(
        (f) => f !== "Project Name" && f !== "Start Date",
      );
      const invalid = validationIssues.customerInvalid;
      const msgs = [...missing.map((m) => `${m} is required`), ...invalid];
      toast.error(
        `Please complete the required customer fields before starting a draft:\n• ${msgs.join(
          "\n• ",
        )}`,
      );
      return;
    }
    setLoading(true);
    try {
      const savedCustomer = await ensureContactForNewProject(customerId);
      applyCustomerLink(savedCustomer._id);
      const draft = await saveProject(
        buildProjectData("draft", savedCustomer._id),
      );
      if (String(draft._id).startsWith("offline_")) {
        setDraftSaveError(
          "Draft saved on this device. Reconnect to create the server draft.",
        );
        return;
      }
      setProjectId(draft._id);
      clearDraftLocally();
      navigate(`/home/edit/${draft._id}`);
    } catch (err) {
      const message = formatSaveError(err);
      setDraftSaveError(message);
      toast.error("Could not start the project draft: " + message);
    } finally {
      setLoading(false);
    }
  };

  // Debounced incremental server save after the first draft exists.
  //  • First pass after a project loads only records a baseline (no write).
  //  • A save happens only if something actually changed since the last save.
  //  • Autosave sends `autosave: true`, so the server never changes workflowStatus
  //    (opening an active project used to demote it to "draft").
  useEffect(() => {
    if (!projectId || isDetailsMode || !isEditMode || loading) return undefined;
    if (
      !lastAutosaveRef.current ||
      lastAutosaveRef.current.projectId !== projectId
    ) {
      lastAutosaveRef.current = {
        projectId,
        signature: JSON.stringify({
          ...buildProjectData("draft", customerId),
          autosave: true,
        }),
      };
      return undefined;
    }
    clearTimeout(draftTimerRef.current);
    if (draftSaveInFlightRef.current) {
      draftSaveQueuedRef.current = true;
      return undefined;
    }
    draftTimerRef.current = setTimeout(async () => {
      const payload = {
        ...buildProjectData("draft", customerId),
        autosave: true,
      };
      const signature = JSON.stringify(payload);
      if (lastAutosaveRef.current?.signature === signature) return; // nothing changed
      draftSaveInFlightRef.current = true;
      setDraftSaving(true);
      try {
        await updateProject(projectId, payload);
        lastAutosaveRef.current = { projectId, signature };
        setDraftSaveError("");
      } catch (err) {
        setDraftSaveError(
          err.message || "Draft saved locally; server sync is pending.",
        );
        saveDraftLocally({
          customer,
          categories,
          settings,
          projectId,
          customerId,
        });
      } finally {
        setDraftSaving(false);
        draftSaveInFlightRef.current = false;
        if (draftSaveQueuedRef.current) {
          draftSaveQueuedRef.current = false;
          setDraftFlushToken((value) => value + 1);
        }
      }
    }, 900);
    return () => clearTimeout(draftTimerRef.current);
  }, [
    projectId,
    customerId,
    customer,
    categories,
    settings,
    isDetailsMode,
    isEditMode,
    loading,
    buildProjectData,
    draftFlushToken,
  ]);

  // Save or complete project
  const saveOrUpdateProject = async () => {
    console.log("Save button clicked, taxonomyReady:", taxonomyReady);

    if (!taxonomyReady) {
      toast.warning("System not ready. Please wait a moment and try again.");
      return;
    }

    const issues = getDetailedValidationIssues();
    if (issues.totalIssuesCount > 0) {
      if (issues.hasCustomerIssues && !isCustomerInfoVisible) {
        setIsCustomerInfoVisible(true);
      }
      const issueSummary = [
        ...(issues.customerMissing.length
          ? [`Missing required fields: ${issues.customerMissing.join(", ")}`]
          : []),
        ...issues.customerInvalid,
        ...issues.dateIssues,
        ...issues.categoryIssues,
      ];
      toast.error(
        `Cannot update project. Please resolve the following ${
          issues.totalIssuesCount
        } issue(s):\n• ${issueSummary.slice(0, 4).join("\n• ")}`,
      );
      return;
    }

    const categoryValidation = validateAllCategories();
    if (!categoryValidation.valid) {
      toast.error(
        `Please fix the project setup before saving:\n\n${categoryValidation.errors.join(
          "\n",
        )}`,
      );
      return;
    }

    try {
      setLoading(true);

      if ((isEditMode || projectId) && projectId) {
        const projectData = buildProjectData("active", customerId);
        await updateProject(projectId, projectData);
        clearDraftLocally();
        toast.success("Project updated successfully!");
        navigate("/home/customers");
      } else if (isNewMode) {
        await startProjectDraft();
      }
    } catch (err) {
      console.error("Error saving project:", err);
      toast.error("Failed to save/update project: " + formatSaveError(err));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all data? This cannot be undone.",
      )
    ) {
      setCustomer({
        firstName: "",
        lastName: "",
        street: "",
        unit: "",
        city: "",
        state: "IL",
        zipCode: "",
        phone: "",
        email: "",
        projectName: "",
        type: "Residential",
        paymentType: "Cash",
        startDate: "",
        finishDate: "",
        notes: "",
      });
      setCategories([]);
      resetSettings();
      setProjectId(null);
      applyCustomerLink(null);
      clearDraftLocally();
      alert("All data reset.");
    }
  };

  const handleEditClick = () => {
    if (id) navigate(`/home/edit/${id}`);
  };

  const toggleCustomerInfo = () => setIsCustomerInfoVisible((prev) => !prev);

  // ── Loading / error states ──────────────────────────────────────────────────

  // Taxonomy fetch still in progress
  if (taxonomyLoading) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText}>
            Loading work types from database...
          </p>
        </div>
      </main>
    );
  }

  // Taxonomy fetch failed
  if (taxonomyError) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText} style={{ color: "#ef4444" }}>
            Failed to load work types: {taxonomyError}. Please refresh the page.
          </p>
        </div>
      </main>
    );
  }

  // Project data is loading (taxonomy is ready, now loading the project itself)
  if (loading) {
    return (
      <main className={styles.mainContent}>
        <div className={styles.container}>
          <p className={styles.loadingText}>Loading project data...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`${styles.mainContent} ${
        !isCustomerInfoVisible ? styles.mainContentCompact : ""
      }`}
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1 className={styles.title}>
              {isDetailsMode
                ? "Project Details"
                : isEditMode
                ? "Edit Project"
                : "New Project"}
            </h1>
            {!isDetailsMode && (draftSaving || draftSaveError) && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: draftSaveError ? "#b91c1c" : "#64748b",
                }}
              >
                {draftSaveError
                  ? "Draft saved locally; sync pending"
                  : "Draft saved"}
              </span>
            )}
            {(isEditMode || isDetailsMode) && customer.status && (
              <span
                className={styles.statusBadge}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "1rem",
                  backgroundColor:
                    customer.status === "Completed"
                      ? "#2ecc71"
                      : customer.status === "In Progress"
                      ? "#3498db"
                      : customer.status === "Overdue"
                      ? "#e74c3c"
                      : "#95a5a6",
                  color: "white",
                  fontWeight: "600",
                  textTransform: "uppercase",
                }}
              >
                {customer.status}
              </span>
            )}
          </div>
          {isDetailsMode && (
            <button onClick={handleEditClick} className={styles.editButton}>
              <FontAwesomeIcon icon={faEdit} className={styles.buttonIcon} />
              Edit Project
            </button>
          )}
        </div>
        <div className={styles.content}>
          <div
            className={`${styles.topRow} ${
              !isCustomerInfoVisible ? styles.customerHidden : ""
            }`}
          >
            {!isDetailsMode && (
              <button
                onClick={toggleCustomerInfo}
                className={`${styles.toggleArrow} ${
                  isCustomerInfoVisible
                    ? styles.toggleArrowRight
                    : styles.toggleArrowLeft
                }`}
                disabled={loading}
                aria-label={
                  isCustomerInfoVisible
                    ? "Hide customer information"
                    : "Show customer information"
                }
                aria-expanded={isCustomerInfoVisible}
                aria-controls="customer-section"
              >
                <FontAwesomeIcon
                  icon={isCustomerInfoVisible ? faChevronLeft : faChevronRight}
                  className={styles.toggleIcon}
                />
              </button>
            )}
            <section
              className={`${styles.customerSection} ${
                !isCustomerInfoVisible ? styles.customerSectionHidden : ""
              }`}
              id="customer-section"
            >
              <div
                className={styles.slideWrapper}
                style={{
                  transform: isCustomerInfoVisible
                    ? "translateX(0)"
                    : "translateX(-100%)",
                }}
                aria-hidden={!isCustomerInfoVisible}
              >
                <CustomerInfo
                  customer={customer}
                  setCustomer={setCustomer}
                  onImportContact={(selectedCustomer) => {
                    setCustomer(selectedCustomer);
                    applyCustomerLink(selectedCustomer._id || null);
                  }}
                  onContactLinkChange={applyCustomerLink}
                  disabled={isDetailsMode}
                  isEditMode={isEditMode}
                />
              </div>
            </section>
            <section
              className={`${styles.calculatorSection} ${
                !isCustomerInfoVisible ? styles.calculatorExpanded : ""
              }`}
            >
              <Calculator disabled={Boolean(isDetailsMode)} />
            </section>
          </div>
          <section className={styles.costBreakdownSection}>
            <CostBreakdown />
          </section>
        </div>

        {!isDetailsMode && validationIssues.totalIssuesCount > 0 && (
          <div className={styles.validationWarningBox} role="alert">
            <div className={styles.warningBoxHeader}>
              <div className={styles.warningBoxTitle}>
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className={styles.warningBoxIcon}
                />
                <span>
                  Project Not Ready to {projectId ? "Update" : "Save"}
                  <span className={styles.warningBadgePill}>
                    {validationIssues.totalIssuesCount}
                  </span>
                </span>
              </div>
              {validationIssues.hasCustomerIssues && !isCustomerInfoVisible && (
                <button
                  type="button"
                  className={styles.warningActionBtn}
                  onClick={() => setIsCustomerInfoVisible(true)}
                >
                  <FontAwesomeIcon icon={faEye} /> Show Customer Information
                </button>
              )}
            </div>
            <ul className={styles.warningList}>
              {validationIssues.customerMissing.length > 0 && (
                <li className={styles.warningItem}>
                  <strong className={styles.warningItemStrong}>
                    Required Customer Fields Missing:
                  </strong>{" "}
                  {validationIssues.customerMissing.join(", ")}
                </li>
              )}
              {validationIssues.customerInvalid.map((err, idx) => (
                <li key={`inv-${idx}`} className={styles.warningItem}>
                  <strong className={styles.warningItemStrong}>
                    Invalid Format:
                  </strong>{" "}
                  {err}
                </li>
              ))}
              {validationIssues.dateIssues.map((err, idx) => (
                <li key={`dt-${idx}`} className={styles.warningItem}>
                  <strong className={styles.warningItemStrong}>
                    Date Conflict:
                  </strong>{" "}
                  {err}
                </li>
              ))}
              {validationIssues.categoryIssues.map((err, idx) => (
                <li key={`cat-${idx}`} className={styles.warningItem}>
                  <strong className={styles.warningItemStrong}>
                    Work Items Setup:
                  </strong>{" "}
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.buttonGroup}>
          {isDetailsMode ? (
            <button
              onClick={() => navigate("/home/customers")}
              className={styles.backButton}
            >
              <FontAwesomeIcon
                icon={faArrowLeft}
                className={styles.buttonIcon}
              />
              Back to Customers
            </button>
          ) : (
            <>
              <button
                onClick={
                  isNewMode && !projectId
                    ? startProjectDraft
                    : saveOrUpdateProject
                }
                className={styles.saveButton}
                disabled={loading || !taxonomyReady}
                title={
                  !taxonomyReady
                    ? "Waiting for work types to load..."
                    : validationIssues.totalIssuesCount > 0
                    ? `Cannot ${
                        projectId ? "update" : "save"
                      } project: ${validationIssues.totalIssuesCount} issue(s) need attention`
                    : projectId
                    ? "Update and save project changes"
                    : "Save customer and start project draft"
                }
              >
                <FontAwesomeIcon icon={faSave} className={styles.buttonIcon} />
                {loading
                  ? "Saving..."
                  : isNewMode && !projectId
                  ? "Save Customer & Start Draft"
                  : projectId
                  ? "Update Project"
                  : "Save Project"}
              </button>
              <button
                onClick={resetAll}
                className={styles.resetButton}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faUndo} className={styles.buttonIcon} />
                Reset All
              </button>
              <button
                onClick={() => navigate("/home/customers")}
                className={styles.backButton}
                disabled={loading}
              >
                <FontAwesomeIcon
                  icon={faArrowLeft}
                  className={styles.buttonIcon}
                />
                Back to Customers
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// HomePage with providers
export default function HomePage() {
  const { id } = useParams();
  const projectKey = id || "new-project";

  return (
    <ErrorBoundary boundaryName="HomePage">
      <CategoriesProvider key={`cat-${projectKey}`}>
        <SettingsProvider key={`set-${projectKey}`}>
          <HomePageContentWrapper />
        </SettingsProvider>
      </CategoriesProvider>
    </ErrorBoundary>
  );
}

// ── FIX: Gate on taxonomyReady (actual data loaded), not on function existence.
// The old HomePageContentWrapper checked getMeasurementType/isValidSubtype/
// getWorkTypeDetails — those are always defined immediately (plain functions
// created on the first render), so the wrapper passed through instantly and
// HomePageContent tried to load a project against an empty taxonomy array.
function HomePageContentWrapper() {
  const { taxonomyReady, taxonomyLoading, taxonomyError } = useWorkType();

  if (taxonomyLoading) {
    return (
      <main>
        <div>
          <p>Loading work types from database...</p>
        </div>
      </main>
    );
  }

  if (taxonomyError) {
    return (
      <main>
        <div>
          <p style={{ color: "#ef4444" }}>
            Failed to load work types: {taxonomyError}. Please refresh the page.
          </p>
        </div>
      </main>
    );
  }

  if (!taxonomyReady) {
    return (
      <main>
        <div>
          <p>Initializing...</p>
        </div>
      </main>
    );
  }

  return <HomePageContent />;
}
