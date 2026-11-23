import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserCheck, CalendarDays, Clock3, Receipt, UserX, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import StatsCard from "../components/common/StatsCard";
import { ErrorState, EmptyState, LoadingState } from "../components/common/States";
import { api } from "../lib/api";
import { formatCurrency, formatDate, getInitials } from "../lib/format";
import { useApiQuery, useMutation } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const pieColors = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#ea580c", "#0891b2", "#ca8a04"];

/** "+3", "-2", "0" style difference label. */
const diff = (now, before) => {
  const d = (now ?? 0) - (before ?? 0);
  return d > 0 ? `+${d}` : String(d);
};

const dateRange = (from, to) =>
  from === to
    ? formatDate(from, { day: "numeric", month: "short" })
    : `${formatDate(from, { day: "numeric", month: "short" })} - ${formatDate(to, { day: "numeric", month: "short" })}`;

function Dashboard() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApiQuery(
    (signal) => api.get("/dashboard", undefined, { signal }),
    []
  );

  // Approve / reject straight from the dashboard card.
  const decide = useMutation(({ id, status }) => api.patch(`/leaves/${id}/status`, { status }));
  const [deciding, setDeciding] = useState(null); // `${id}:${status}` while saving

  const handleDecision = async (request, status) => {
    setDeciding(`${request.id}:${status}`);
    try {
      await decide.run({ id: request.id, status });
      toast.success(`${request.name}'s leave ${status.toLowerCase()}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeciding(null);
    }
  };

  const scope = data?.scope;
  const stats = data?.stats ?? {};
  const isSelf = scope === "self";
  const weekly = data?.weeklyAttendance ?? [];

  const subtitle = !data
    ? "Here is what's happening today."
    : isSelf
      ? "Here is your week at a glance."
      : scope === "department"
        ? `Here is what's happening in ${user?.department ?? "your department"} today.`
        : "Here is what's happening across the company today.";

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const presentDays = weekly.reduce((n, d) => n + d.present, 0);
  const absentDays = weekly.reduce((n, d) => n + d.absent, 0);

  const cards = isSelf
    ? [
        { title: "Days Present", value: presentDays, description: "in the last 7 days", icon: UserCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
        { title: "Days Absent", value: absentDays, description: "in the last 7 days", icon: UserX, iconBg: "bg-red-50", iconColor: "text-red-600" },
        { title: "Pending Leaves", value: stats.pendingLeaves, description: "awaiting approval", icon: CalendarDays, iconBg: "bg-orange-50", iconColor: "text-orange-600" },
        { title: "Pending Claims", value: formatCurrency(stats.pendingReimbursementAmount), description: `${stats.pendingReimbursements ?? 0} claim(s) awaiting approval`, icon: Receipt, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
      ]
    : [
        { title: "Total Employees", value: stats.totalEmployees, change: diff(stats.totalEmployees, stats.employeesLastMonth), description: "since last month", icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
        { title: "Present Today", value: stats.presentToday, change: diff(stats.presentToday, stats.presentYesterday), description: "vs yesterday", icon: UserCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
        { title: "On Leave", value: stats.onLeaveToday, description: "on approved leave today", icon: CalendarDays, iconBg: "bg-orange-50", iconColor: "text-orange-600" },
        { title: "Pending Requests", value: (stats.pendingLeaves ?? 0) + (stats.pendingReimbursements ?? 0), description: `${stats.pendingLeaves ?? 0} leave, ${stats.pendingReimbursements ?? 0} reimbursement`, icon: Clock3, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
      ];

  const loadingFirst = loading && !data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back, {user?.firstName}. {subtitle}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatsCard key={card.title} {...card} value={card.value ?? 0} loading={loadingFirst} />
        ))}
      </div>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-6 ${isSelf ? "" : "xl:grid-cols-3"}`}>
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${isSelf ? "" : "xl:col-span-2"}`}>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Attendance Overview</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSelf ? "Your attendance over the last 7 days" : "Present and absent over the last 7 days"}
            </p>
          </div>

          <div className="h-80">
            {loadingFirst ? (
              <LoadingState className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip labelFormatter={(_, p) => (p?.[0] ? formatDate(p[0].payload.date) : "")} />
                  <Area type="monotone" dataKey="present" name="Present" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                  <Area type="monotone" dataKey="absent" name="Absent" stroke="#f97316" fill="#ffedd5" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {!isSelf && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-slate-900">Departments</h2>
              <p className="mt-1 text-sm text-slate-500">Active employees by department</p>
            </div>

            <div className="h-80">
              {loadingFirst ? (
                <LoadingState className="h-full" />
              ) : data.departmentDistribution.length === 0 ? (
                <EmptyState title="No departments yet" className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.departmentDistribution} cx="50%" cy="45%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name">
                      {data.departmentDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className={`grid grid-cols-1 gap-6 ${isSelf ? "" : "xl:grid-cols-3"}`}>
        {!isSelf && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent Employees</h2>
                <p className="mt-1 text-sm text-slate-500">Recently added employees</p>
              </div>
              <Link to="/employees" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>

            {loadingFirst ? (
              <LoadingState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Employee", "Department", "Job Title", "Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                              {getInitials(employee.name)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{employee.name}</p>
                              <p className="text-xs text-slate-500">Joined {formatDate(employee.joiningDate)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{employee.department || "-"}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{employee.designation || "-"}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              employee.status === "Active"
                                ? "bg-emerald-50 text-emerald-700"
                                : employee.status === "On Leave"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {employee.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.recentEmployees.length === 0 && <EmptyState title="No employees yet" />}
              </div>
            )}
          </div>
        )}

        {/* Leave Requests */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isSelf ? "My Pending Leave" : "Pending Leave Requests"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Requests waiting for approval</p>
            </div>
            <Link to="/leaves" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              View All
            </Link>
          </div>

          {loadingFirst ? (
            <LoadingState />
          ) : data.pendingLeaves.length === 0 ? (
            <EmptyState title="All caught up" description="No leave requests are waiting." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.pendingLeaves.map((request) => (
                <div key={request.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                        {getInitials(request.name)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{request.name}</p>
                        <p className="text-xs text-slate-500">{request.type}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {request.days} day{request.days > 1 ? "s" : ""}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-500">{dateRange(request.fromDate, request.toDate)}</p>

                  {!isSelf && (isAdmin || request.employeeId !== user?.id) && (
                    <div className="mt-3 flex gap-2">
                      {[
                        ["Approved", "Approve", "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"],
                        ["Rejected", "Reject", "bg-red-50 text-red-700 hover:bg-red-100"],
                      ].map(([status, label, cls]) => (
                        <button
                          key={status}
                          onClick={() => handleDecision(request, status)}
                          disabled={decide.pending}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${cls}`}
                        >
                          {deciding === `${request.id}:${status}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isSelf && !isAdmin && request.employeeId === user?.id && (
                    <p className="mt-3 text-xs text-slate-400">Your own request: an admin will review it.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
