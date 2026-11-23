import { useState } from "react";
import {
  Search,
  CalendarDays,
  Clock3,
  Users,
  UserCheck,
  X,
  Pencil,
  LogIn,
  LogOut,
  Loader2,
} from "lucide-react";

import { api } from "../lib/api";
import { formatDate, formatTime, getInitials, todayISO } from "../lib/format";
import { useApiQuery, useDebounce, useMutation } from "../hooks/useApi";
import { useEmployeeOptions } from "../hooks/useDepartments";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  FormError,
  RefreshBar,
} from "../components/common/States";
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 15;
const STATUSES = ["Present", "Late", "Absent", "Half Day"];

const emptyAttendance = {
  employeeId: "",
  date: todayISO(),
  checkIn: "",
  checkOut: "",
  status: "Present",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const SUMMARY_CARDS = [
  { status: "Present", icon: UserCheck, bg: "bg-emerald-50", color: "text-emerald-600" },
  { status: "Late", icon: Clock3, bg: "bg-orange-50", color: "text-orange-600" },
  { status: "Absent", icon: Users, bg: "bg-red-50", color: "text-red-600" },
  { status: "Half Day", icon: Clock3, bg: "bg-purple-50", color: "text-purple-600" },
];

function getStatusClass(status) {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700";
    case "Late":
      return "bg-orange-50 text-orange-700";
    case "Absent":
      return "bg-red-50 text-red-700";
    case "Half Day":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function Attendance() {
  const { canManage } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  // Managers start on today's register; employees see their whole history.
  const [dateFilter, setDateFilter] = useState(canManage ? todayISO() : "");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const list = useApiQuery(
    (signal) =>
      api.get(
        "/attendance",
        { search: debouncedSearch, status: statusFilter, date: dateFilter, page, limit: PAGE_SIZE },
        { signal }
      ),
    [debouncedSearch, statusFilter, dateFilter, page]
  );
  const summary = useApiQuery(
    (signal) => api.get("/attendance/summary", { date: dateFilter || todayISO() }, { signal }),
    [dateFilter]
  );
  const records = list.data ?? [];
  const counts = summary.data ?? {};

  const [showModal, setShowModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [formData, setFormData] = useState(emptyAttendance);
  const { employees } = useEmployeeOptions(canManage);

  const save = useMutation((body) =>
    editingAttendance
      ? api.put(`/attendance/${editingAttendance.id}`, body)
      : api.post("/attendance", body)
  );

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const openAddModal = () => {
    setEditingAttendance(null);
    setFormData({ ...emptyAttendance, date: dateFilter || todayISO() });
    save.reset();
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingAttendance(record);
    setFormData({
      employeeId: String(record.employeeId),
      date: record.date,
      checkIn: record.checkIn ?? "",
      checkOut: record.checkOut ?? "",
      status: record.status,
    });
    save.reset();
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await save.run({
        employeeId: Number(formData.employeeId),
        date: formData.date,
        checkIn: formData.checkIn || null,
        checkOut: formData.checkOut || null,
        status: formData.status,
      });
      toast.success(editingAttendance ? "Attendance updated" : "Attendance saved");
      setShowModal(false);
      setEditingAttendance(null);
      refreshAll();
    } catch {
      // shown in the form
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? "Track and manage employee attendance." : "Check in, check out and see your attendance history."}
          </p>
        </div>

        {canManage && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <UserCheck className="h-4 w-4" />
            Mark Attendance
          </button>
        )}
      </div>

      {/* Everyone gets their own check-in card */}
      <TodayCard onChange={refreshAll} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map(({ status, icon: Icon, bg, color }) => (
          <div key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  {status}
                  <span className="ml-1 text-xs text-slate-400">
                    · {dateFilter ? formatDate(dateFilter, { day: "2-digit", month: "short" }) : "today"}
                  </span>
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  {summary.loading && !summary.data ? (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                  ) : summary.error ? (
                    "–"
                  ) : (
                    counts[status] ?? 0
                  )}
                </h2>
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
              placeholder={canManage ? "Search employee..." : "Search..."}
              disabled={!canManage}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setFilter(setDateFilter)(event.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
              title="Clear the date to see all days"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setFilter(setStatusFilter)(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Attendance Records</h2>
            <p className="mt-1 text-sm text-slate-500">
              {list.meta ? `${list.meta.total} record${list.meta.total === 1 ? "" : "s"}` : "Loading..."}
              {dateFilter ? ` on ${formatDate(dateFilter)}` : " across all days"}
            </p>
          </div>
          {dateFilter && (
            <button
              onClick={() => setFilter(setDateFilter)("")}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Show all days
            </button>
          )}
        </div>
        <RefreshBar active={list.loading && !!list.data} />

        {list.loading && !list.data ? (
          <LoadingState label="Loading attendance..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    {["Employee", "Department", "Check In", "Check Out", "Hours", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                    {canManage && (
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {getInitials(record.name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{record.name}</p>
                            <p className="text-xs text-slate-500">{formatDate(record.date)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{record.department || "-"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatTime(record.checkIn)}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatTime(record.checkOut)}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {record.workHours != null ? `${record.workHours.toFixed(1)} h` : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openEditModal(record)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            aria-label={`Edit attendance for ${record.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {records.length === 0 && (
                <EmptyState
                  title="No attendance records found"
                  description="Try changing the date, search or status."
                />
              )}
            </div>
            <Pagination meta={list.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingAttendance ? "Edit Attendance" : "Mark Attendance"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Enter attendance details.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <FormError error={save.error} />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee</label>
                  <select
                    name="employeeId"
                    required
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    disabled={!!editingAttendance}
                    className={`${inputClass} bg-white disabled:bg-slate-50`}
                  >
                    <option value="">Select employee</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employeeCode}{e.department ? `, ${e.department}` : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
                  <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className={inputClass} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Attendance Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className={`${inputClass} bg-white`}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Check In</label>
                  <input type="time" name="checkIn" value={formData.checkIn} onChange={handleInputChange} disabled={formData.status === "Absent"} className={`${inputClass} disabled:bg-slate-50`} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Check Out</label>
                  <input type="time" name="checkOut" value={formData.checkOut} onChange={handleInputChange} disabled={formData.status === "Absent"} className={`${inputClass} disabled:bg-slate-50`} />
                </div>
              </div>

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
                  disabled={save.pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {save.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingAttendance ? "Update Attendance" : "Save Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** The signed-in user's own check-in / check-out for today. */
function TodayCard({ onChange }) {
  const today = useApiQuery((signal) => api.get("/attendance/today", undefined, { signal }), []);
  const action = useMutation((kind) => api.post(`/attendance/${kind}`));
  const toast = useToast();
  const record = today.data;

  const run = async (kind) => {
    try {
      const res = await action.run(kind);
      today.setData(res.data);
      toast.success(
        kind === "check-in"
          ? `Checked in at ${formatTime(res.data.checkIn)}`
          : `Checked out at ${formatTime(res.data.checkOut)}`
      );
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  let body;
  if (today.loading && today.data === undefined) {
    body = <p className="text-sm text-slate-500">Loading...</p>;
  } else if (today.error) {
    body = <p className="text-sm text-red-600">{today.error.message}</p>;
  } else if (!record) {
    body = <p className="text-sm text-slate-500">You haven&apos;t checked in yet today.</p>;
  } else if (!record.checkIn) {
    body = (
      <p className="text-sm text-slate-600">
        You are marked
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClass(record.status)}`}>
          {record.status}
        </span>
        <span className="ml-2 text-slate-400">today. Ask your manager if this is wrong.</span>
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-slate-600">
        Checked in at <span className="font-semibold">{formatTime(record.checkIn)}</span>
        {record.checkOut && (
          <>
            {" "}· checked out at <span className="font-semibold">{formatTime(record.checkOut)}</span>
          </>
        )}
        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClass(record.status)}`}>
          {record.status}
        </span>
      </p>
    );
  }

  const canCheckIn = today.data === null;
  const canCheckOut = record?.checkIn && !record?.checkOut;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-slate-900">Today · {formatDate(todayISO(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <div className="mt-1">{body}</div>
      </div>
      <div className="flex gap-2">
        {canCheckIn && (
          <button
            onClick={() => run("check-in")}
            disabled={action.pending}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {action.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Check In
          </button>
        )}
        {canCheckOut && (
          <button
            onClick={() => run("check-out")}
            disabled={action.pending}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {action.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Check Out
          </button>
        )}
      </div>
    </div>
  );
}

export default Attendance;
