// src/components/Calendar/ProjectCalendar.jsx
//
// Event types surfaced on the calendar:
//   • project-span              — full duration bar (start → finish), colour = project status
//   • payment-deposit           — deposit due / paid
//   • payment-installment       — installment due
//   • payment-installment-paid  — installment already paid
//   • payment-installment-overdue — installment past-due and unpaid
//   • payment-onetime           — one-time payments
//   • project-start             — pin on the first day of a project
//   • project-end               — pin on the last day of a project
//
// Clicking any event opens a rich side panel with EVERY field a contractor
// needs: dates, duration, full cost breakdown (materials / labor / waste /
// tax / markup / misc fees / credits), the complete scope of work (every
// category → work item → surface, with dimensions and per-item costs),
// the full payment / installment ledger, pricing settings snapshot, and
// contact info.
//
// Beyond the month/week/day/agenda grid (react-big-calendar), this
// component also offers:
//   • a searchable, category-filterable header
//   • a "List" view — a scannable, month-grouped card list of every project
//   • an expanded KPI strip (revenue this month, upcoming 7-day payments,
//     draft count, average project value, in addition to the original stats)
//   • CSV export and print of whatever is currently filtered/visible

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  isPast,
  isToday,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  addDays,
  isWithinInterval,
} from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { getCalendarProjects } from "../../services/projectService";
import styles from "./ProjectCalendar.module.css";

