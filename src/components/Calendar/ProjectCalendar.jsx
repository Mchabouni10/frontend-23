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
// Clicking any event opens a rich side panel with every field a contractor
// needs: dates, duration, financial snapshot, full installment list, contacts.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isPast, isToday, differenceInDays } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getProjects } from '../../services/projectService';
import styles from './ProjectCalendar.module.css';

// ─── Localizer ────────────────────────────────────────────────────────────────

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function fmt$(n) {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

/** Derive project status the same way CustomerProjects.jsx does */
function deriveStatus(project) {
  const today = new Date();
  const start  = safeDate(project.customerInfo?.startDate);
  const finish = safeDate(project.customerInfo?.finishDate);
  const payments   = project.settings?.payments || [];
  const grandTotal = project._cachedTotal || 0;
  const totalPaid  = payments.reduce((s, p) => s + (p.isPaid ? parseFloat(p.amount) || 0 : 0), 0);
  const remaining  = Math.max(0, grandTotal - totalPaid);

  if (remaining === 0 && finish && finish < today) return 'Completed';
  if (finish && finish < today && remaining > 0)   return 'Overdue';
  if (start && start > today)                      return 'Pending';
  if (start && finish && start <= today && finish >= today) return 'In Progress';
  return 'Unknown';
}

// ─── Event colour map ─────────────────────────────────────────────────────────

const EVENT_COLORS = {
  'span-Completed':               { bg: 'var(--success)',        border: 'var(--success-dark)' },
  'span-In Progress':             { bg: 'var(--secondary)',      border: 'var(--secondary-dark)' },
  'span-Pending':                 { bg: 'var(--warning)',        border: 'var(--warning-dark)' },
  'span-Overdue':                 { bg: 'var(--error)',          border: 'var(--error-dark)' },
  'span-Unknown':                 { bg: 'var(--muted)',          border: 'var(--muted-dark)' },
  'payment-deposit':              { bg: '#7c3aed',               border: '#5b21b6' },
  'payment-deposit-paid':         { bg: 'var(--success)',        border: 'var(--success-dark)' },
  'payment-installment':          { bg: 'var(--secondary)',      border: 'var(--secondary-dark)' },
  'payment-installment-paid':     { bg: 'var(--success)',        border: 'var(--success-dark)' },
  'payment-installment-overdue':  { bg: 'var(--error)',          border: 'var(--error-dark)' },
  'payment-onetime':              { bg: 'var(--muted)',          border: 'var(--muted-dark)' },
  'project-start':                { bg: 'var(--primary)',        border: 'var(--primary-dark)' },
  'project-end':                  { bg: 'var(--primary-dark)',   border: 'var(--primary)' },
};

function colorFor(eventType) {
  return EVENT_COLORS[eventType] || { bg: 'var(--muted)', border: 'var(--muted-dark)' };
}

// ─── Build events from project list ──────────────────────────────────────────

function buildEvents(projects) {
  const events = [];

  projects.forEach((project) => {
    const ci           = project.customerInfo || {};
    const status       = deriveStatus(project);
    const customerName = `${ci.firstName || ''} ${ci.lastName || ''}`.trim() || 'Unknown';
    const projectLabel = ci.projectName || 'Unnamed Project';
    const fullTitle    = `${customerName} — ${projectLabel}`;
    const payments     = project.settings?.payments || [];
    const grandTotal   = project._cachedTotal || 0;

    const totalPaid = payments.reduce((s, p) => s + (p.isPaid ? parseFloat(p.amount) || 0 : 0), 0);
    const remaining = Math.max(0, grandTotal - totalPaid);
    const deposit   = payments.find((p) => (p.type || p.paymentType) === 'Deposit');
    const depositAmt = deposit ? parseFloat(deposit.amount) || 0 : 0;

    const installments = payments
      .filter((p) => (p.type || p.paymentType) === 'Installment')
      .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));

    const paidInstallments    = installments.filter((p) => p.isPaid).length;
    const overdueInstallments = installments.filter(
      (p) => !p.isPaid && isPast(safeDate(p.date) || new Date()) && !isToday(safeDate(p.date) || new Date()),
    ).length;

    const start  = safeDate(ci.startDate);
    const finish = safeDate(ci.finishDate);
    const dur    = durationDays(ci.startDate, ci.finishDate);

    const projectMeta = {
      projectId:    project._id,
      customerName,
      projectName:  projectLabel,
      status,
      startDate:    ci.startDate,
      finishDate:   ci.finishDate,
      durationDays: dur,
      address:      [ci.street, ci.unit, ci.city, ci.state, ci.zipCode].filter(Boolean).join(', '),
      phone:        ci.phone,
      email:        ci.email,
      paymentType:  ci.paymentType,
      type:         ci.type,
      notes:        ci.notes,
      grandTotal,
      totalPaid,
      remaining,
      depositAmt,
      paidInstallments,
      totalInstallments: installments.length,
      overdueInstallments,
      progressPct:  grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0,
      installments: installments.map((p) => ({
        id:                p.id,
        installmentNumber: p.installmentNumber,
        totalInstallments: p.totalInstallments,
        date:              p.date,
        amount:            parseFloat(p.amount) || 0,
        isPaid:            p.isPaid,
        method:            p.method,
        note:              p.note,
        isOverdue: !p.isPaid && isPast(safeDate(p.date) || new Date()) && !isToday(safeDate(p.date) || new Date()),
      })),
    };

    // ── Project span bar ──────────────────────────────────────────────────────
    if (start) {
      const end = finish
        ? new Date(finish.getTime() + 86400000)
        : new Date(start.getTime() + 86400000);

      const installSuffix = installments.length > 0
        ? ` · ${paidInstallments}/${installments.length} paid`
        : '';

      events.push({
        id:        `span-${project._id}`,
        title:     `📋 ${fullTitle}${installSuffix}`,
        start,
        end,
        allDay:    true,
        eventType: `span-${status}`,
        meta:      { kind: 'project-span', ...projectMeta },
      });
    }

    // ── Start pin ─────────────────────────────────────────────────────────────
    if (start) {
      events.push({
        id:        `start-${project._id}`,
        title:     `🚀 Start: ${projectLabel}`,
        start,
        end:       start,
        allDay:    true,
        eventType: 'project-start',
        meta:      { kind: 'project-start', ...projectMeta },
      });
    }

    // ── Finish pin ────────────────────────────────────────────────────────────
    if (finish) {
      events.push({
        id:        `end-${project._id}`,
        title:     `🏁 End: ${projectLabel}`,
        start:     finish,
        end:       finish,
        allDay:    true,
        eventType: 'project-end',
        meta:      { kind: 'project-end', ...projectMeta },
      });
    }

    // ── Payments ──────────────────────────────────────────────────────────────
    payments.forEach((payment) => {
      const payDate = safeDate(payment.date);
      if (!payDate) return;

      const pType   = (payment.type || payment.paymentType || '').trim();
      const amount  = parseFloat(payment.amount) || 0;
      const isOverdue = !payment.isPaid && isPast(payDate) && !isToday(payDate);

      let eventType = 'payment-onetime';
      let emoji     = '💵';

      if (pType === 'Deposit') {
        eventType = payment.isPaid ? 'payment-deposit-paid' : 'payment-deposit';
        emoji     = payment.isPaid ? '✅' : '💎';
      } else if (pType === 'Installment') {
        eventType = isOverdue
          ? 'payment-installment-overdue'
          : payment.isPaid
          ? 'payment-installment-paid'
          : 'payment-installment';
        emoji = payment.isPaid ? '✅' : isOverdue ? '⚠️' : '📅';
      }

      const label =
        pType === 'Installment'
          ? `${emoji} #${payment.installmentNumber} $${fmt$(amount)} — ${customerName}`
          : `${emoji} ${pType} $${fmt$(amount)} — ${customerName}`;

      events.push({
        id:        `pay-${project._id}-${payment.id || Math.random()}`,
        title:     label,
        start:     payDate,
        end:       payDate,
        allDay:    true,
        eventType,
        meta: {
          kind:              'payment',
          paymentType:       pType,
          amount,
          isPaid:            payment.isPaid,
          isOverdue,
          method:            payment.method,
          note:              payment.note,
          installmentNumber: payment.installmentNumber,
          totalInstallments: payment.totalInstallments,
          customerName,
          projectName:       projectLabel,
          projectId:         project._id,
          phone:             ci.phone,
          email:             ci.email,
          address:           [ci.street, ci.unit, ci.city, ci.state, ci.zipCode].filter(Boolean).join(', '),
          date:              payment.date,
          grandTotal,
          totalPaid,
          remaining,
          progressPct:       grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0,
          status,
          startDate:         ci.startDate,
          finishDate:        ci.finishDate,
        },
      });
    });
  });

  return events;
}

