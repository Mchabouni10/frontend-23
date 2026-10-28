// src/components/CompanyExpenses/expenseShared.js
// One place for the constants + helpers that CompanyExpenses, Workers and
// ProjectProfit all need, so the three screens never drift apart.
import {
  faGasPump,
  faPhone,
  faGlobe,
  faTools,
  faHardHat,
  faReceipt,
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
  faUtensils,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

// ── Categories ──────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: "fuel", name: "Fuel / Van", icon: faGasPump, color: "#e74c3c" },
  { id: "vehicle_maint", name: "Vehicle Maintenance", icon: faTruck, color: "#c0392b" },
  { id: "phone", name: "Phone Bill", icon: faPhone, color: "#3498db" },
  { id: "website", name: "Website / Hosting", icon: faGlobe, color: "#9b59b6" },
  { id: "software", name: "Software / Subscriptions", icon: faLaptop, color: "#8e44ad" },
  { id: "marketing", name: "Marketing / Ads", icon: faBullhorn, color: "#e67e22" },
  { id: "insurance", name: "Insurance", icon: faShieldAlt, color: "#5d7a99" },
  { id: "tools", name: "Tools", icon: faTools, color: "#f39c12" },
  { id: "material", name: "Materials", icon: faHardHat, color: "#2ecc71" },
  { id: "subcontractors", name: "Subcontractors", icon: faUserTie, color: "#16a085" },
  { id: "permits", name: "Permits / Licenses", icon: faClipboardList, color: "#27ae60" },
  { id: "office", name: "Office Supplies", icon: faPaperclip, color: "#7f8c8d" },
  { id: "rent", name: "Rent / Utilities", icon: faBuilding, color: "#4f6d8a" },
  { id: "disposal", name: "Waste Disposal", icon: faRecycle, color: "#795548" },
  { id: "taxes", name: "Taxes / Fees", icon: faFileInvoiceDollar, color: "#607d8b" },
  { id: "meals", name: "Meals / Entertainment", icon: faUtensils, color: "#d35400" },
  // Job costs — always linked to a project (Worker Pay also needs a worker)
  { id: "worker_pay", name: "Worker Pay", icon: faUsers, color: "#1abc9c" },
  { id: "crew_meals", name: "Crew Meals", icon: faUtensils, color: "#e08e0b" },
  { id: "other", name: "Other", icon: faReceipt, color: "#95a5a6" },
];

export const PAYMENT_METHODS = [
  "Cash",
  "Check",
  "ACH",
  "Credit",
  "Debit",
  "Wire Transfer",
  "Other",
];

// Categories that must be tied to a project.
export const JOB_CATEGORIES = ["worker_pay", "crew_meals"];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const getCategory = (id) =>
  CATEGORY_BY_ID[id] || { id, name: id, icon: faReceipt, color: "#95a5a6" };

// ── Money ───────────────────────────────────────────────────────────────────
export const money = (n) =>
  `$${(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// "$12.4k" for tight spaces (charts, chips)
export const moneyCompact = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
};

export const percent = (part, whole) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

// ── Dates ───────────────────────────────────────────────────────────────────
// Everything works on a plain "YYYY-MM-DD" key so there is never a UTC shift.
export const toDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const getLocalDateKey = () => toDateKey(new Date());

export const keyToLocalDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const formatDate = (dateKey) => {
  if (!dateKey) return "—";
  return keyToLocalDate(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatWeekday = (dateKey) =>
  dateKey
    ? keyToLocalDate(dateKey).toLocaleDateString("en-US", { weekday: "short" })
    : "";

export const formatMonthLabel = (monthKey) => {
  if (!monthKey) return "Unknown date";
  return keyToLocalDate(`${monthKey}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

// ── People / projects ───────────────────────────────────────────────────────
// "(312) 555-1234" as the user types; the database stores digits only.
export const formatPhone = (value) => {
  let d = String(value || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export const getInitials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

// "George Smith — Kitchen remodel"
export const getProjectLabel = (project) => {
  const ci = project?.customerInfo || {};
  const customer =
    `${ci.firstName || ""} ${ci.lastName || ""}`.trim() || "Unknown";
  return `${customer} — ${ci.projectName || "Unnamed Project"}`;
};

// Newest start date first.
export const sortProjectsNewestFirst = (projects) =>
  [...projects].sort((a, b) =>
    String(b.customerInfo?.startDate || "").localeCompare(
      String(a.customerInfo?.startDate || ""),
    ),
  );