// ─── Localizer ────────────────────────────────────────────────────────────────

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// ─── Generic helpers ──────────────────────────────────────────────────────────

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function fmt$(n) {
  const num = parseFloat(n) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(n) {
  const num = parseFloat(n) || 0;
  return `${(num * 100).toFixed(1)}%`;
}

function shortDate(d) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function durationDays(start, finish) {
  if (!start || !finish) return null;
  const s = safeDate(start);
  const f = safeDate(finish);
  if (!s || !f) return null;
  return Math.max(0, differenceInDays(f, s)) + 1;
}

function daysFromToday(dateVal) {
  if (!dateVal) return null;
  const d = safeDate(dateVal);
  if (!d) return null;
  return differenceInDays(d, new Date());
}

function humanizeKey(key) {
  if (!key) return "";
  return key
    .toString()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumBy(arr, fn) {
  return (arr || []).reduce((s, item) => s + (parseFloat(fn(item)) || 0), 0);
}

function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Format one surface's measurement the way it was captured on the estimate. */
function formatSurface(surface) {
  const type = surface.measurementType;
  if (type === "linear-foot") {
    const len = surface.linearFt || surface.length || 0;
    return `${len} linear ft`;
  }
  if (type === "by-unit") {
    const u = surface.units || 0;
    return `${u} unit${u === 1 ? "" : "s"}`;
  }
  // square-foot (default)
  if (surface.manualSqft) return `${surface.sqft || 0} sqft (entered manually)`;
  const w = surface.width || 0;
  const h = surface.height || 0;
  return `${w}' × ${h}' = ${surface.sqft || 0} sqft`;
}

/** Derive project status the same way CustomerProjects.jsx does */
function deriveStatus(project) {
  const today = new Date();
  const start = safeDate(project.customerInfo?.startDate);
  const finish = safeDate(project.customerInfo?.finishDate);
  const payments = project.settings?.payments || [];
  const grandTotal = project._cachedTotal || 0;
  const totalPaid = payments.reduce(
    (s, p) => s + (p.isPaid ? parseFloat(p.amount) || 0 : 0),
    0,
  );
  const remaining = Math.max(0, grandTotal - totalPaid);

  if (remaining === 0 && finish && finish < today) return "Completed";
  if (finish && finish < today && remaining > 0) return "Overdue";
  if (start && start > today) return "Pending";
  if (start && finish && start <= today && finish >= today)
    return "In Progress";
  return "Unknown";
}

// ─── Event colour map ─────────────────────────────────────────────────────────

const EVENT_COLORS = {
  "span-Completed": { bg: "var(--success)", border: "var(--success-dark)" },
  "span-In Progress": {
    bg: "var(--secondary)",
    border: "var(--secondary-dark)",
  },
  "span-Pending": { bg: "var(--warning)", border: "var(--warning-dark)" },
  "span-Overdue": { bg: "var(--error)", border: "var(--error-dark)" },
  "span-Unknown": { bg: "var(--muted)", border: "var(--muted-dark)" },
  "payment-deposit": { bg: "#7c3aed", border: "#5b21b6" },
  "payment-deposit-paid": {
    bg: "var(--success)",
    border: "var(--success-dark)",
  },
  "payment-installment": {
    bg: "var(--secondary)",
    border: "var(--secondary-dark)",
  },
  "payment-installment-paid": {
    bg: "var(--success)",
    border: "var(--success-dark)",
  },
  "payment-installment-overdue": {
    bg: "var(--error)",
    border: "var(--error-dark)",
  },
  "payment-onetime": { bg: "var(--muted)", border: "var(--muted-dark)" },
  "project-start": { bg: "var(--primary)", border: "var(--primary-dark)" },
  "project-end": { bg: "var(--primary-dark)", border: "var(--primary)" },
};

function colorFor(eventType) {
  return (
    EVENT_COLORS[eventType] || {
      bg: "var(--muted)",
      border: "var(--muted-dark)",
    }
  );
}

// Cost-breakdown segment colours (used by the CostBar + legend)
const COST_SEGMENT_COLORS = {
  Materials: "var(--secondary)",
  Labor: "var(--primary)",
  Waste: "var(--warning)",
  Transportation: "#0891b2",
  Tax: "#7c3aed",
  Markup: "var(--success)",
  "Misc Fees": "#ec4899",
};

// ─── Build events from project list ──────────────────────────────────────────

function buildEvents(projects) {
  const events = [];

  projects.forEach((project) => {
    const ci = project.customerInfo || {};
    const status = deriveStatus(project);
    const customerName =
      `${ci.firstName || ""} ${ci.lastName || ""}`.trim() || "Unknown";
    const projectLabel = ci.projectName || "Unnamed Project";
    const fullTitle = `${customerName} — ${projectLabel}`;
    const payments = project.settings?.payments || [];
    const grandTotal = project._cachedTotal || 0;

    const totalPaid = payments.reduce(
      (s, p) => s + (p.isPaid ? parseFloat(p.amount) || 0 : 0),
      0,
    );
    const remaining = Math.max(0, grandTotal - totalPaid);
    const deposit = payments.find(
      (p) => (p.type || p.paymentType) === "Deposit",
    );
    const depositAmt = deposit ? parseFloat(deposit.amount) || 0 : 0;

    const installments = payments
      .filter((p) => (p.type || p.paymentType) === "Installment")
      .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));

    const otherPayments = payments.filter(
      (p) => !["Deposit", "Installment"].includes(p.type || p.paymentType),
    );

    const paidInstallments = installments.filter((p) => p.isPaid).length;
    const overdueInstallments = installments.filter(
      (p) =>
        !p.isPaid &&
        isPast(safeDate(p.date) || new Date()) &&
        !isToday(safeDate(p.date) || new Date()),
    ).length;

    const start = safeDate(ci.startDate);
    const finish = safeDate(ci.finishDate);
    const dur = durationDays(ci.startDate, ci.finishDate);

    // ── Full scope of work: category → work item → surfaces ────────────────
    const categories = (project.categories || []).map((cat) => {
      const workItems = (cat.workItems || []).map((item) => ({
        name: item.name || "Unnamed Work Item",
        type: item.type,
        typeLabel:
          item.type === "custom-work-type"
            ? item.customWorkTypeName || "Custom Work Type"
            : humanizeKey(item.type),
        subtype: item.subtype || "",
        description: item.description || "",
        notes: item.notes || "",
        measurementType: item.measurementType,
        materialCost: parseFloat(item.materialCost) || 0,
        laborCost: parseFloat(item.laborCost) || 0,
        surfaces: (item.surfaces || []).map((s, i) => ({
          id: s.id || String(i),
          name: s.name || `Surface ${i + 1}`,
          measurementType: s.measurementType,
          display: formatSurface(s),
        })),
      }));
      return {
        key: cat.key,
        name: cat.name || humanizeKey(cat.key) || "Uncategorized",
        workItems,
        itemCount: workItems.length,
        materialCost: sumBy(workItems, (w) => w.materialCost),
        laborCost: sumBy(workItems, (w) => w.laborCost),
      };
    });

    const totalWorkItems = categories.reduce((s, c) => s + c.itemCount, 0);

    // ── Settings / pricing snapshot ─────────────────────────────────────────
    const settings = project.settings || {};
    const miscFees = (settings.miscFees || []).map((f) => ({
      name: f.name,
      amount: parseFloat(f.amount) || 0,
    }));
    const credits = (settings.credits || []).map((c) => ({
      date: c.date,
      amount: parseFloat(c.amount) || 0,
      reason: c.reason,
    }));
    const wasteEntries = (settings.wasteEntries || []).map((w) => ({
      surfaceName: w.surfaceName,
      surfaceCost: parseFloat(w.surfaceCost) || 0,
      wasteFactor: parseFloat(w.wasteFactor) || 0,
      wasteable: w.wasteable,
    }));

    // ── Cost breakdown (backend-computed totals, when present) ─────────────
    const totals = project.totals || {};
    const costBreakdown = {
      materialCost: parseFloat(totals.materialCost) || 0,
      laborCostBeforeDiscount: parseFloat(totals.laborCostBeforeDiscount) || 0,
      laborDiscount: parseFloat(totals.laborDiscount) || 0,
      laborCost: parseFloat(totals.laborCost) || 0,
      wasteCost: parseFloat(totals.wasteCost) || 0,
      transportationFee:
        parseFloat(totals.transportationFee) ||
        parseFloat(settings.transportationFee) ||
        0,
      subtotal: parseFloat(totals.subtotal) || 0,
      taxAmount: parseFloat(totals.taxAmount) || 0,
      markupAmount: parseFloat(totals.markupAmount) || 0,
      miscFeesTotal:
        parseFloat(totals.miscFeesTotal) || sumBy(miscFees, (f) => f.amount),
      creditsTotal:
        parseFloat(totals.creditsTotal) || sumBy(credits, (c) => c.amount),
      total: parseFloat(totals.total) || grandTotal,
    };

    const pricingSettings = {
      taxRate: parseFloat(settings.taxRate) || 0,
      markup: parseFloat(settings.markup) || 0,
      wasteFactor: parseFloat(settings.wasteFactor) || 0,
      laborDiscount: parseFloat(settings.laborDiscount) || 0,
      transportationFee: parseFloat(settings.transportationFee) || 0,
    };

    const projectMeta = {
      projectId: project._id,
      customerName,
      projectName: projectLabel,
      status,
      workflowStatus: project.workflowStatus || "draft",
      startDate: ci.startDate,
      finishDate: ci.finishDate,
      durationDays: dur,
      address: [ci.street, ci.unit, ci.city, ci.state, ci.zipCode]
        .filter(Boolean)
        .join(", "),
      phone: ci.phone,
      email: ci.email,
      paymentType: ci.paymentType,
      propertyType: ci.type,
      notes: ci.notes,
      grandTotal,
      totalPaid,
      remaining,
      depositAmt,
      paidInstallments,
      totalInstallments: installments.length,
      overdueInstallments,
      progressPct:
        grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0,
      installments: installments.map((p) => ({
        id: p.id,
        installmentNumber: p.installmentNumber,
        totalInstallments: p.totalInstallments,
        date: p.date,
        amount: parseFloat(p.amount) || 0,
        isPaid: p.isPaid,
        method: p.method,
        note: p.note,
        isOverdue:
          !p.isPaid &&
          isPast(safeDate(p.date) || new Date()) &&
          !isToday(safeDate(p.date) || new Date()),
      })),
      otherPayments: otherPayments.map((p) => ({
        date: p.date,
        amount: parseFloat(p.amount) || 0,
        type: p.type || p.paymentType,
        method: p.method,
        isPaid: p.isPaid,
        note: p.note,
      })),
      categories,
      totalCategories: categories.length,
      totalWorkItems,
      miscFees,
      credits,
      wasteEntries,
      costBreakdown,
      pricingSettings,
    };

    // ── Project span bar ──────────────────────────────────────────────────────
    if (start) {
      const end = finish
        ? new Date(finish.getTime() + 86400000)
        : new Date(start.getTime() + 86400000);

      const installSuffix =
        installments.length > 0
          ? ` · ${paidInstallments}/${installments.length} paid`
          : "";

      events.push({
        id: `span-${project._id}`,
        title: `📋 ${fullTitle}${installSuffix}`,
        start,
        end,
        allDay: true,
        eventType: `span-${status}`,
        meta: { kind: "project-span", ...projectMeta },
      });
    }

    // ── Start pin ─────────────────────────────────────────────────────────────
    if (start) {
      events.push({
        id: `start-${project._id}`,
        title: `🚀 Start: ${projectLabel}`,
        start,
        end: start,
        allDay: true,
        eventType: "project-start",
        meta: { kind: "project-start", ...projectMeta },
      });
    }

    // ── Finish pin ────────────────────────────────────────────────────────────
    if (finish) {
      events.push({
        id: `end-${project._id}`,
        title: `🏁 End: ${projectLabel}`,
        start: finish,
        end: finish,
        allDay: true,
        eventType: "project-end",
        meta: { kind: "project-end", ...projectMeta },
      });
    }

    // ── Payments ──────────────────────────────────────────────────────────────
    payments.forEach((payment) => {
      const payDate = safeDate(payment.date);
      if (!payDate) return;

      const pType = (payment.type || payment.paymentType || "").trim();
      const amount = parseFloat(payment.amount) || 0;
      const isOverdue = !payment.isPaid && isPast(payDate) && !isToday(payDate);

      let eventType = "payment-onetime";
      let emoji = "💵";

      if (pType === "Deposit") {
        eventType = payment.isPaid ? "payment-deposit-paid" : "payment-deposit";
        emoji = payment.isPaid ? "✅" : "💎";
      } else if (pType === "Installment") {
        eventType = isOverdue
          ? "payment-installment-overdue"
          : payment.isPaid
          ? "payment-installment-paid"
          : "payment-installment";
        emoji = payment.isPaid ? "✅" : isOverdue ? "⚠️" : "📅";
      }

      const label =
        pType === "Installment"
          ? `${emoji} #${payment.installmentNumber} $${fmt$(
              amount,
            )} — ${customerName}`
          : `${emoji} ${pType} $${fmt$(amount)} — ${customerName}`;

      events.push({
        id: `pay-${project._id}-${payment.id || Math.random()}`,
        title: label,
        start: payDate,
        end: payDate,
        allDay: true,
        eventType,
        meta: {
          kind: "payment",
          paymentType: pType,
          amount,
          isPaid: payment.isPaid,
          isOverdue,
          method: payment.method,
          note: payment.note,
          installmentNumber: payment.installmentNumber,
          totalInstallments: payment.totalInstallments,
          customerName,
          projectName: projectLabel,
          projectId: project._id,
          phone: ci.phone,
          email: ci.email,
          address: [ci.street, ci.unit, ci.city, ci.state, ci.zipCode]
            .filter(Boolean)
            .join(", "),
          date: payment.date,
          grandTotal,
          totalPaid,
          remaining,
          progressPct:
            grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0,
          status,
          workflowStatus: project.workflowStatus || "draft",
          startDate: ci.startDate,
          finishDate: ci.finishDate,
        },
      });
    });
  });

  return events;
}

