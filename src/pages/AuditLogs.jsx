import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Search, ShieldCheck, X } from "lucide-react";

import { api } from "../lib/api";
import { inputClass, secondaryButton } from "../lib/ui";
import { useApiQuery, useDebounce } from "../hooks/useApi";
import { LoadingState, ErrorState, EmptyState, RefreshBar } from "../components/common/States";
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 25;

// Friendlier names for the entity types in the log.
const ENTITY_LABELS = {
  auth: "Sign-in",
  employee: "Employee",
  department: "Department",
  attendance: "Attendance",
  leave: "Leave",
  reimbursement: "Reimbursement",
  payroll_run: "Payroll",
};

const ACTION_COLORS = {
  create: "bg-emerald-50 text-emerald-700",
  delete: "bg-red-50 text-red-700",
  login_failed: "bg-red-50 text-red-700",
  approve: "bg-blue-50 text-blue-700",
  pay: "bg-emerald-50 text-emerald-700",
};

const actionColor = (action) => {
  const verb = action.split(".").pop();
  return ACTION_COLORS[verb] ?? (verb.includes("delete") ? ACTION_COLORS.delete : "bg-slate-100 text-slate-700");
};

const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const showValue = (v) => {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const emptyFilters = { search: "", entityType: "", action: "", from: "", to: "" };

function AuditLogs() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const search = useDebounce(filters.search);

  const facets = useApiQuery((signal) => api.get("/audit-logs/facets", undefined, { signal }), []);
  const list = useApiQuery(
    (signal) =>
      api.get(
        "/audit-logs",
        { ...filters, search, page, limit: PAGE_SIZE },
        { signal }
      ),
    [search, filters.entityType, filters.action, filters.from, filters.to, page]
  );

  const setFilter = (name) => (e) => {
    const value = e.target.value;
    setFilters((f) => ({ ...f, [name]: value, ...(name === "entityType" && { action: "" }) }));
    setPage(1);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  // Action choices for the chosen entity type, e.g. "leave.approve".
  const actionOptions = [
    ...new Set(
      (facets.data?.pairs ?? [])
        .filter((p) => !filters.entityType || p.entityType === filters.entityType)
        .map((p) => p.action)
    ),
  ].sort();

  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Who changed what, and when. Visible to admins only.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={setFilter("search")}
              placeholder="Search person, action or description..."
              aria-label="Search audit logs"
              className={`${inputClass} pl-10`}
            />
          </div>
          <select value={filters.entityType} onChange={setFilter("entityType")} aria-label="Area" className={inputClass}>
            <option value="">All areas</option>
            {(facets.data?.entityTypes ?? []).map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <select value={filters.action} onChange={setFilter("action")} aria-label="Action" className={inputClass}>
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="flex gap-2 xl:col-span-2">
            <input type="date" value={filters.from} onChange={setFilter("from")} aria-label="From date" className={inputClass} />
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} aria-label="To date" className={inputClass} />
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setFilters(emptyFilters);
              setPage(1);
            }}
            className={`${secondaryButton} mt-3 py-1.5 text-xs`}
          >
            <X size={14} />
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <RefreshBar active={list.loading && !!list.data} />
        {list.loading && !list.data ? (
          <LoadingState label="Loading audit logs..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="No activity found" description={hasFilters ? "Try changing the filters." : "Actions will appear here as people use the app."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["", "When", "Who", "Action", "What happened", "IP"].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((log) => {
                    const changes = log.changes ? Object.entries(log.changes) : [];
                    const open = expanded === log.id;
                    return (
                      <Fragment key={log.id}>
                        <tr
                          className={`align-top ${changes.length ? "cursor-pointer hover:bg-slate-50" : ""}`}
                          onClick={() => changes.length && setExpanded(open ? null : log.id)}
                        >
                          <td className="w-8 px-4 py-3.5 text-slate-400">
                            {changes.length > 0 &&
                              (open ? <ChevronDown size={16} aria-label="Hide changes" /> : <ChevronRight size={16} aria-label="Show changes" />)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600">{formatWhen(log.createdAt)}</td>
                          <td className="px-4 py-3.5 text-sm font-medium text-slate-800">
                            {log.actorName || <span className="text-slate-400">Unknown</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`whitespace-nowrap rounded-lg px-2.5 py-1 font-mono text-xs ${actionColor(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-700">
                            {log.summary}
                            {changes.length > 0 && (
                              <span className="ml-2 text-xs text-slate-400">
                                {changes.length} field{changes.length === 1 ? "" : "s"} changed
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500">{log.ip || "-"}</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50">
                            <td />
                            <td colSpan={5} className="px-4 pb-4">
                              <table className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Field</th>
                                    <th className="px-3 py-2 text-left font-semibold">Before</th>
                                    <th className="px-3 py-2 text-left font-semibold">After</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {changes.map(([field, c]) => (
                                    <tr key={field}>
                                      <td className="px-3 py-2 font-medium text-slate-700">{field}</td>
                                      <td className="px-3 py-2 text-red-700">{showValue(c?.from)}</td>
                                      <td className="px-3 py-2 text-emerald-700">{showValue(c?.to)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination meta={list.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <ShieldCheck size={14} />
        Log entries can't be edited or deleted from the app.
      </p>
    </div>
  );
}

export default AuditLogs;
