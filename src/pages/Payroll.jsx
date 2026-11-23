import { useState } from "react";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Play,
  Printer,
  RefreshCw,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency, formatDate, todayISO } from "../lib/format";
import { inputClass, primaryButton, secondaryButton } from "../lib/ui";
import { useApiQuery, useMutation } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { LoadingState, ErrorState, EmptyState, FormError, RefreshBar } from "../components/common/States";
import { Modal, Field, SummaryCard, Tabs, StatusBadge } from "../components/common/Ui";

/** "2026-11" -> "November 2026" */
const formatMonth = (month) =>
  month
    ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : "-";

const th = "px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const thRight = `${th} text-right`;
const td = "px-5 py-3.5 text-sm text-slate-700";
const tdRight = `${td} text-right tabular-nums`;

function Payroll() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(isAdmin ? "runs" : "mine");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin ? "Run monthly payroll, manage salaries and view payslips" : "Your monthly payslips"}
          </p>
        </div>
        {isAdmin && (
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "runs", label: "Payroll runs" },
              { id: "salaries", label: "Salaries" },
              { id: "mine", label: "My payslips" },
            ]}
          />
        )}
      </div>

      {tab === "runs" && isAdmin && <PayrollRuns />}
      {tab === "salaries" && isAdmin && <Salaries />}
      {tab === "mine" && <PayslipList />}
    </div>
  );
}

// ---- Runs (admin) ---------------------------------------------------------------

function PayrollRuns() {
  const toast = useToast();
  const runs = useApiQuery((signal) => api.get("/payroll/runs", undefined, { signal }), []);
  const [showCreate, setShowCreate] = useState(false);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [openRunId, setOpenRunId] = useState(null);

  const create = useMutation((m) => api.post("/payroll/runs", { month: m }));

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await create.run(month);
      toast.success(`Payroll for ${formatMonth(month)} calculated`);
      setShowCreate(false);
      runs.reload();
      setOpenRunId(res.data.id);
    } catch {
      // shown in the form
    }
  };

  const list = runs.data ?? [];
  const latestPaid = list.find((r) => r.status === "Paid");
  const drafts = list.filter((r) => r.status === "Draft").length;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Last paid payroll"
          value={runs.data ? (latestPaid ? formatCurrency(latestPaid.netPay) : "None yet") : "…"}
          icon={<Wallet size={20} />}
          iconClass="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          title="Employees paid"
          value={runs.data ? (latestPaid?.employees ?? 0) : "…"}
          icon={<Users size={20} />}
          iconClass="bg-blue-100 text-blue-700"
        />
        <SummaryCard
          title="Drafts waiting"
          value={runs.data ? drafts : "…"}
          icon={<Calculator size={20} />}
          iconClass="bg-amber-100 text-amber-700"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Payroll runs</h2>
            <p className="text-sm text-slate-500">A draft can be recalculated or deleted. Paid runs are locked.</p>
          </div>
          <button
            onClick={() => {
              create.reset();
              setShowCreate(true);
            }}
            className={primaryButton}
          >
            <Play size={16} />
            Run payroll
          </button>
        </div>
        <RefreshBar active={runs.loading && !!runs.data} />
        {runs.loading && !runs.data ? (
          <LoadingState label="Loading payroll runs..." />
        ) : runs.error && !runs.data ? (
          <ErrorState error={runs.error} onRetry={runs.reload} />
        ) : list.length === 0 ? (
          <EmptyState title="No payroll runs yet" description="Run payroll for a month to create payslips." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Month</th>
                  <th className={th}>Status</th>
                  <th className={thRight}>Employees</th>
                  <th className={thRight}>Gross</th>
                  <th className={thRight}>Deductions</th>
                  <th className={thRight}>Reimbursements</th>
                  <th className={thRight}>Net pay</th>
                  <th className={thRight}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <p className="font-semibold text-slate-900">{formatMonth(r.month)}</p>
                      <p className="text-xs text-slate-500">
                        {r.status === "Paid" ? `Paid ${formatDate(r.paidAt)}` : `Created by ${r.createdBy || "-"}`}
                      </p>
                    </td>
                    <td className={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className={tdRight}>{r.employees}</td>
                    <td className={tdRight}>{formatCurrency(r.gross)}</td>
                    <td className={tdRight}>{formatCurrency(r.deductions)}</td>
                    <td className={tdRight}>{formatCurrency(r.reimbursements)}</td>
                    <td className={`${tdRight} font-semibold text-slate-900`}>{formatCurrency(r.netPay)}</td>
                    <td className={tdRight}>
                      <button onClick={() => setOpenRunId(r.id)} className="text-sm font-semibold text-blue-600 hover:underline">
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Run payroll" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4 p-6">
            <FormError error={create.error} />
            <Field label="Month" hint="Creates a draft with a payslip for every active employee who has a salary set up.">
              <input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
            </Field>
            <ul className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <li>Working days are the days in the month except Sundays.</li>
              <li>Absent days not covered by approved leave are deducted as loss of pay.</li>
              <li>Approved reimbursements up to the end of the month are paid with the salary.</li>
            </ul>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setShowCreate(false)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={create.pending} className={primaryButton}>
                {create.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Calculate payroll
              </button>
            </div>
          </form>
        </Modal>
      )}

      {openRunId && (
        <RunDetail
          runId={openRunId}
          onClose={() => setOpenRunId(null)}
          onChanged={runs.reload}
        />
      )}
    </>
  );
}