// ─── Legend config ────────────────────────────────────────────────────────────

const LEGEND = [
  { label: "In Progress", color: "var(--secondary)" },
  { label: "Completed", color: "var(--success)" },
  { label: "Pending", color: "var(--warning)" },
  { label: "Overdue", color: "var(--error)" },
  { label: "Deposit", color: "#7c3aed" },
  { label: "Payment Due", color: "var(--secondary)" },
  { label: "Payment Paid", color: "var(--success)" },
  { label: "Payment Late", color: "var(--error)" },
  { label: "Start / End", color: "var(--primary)" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailRow({ label, value, highlight, mono }) {
  return (
    <div
      className={`${styles.detailRow} ${
        highlight ? styles.detailRowHighlight : ""
      }`}
    >
      <span className={styles.detailLabel}>{label}</span>
      <span
        className={`${styles.detailValue} ${
          mono ? styles.detailValueMono : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniProgressBar({ pct, overdueCount = 0 }) {
  const fillClass =
    pct >= 100
      ? styles.progressFillComplete
      : overdueCount > 0
      ? styles.progressFillDanger
      : styles.progressFillNormal;
  return (
    <div className={styles.miniProgress}>
      <div className={styles.miniProgressTrack}>
        <div
          className={`${styles.miniProgressFill} ${fillClass}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={styles.miniProgressPct}>{Math.round(pct)}%</span>
    </div>
  );
}

function InstallmentTable({ installments }) {
  if (!installments || installments.length === 0) return null;
  return (
    <div className={styles.installmentTable}>
      <div className={styles.installmentTableHeader}>
        <span>#</span>
        <span>Due Date</span>
        <span>Amount</span>
        <span>Status</span>
      </div>
      {installments.map((inst, i) => {
        const tag = inst.isPaid
          ? { label: "Paid", cls: styles.tagPaid }
          : inst.isOverdue
          ? { label: "Overdue", cls: styles.tagOverdue }
          : { label: "Pending", cls: styles.tagPending };
        return (
          <div
            key={inst.id || i}
            className={`${styles.installmentRow} ${
              inst.isOverdue ? styles.installmentRowOverdue : ""
            }`}
          >
            <span className={styles.instNum}>
              {inst.installmentNumber}/
              {inst.totalInstallments || installments.length}
            </span>
            <span className={styles.instDate}>{shortDate(inst.date)}</span>
            <span className={styles.instAmount}>${fmt$(inst.amount)}</span>
            <span className={`${styles.instTag} ${tag.cls}`}>{tag.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FinancialBlock({
  grandTotal,
  totalPaid,
  remaining,
  depositAmt,
  progressPct,
  overdueCount,
}) {
  return (
    <div className={styles.financialBlock}>
      <div className={styles.financialGrid}>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Total</span>
          <span className={styles.finStatValue}>${fmt$(grandTotal)}</span>
        </div>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Paid</span>
          <span className={`${styles.finStatValue} ${styles.finStatPaid}`}>
            ${fmt$(totalPaid)}
          </span>
        </div>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Balance</span>
          <span
            className={`${styles.finStatValue} ${
              remaining > 0 ? styles.finStatDue : styles.finStatSettled
            }`}
          >
            ${fmt$(remaining)}
          </span>
        </div>
        {depositAmt > 0 && (
          <div className={styles.finStat}>
            <span className={styles.finStatLabel}>Deposit</span>
            <span className={`${styles.finStatValue} ${styles.finStatDeposit}`}>
              ${fmt$(depositAmt)}
            </span>
          </div>
        )}
      </div>
      <MiniProgressBar pct={progressPct} overdueCount={overdueCount} />
    </div>
  );
}

// ── Generic mini-table (misc fees / credits / waste) ───────────────────────

function MiniTable({ widths, headers, children, empty }) {
  const rows = React.Children.count(children);
  return (
    <div className={styles.miniTable}>
      <div
        className={styles.miniTableHead}
        style={{ gridTemplateColumns: widths }}
      >
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      {rows === 0 ? (
        <div className={styles.miniTableEmpty}>{empty}</div>
      ) : (
        children
      )}
    </div>
  );
}

function MiniTableRow({ widths, danger, children }) {
  return (
    <div
      className={`${styles.miniTableRow} ${
        danger ? styles.miniTableRowDanger : ""
      }`}
      style={{ gridTemplateColumns: widths }}
    >
      {children}
    </div>
  );
}

// ── Cost breakdown: stacked bar + itemized rows ─────────────────────────────

function CostBar({ segments }) {
  const total = sumBy(segments, (s) => s.value) || 1;
  const visible = segments.filter((s) => s.value > 0);
  if (visible.length === 0) return null;
  return (
    <div className={styles.costBarWrap}>
      <div className={styles.costBar}>
        {visible.map((s) => (
          <div
            key={s.label}
            className={styles.costBarSegment}
            title={`${s.label}: $${fmt$(s.value)}`}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <div className={styles.costBarLegend}>
        {visible.map((s) => (
          <span key={s.label} className={styles.costBarLegendItem}>
            <span
              className={styles.legendDot}
              style={{ background: s.color }}
            />
            {s.label} · ${fmt$(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function CostRow({ label, value, tone }) {
  const cls =
    tone === "negative"
      ? styles.costRowNegative
      : tone === "total"
      ? styles.costRowTotal
      : styles.costRowDefault;
  const sign = tone === "negative" && value > 0 ? "−" : "";
  return (
    <div className={`${styles.costRow} ${cls}`}>
      <span>{label}</span>
      <span>
        {sign}${fmt$(Math.abs(value))}
      </span>
    </div>
  );
}

function CostBreakdown({ cb }) {
  const segments = [
    {
      label: "Materials",
      value: cb.materialCost,
      color: COST_SEGMENT_COLORS.Materials,
    },
    { label: "Labor", value: cb.laborCost, color: COST_SEGMENT_COLORS.Labor },
    { label: "Waste", value: cb.wasteCost, color: COST_SEGMENT_COLORS.Waste },
    {
      label: "Transportation",
      value: cb.transportationFee,
      color: COST_SEGMENT_COLORS.Transportation,
    },
    { label: "Tax", value: cb.taxAmount, color: COST_SEGMENT_COLORS.Tax },
    {
      label: "Markup",
      value: cb.markupAmount,
      color: COST_SEGMENT_COLORS.Markup,
    },
    {
      label: "Misc Fees",
      value: cb.miscFeesTotal,
      color: COST_SEGMENT_COLORS["Misc Fees"],
    },
  ];

  return (
    <div className={styles.costBreakdown}>
      <CostBar segments={segments} />
      <div className={styles.costRows}>
        <CostRow label="Materials" value={cb.materialCost} />
        <CostRow
          label="Labor (before discount)"
          value={cb.laborCostBeforeDiscount}
        />
        {cb.laborDiscount > 0 && (
          <CostRow
            label="Labor Discount"
            value={cb.laborDiscount}
            tone="negative"
          />
        )}
        <CostRow label="Labor (net)" value={cb.laborCost} />
        {cb.wasteCost > 0 && <CostRow label="Waste" value={cb.wasteCost} />}
        {cb.transportationFee > 0 && (
          <CostRow label="Transportation" value={cb.transportationFee} />
        )}
        <CostRow label="Subtotal" value={cb.subtotal} />
        {cb.taxAmount > 0 && <CostRow label="Tax" value={cb.taxAmount} />}
        {cb.markupAmount > 0 && (
          <CostRow label="Markup" value={cb.markupAmount} />
        )}
        {cb.miscFeesTotal > 0 && (
          <CostRow label="Misc Fees" value={cb.miscFeesTotal} />
        )}
        {cb.creditsTotal > 0 && (
          <CostRow
            label="Credits / Adjustments"
            value={cb.creditsTotal}
            tone="negative"
          />
        )}
        <CostRow label="Grand Total" value={cb.total} tone="total" />
      </div>
    </div>
  );
}

function PricingChips({ ps }) {
  const chips = [
    ps.taxRate > 0 && { label: `Tax ${pct(ps.taxRate)}` },
    ps.markup > 0 && { label: `Markup ${pct(ps.markup)}` },
    ps.wasteFactor > 0 && { label: `Waste Factor ${pct(ps.wasteFactor)}` },
    ps.laborDiscount > 0 && {
      label: `Labor Discount ${pct(ps.laborDiscount)}`,
    },
    ps.transportationFee > 0 && {
      label: `Transport $${fmt$(ps.transportationFee)}`,
    },
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <div className={styles.chipRow}>
      {chips.map((c) => (
        <span key={c.label} className={styles.infoChip}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function FeesAndCredits({ miscFees, credits }) {
  if (
    (!miscFees || miscFees.length === 0) &&
    (!credits || credits.length === 0)
  )
    return null;
  return (
    <>
      {miscFees && miscFees.length > 0 && (
        <div className={styles.subBlock}>
          <span className={styles.subBlockLabel}>Misc Fees</span>
          <MiniTable widths="1fr auto" headers={["Fee", "Amount"]}>
            {miscFees.map((f, i) => (
              <MiniTableRow key={i} widths="1fr auto">
                <span>{f.name}</span>
                <span style={{ textAlign: "right" }}>${fmt$(f.amount)}</span>
              </MiniTableRow>
            ))}
          </MiniTable>
        </div>
      )}
      {credits && credits.length > 0 && (
        <div className={styles.subBlock}>
          <span className={styles.subBlockLabel}>Credits / Adjustments</span>
          <MiniTable
            widths="70px 1fr auto"
            headers={["Date", "Reason", "Amount"]}
          >
            {credits.map((c, i) => (
              <MiniTableRow key={i} widths="70px 1fr auto" danger>
                <span>{shortDate(c.date)}</span>
                <span>{c.reason}</span>
                <span style={{ textAlign: "right" }}>−${fmt$(c.amount)}</span>
              </MiniTableRow>
            ))}
          </MiniTable>
        </div>
      )}
    </>
  );
}

function WasteBlock({ wasteEntries }) {
  if (!wasteEntries || wasteEntries.length === 0) return null;
  return (
    <div className={styles.subBlock}>
      <span className={styles.subBlockLabel}>Waste by Surface</span>
      <MiniTable widths="1fr 70px 90px" headers={["Surface", "Factor", "Cost"]}>
        {wasteEntries.map((w, i) => (
          <MiniTableRow key={i} widths="1fr 70px 90px">
            <span>{w.surfaceName || "Surface"}</span>
            <span>{pct(w.wasteFactor)}</span>
            <span style={{ textAlign: "right" }}>${fmt$(w.surfaceCost)}</span>
          </MiniTableRow>
        ))}
      </MiniTable>
    </div>
  );
}

// ── Scope of work: category → work item → surfaces ──────────────────────────

function WorkItemCard({ item }) {
  return (
    <div className={styles.workItemCard}>
      <div className={styles.workItemHeader}>
        <span className={styles.workItemName}>{item.name}</span>
        <span className={styles.workItemCosts}>
          {item.materialCost > 0 && (
            <span className={styles.workItemCostChip}>
              Mat ${fmt$(item.materialCost)}
            </span>
          )}
          {item.laborCost > 0 && (
            <span className={styles.workItemCostChip}>
              Labor ${fmt$(item.laborCost)}
            </span>
          )}
        </span>
      </div>
      <div className={styles.workItemMeta}>
        <span className={styles.workItemTypeBadge}>{item.typeLabel}</span>
        {item.subtype && (
          <span className={styles.workItemTypeBadge}>{item.subtype}</span>
        )}
      </div>
      {item.description && (
        <p className={styles.workItemDescription}>{item.description}</p>
      )}
      {item.surfaces.length > 0 && (
        <div className={styles.surfaceList}>
          {item.surfaces.map((s) => (
            <div key={s.id} className={styles.surfaceLine}>
              <span>{s.name}</span>
              <span>{s.display}</span>
            </div>
          ))}
        </div>
      )}
      {item.notes && <p className={styles.workItemNotes}>“{item.notes}”</p>}
    </div>
  );
}

function CategoryAccordion({ category, defaultOpen }) {
  return (
    <details className={styles.categoryAccordion} open={defaultOpen}>
      <summary className={styles.categorySummary}>
        <span>{category.name}</span>
        <span className={styles.categorySummaryMeta}>
          {category.itemCount} item{category.itemCount !== 1 ? "s" : ""} · $
          {fmt$(category.materialCost + category.laborCost)}
        </span>
      </summary>
      <div className={styles.categoryBody}>
        {category.workItems.map((item, i) => (
          <WorkItemCard key={i} item={item} />
        ))}
      </div>
    </details>
  );
}

function ScopeOfWork({ categories }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className={styles.scopeOfWork}>
      {categories.map((cat, i) => (
        <CategoryAccordion
          key={cat.key || i}
          category={cat}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ event, onClose }) {
  if (!event) return null;
  const { meta } = event;

  const isProject =
    meta.kind === "project-span" ||
    meta.kind === "project-start" ||
    meta.kind === "project-end";
  const isPayment = meta.kind === "payment";

  const daysLeft = meta.finishDate ? daysFromToday(meta.finishDate) : null;

  const statusColors = {
    Completed: styles.statusCompleted,
    "In Progress": styles.statusInProgress,
    Pending: styles.statusPending,
    Overdue: styles.statusOverdue,
    Unknown: styles.statusUnknown,
  };

  return (
    <aside className={styles.detailPanel}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderMain}>
          <div className={styles.detailBadgeRow}>
            <span className={styles.detailKindBadge} data-kind={meta.kind}>
              {isPayment ? meta.paymentType : "Project"}
            </span>
            {meta.status && (
              <span
                className={`${styles.statusPill} ${
                  statusColors[meta.status] || ""
                }`}
              >
                {meta.status}
              </span>
            )}
            {meta.workflowStatus && (
              <span
                className={styles.workflowBadge}
                data-workflow={meta.workflowStatus}
              >
                {humanizeKey(meta.workflowStatus)}
              </span>
            )}
            {daysLeft !== null && !isPayment && (
              <span
                className={`${styles.daysChip} ${
                  daysLeft < 0
                    ? styles.daysChipOverdue
                    : daysLeft <= 7
                    ? styles.daysChipWarning
                    : ""
                }`}
              >
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}d overdue`
                  : daysLeft === 0
                  ? "Due today"
                  : `${daysLeft}d left`}
              </span>
            )}
          </div>
          <h3 className={styles.detailTitle}>{meta.projectName}</h3>
          <p className={styles.detailCustomer}>{meta.customerName}</p>
        </div>
        <button
          className={styles.detailClose}
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      <div className={styles.detailBody}>
        {/* ── Payment event ──────────────────────────────────────────── */}
        {isPayment && (
          <>
            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Payment Detail</span>
              <DetailRow
                label="Amount"
                value={`$${fmt$(meta.amount)}`}
                highlight={!meta.isPaid && meta.isOverdue}
                mono
              />
              <DetailRow
                label="Status"
                value={
                  meta.isPaid
                    ? "✅ Paid"
                    : meta.isOverdue
                    ? "⚠️ Overdue"
                    : "⏳ Pending"
                }
              />
              <DetailRow label="Due Date" value={shortDate(meta.date)} />
              {meta.installmentNumber && (
                <DetailRow
                  label="Installment"
                  value={`#${meta.installmentNumber} of ${
                    meta.totalInstallments || "?"
                  }`}
                />
              )}
              {meta.method && <DetailRow label="Method" value={meta.method} />}
              {meta.note && <DetailRow label="Note" value={meta.note} />}
            </div>

            <div className={styles.detailDivider} />

            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Project Context</span>
              <DetailRow label="Status" value={meta.status} />
              <DetailRow label="Start" value={shortDate(meta.startDate)} />
              <DetailRow label="Finish" value={shortDate(meta.finishDate)} />
            </div>

            <FinancialBlock
              grandTotal={meta.grandTotal}
              totalPaid={meta.totalPaid}
              remaining={meta.remaining}
              depositAmt={0}
              progressPct={meta.progressPct}
              overdueCount={0}
            />
          </>
        )}

        {/* ── Project event (span / start / end) ─────────────────────── */}
        {isProject && (
          <>
            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Timeline</span>
              <DetailRow label="Start" value={shortDate(meta.startDate)} />
              <DetailRow label="Finish" value={shortDate(meta.finishDate)} />
              {meta.durationDays != null && (
                <DetailRow
                  label="Duration"
                  value={`${meta.durationDays} day${
                    meta.durationDays !== 1 ? "s" : ""
                  }`}
                />
              )}
              {meta.propertyType && (
                <DetailRow label="Property" value={meta.propertyType} />
              )}
              {meta.paymentType && (
                <DetailRow label="Payment Plan" value={meta.paymentType} />
              )}
              {(meta.totalCategories > 0 || meta.totalWorkItems > 0) && (
                <DetailRow
                  label="Scope"
                  value={`${meta.totalCategories} categor${
                    meta.totalCategories !== 1 ? "ies" : "y"
                  } · ${meta.totalWorkItems} item${
                    meta.totalWorkItems !== 1 ? "s" : ""
                  }`}
                />
              )}
            </div>

            {meta.categories && meta.categories.length > 0 && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionLabel}>
                    Scope of Work
                  </span>
                  <ScopeOfWork categories={meta.categories} />
                </div>
              </>
            )}

            <div className={styles.detailDivider} />

            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Cost Breakdown</span>
              <PricingChips ps={meta.pricingSettings} />
              <CostBreakdown cb={meta.costBreakdown} />
            </div>

            {(meta.miscFees?.length > 0 || meta.credits?.length > 0) && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <FeesAndCredits
                    miscFees={meta.miscFees}
                    credits={meta.credits}
                  />
                </div>
              </>
            )}

            {meta.wasteEntries?.length > 0 && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <WasteBlock wasteEntries={meta.wasteEntries} />
                </div>
              </>
            )}

            <div className={styles.detailDivider} />

            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Payment Summary</span>
              <FinancialBlock
                grandTotal={meta.grandTotal}
                totalPaid={meta.totalPaid}
                remaining={meta.remaining}
                depositAmt={meta.depositAmt}
                progressPct={meta.progressPct}
                overdueCount={meta.overdueInstallments}
              />
              {meta.overdueInstallments > 0 && (
                <div className={styles.overdueAlert}>
                  ⚠️ {meta.overdueInstallments} overdue installment
                  {meta.overdueInstallments > 1 ? "s" : ""}
                </div>
              )}
            </div>

            {meta.installments && meta.installments.length > 0 && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionLabel}>
                    Installments
                    <span className={styles.installmentBadge}>
                      {meta.paidInstallments}/{meta.totalInstallments} paid
                    </span>
                  </span>
                  <InstallmentTable installments={meta.installments} />
                </div>
              </>
            )}

            {meta.otherPayments && meta.otherPayments.length > 0 && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionLabel}>
                    Other Payments
                  </span>
                  <MiniTable
                    widths="70px 1fr auto"
                    headers={["Date", "Type", "Amount"]}
                  >
                    {meta.otherPayments.map((p, i) => (
                      <MiniTableRow key={i} widths="70px 1fr auto">
                        <span>{shortDate(p.date)}</span>
                        <span>
                          {p.type}
                          {p.method ? ` · ${p.method}` : ""}
                        </span>
                        <span style={{ textAlign: "right" }}>
                          ${fmt$(p.amount)}
                        </span>
                      </MiniTableRow>
                    ))}
                  </MiniTable>
                </div>
              </>
            )}

            {meta.notes && (
              <>
                <div className={styles.detailDivider} />
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionLabel}>Notes</span>
                  <p className={styles.notesText}>{meta.notes}</p>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Contact (always shown) ─────────────────────────────────── */}
        {(meta.phone || meta.email || meta.address) && (
          <>
            <div className={styles.detailDivider} />
            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Contact</span>
              {meta.phone && (
                <DetailRow
                  label="Phone"
                  value={
                    <a href={`tel:${meta.phone}`} className={styles.detailLink}>
                      {meta.phone}
                    </a>
                  }
                />
              )}
              {meta.email && (
                <DetailRow
                  label="Email"
                  value={
                    <a
                      href={`mailto:${meta.email}`}
                      className={styles.detailLink}
                    >
                      {meta.email}
                    </a>
                  }
                />
              )}
              {meta.address && (
                <DetailRow
                  label="Address"
                  value={
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(
                        meta.address,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.detailLink}
                    >
                      {meta.address}
                    </a>
                  }
                />
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStat({ label, value, accent }) {
  return (
    <div className={styles.summaryStat}>
      <span className={styles.summaryValue} data-accent={accent}>
        {value}
      </span>
      <span className={styles.summaryLabel}>{label}</span>
    </div>
  );
}

function SummaryStrip({ projects }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekAhead = addDays(now, 7);

    let grandTotal = 0,
      totalPaid = 0,
      overdue = 0,
      active = 0,
      overduePayments = 0;
    let draftCount = 0,
      monthRevenue = 0,
      upcoming7Count = 0,
      upcoming7Amount = 0;

    projects.forEach((p) => {
      grandTotal += p._cachedTotal || 0;
      const payments = p.settings?.payments || [];
      const paid = payments.reduce(
        (s, pay) => s + (pay.isPaid ? parseFloat(pay.amount) || 0 : 0),
        0,
      );
      totalPaid += paid;
      overduePayments += payments.filter(
        (pay) =>
          !pay.isPaid &&
          isPast(safeDate(pay.date) || new Date()) &&
          !isToday(safeDate(pay.date) || new Date()),
      ).length;

      payments.forEach((pay) => {
        const d = safeDate(pay.date);
        if (!d) return;
        if (
          pay.isPaid &&
          isWithinInterval(d, { start: monthStart, end: monthEnd })
        ) {
          monthRevenue += parseFloat(pay.amount) || 0;
        }
        if (
          !pay.isPaid &&
          isWithinInterval(d, { start: now, end: weekAhead })
        ) {
          upcoming7Count += 1;
          upcoming7Amount += parseFloat(pay.amount) || 0;
        }
      });

      const status = deriveStatus(p);
      if (status === "Overdue") overdue++;
      if (status === "In Progress") active++;
      if ((p.workflowStatus || "draft") === "draft") draftCount++;
    });

    const avgValue = projects.length > 0 ? grandTotal / projects.length : 0;

    return {
      grandTotal,
      totalPaid,
      remaining: grandTotal - totalPaid,
      overdue,
      active,
      overduePayments,
      draftCount,
      monthRevenue,
      upcoming7Count,
      upcoming7Amount,
      avgValue,
    };
  }, [projects]);

  return (
    <div className={styles.summaryStrip}>
      <SummaryStat label="Active" value={stats.active} accent="secondary" />
      <SummaryStat
        label="Overdue Projects"
        value={stats.overdue}
        accent={stats.overdue > 0 ? "error" : "success"}
      />
      <SummaryStat
        label="Late Payments"
        value={stats.overduePayments}
        accent={stats.overduePayments > 0 ? "warning" : "success"}
      />
      <SummaryStat
        label="Revenue"
        value={`$${fmt$(stats.grandTotal)}`}
        accent="primary"
      />
      <SummaryStat
        label="Collected"
        value={`$${fmt$(stats.totalPaid)}`}
        accent="success"
      />
      <SummaryStat
        label="Outstanding"
        value={`$${fmt$(stats.remaining)}`}
        accent={stats.remaining > 0 ? "error" : "success"}
      />
      <SummaryStat
        label="This Month"
        value={`$${fmt$(stats.monthRevenue)}`}
        accent="primary"
      />
      <SummaryStat
        label="Due in 7 Days"
        value={`${stats.upcoming7Count} · $${fmt$(stats.upcoming7Amount)}`}
        accent={stats.upcoming7Count > 0 ? "warning" : "success"}
      />
      <SummaryStat
        label="Avg. Project"
        value={`$${fmt$(stats.avgValue)}`}
        accent="secondary"
      />
      <SummaryStat label="Drafts" value={stats.draftCount} accent="secondary" />
    </div>
  );
}

// ─── List view (alternate to the calendar grid) ───────────────────────────────

function ListView({ projects, onSelect }) {
  const grouped = useMemo(() => {
    const groups = {};
    projects.forEach((p) => {
      const start = safeDate(p.customerInfo?.startDate);
      const key = start
        ? start.toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "No Start Date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const da = safeDate(a[0]?.customerInfo?.startDate);
      const db = safeDate(b[0]?.customerInfo?.startDate);
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }, [projects]);

  if (projects.length === 0) {
    return (
      <div className={styles.loadingState}>
        <p>No projects match the current filters.</p>
      </div>
    );
  }

  const statusAccent = {
    Completed: "var(--success)",
    "In Progress": "var(--secondary)",
    Pending: "var(--warning)",
    Overdue: "var(--error)",
    Unknown: "var(--muted)",
  };

  return (
    <div className={styles.listView}>
      {grouped.map(([label, group]) => (
        <div key={label} className={styles.listMonthGroup}>
          <div className={styles.listMonthLabel}>{label}</div>
          {group.map((p) => {
            const ci = p.customerInfo || {};
            const status = deriveStatus(p);
            const grandTotal = p._cachedTotal || 0;
            const paid = (p.settings?.payments || []).reduce(
              (s, pay) => s + (pay.isPaid ? parseFloat(pay.amount) || 0 : 0),
              0,
            );
            const events = buildEvents([p]);
            const spanEvent =
              events.find((e) => e.eventType.startsWith("span-")) || events[0];
            return (
              <button
                key={p._id}
                className={styles.listCard}
                onClick={() => spanEvent && onSelect(spanEvent)}
              >
                <span
                  className={styles.listCardStatusBar}
                  style={{ background: statusAccent[status] }}
                />
                <div className={styles.listCardMain}>
                  <div className={styles.listCardTitleRow}>
                    <span className={styles.listCardTitle}>
                      {ci.firstName || ""} {ci.lastName || ""} —{" "}
                      {ci.projectName || "Unnamed Project"}
                    </span>
                    <span
                      className={`${styles.statusPill}`}
                      style={{
                        background: `color-mix(in srgb, ${statusAccent[status]} 15%, transparent)`,
                        color: statusAccent[status],
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  <div className={styles.listCardMeta}>
                    <span>
                      {shortDate(ci.startDate)} → {shortDate(ci.finishDate)}
                    </span>
                    <span>{(p.categories || []).length} categories</span>
                    {(p.workflowStatus || "draft") === "draft" && (
                      <span
                        className={styles.workflowBadge}
                        data-workflow="draft"
                      >
                        Draft
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.listCardFinancial}>
                  <span className={styles.finStatValue}>
                    ${fmt$(grandTotal)}
                  </span>
                  <span className={styles.summaryLabel}>
                    ${fmt$(paid)} paid
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function TogglePill({ active, onClick, color, children }) {
  return (
    <button
      className={`${styles.togglePill} ${
        active ? styles.togglePillActive : ""
      }`}
      onClick={onClick}
      style={active ? { borderColor: color, color } : {}}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectCalendar() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [showProjectSpans, setShowProjectSpans] = useState(true);
  const [showPayments, setShowPayments] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState("calendar"); // 'calendar' | 'list'

  useEffect(() => {
    (async () => {
      try {
        const data = await getCalendarProjects();
        const enriched = data.map((p) => ({
          ...p,
          _cachedTotal:
            parseFloat(p.settings?.grandTotal) ||
            parseFloat(p.paymentDetails?.grandTotal) ||
            parseFloat(p.totals?.total) ||
            0,
        }));
        setProjects(enriched);
      } catch (err) {
        console.error("ProjectCalendar fetch error:", err);
        setError("Could not load projects. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categoryOptions = useMemo(() => {
    const names = new Set();
    projects.forEach((p) =>
      (p.categories || []).forEach((c) =>
        names.add(c.name || humanizeKey(c.key)),
      ),
    );
    return ["All", ...Array.from(names).sort()];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let list = projects;

    if (statusFilter !== "All") {
      list = list.filter((p) => deriveStatus(p) === statusFilter);
    }

    if (categoryFilter !== "All") {
      list = list.filter((p) =>
        (p.categories || []).some(
          (c) => (c.name || humanizeKey(c.key)) === categoryFilter,
        ),
      );
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((p) => {
        const ci = p.customerInfo || {};
        const haystack = [
          ci.firstName,
          ci.lastName,
          ci.projectName,
          ci.street,
          ci.city,
          ci.zipCode,
          ci.email,
          ci.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return list;
  }, [projects, statusFilter, categoryFilter, searchText]);

  const allEvents = useMemo(
    () => buildEvents(filteredProjects),
    [filteredProjects],
  );

  const visibleEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.eventType.startsWith("span-") && !showProjectSpans) return false;
      if (e.eventType.startsWith("payment-") && !showPayments) return false;
      if (
        (e.eventType === "project-start" || e.eventType === "project-end") &&
        !showPins
      )
        return false;
      return true;
    });
  }, [allEvents, showProjectSpans, showPayments, showPins]);

  const scopeTotals = useMemo(() => {
    const totalCategories = filteredProjects.reduce(
      (s, p) => s + (p.categories || []).length,
      0,
    );
    const totalWorkItems = filteredProjects.reduce(
      (s, p) =>
        s +
        (p.categories || []).reduce(
          (s2, c) => s2 + (c.workItems || []).length,
          0,
        ),
      0,
    );
    return { totalCategories, totalWorkItems };
  }, [filteredProjects]);

  const handleSelectEvent = useCallback((event) => setSelectedEvent(event), []);

  const eventPropGetter = useCallback((event) => {
    const { bg, border } = colorFor(event.eventType);
    const isDraft = event.meta?.workflowStatus === "draft";
    return {
      style: {
        backgroundColor: bg,
        borderLeft: `3px solid ${border}`,
        borderStyle: isDraft ? "dashed" : "solid",
        borderRadius: "4px",
        color: "#fff",
        fontSize: "0.72rem",
        fontWeight: 500,
        padding: "2px 5px",
        opacity: isDraft ? 0.75 : 0.92,
      },
    };
  }, []);

  const handleExportCSV = useCallback(() => {
    const header = [
      "Customer",
      "Project",
      "Status",
      "Workflow",
      "Start",
      "Finish",
      "Duration (days)",
      "Categories",
      "Work Items",
      "Material Cost",
      "Labor Cost",
      "Waste Cost",
      "Transportation",
      "Tax",
      "Markup",
      "Misc Fees",
      "Credits",
      "Subtotal",
      "Grand Total",
      "Paid",
      "Remaining",
      "Deposit",
      "Installments Paid",
      "Installments Total",
      "Address",
      "Phone",
      "Email",
    ];
    const rows = [header];
    filteredProjects.forEach((p) => {
      const events = buildEvents([p]);
      const spanEvent = events.find((e) => e.eventType.startsWith("span-"));
      const m = spanEvent?.meta;
      if (!m) return;
      rows.push([
        m.customerName,
        m.projectName,
        m.status,
        m.workflowStatus,
        shortDate(m.startDate),
        shortDate(m.finishDate),
        m.durationDays ?? "",
        m.totalCategories,
        m.totalWorkItems,
        m.costBreakdown.materialCost.toFixed(2),
        m.costBreakdown.laborCost.toFixed(2),
        m.costBreakdown.wasteCost.toFixed(2),
        m.costBreakdown.transportationFee.toFixed(2),
        m.costBreakdown.taxAmount.toFixed(2),
        m.costBreakdown.markupAmount.toFixed(2),
        m.costBreakdown.miscFeesTotal.toFixed(2),
        m.costBreakdown.creditsTotal.toFixed(2),
        m.costBreakdown.subtotal.toFixed(2),
        m.grandTotal.toFixed(2),
        m.totalPaid.toFixed(2),
        m.remaining.toFixed(2),
        m.depositAmt.toFixed(2),
        m.paidInstallments,
        m.totalInstallments,
        m.address,
        m.phone,
        m.email,
      ]);
    });
    downloadCSV(
      `project-schedule-${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
    );
  }, [filteredProjects]);

  return (
    <div
      className={`${styles.wrapper} ${
        selectedEvent ? styles.wrapperWithPanel : ""
      }`}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className={styles.calHeader}>
        <div className={styles.calHeaderLeft}>
          <h2 className={styles.calTitle}>Project Schedule</h2>
          <p className={styles.calSubtitle}>
            {filteredProjects.length} project
            {filteredProjects.length !== 1 ? "s" : ""} · {visibleEvents.length}{" "}
            events · {scopeTotals.totalCategories} categories ·{" "}
            {scopeTotals.totalWorkItems} work items
          </p>
        </div>

        <div className={styles.calHeaderRight}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search customer, project, address…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {["All", "In Progress", "Pending", "Completed", "Overdue"].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>

          <select
            className={styles.filterSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Work Types" : c}
              </option>
            ))}
          </select>

          <div className={styles.toggleGroup}>
            <TogglePill
              active={showProjectSpans}
              onClick={() => setShowProjectSpans((v) => !v)}
              color="var(--secondary)"
            >
              Project Bars
            </TogglePill>
            <TogglePill
              active={showPayments}
              onClick={() => setShowPayments((v) => !v)}
              color="#7c3aed"
            >
              Payments
            </TogglePill>
            <TogglePill
              active={showPins}
              onClick={() => setShowPins((v) => !v)}
              color="var(--primary)"
            >
              Start / End
            </TogglePill>
          </div>

          <div className={styles.toggleGroup}>
            <TogglePill
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              color="var(--primary)"
            >
              📅 Calendar
            </TogglePill>
            <TogglePill
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
              color="var(--primary)"
            >
              📋 List
            </TogglePill>
          </div>

          <button className={styles.actionBtn} onClick={handleExportCSV}>
            ⬇ Export CSV
          </button>
          <button className={styles.actionBtn} onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </header>

      {/* ── Summary strip ─────────────────────────────────────────── */}
      {!loading && !error && <SummaryStrip projects={filteredProjects} />}

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className={styles.mainArea}>
        <div className={styles.calendarPane}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Loading schedule…</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          ) : viewMode === "list" ? (
            <ListView
              projects={filteredProjects}
              onSelect={handleSelectEvent}
            />
          ) : (
            <Calendar
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "100%" }}
              eventPropGetter={eventPropGetter}
              onSelectEvent={handleSelectEvent}
              views={["month", "week", "day", "agenda"]}
              defaultView="month"
              popup
              tooltipAccessor={(e) => e.title}
            />
          )}
        </div>

        {selectedEvent && (
          <DetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>

      {/* ── Legend ────────────────────────────────────────────────── */}
      <footer className={styles.legend}>
        {LEGEND.map(({ label, color }) => (
          <span key={label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{
              background: "var(--muted)",
              border: "1px dashed var(--text-light)",
            }}
          />
          Draft (dashed)
        </span>
      </footer>
    </div>
  );
}