// ─── Legend config ────────────────────────────────────────────────────────────

const LEGEND = [
  { label: 'In Progress',    color: 'var(--secondary)' },
  { label: 'Completed',      color: 'var(--success)' },
  { label: 'Pending',        color: 'var(--warning)' },
  { label: 'Overdue',        color: 'var(--error)' },
  { label: 'Deposit',        color: '#7c3aed' },
  { label: 'Payment Due',    color: 'var(--secondary)' },
  { label: 'Payment Paid',   color: 'var(--success)' },
  { label: 'Payment Late',   color: 'var(--error)' },
  { label: 'Start / End',    color: 'var(--primary)' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailRow({ label, value, highlight, mono }) {
  return (
    <div className={`${styles.detailRow} ${highlight ? styles.detailRowHighlight : ''}`}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={`${styles.detailValue} ${mono ? styles.detailValueMono : ''}`}>{value}</span>
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
          ? { label: 'Paid',    cls: styles.tagPaid }
          : inst.isOverdue
          ? { label: 'Overdue', cls: styles.tagOverdue }
          : { label: 'Pending', cls: styles.tagPending };
        return (
          <div
            key={inst.id || i}
            className={`${styles.installmentRow} ${inst.isOverdue ? styles.installmentRowOverdue : ''}`}
          >
            <span className={styles.instNum}>
              {inst.installmentNumber}/{inst.totalInstallments || installments.length}
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

function FinancialBlock({ grandTotal, totalPaid, remaining, depositAmt, progressPct, overdueCount }) {
  return (
    <div className={styles.financialBlock}>
      <div className={styles.financialGrid}>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Total</span>
          <span className={styles.finStatValue}>${fmt$(grandTotal)}</span>
        </div>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Paid</span>
          <span className={`${styles.finStatValue} ${styles.finStatPaid}`}>${fmt$(totalPaid)}</span>
        </div>
        <div className={styles.finStat}>
          <span className={styles.finStatLabel}>Balance</span>
          <span className={`${styles.finStatValue} ${remaining > 0 ? styles.finStatDue : styles.finStatSettled}`}>
            ${fmt$(remaining)}
          </span>
        </div>
        {depositAmt > 0 && (
          <div className={styles.finStat}>
            <span className={styles.finStatLabel}>Deposit</span>
            <span className={`${styles.finStatValue} ${styles.finStatDeposit}`}>${fmt$(depositAmt)}</span>
          </div>
        )}
      </div>
      <MiniProgressBar pct={progressPct} overdueCount={overdueCount} />
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ event, onClose }) {
  if (!event) return null;
  const { meta } = event;

  const isProject = meta.kind === 'project-span' || meta.kind === 'project-start' || meta.kind === 'project-end';
  const isPayment = meta.kind === 'payment';

  const daysLeft = meta.finishDate ? daysFromToday(meta.finishDate) : null;

  const statusColors = {
    Completed:     styles.statusCompleted,
    'In Progress': styles.statusInProgress,
    Pending:       styles.statusPending,
    Overdue:       styles.statusOverdue,
    Unknown:       styles.statusUnknown,
  };

  return (
    <aside className={styles.detailPanel}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderMain}>
          <div className={styles.detailBadgeRow}>
            <span className={styles.detailKindBadge} data-kind={meta.kind}>
              {isPayment ? meta.paymentType : 'Project'}
            </span>
            {meta.status && (
              <span className={`${styles.statusPill} ${statusColors[meta.status] || ''}`}>
                {meta.status}
              </span>
            )}
            {daysLeft !== null && !isPayment && (
              <span className={`${styles.daysChip} ${daysLeft < 0 ? styles.daysChipOverdue : daysLeft <= 7 ? styles.daysChipWarning : ''}`}>
                {daysLeft < 0
                  ? `${Math.abs(daysLeft)}d overdue`
                  : daysLeft === 0
                  ? 'Due today'
                  : `${daysLeft}d left`}
              </span>
            )}
          </div>
          <h3 className={styles.detailTitle}>{meta.projectName}</h3>
          <p className={styles.detailCustomer}>{meta.customerName}</p>
        </div>
        <button className={styles.detailClose} onClick={onClose} aria-label="Close panel">✕</button>
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
                value={meta.isPaid ? '✅ Paid' : meta.isOverdue ? '⚠️ Overdue' : '⏳ Pending'}
              />
              <DetailRow label="Due Date" value={shortDate(meta.date)} />
              {meta.installmentNumber && (
                <DetailRow
                  label="Installment"
                  value={`#${meta.installmentNumber} of ${meta.totalInstallments || '?'}`}
                />
              )}
              {meta.method && <DetailRow label="Method" value={meta.method} />}
              {meta.note   && <DetailRow label="Note"   value={meta.note} />}
            </div>

            <div className={styles.detailDivider} />

            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Project Context</span>
              <DetailRow label="Status" value={meta.status} />
              <DetailRow label="Start"  value={shortDate(meta.startDate)} />
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
              <DetailRow label="Start"    value={shortDate(meta.startDate)} />
              <DetailRow label="Finish"   value={shortDate(meta.finishDate)} />
              {meta.durationDays != null && (
                <DetailRow label="Duration" value={`${meta.durationDays} day${meta.durationDays !== 1 ? 's' : ''}`} />
              )}
              {meta.type        && <DetailRow label="Work Type"    value={meta.type} />}
              {meta.paymentType && <DetailRow label="Payment Plan" value={meta.paymentType} />}
            </div>

            <div className={styles.detailDivider} />

            <div className={styles.detailSection}>
              <span className={styles.detailSectionLabel}>Financials</span>
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
                  ⚠️ {meta.overdueInstallments} overdue installment{meta.overdueInstallments > 1 ? 's' : ''}
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
                  value={<a href={`tel:${meta.phone}`} className={styles.detailLink}>{meta.phone}</a>}
                />
              )}
              {meta.email && (
                <DetailRow
                  label="Email"
                  value={<a href={`mailto:${meta.email}`} className={styles.detailLink}>{meta.email}</a>}
                />
              )}
              {meta.address && <DetailRow label="Address" value={meta.address} />}
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
      <span className={styles.summaryValue} data-accent={accent}>{value}</span>
      <span className={styles.summaryLabel}>{label}</span>
    </div>
  );
}

function SummaryStrip({ projects }) {
  const stats = useMemo(() => {
    let grandTotal = 0, totalPaid = 0, overdue = 0, active = 0, overduePayments = 0;
    projects.forEach((p) => {
      grandTotal += p._cachedTotal || 0;
      const payments = p.settings?.payments || [];
      const paid = payments.reduce((s, pay) => s + (pay.isPaid ? parseFloat(pay.amount) || 0 : 0), 0);
      totalPaid += paid;
      overduePayments += payments.filter(
        (pay) => !pay.isPaid && isPast(safeDate(pay.date) || new Date()) && !isToday(safeDate(pay.date) || new Date()),
      ).length;
      const status = deriveStatus(p);
      if (status === 'Overdue')     overdue++;
      if (status === 'In Progress') active++;
    });
    return { grandTotal, totalPaid, remaining: grandTotal - totalPaid, overdue, active, overduePayments };
  }, [projects]);

  return (
    <div className={styles.summaryStrip}>
      <SummaryStat label="Active"           value={stats.active}                  accent="secondary" />
      <SummaryStat label="Overdue Projects" value={stats.overdue}                 accent={stats.overdue > 0 ? 'error' : 'success'} />
      <SummaryStat label="Late Payments"    value={stats.overduePayments}         accent={stats.overduePayments > 0 ? 'warning' : 'success'} />
      <SummaryStat label="Revenue"          value={`$${fmt$(stats.grandTotal)}`}  accent="primary" />
      <SummaryStat label="Collected"        value={`$${fmt$(stats.totalPaid)}`}   accent="success" />
      <SummaryStat label="Outstanding"      value={`$${fmt$(stats.remaining)}`}   accent={stats.remaining > 0 ? 'error' : 'success'} />
    </div>
  );
}

// ─── Toggle pill ──────────────────────────────────────────────────────────────

function TogglePill({ active, onClick, color, children }) {
  return (
    <button
      className={`${styles.togglePill} ${active ? styles.togglePillActive : ''}`}
      onClick={onClick}
      style={active ? { borderColor: color, color } : {}}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectCalendar() {
  const [projects, setProjects]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [showProjectSpans, setShowProjectSpans] = useState(true);
  const [showPayments, setShowPayments]         = useState(true);
  const [showPins, setShowPins]                 = useState(true);
  const [statusFilter, setStatusFilter]         = useState('All');

  useEffect(() => {
    (async () => {
      try {
        const data = await getProjects();
        const enriched = data.map((p) => ({
          ...p,
          _cachedTotal: parseFloat(p.settings?.grandTotal) || 0,
        }));
        setProjects(enriched);
      } catch (err) {
        console.error('ProjectCalendar fetch error:', err);
        setError('Could not load projects. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'All') return projects;
    return projects.filter((p) => deriveStatus(p) === statusFilter);
  }, [projects, statusFilter]);

  const allEvents     = useMemo(() => buildEvents(filteredProjects), [filteredProjects]);

  const visibleEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.eventType.startsWith('span-')    && !showProjectSpans) return false;
      if (e.eventType.startsWith('payment-') && !showPayments)     return false;
      if ((e.eventType === 'project-start' || e.eventType === 'project-end') && !showPins) return false;
      return true;
    });
  }, [allEvents, showProjectSpans, showPayments, showPins]);

  const handleSelectEvent = useCallback((event) => setSelectedEvent(event), []);

  const eventPropGetter = useCallback((event) => {
    const { bg, border } = colorFor(event.eventType);
    return {
      style: {
        backgroundColor: bg,
        borderLeft:  `3px solid ${border}`,
        borderRadius: '4px',
        color:       '#fff',
        fontSize:    '0.72rem',
        fontWeight:  500,
        padding:     '2px 5px',
        opacity:     0.92,
      },
    };
  }, []);

  return (
    <div className={`${styles.wrapper} ${selectedEvent ? styles.wrapperWithPanel : ''}`}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <header className={styles.calHeader}>
        <div className={styles.calHeaderLeft}>
          <h2 className={styles.calTitle}>Project Schedule</h2>
          <p className={styles.calSubtitle}>
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} · {visibleEvents.length} events
          </p>
        </div>

        <div className={styles.calHeaderRight}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {['All', 'In Progress', 'Pending', 'Completed', 'Overdue'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <div className={styles.toggleGroup}>
            <TogglePill active={showProjectSpans} onClick={() => setShowProjectSpans((v) => !v)} color="var(--secondary)">
              Project Bars
            </TogglePill>
            <TogglePill active={showPayments} onClick={() => setShowPayments((v) => !v)} color="#7c3aed">
              Payments
            </TogglePill>
            <TogglePill active={showPins} onClick={() => setShowPins((v) => !v)} color="var(--primary)">
              Start / End
            </TogglePill>
          </div>
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
          ) : (
            <Calendar
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              eventPropGetter={eventPropGetter}
              onSelectEvent={handleSelectEvent}
              views={['month', 'week', 'day', 'agenda']}
              defaultView="month"
              popup
              tooltipAccessor={(e) => e.title}
            />
          )}
        </div>

        {selectedEvent && (
          <DetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
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
      </footer>
    </div>
  );
}