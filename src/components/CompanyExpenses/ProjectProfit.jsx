// src/components/CompanyExpenses/ProjectProfit.jsx
import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHardHat,
  faPlus,
  faTrash,
  faCircleCheck,
  faTriangleExclamation,
  faChartLine,
  faLayerGroup,
  faListUl,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { calculateTotalProjectValue } from "../../constants/additionalRevenueCalculator";
import * as workersAPI from "../../utilities/workers-api";
import {
  getCategory,
  money,
  percent,
  toDateKey,
  formatDate,
  getProjectLabel,
  sortProjectsNewestFirst,
} from "./expenseShared";
import styles from "./ProjectProfit.module.css";

// Kept so existing imports (`import { getProjectLabel } from "./ProjectProfit"`)
// keep working; the implementation now lives in expenseShared.js.
export { getProjectLabel };

const PORTFOLIO_PREVIEW = 6;

// Everything we show about one project, computed in one place so the detail
// view and the "all projects" table can never disagree.
//
// Worker "Paid" = Worker Pay only, compared with the agreed amount.
// Meals bought for a worker are a project cost (and part of that worker's true
// cost) but they are NOT payments against the agreed amount.
function computeProject(project, jobExpenses, projectAssignments, workerById) {
  const contractTotal = calculateTotalProjectValue(project) || 0;

  const payByWorker = {};
  const mealsByWorker = {};
  let unassignedMeals = 0;
  let otherCosts = 0;
  const costBreakdown = {};

  jobExpenses.forEach((e) => {
    costBreakdown[e.category] = (costBreakdown[e.category] || 0) + e.amount;
    if (e.category === "worker_pay") {
      payByWorker[e.workerId] = (payByWorker[e.workerId] || 0) + e.amount;
    } else if (e.category === "crew_meals") {
      if (e.workerId) {
        mealsByWorker[e.workerId] = (mealsByWorker[e.workerId] || 0) + e.amount;
      } else {
        unassignedMeals += e.amount;
      }
    } else {
      otherCosts += e.amount;
    }
  });

  const workerIds = new Set([
    ...projectAssignments.map((a) => a.workerId),
    ...Object.keys(payByWorker),
    ...Object.keys(mealsByWorker),
  ]);

  const rows = [...workerIds]
    .map((id) => {
      const assignment = projectAssignments.find((a) => a.workerId === id);
      const agreed = assignment ? assignment.agreedAmount : 0;
      const paid = payByWorker[id] || 0;
      const meals = mealsByWorker[id] || 0;
      return {
        workerId: id,
        name: workerById[id]?.name || "Removed worker",
        assignment,
        agreed,
        paid,
        meals,
        balance: agreed - paid,
        progress: agreed > 0 ? Math.min(100, (paid / agreed) * 100) : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const workerPay = rows.reduce((s, r) => s + r.paid, 0);
  const assignedMeals = rows.reduce((s, r) => s + r.meals, 0);
  const crewMeals = assignedMeals + unassignedMeals;
  const workerCommitted = rows.reduce(
    (s, r) => s + Math.max(r.agreed, r.paid),
    0,
  );
  const totalCosts = workerPay + crewMeals + otherCosts;
  const netProfit = contractTotal - totalCosts;

  return {
    contractTotal,
    workerPay,
    crewMeals,
    assignedMeals,
    unassignedMeals,
    otherCosts,
    rows,
    totalCosts,
    netProfit,
    netAfterLabor: contractTotal - workerPay - crewMeals,
    projectedNet: contractTotal - workerCommitted - crewMeals - otherCosts,
    stillOwed: workerCommitted - workerPay,
    margin: contractTotal > 0 ? (netProfit / contractTotal) * 100 : 0,
    costBreakdown,
    jobExpenseCount: jobExpenses.length,
    totalAgreed: rows.reduce((s, r) => s + r.agreed, 0),
  };
}

export default function ProjectProfit({
  projects,
  workers,
  assignments,
  expenses,
  onAssignmentSaved,
  onAssignmentDeleted,
}) {
  const [selectedId, setSelectedId] = useState("");
  const [newWorkerId, setNewWorkerId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [edits, setEdits] = useState({}); // workerId -> typed agreed amount
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const sortedProjects = useMemo(
    () => sortProjectsNewestFirst(projects),
    [projects],
  );

  const activeId = selectedId || sortedProjects[0]?._id || "";
  const project = projects.find((p) => p._id === activeId);

  const workerById = useMemo(
    () => Object.fromEntries(workers.map((w) => [w._id, w])),
    [workers],
  );

  // Group once, so the portfolio table isn't filtering every expense per project
  const expensesByProject = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      if (!e.projectId) return;
      (map[e.projectId] = map[e.projectId] || []).push(e);
    });
    return map;
  }, [expenses]);

  const assignmentsByProject = useMemo(() => {
    const map = {};
    assignments.forEach((a) => {
      (map[a.projectId] = map[a.projectId] || []).push(a);
    });
    return map;
  }, [assignments]);

  // One calculation per project; the selected project's numbers come from here too
  const portfolio = useMemo(
    () =>
      sortedProjects.map((p) => ({
        project: p,
        calc: computeProject(
          p,
          expensesByProject[p._id] || [],
          assignmentsByProject[p._id] || [],
          workerById,
        ),
      })),
    [sortedProjects, expensesByProject, assignmentsByProject, workerById],
  );

  const calc = useMemo(
    () => portfolio.find((row) => row.project._id === activeId)?.calc || null,
    [portfolio, activeId],
  );

  const portfolioTotals = useMemo(
    () =>
      portfolio.reduce(
        (t, { calc: c }) => ({
          revenue: t.revenue + c.contractTotal,
          net: t.net + c.netProfit,
        }),
        { revenue: 0, net: 0 },
      ),
    [portfolio],
  );

  const ledger = useMemo(
    () =>
      project
        ? [...(expensesByProject[project._id] || [])].sort((a, b) =>
            a.date === b.date ? 0 : a.date < b.date ? 1 : -1,
          )
        : [],
    [project, expensesByProject],
  );

  const assignableWorkers = useMemo(() => {
    if (!calc) return [];
    const inTable = new Set(calc.rows.map((r) => r.workerId));
    return workers.filter((w) => w.active !== false && !inTable.has(w._id));
  }, [workers, calc]);

  const selectProject = (id) => {
    setSelectedId(id);
    setEdits({});
    setError(null);
  };

  const saveAgreed = async (workerId, value) => {
    const amount = parseFloat(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter an agreed amount of $0 or more.");
      return false;
    }
    try {
      setSaving(true);
      setError(null);
      const saved = await workersAPI.saveAssignment({
        projectId: project._id,
        workerId,
        agreedAmount: amount,
      });
      onAssignmentSaved(saved);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[workerId];
        return next;
      });
      return true;
    } catch (err) {
      console.error("Error saving agreed amount:", err);
      setError("Could not save the agreed amount. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newWorkerId) {
      setError("Choose a worker first.");
      return;
    }
    const ok = await saveAgreed(newWorkerId, newAmount);
    if (ok) {
      setNewWorkerId("");
      setNewAmount("");
    }
  };

  const handleRemoveAssignment = async (assignment) => {
    if (
      !window.confirm("Remove this agreed amount? Recorded payments are kept.")
    )
      return;
    try {
      setError(null);
      await workersAPI.deleteAssignment(assignment._id);
      onAssignmentDeleted(assignment._id);
    } catch (err) {
      console.error("Error removing assignment:", err);
      setError("Could not remove the agreed amount. Please try again.");
    }
  };

  const netClass = (n) => (n >= 0 ? styles.positive : styles.negative);
  const statusOf = (c) =>
    c.jobExpenseCount === 0
      ? { label: "No costs yet", tone: styles.muted, icon: faCircleCheck }
      : c.netProfit >= 0
      ? { label: "Profitable", tone: styles.positive, icon: faCircleCheck }
      : {
          label: "Over cost",
          tone: styles.negative,
          icon: faTriangleExclamation,
        };

  const visiblePortfolio = showAllProjects
    ? portfolio
    : portfolio.slice(0, PORTFOLIO_PREVIEW);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <FontAwesomeIcon icon={faHardHat} />
          Project Profit
        </h2>
        {sortedProjects.length > 0 && (
          <select
            className={`${styles.select} ${styles.projectSelect}`}
            value={activeId}
            onChange={(e) => selectProject(e.target.value)}
            aria-label="Select project"
          >
            {sortedProjects.map((p) => (
              <option key={p._id} value={p._id}>
                {getProjectLabel(p)}
              </option>
            ))}
          </select>
        )}
      </div>

      {!project || !calc ? (
        <p className={styles.empty}>No projects yet.</p>
      ) : (
        <>
          {error && <p className={styles.error}>{error}</p>}

          {/* ── All projects at a glance ───────────────────────── */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <FontAwesomeIcon icon={faLayerGroup} /> All projects
              <span className={styles.panelMeta}>
                {portfolio.length} projects · net {money(portfolioTotals.net)}{" "}
                on {money(portfolioTotals.revenue)}
              </span>
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th className={styles.num}>Revenue</th>
                    <th className={styles.num}>Job costs</th>
                    <th className={styles.num}>Net profit</th>
                    <th className={styles.num}>Margin</th>
                    <th className={styles.num}>Owed to workers</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePortfolio.map(({ project: p, calc: c }) => (
                    <tr
                      key={p._id}
                      className={`${styles.clickRow} ${
                        p._id === activeId ? styles.activeRow : ""
                      }`}
                      onClick={() => selectProject(p._id)}
                    >
                      <td>{getProjectLabel(p)}</td>
                      <td className={styles.num}>{money(c.contractTotal)}</td>
                      <td className={styles.num}>{money(c.totalCosts)}</td>
                      <td
                        className={`${styles.num} ${styles.strong} ${
                          c.jobExpenseCount ? netClass(c.netProfit) : ""
                        }`}
                      >
                        {money(c.netProfit)}
                      </td>
                      <td className={styles.num}>
                        {c.contractTotal ? `${c.margin.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={`${styles.num} ${
                          c.stillOwed > 0 ? styles.warning : ""
                        }`}
                      >
                        {c.stillOwed > 0 ? money(c.stillOwed) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {portfolio.length > PORTFOLIO_PREVIEW && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setShowAllProjects((v) => !v)}
              >
                {showAllProjects
                  ? "Show fewer"
                  : `Show all ${portfolio.length} projects`}
              </button>
            )}
          </div>

          {/* ── Selected project ───────────────────────────────── */}
          <div className={styles.projectMeta}>
            <div>
              <span>Customer / project</span>
              <strong>{getProjectLabel(project)}</strong>
            </div>
            <div>
              <span>Start date</span>
              <strong>
                {formatDate(toDateKey(project.customerInfo?.startDate))}
              </strong>
            </div>
            <div>
              <span>Crew</span>
              <strong>
                {calc.rows.length}{" "}
                {calc.rows.length === 1 ? "worker" : "workers"}
              </strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={statusOf(calc).tone}>
                <FontAwesomeIcon icon={statusOf(calc).icon} />{" "}
                {statusOf(calc).label}
              </strong>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <div className={styles.metric}>
              <span>Project revenue</span>
              <strong>{money(calc.contractTotal)}</strong>
              <small>Calculated project total</small>
            </div>
            <div className={styles.metric}>
              <span>Total job costs</span>
              <strong>{money(calc.totalCosts)}</strong>
              <small>
                {calc.contractTotal
                  ? `${percent(
                      calc.totalCosts,
                      calc.contractTotal,
                    )}% of revenue`
                  : `${calc.jobExpenseCount} linked expenses`}
              </small>
            </div>
            <div className={styles.metric}>
              <span>Net profit</span>
              <strong className={netClass(calc.netProfit)}>
                {money(calc.netProfit)}
              </strong>
              <small>{calc.margin.toFixed(1)}% margin</small>
            </div>
            <div className={styles.metric}>
              <span>Still owed to workers</span>
              <strong
                className={
                  calc.stillOwed > 0 ? styles.warning : styles.positive
                }
              >
                {money(Math.max(0, calc.stillOwed))}
              </strong>
              <small>
                {money(calc.totalAgreed)} agreed · {money(calc.workerPay)} paid
              </small>
            </div>
          </div>

          {/* Where does the revenue go? */}
          {calc.contractTotal > 0 && (
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Where the revenue goes</h3>
              <div
                className={styles.splitBar}
                role="img"
                aria-label="Revenue split"
              >
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      percent(calc.workerPay, calc.contractTotal),
                    )}%`,
                    background: "#1abc9c",
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      percent(calc.crewMeals, calc.contractTotal),
                    )}%`,
                    background: "#e08e0b",
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      percent(calc.otherCosts, calc.contractTotal),
                    )}%`,
                    background: "var(--secondary)",
                  }}
                />
                {calc.netProfit > 0 && (
                  <div
                    style={{
                      width: `${percent(calc.netProfit, calc.contractTotal)}%`,
                      background: "var(--success)",
                    }}
                  />
                )}
              </div>
              <div className={styles.legend}>
                {[
                  ["Worker pay", calc.workerPay, "#1abc9c"],
                  ["Crew meals", calc.crewMeals, "#e08e0b"],
                  ["Materials & other", calc.otherCosts, "var(--secondary)"],
                  [
                    calc.netProfit >= 0 ? "Net profit" : "Loss",
                    Math.abs(calc.netProfit),
                    calc.netProfit >= 0 ? "var(--success)" : "var(--error)",
                  ],
                ].map(([label, amount, color]) => (
                  <span key={label} className={styles.legendItem}>
                    <i className={styles.dot} style={{ background: color }} />
                    {label} <strong>{money(amount)}</strong>
                    <small>{percent(amount, calc.contractTotal)}%</small>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={styles.twoCol}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>Profit &amp; loss</h3>
              <div className={styles.summary}>
                <div className={styles.line}>
                  <span>Project total</span>
                  <span>{money(calc.contractTotal)}</span>
                </div>
                <div className={styles.line}>
                  <span className={styles.muted}>− Worker pay</span>
                  <span>{money(calc.workerPay)}</span>
                </div>
                <div className={styles.line}>
                  <span className={styles.muted}>
                    − Crew meals
                    {calc.assignedMeals > 0
                      ? ` (${money(calc.assignedMeals)} for named workers)`
                      : ""}
                  </span>
                  <span>{money(calc.crewMeals)}</span>
                </div>
                <div className={`${styles.line} ${styles.total}`}>
                  <span>Net after crew</span>
                  <span className={netClass(calc.netAfterLabor)}>
                    {money(calc.netAfterLabor)}
                  </span>
                </div>
                <div className={styles.line}>
                  <span className={styles.muted}>
                    − Materials &amp; other job costs
                  </span>
                  <span>{money(calc.otherCosts)}</span>
                </div>
                <div className={`${styles.line} ${styles.total}`}>
                  <span>Net profit</span>
                  <span className={netClass(calc.netProfit)}>
                    {money(calc.netProfit)}
                  </span>
                </div>
                {calc.stillOwed > 0 && (
                  <div className={styles.line}>
                    <span className={styles.muted}>
                      If all agreed amounts are paid ({money(calc.stillOwed)}{" "}
                      still owed)
                    </span>
                    <span className={netClass(calc.projectedNet)}>
                      {money(calc.projectedNet)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>
                <FontAwesomeIcon icon={faChartLine} /> Cost breakdown
              </h3>
              {calc.jobExpenseCount === 0 ? (
                <p className={styles.muted}>
                  No expenses have been linked to this project yet.
                </p>
              ) : (
                <div className={styles.breakdownGrid}>
                  {Object.entries(calc.costBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => {
                      const cat = getCategory(category);
                      return (
                        <div className={styles.breakdownItem} key={category}>
                          <span>
                            <FontAwesomeIcon
                              icon={cat.icon}
                              style={{ color: cat.color }}
                            />{" "}
                            {cat.name}
                          </span>
                          <strong>{money(amount)}</strong>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* ── Workers on this project ────────────────────────── */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <FontAwesomeIcon icon={faUsers} /> Workers on this project
            </h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Agreed</th>
                    <th>Paid</th>
                    <th className={styles.num}>Meals</th>
                    <th className={styles.num}>Balance owed</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className={styles.empty}>
                        No workers on this project yet.
                      </td>
                    </tr>
                  ) : (
                    calc.rows.map((r) => {
                      const typed = edits[r.workerId];
                      const dirty =
                        typed !== undefined && Number(typed) !== r.agreed;
                      return (
                        <tr key={r.workerId}>
                          <td className={styles.strong}>{r.name}</td>
                          <td>
                            <div className={styles.inlineEdit}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className={`${styles.input} ${styles.amountInput}`}
                                value={
                                  typed !== undefined
                                    ? typed
                                    : r.assignment
                                    ? r.agreed
                                    : ""
                                }
                                placeholder="0.00"
                                aria-label={`Agreed amount for ${r.name}`}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [r.workerId]: e.target.value,
                                  }))
                                }
                              />
                              {dirty && (
                                <button
                                  type="button"
                                  className={styles.button}
                                  disabled={saving}
                                  onClick={() => saveAgreed(r.workerId, typed)}
                                >
                                  Save
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={styles.paidCell}>
                            <span>{money(r.paid)}</span>
                            {r.agreed > 0 && (
                              <div
                                className={styles.progressTrack}
                                title={`${r.progress.toFixed(
                                  0,
                                )}% of agreed amount paid`}
                              >
                                <div
                                  className={`${styles.progressFill} ${
                                    r.balance < 0 ? styles.progressOver : ""
                                  }`}
                                  style={{ width: `${r.progress}%` }}
                                />
                              </div>
                            )}
                          </td>
                          <td className={`${styles.num} ${styles.muted}`}>
                            {r.meals > 0 ? money(r.meals) : "—"}
                          </td>
                          <td
                            className={`${styles.num} ${
                              r.balance < 0 ? styles.negative : ""
                            }`}
                          >
                            {r.assignment
                              ? r.balance < 0
                                ? `${money(Math.abs(r.balance))} overpaid`
                                : money(r.balance)
                              : "—"}
                          </td>
                          <td className={styles.actionsCell}>
                            {r.assignment && (
                              <button
                                type="button"
                                className={styles.iconButton}
                                title="Remove agreed amount"
                                aria-label="Remove agreed amount"
                                onClick={() =>
                                  handleRemoveAssignment(r.assignment)
                                }
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {calc.rows.length > 1 && (
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>{money(calc.totalAgreed)}</td>
                      <td>{money(calc.workerPay)}</td>
                      <td className={styles.num}>
                        {money(calc.assignedMeals)}
                      </td>
                      <td className={styles.num}>
                        {money(Math.max(0, calc.stillOwed))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className={styles.addRow}>
              <select
                className={styles.select}
                value={newWorkerId}
                onChange={(e) => setNewWorkerId(e.target.value)}
                aria-label="Worker to add"
              >
                <option value="">
                  {workers.length === 0
                    ? "Add a worker in the Workers section first"
                    : assignableWorkers.length === 0
                    ? "All workers are already on this project"
                    : "Add worker to this project…"}
                </option>
                {assignableWorkers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${styles.input} ${styles.amountInput}`}
                placeholder="Agreed $"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                aria-label="Agreed amount"
              />
              <button
                type="button"
                className={styles.button}
                disabled={saving || !newWorkerId}
                onClick={handleAdd}
              >
                <FontAwesomeIcon icon={faPlus} /> Add
              </button>
            </div>
          </div>

          {/* ── Job ledger ─────────────────────────────────────── */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              <FontAwesomeIcon icon={faListUl} /> Job ledger
              <span className={styles.panelMeta}>
                {ledger.length} {ledger.length === 1 ? "entry" : "entries"} ·{" "}
                {money(calc.totalCosts)}
              </span>
            </h3>
            {ledger.length === 0 ? (
              <p className={styles.muted}>
                Nothing recorded yet. Tag expenses to this project from Add New
                Expense.
              </p>
            ) : (
              <div className={`${styles.tableWrap} ${styles.ledgerScroll}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Details</th>
                      <th>Paid by</th>
                      <th className={styles.num}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e) => {
                      const cat = getCategory(e.category);
                      return (
                        <tr key={e._id}>
                          <td className={styles.nowrap}>
                            {formatDate(e.date)}
                          </td>
                          <td className={styles.nowrap}>
                            <FontAwesomeIcon
                              icon={cat.icon}
                              style={{ color: cat.color }}
                            />{" "}
                            {cat.name}
                          </td>
                          <td>
                            {[
                              e.workerId &&
                                (workerById[e.workerId]?.name ||
                                  "Removed worker"),
                              e.description,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td>{e.paymentMethod || "—"}</td>
                          <td className={`${styles.num} ${styles.strong}`}>
                            {money(e.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className={styles.note}>
            The project total includes any sales tax collected and the materials
            you buy. Tag material purchases and other job costs to this project
            (any category) so “Net profit” reflects real profit. Add or edit
            workers (phone, address) in the Workers section above.
          </p>
        </>
      )}
    </section>
  );
}