function RunDetail({ runId, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const run = useApiQuery((signal) => api.get(`/payroll/runs/${runId}`, undefined, { signal }), [runId]);
  const [slip, setSlip] = useState(null);

  const recalc = useMutation(() => api.post(`/payroll/runs/${runId}/recalculate`));
  const pay = useMutation(() => api.post(`/payroll/runs/${runId}/pay`));
  const remove = useMutation(() => api.delete(`/payroll/runs/${runId}`));
  const busy = recalc.pending || pay.pending || remove.pending;

  const r = run.data;
  const label = formatMonth(r?.month);

  const act = async (mutation, message) => {
    try {
      await mutation.run();
      toast.success(message);
      onChanged();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const handleRecalc = async () => {
    if (await act(recalc, `Payroll for ${label} recalculated`)) run.reload();
  };
  const handlePay = async () => {
    const ok = await confirm({
      title: `Mark ${label} payroll as paid?`,
      message: `${r.employees} employees will be notified that their payslip for ${formatCurrency(r.netPay)} in total is ready. The run will be locked and its reimbursements marked Paid.`,
      confirmLabel: "Mark as paid",
    });
    if (ok && (await act(pay, `Payroll for ${label} marked as paid`))) run.reload();
  };
  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete the ${label} draft?`,
      message: "Its payslips will be removed and its reimbursements released for the next run.",
      confirmLabel: "Delete draft",
      danger: true,
    });
    if (ok && (await act(remove, `Draft for ${label} deleted`))) onClose();
  };

  return (
    <Modal title={r ? `Payroll for ${label}` : "Payroll run"} subtitle={r && `${r.workingDays} working days`} onClose={onClose} size="max-w-6xl">
      {run.loading && !r ? (
        <LoadingState label="Loading payslips..." />
      ) : run.error && !r ? (
        <ErrorState error={run.error} onRetry={run.reload} />
      ) : (
        <>
          <RefreshBar active={run.loading} />
          <div className="grid grid-cols-2 gap-4 border-b border-slate-200 p-6 md:grid-cols-5">
            <Stat label="Status" value={<StatusBadge status={r.status} />} />
            <Stat label="Employees" value={r.employees} />
            <Stat label="Gross" value={formatCurrency(r.gross)} />
            <Stat label="Deductions" value={formatCurrency(r.deductions)} />
            <Stat label="Net pay" value={formatCurrency(r.netPay)} strong />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Employee</th>
                  <th className={thRight}>Gross</th>
                  <th className={thRight}>LOP days</th>
                  <th className={thRight}>Deductions</th>
                  <th className={thRight}>Reimb.</th>
                  <th className={thRight}>Net pay</th>
                  <th className={thRight}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.employeeCode} · {p.department || "No department"}
                      </p>
                    </td>
                    <td className={tdRight}>{formatCurrency(p.gross)}</td>
                    <td className={`${tdRight} ${p.lopDays ? "font-semibold text-red-600" : ""}`}>{p.lopDays}</td>
                    <td className={tdRight}>{formatCurrency(p.totalDeductions)}</td>
                    <td className={tdRight}>{p.reimbursements ? formatCurrency(p.reimbursements) : "-"}</td>
                    <td className={`${tdRight} font-semibold text-slate-900`}>{formatCurrency(p.netPay)}</td>
                    <td className={tdRight}>
                      <button onClick={() => setSlip(p)} className="text-sm font-semibold text-blue-600 hover:underline">
                        Payslip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4">
            {r.status === "Draft" ? (
              <>
                <button onClick={handleDelete} disabled={busy} className="mr-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 size={16} />
                  Delete draft
                </button>
                <button onClick={handleRecalc} disabled={busy} className={secondaryButton}>
                  {recalc.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw size={16} />}
                  Recalculate
                </button>
                <button onClick={handlePay} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {pay.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 size={16} />}
                  Mark as paid
                </button>
              </>
            ) : (
              <p className="mr-auto self-center text-sm text-slate-500">Paid on {formatDate(r.paidAt)}. This run is locked.</p>
            )}
            <button onClick={onClose} className={primaryButton}>
              Close
            </button>
          </div>
        </>
      )}
      {slip && <PayslipView slip={{ ...slip, runStatus: r.status }} onClose={() => setSlip(null)} />}
    </Modal>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <div className={`mt-1 ${strong ? "text-lg font-bold text-slate-900" : "text-sm font-semibold text-slate-700"}`}>{value}</div>
    </div>
  );
}

// ---- Salaries (admin) -------------------------------------------------------------

const SALARY_FIELDS = [
  ["basic", "Basic"],
  ["hra", "HRA"],
  ["allowances", "Allowances"],
  ["pf", "Provident fund (PF)"],
  ["professionalTax", "Professional tax"],
  ["tds", "TDS (income tax)"],
];

function Salaries() {
  const toast = useToast();
  const list = useApiQuery((signal) => api.get("/payroll/salaries", undefined, { signal }), []);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [payslipsFor, setPayslipsFor] = useState(null);
  const save = useMutation((body) => api.put(`/payroll/salaries/${editing.employeeId}`, body));

  const rows = list.data ?? [];
  const missing = rows.filter((r) => r.basic == null).length;
  const monthlyGross = rows.reduce((n, r) => n + (r.gross ?? 0), 0);

  const openEdit = (row) => {
    save.reset();
    setEditing(row);
    setForm(Object.fromEntries(SALARY_FIELDS.map(([k]) => [k, row[k] != null ? String(row[k]) : ""])));
  };

  const num = (k) => Number(form[k]) || 0;
  const previewGross = num("basic") + num("hra") + num("allowances");
  const previewDeductions = num("pf") + num("professionalTax") + num("tds");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await save.run(Object.fromEntries(SALARY_FIELDS.map(([k]) => [k, num(k)])));
      toast.success(`${editing.name}'s salary saved`);
      setEditing(null);
      list.reload();
    } catch {
      // shown in the form
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard title="Monthly gross" value={list.data ? formatCurrency(monthlyGross) : "…"} icon={<Banknote size={20} />} iconClass="bg-blue-100 text-blue-700" />
        <SummaryCard title="Employees" value={list.data ? rows.length : "…"} icon={<Users size={20} />} />
        <SummaryCard title="Without a salary" value={list.data ? missing : "…"} icon={<Calculator size={20} />} iconClass={missing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">Salary structure</h2>
          <p className="text-sm text-slate-500">Monthly amounts. Changes apply to the next payroll run (or recalculate a draft).</p>
        </div>
        <RefreshBar active={list.loading && !!list.data} />
        {list.loading && !list.data ? (
          <LoadingState label="Loading salaries..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Employee</th>
                  <th className={thRight}>Basic</th>
                  <th className={thRight}>HRA + allowances</th>
                  <th className={thRight}>Gross</th>
                  <th className={thRight}>Deductions</th>
                  <th className={thRight}>Take-home</th>
                  <th className={thRight}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50">
                    <td className={td}>
                      <p className="font-semibold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {r.designation || "-"} · {r.department || "No department"}
                      </p>
                    </td>
                    {r.basic == null ? (
                      <td colSpan={5} className={`${td} text-amber-700`}>
                        No salary set up. This person is left out of payroll.
                      </td>
                    ) : (
                      <>
                        <td className={tdRight}>{formatCurrency(r.basic)}</td>
                        <td className={tdRight}>{formatCurrency(r.hra + r.allowances)}</td>
                        <td className={tdRight}>{formatCurrency(r.gross)}</td>
                        <td className={tdRight}>{formatCurrency(r.deductions)}</td>
                        <td className={`${tdRight} font-semibold text-slate-900`}>{formatCurrency(r.gross - r.deductions)}</td>
                      </>
                    )}
                    <td className={`${tdRight} whitespace-nowrap`}>
                      <button onClick={() => setPayslipsFor(r)} className="mr-3 text-sm font-semibold text-slate-500 hover:text-slate-900" aria-label={`Payslips for ${r.name}`}>
                        <FileText size={16} className="inline" />
                      </button>
                      <button onClick={() => openEdit(r)} className="text-sm font-semibold text-blue-600 hover:underline">
                        <Pencil size={14} className="mr-1 inline" />
                        {r.basic == null ? "Set up" : "Edit"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={`Salary: ${editing.name}`} subtitle={editing.designation} onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <FormError error={save.error} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SALARY_FIELDS.map(([k, label]) => (
                <Field key={k} label={`${label} (₹)`}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required={k === "basic"}
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
              <Stat label="Gross" value={formatCurrency(previewGross)} />
              <Stat label="Deductions" value={formatCurrency(previewDeductions)} />
              <Stat label="Take-home" value={formatCurrency(previewGross - previewDeductions)} strong />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={save.pending} className={primaryButton}>
                {save.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save salary
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payslipsFor && (
        <Modal title={`Payslips: ${payslipsFor.name}`} onClose={() => setPayslipsFor(null)} size="max-w-3xl">
          <div className="p-6">
            <PayslipList employeeId={payslipsFor.employeeId} embedded />
          </div>
        </Modal>
      )}
    </>
  );
}

// ---- Payslips (everyone) ------------------------------------------------------------

function PayslipList({ employeeId, embedded }) {
  const list = useApiQuery(
    (signal) => api.get("/payroll/payslips", { employeeId }, { signal }),
    [employeeId ?? null]
  );
  const [slip, setSlip] = useState(null);
  const rows = list.data ?? [];
  const latest = rows[0];

  return (
    <>
      {!embedded && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard title="Latest net pay" value={list.data ? (latest ? formatCurrency(latest.netPay) : "-") : "…"} icon={<Wallet size={20} />} iconClass="bg-emerald-100 text-emerald-700" />
          <SummaryCard title="Latest payslip" value={list.data ? (latest ? formatMonth(latest.month) : "None yet") : "…"} icon={<FileText size={20} />} iconClass="bg-blue-100 text-blue-700" />
          <SummaryCard title="Paid this year" value={list.data ? formatCurrency(rows.filter((r) => r.month.startsWith(String(new Date().getFullYear()))).reduce((n, r) => n + r.netPay, 0)) : "…"} icon={<Banknote size={20} />} />
        </div>
      )}

      <div className={embedded ? "" : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"}>
        {list.loading && !list.data ? (
          <LoadingState label="Loading payslips..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="No payslips yet" description="Payslips appear here once a payroll run is marked as paid." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className={th}>Month</th>
                  <th className={thRight}>Gross</th>
                  <th className={thRight}>Deductions</th>
                  <th className={thRight}>Reimbursements</th>
                  <th className={thRight}>Net pay</th>
                  <th className={thRight}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <p className="font-semibold text-slate-900">{formatMonth(p.month)}</p>
                      <p className="text-xs text-slate-500">Paid {formatDate(p.paidAt)}</p>
                    </td>
                    <td className={tdRight}>{formatCurrency(p.gross)}</td>
                    <td className={tdRight}>{formatCurrency(p.totalDeductions)}</td>
                    <td className={tdRight}>{p.reimbursements ? formatCurrency(p.reimbursements) : "-"}</td>
                    <td className={`${tdRight} font-semibold text-slate-900`}>{formatCurrency(p.netPay)}</td>
                    <td className={tdRight}>
                      <button onClick={() => setSlip(p)} className="text-sm font-semibold text-blue-600 hover:underline">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {slip && <PayslipView slip={slip} onClose={() => setSlip(null)} />}
    </>
  );
}

/** A printable payslip. Printing shows only this sheet (see .print-area in index.css). */
function PayslipView({ slip, onClose }) {
  const money = (v) => formatCurrency(v, 2);
  const earnings = [
    ["Basic", slip.basic],
    ["House rent allowance", slip.hra],
    ["Other allowances", slip.allowances],
  ];
  const deductions = [
    [`Loss of pay (${slip.lopDays} day${slip.lopDays === 1 ? "" : "s"})`, slip.lopDeduction],
    ["Provident fund", slip.pf],
    ["Professional tax", slip.professionalTax],
    ["TDS", slip.tds],
  ];

  return (
    <Modal title={`Payslip: ${formatMonth(slip.month)}`} subtitle={slip.name} onClose={onClose} size="max-w-3xl">
      <div className="print-area space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">E</div>
            <div>
              <p className="font-bold text-slate-900">EmployeeHub</p>
              <p className="text-xs text-slate-500">Payslip for {formatMonth(slip.month)}</p>
            </div>
          </div>
          {slip.runStatus === "Draft" && <StatusBadge status="Draft" />}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Info label="Employee" value={slip.name} />
          <Info label="Employee ID" value={slip.employeeCode} />
          <Info label="Designation" value={slip.designation} />
          <Info label="Department" value={slip.department} />
          <Info label="Working days" value={slip.workingDays} />
          <Info label="Loss of pay days" value={slip.lopDays} />
          <Info label="Paid days" value={slip.workingDays - slip.lopDays} />
          <Info label="Paid on" value={slip.paidAt ? formatDate(slip.paidAt) : "Not paid yet"} />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Breakdown money={money} title="Earnings" rows={earnings} totalLabel="Gross earnings" total={slip.gross} />
          <Breakdown money={money} title="Deductions" rows={deductions} totalLabel="Total deductions" total={slip.totalDeductions} />
        </div>

        <div className="space-y-2 rounded-xl bg-slate-50 p-5 text-sm">
          <Line label="Gross earnings" value={money(slip.gross)} />
          <Line label="Less deductions" value={`− ${money(slip.totalDeductions)}`} />
          {slip.reimbursements > 0 && <Line label="Plus reimbursements" value={`+ ${money(slip.reimbursements)}`} />}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-bold text-slate-900">Net pay</span>
            <span className="text-xl font-bold text-slate-900">{money(slip.netPay)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400">This is a system-generated payslip and does not need a signature.</p>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 print:hidden">
        <button onClick={() => window.print()} className={secondaryButton}>
          <Printer size={16} />
          Print / Save as PDF
        </button>
        <button onClick={onClose} className={primaryButton}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-800">{value ?? "-"}</p>
    </div>
  );
}

function Breakdown({ money, title, rows, totalLabel, total }) {
  return (
    <div className="rounded-xl border border-slate-200">
      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="space-y-2 px-4 py-3 text-sm">
        {rows.map(([label, value]) => (
          <Line key={label} label={label} value={money(value)} />
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-2.5 text-sm font-semibold">
        <Line label={totalLabel} value={money(total)} />
      </div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

export default Payroll;
