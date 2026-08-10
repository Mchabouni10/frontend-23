// src/components/HomePage/HomePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSave,
  faUndo,
  faArrowLeft,
  faEdit,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
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
import ErrorBoundary from "../ErrorBoundary";

// Validate project before saving
const validateProjectData = (customer) => {
  const requiredFields = [
    "firstName",
    "lastName",
    "street",
    "phone",
    "startDate",
    "zipCode",
    "email",
    "projectName",
  ];
  const missing = requiredFields.filter((field) => {
    if (field === "startDate") {
      return (
        !customer[field] ||
        (customer[field] instanceof Date && isNaN(customer[field].getTime()))
      );
    }
    return !customer[field]?.trim();
  });

  if (missing.length > 0)
    return `Please fill in all required fields: ${missing.join(", ")}`;

  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
    return "Please enter a valid email address.";

  if (!/^\d{5}$/.test(customer.zipCode))
    return "ZIP Code must be exactly 5 digits.";

  return null;
};

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

  const { categories, setCategories } = useCategories();
  const { settings, setSettings, resetSettings } = useSettings();

  const workTypeContext = useWorkType();
  const {
    getMeasurementType,
    isValidSubtype,
    getWorkTypeDetails,
    // ── FIX: use taxonomyReady (data actually loaded) instead of checking
    //    whether functions exist (they always exist immediately).
    taxonomyReady,
    taxonomyLoading,
    taxonomyError,
  } = workTypeContext;

  const [customer, setCustomer] = useState({
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
  const [loading, setLoading] = useState(false);
  const [isCustomerInfoVisible, setIsCustomerInfoVisible] = useState(true);

  const isDetailsMode = location.pathname.startsWith("/home/customer/") && id;
  const isEditMode = location.pathname.startsWith("/home/edit/") && id;
  const isNewMode =
    location.pathname === "/home/customer" ||
    location.pathname === "/home/new-customer-project";

  // Validation for required customer fields
  const validateCustomerFields = useCallback(() => {
    const requiredFields = [
      "firstName",
      "lastName",
      "street",
      "city",
      "zipCode",
      "phone",
      "email",
      "projectName",
      "startDate",
    ];

    const missingFields = requiredFields.filter((field) => {
      if (field === "startDate") {
        return (
          !customer[field] ||
          (customer[field] instanceof Date && isNaN(customer[field].getTime()))
        );
      }
      return !customer[field] || !customer[field].toString().trim();
    });

    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return false;
    }

    if (customer.zipCode && !/^\d{5}$/.test(customer.zipCode)) {
      return false;
    }

    if (customer.phone) {
      const cleaned = customer.phone.replace(/\D/g, "");
      if (!(cleaned.length === 11 && cleaned.startsWith("1"))) {
        return false;
      }
    }

    return missingFields.length === 0;
  }, [customer]);

  const isCustomerDataValid = validateCustomerFields();

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
        setLoading(true);
        try {
          const project = await getProject(id);
          setProjectId(project._id);

          const normalizedCustomer = {
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

  // Save or update project
  const saveOrUpdateProject = async () => {
    console.log("Save button clicked, taxonomyReady:", taxonomyReady);

    if (!taxonomyReady) {
      alert("System not ready. Please wait a moment and try again.");
      return;
    }

    const validationError = validateProjectData(customer);
    if (validationError) {
      alert(validationError);
      return;
    }

    const sanitizedCategories = sanitizeCategoriesWithEngine(categories);

    try {
      const engine = new CalculatorEngine(
        sanitizedCategories,
        settings,
        workTypeContext,
      );

      const totals = engine.calculateTotals();
      const breakdowns = engine.calculateBreakdowns();
      const paymentDetails = engine.calculatePaymentDetails();

      const projectData = {
        customerInfo: {
          ...customer,
          startDate:
            customer.startDate instanceof Date &&
            !isNaN(customer.startDate.getTime())
              ? customer.startDate.toISOString().split("T")[0]
              : customer.startDate,
          finishDate:
            customer.finishDate instanceof Date &&
            !isNaN(customer.finishDate.getTime())
              ? customer.finishDate.toISOString().split("T")[0]
              : customer.finishDate,
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

      setLoading(true);

      if (isEditMode && projectId) {
        await updateProject(projectId, projectData);
        alert("Project updated successfully!");
        navigate("/home/customers");
      } else if (isNewMode) {
        const newProject = await saveProject(projectData);
        setProjectId(newProject._id);
        alert("Project saved successfully!");
        navigate("/home/customers");
      }
    } catch (err) {
      console.error("Error saving project:", err);
      alert(
        "Failed to save/update project: " + (err.message || "Unknown error"),
      );
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
                onClick={saveOrUpdateProject}
                className={styles.saveButton}
                disabled={loading || !taxonomyReady || !isCustomerDataValid}
                title={
                  !taxonomyReady
                    ? "Waiting for work types to load..."
                    : !isCustomerDataValid
                    ? "Please fill in all required customer information fields"
                    : ""
                }
              >
                <FontAwesomeIcon icon={faSave} className={styles.buttonIcon} />
                {loading
                  ? "Saving..."
                  : isEditMode && projectId
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
