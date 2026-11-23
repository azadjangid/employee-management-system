import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  X,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";

import { api } from "../lib/api";
import { formatDate, getInitials, todayISO } from "../lib/format";
import { useApiQuery, useDebounce, useMutation } from "../hooks/useApi";
import { useEmployeeOptions } from "../hooks/useDepartments";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../context/AuthContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  FormError,
  RefreshBar,
} from "../components/common/States";
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 10;
const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave"];

const emptyForm = {
  employeeId: "",
  leaveType: "Casual Leave",
  fromDate: "",
  toDate: "",
  reason: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getStatusClass(status) {
  if (status === "Approved") return "bg-emerald-50 text-emerald-700";
  if (status === "Rejected") return "bg-red-50 text-red-700";
  return "bg-orange-50 text-orange-700";
}

function calculateDays(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  return Math.round((new Date(toDate) - new Date(fromDate)) / 86400000) + 1;
}

function Leaves() {
  const { user, canManage, isAdmin } = useAuth();

  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  // The top bar's search can link here with ?search=...
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch);
  if (urlSearch !== prevUrlSearch) {
    setPrevUrlSearch(urlSearch);
    setSearch(urlSearch);
    setPage(1);
  }

  const list = useApiQuery(
    (signal) =>
      api.get(
        "/leaves",
        { search: debouncedSearch, status: statusFilter, leaveType: typeFilter, page, limit: PAGE_SIZE },
        { signal }
      ),
    [debouncedSearch, statusFilter, typeFilter, page]
  );
  const summary = useApiQuery((signal) => api.get("/leaves/summary", undefined, { signal }), []);
  const leaves = list.data ?? [];

  const [showModal, setShowModal] = useState(false);
  const [viewLeave, setViewLeave] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const { employees } = useEmployeeOptions(canManage);

  const create = useMutation((body) => api.post("/leaves", body));
  const decide = useMutation(({ id, status }) => api.patch(`/leaves/${id}/status`, { status }));
  const cancel = useMutation((id) => api.delete(`/leaves/${id}`));

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  // Managers can't decide on their own requests; admins can.
  const canDecide = (leave) =>
    leave.status === "Pending" && canManage && (isAdmin || leave.employeeId !== user.id);
  const canCancel = (leave) =>
    leave.status === "Pending" && (leave.employeeId === user.id || canManage);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const openForm = () => {
    setFormData(emptyForm);
    create.reset();
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await create.run({
        ...formData,
        employeeId: formData.employeeId ? Number(formData.employeeId) : undefined,
      });
      toast.success("Leave request submitted");
      setShowModal(false);
      refreshAll();
    } catch {
      // shown in the form
    }
  };

  const updateLeaveStatus = async (leave, status) => {
    try {
      const res = await decide.run({ id: leave.id, status });
      if (viewLeave?.id === leave.id) setViewLeave(res.data);
      toast.success(`${leave.employeeName}'s leave ${status.toLowerCase()}`);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancel = async (leave) => {
    const ok = await confirm({
      title: "Cancel this leave request?",
      message: `${leave.leaveType}, ${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)}.`,
      confirmLabel: "Cancel request",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
    try {
      await cancel.run(leave.id);
      setViewLeave(null);
      toast.success("Leave request cancelled");
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const days = calculateDays(formData.fromDate, formData.toDate);
  const counts = summary.data;
  const busy = decide.pending || cancel.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? "Manage employee leave requests and approvals." : "Request leave and track your requests."}
          </p>
        </div>

        <button
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Request Leave
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Pending Requests", key: "Pending", icon: Clock3, bg: "bg-orange-50", color: "text-orange-600" },
          { label: "Approved", key: "Approved", icon: CheckCircle2, bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Rejected", key: "Rejected", icon: XCircle, bg: "bg-red-50", color: "text-red-600" },
        ].map(({ label, key, icon: Icon, bg, color }) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {counts ? counts[key].count : summary.error ? "–" : <Loader2 className="h-6 w-6 animate-spin text-slate-300" />}
                </h2>
                {counts && key !== "Rejected" && (
                  <p className="mt-1 text-xs text-slate-400">{counts[key].days} day(s)</p>
                )}
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setFilter(setSearch)(event.target.value)}
              placeholder={canManage ? "Search employee, department or reason..." : "Search by reason..."}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setFilter(setTypeFilter)(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Leave Types</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setFilter(setStatusFilter)(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Leave Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Leave Requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            {list.meta ? `${list.meta.total} leave request${list.meta.total === 1 ? "" : "s"}` : "Loading..."}
          </p>
        </div>
        <RefreshBar active={list.loading && !!list.data} />

        {list.loading && !list.data ? (
          <LoadingState label="Loading leave requests..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr>
                    {["Employee", "Leave Type", "Dates", "Days", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {leaves.map((leave) => (
                    <tr key={leave.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {getInitials(leave.employeeName)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{leave.employeeName}</p>
                            <p className="text-xs text-slate-500">{leave.department || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{leave.leaveType}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {formatDate(leave.fromDate)} → {formatDate(leave.toDate)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{leave.days}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(leave.status)}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewLeave(leave)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canDecide(leave) && (
                            <>
                              <button
                                onClick={() => updateLeaveStatus(leave, "Approved")}
                                disabled={busy}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                                title="Approve"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => updateLeaveStatus(leave, "Rejected")}
                                disabled={busy}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {!canDecide(leave) && canCancel(leave) && (
                            <button
                              onClick={() => handleCancel(leave)}
                              disabled={busy}
                              className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              title="Cancel request"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {leaves.length === 0 && (
                <EmptyState title="No leave requests found" description="Try changing your search or filters." />
              )}
            </div>
            <Pagination meta={list.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Request Leave</h2>
                <p className="mt-1 text-sm text-slate-500">Submit a new leave request.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <FormError error={create.error} />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {canManage && (
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee</label>
                    <select name="employeeId" value={formData.employeeId} onChange={handleInputChange} className={`${inputClass} bg-white`}>
                      <option value="">Myself ({user.name})</option>
                      {employees
                        .filter((e) => e.id !== user.id && e.status !== "Inactive")
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.department || "No department"})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Leave Type</label>
                  <select name="leaveType" value={formData.leaveType} onChange={handleInputChange} className={`${inputClass} bg-white`}>
                    {LEAVE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">From Date</label>
                  <input type="date" name="fromDate" required min={todayISO()} value={formData.fromDate} onChange={handleInputChange} className={inputClass} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">To Date</label>
                  <input type="date" name="toDate" required min={formData.fromDate || todayISO()} value={formData.toDate} onChange={handleInputChange} className={inputClass} />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
                  <textarea name="reason" required rows="4" value={formData.reason} onChange={handleInputChange} placeholder="Enter reason for leave..." className={`${inputClass} resize-none`} />
                </div>
              </div>

              {days > 0 && (
                <p className="text-sm text-slate-500">
                  Duration: <span className="font-semibold text-slate-700">{days} day(s)</span>
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create.pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {create.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Leave Modal */}
      {viewLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Leave Details</h2>
              <button onClick={() => setViewLeave(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                  {getInitials(viewLeave.employeeName)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{viewLeave.employeeName}</h3>
                  <p className="text-sm text-slate-500">{viewLeave.department}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <Detail label="Leave Type" value={viewLeave.leaveType} />
                <div>
                  <p className="text-xs uppercase text-slate-400">Status</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(viewLeave.status)}`}>
                    {viewLeave.status}
                  </span>
                </div>
                <Detail label="From" value={formatDate(viewLeave.fromDate)} />
                <Detail label="To" value={formatDate(viewLeave.toDate)} />
                <Detail label="Duration" value={`${viewLeave.days} day(s)`} />
                <Detail label="Applied On" value={formatDate(viewLeave.appliedOn)} />
                {viewLeave.reviewedBy && (
                  <Detail
                    label={viewLeave.status === "Approved" ? "Approved By" : "Rejected By"}
                    value={viewLeave.reviewedBy}
                  />
                )}
              </div>

              <div>
                <p className="text-xs uppercase text-slate-400">Reason</p>
                <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{viewLeave.reason}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              {canDecide(viewLeave) && (
                <>
                  <button
                    onClick={() => updateLeaveStatus(viewLeave, "Rejected")}
                    disabled={busy}
                    className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateLeaveStatus(viewLeave, "Approved")}
                    disabled={busy}
                    className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </>
              )}
              {!canDecide(viewLeave) && canCancel(viewLeave) && (
                <button
                  onClick={() => handleCancel(viewLeave)}
                  disabled={busy}
                  className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Cancel Request
                </button>
              )}
              <button
                onClick={() => setViewLeave(null)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || "-"}</p>
    </div>
  );
}

export default Leaves;
