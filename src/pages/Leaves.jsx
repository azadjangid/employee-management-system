import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  X,
  Eye,
} from "lucide-react";

const initialLeaves = [
  {
    id: 1,
    employeeName: "Rahul Sharma",
    department: "Engineering",
    leaveType: "Casual Leave",
    fromDate: "2026-10-05",
    toDate: "2026-10-06",
    days: 2,
    reason: "Personal work",
    status: "Pending",
    appliedOn: "2026-09-28",
  },
  {
    id: 2,
    employeeName: "Priya Mehta",
    department: "Design",
    leaveType: "Sick Leave",
    fromDate: "2026-10-03",
    toDate: "2026-10-03",
    days: 1,
    reason: "Not feeling well",
    status: "Approved",
    appliedOn: "2026-09-27",
  },
  {
    id: 3,
    employeeName: "Amit Patel",
    department: "Engineering",
    leaveType: "Earned Leave",
    fromDate: "2026-10-10",
    toDate: "2026-10-12",
    days: 3,
    reason: "Family vacation",
    status: "Pending",
    appliedOn: "2026-09-29",
  },
  {
    id: 4,
    employeeName: "Neha Singh",
    department: "HR",
    leaveType: "Casual Leave",
    fromDate: "2026-09-30",
    toDate: "2026-10-01",
    days: 2,
    reason: "Personal work",
    status: "Approved",
    appliedOn: "2026-09-25",
  },
  {
    id: 5,
    employeeName: "Vikas Kumar",
    department: "Sales",
    leaveType: "Sick Leave",
    fromDate: "2026-09-26",
    toDate: "2026-09-26",
    days: 1,
    reason: "Fever",
    status: "Rejected",
    appliedOn: "2026-09-25",
  },
  {
    id: 6,
    employeeName: "Anjali Verma",
    department: "Marketing",
    leaveType: "Earned Leave",
    fromDate: "2026-10-15",
    toDate: "2026-10-17",
    days: 3,
    reason: "Travel",
    status: "Pending",
    appliedOn: "2026-09-30",
  },
];

const emptyForm = {
  employeeName: "",
  department: "Engineering",
  leaveType: "Casual Leave",
  fromDate: "",
  toDate: "",
  reason: "",
};

function Leaves() {
  const [leaves, setLeaves] = useState(initialLeaves);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);
  const [viewLeave, setViewLeave] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const pendingCount = leaves.filter(
    (leave) => leave.status === "Pending"
  ).length;

  const approvedCount = leaves.filter(
    (leave) => leave.status === "Approved"
  ).length;

  const rejectedCount = leaves.filter(
    (leave) => leave.status === "Rejected"
  ).length;

  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        leave.employeeName
          .toLowerCase()
          .includes(searchText) ||
        leave.department
          .toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "All" ||
        leave.status === statusFilter;

      const matchesType =
        typeFilter === "All" ||
        leave.leaveType === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    leaves,
    search,
    statusFilter,
    typeFilter,
  ]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const calculateDays = (fromDate, toDate) => {
    if (!fromDate || !toDate) {
      return 0;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    const difference =
      end.getTime() - start.getTime();

    return (
      Math.floor(
        difference / (1000 * 60 * 60 * 24)
      ) + 1
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const days = calculateDays(
      formData.fromDate,
      formData.toDate
    );

    if (days <= 0) {
      alert(
        "Please select a valid date range."
      );
      return;
    }

    const newLeave = {
      id: Date.now(),
      ...formData,
      days,
      status: "Pending",
      appliedOn: new Date()
        .toISOString()
        .split("T")[0],
    };

    setLeaves((previous) => [
      newLeave,
      ...previous,
    ]);

    setFormData(emptyForm);
    setShowModal(false);
  };

  const updateLeaveStatus = (id, status) => {
    setLeaves((previous) =>
      previous.map((leave) =>
        leave.id === id
          ? {
              ...leave,
              status,
            }
          : leave
      )
    );
  };

  const getStatusClass = (status) => {
    if (status === "Approved") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (status === "Rejected") {
      return "bg-red-50 text-red-700";
    }

    return "bg-orange-50 text-orange-700";
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Leave Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee leave requests and approvals.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(emptyForm);
            setShowModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Request Leave
        </button>

      </div>

      {/* Summary */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Pending Requests
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {pendingCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
              <Clock3 className="h-5 w-5 text-orange-600" />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Approved
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {approvedCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Rejected
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {rejectedCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>

          </div>

        </div>

      </div>

      {/* Leave Balance */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="mb-5">

          <h2 className="font-semibold text-slate-900">
            Leave Balance
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current leave availability
          </p>

        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">

          <div>

            <div className="mb-2 flex items-center justify-between">

              <span className="text-sm font-medium text-slate-700">
                Casual Leave
              </span>

              <span className="text-sm font-semibold text-slate-900">
                8 / 12
              </span>

            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">

              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: "67%" }}
              />

            </div>

          </div>

          <div>

            <div className="mb-2 flex items-center justify-between">

              <span className="text-sm font-medium text-slate-700">
                Sick Leave
              </span>

              <span className="text-sm font-semibold text-slate-900">
                6 / 10
              </span>

            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">

              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "60%" }}
              />

            </div>

          </div>

          <div>

            <div className="mb-2 flex items-center justify-between">

              <span className="text-sm font-medium text-slate-700">
                Earned Leave
              </span>

              <span className="text-sm font-semibold text-slate-900">
                10 / 15
              </span>

            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">

              <div
                className="h-full rounded-full bg-purple-500"
                style={{ width: "67%" }}
              />

            </div>

          </div>

        </div>

      </div>

      {/* Filters */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <div className="relative">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search employee..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">
              All Leave Types
            </option>

            <option value="Casual Leave">
              Casual Leave
            </option>

            <option value="Sick Leave">
              Sick Leave
            </option>

            <option value="Earned Leave">
              Earned Leave
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">
              All Status
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Approved">
              Approved
            </option>

            <option value="Rejected">
              Rejected
            </option>
          </select>

        </div>

      </div>

      {/* Leave Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h2 className="font-semibold text-slate-900">
            Leave Requests
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredLeaves.length} leave requests.
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1000px]">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Leave Type
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Dates
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Days
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {filteredLeaves.map((leave) => (

                <tr
                  key={leave.id}
                  className="hover:bg-slate-50"
                >

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                        {getInitials(
                          leave.employeeName
                        )}
                      </div>

                      <div>

                        <p className="font-medium text-slate-900">
                          {leave.employeeName}
                        </p>

                        <p className="text-xs text-slate-500">
                          {leave.department}
                        </p>

                      </div>

                    </div>

                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {leave.leaveType}
                  </td>

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-2 text-sm text-slate-600">

                      <CalendarDays className="h-4 w-4 text-slate-400" />

                      {leave.fromDate} → {leave.toDate}

                    </div>

                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {leave.days}
                  </td>

                  <td className="px-5 py-4">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        leave.status
                      )}`}
                    >
                      {leave.status}
                    </span>

                  </td>

                  <td className="px-5 py-4">

                    <div className="flex justify-end gap-2">

                      <button
                        onClick={() =>
                          setViewLeave(leave)
                        }
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      {leave.status === "Pending" && (
                        <>
                          <button
                            onClick={() =>
                              updateLeaveStatus(
                                leave.id,
                                "Approved"
                              )
                            }
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                            title="Approve"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() =>
                              updateLeaveStatus(
                                leave.id,
                                "Rejected"
                              )
                            }
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {filteredLeaves.length === 0 && (
            <div className="px-5 py-12 text-center">

              <p className="font-medium text-slate-700">
                No leave requests found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters.
              </p>

            </div>
          )}

        </div>

      </div>

      {/* Request Leave Modal */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  Request Leave
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Submit a new leave request.
                </p>

              </div>

              <button
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee Name
                  </label>

                  <input
                    type="text"
                    name="employeeName"
                    required
                    value={formData.employeeName}
                    onChange={handleInputChange}
                    placeholder="Enter employee name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>

                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Engineering">
                      Engineering
                    </option>

                    <option value="Design">
                      Design
                    </option>

                    <option value="Marketing">
                      Marketing
                    </option>

                    <option value="HR">
                      HR
                    </option>

                    <option value="Sales">
                      Sales
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Leave Type
                  </label>

                  <select
                    name="leaveType"
                    value={formData.leaveType}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Casual Leave">
                      Casual Leave
                    </option>

                    <option value="Sick Leave">
                      Sick Leave
                    </option>

                    <option value="Earned Leave">
                      Earned Leave
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    From Date
                  </label>

                  <input
                    type="date"
                    name="fromDate"
                    required
                    value={formData.fromDate}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    To Date
                  </label>

                  <input
                    type="date"
                    name="toDate"
                    required
                    min={formData.fromDate}
                    value={formData.toDate}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">

                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Reason
                  </label>

                  <textarea
                    name="reason"
                    required
                    rows="4"
                    value={formData.reason}
                    onChange={handleInputChange}
                    placeholder="Enter reason for leave..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                </div>

              </div>

              {formData.fromDate &&
                formData.toDate && (
                  <div className="rounded-xl bg-blue-50 p-4">

                    <p className="text-sm text-blue-700">

                      Requested leave duration:{" "}

                      <span className="font-bold">
                        {calculateDays(
                          formData.fromDate,
                          formData.toDate
                        )}{" "}
                        day(s)
                      </span>

                    </p>

                  </div>
                )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
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

              <h2 className="text-lg font-bold text-slate-900">
                Leave Details
              </h2>

              <button
                onClick={() =>
                  setViewLeave(null)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <div className="space-y-5 p-6">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                  {getInitials(
                    viewLeave.employeeName
                  )}
                </div>

                <div>

                  <h3 className="font-bold text-slate-900">
                    {viewLeave.employeeName}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {viewLeave.department}
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-2 gap-5">

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Leave Type
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {viewLeave.leaveType}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      viewLeave.status
                    )}`}
                  >
                    {viewLeave.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    From
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {viewLeave.fromDate}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    To
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {viewLeave.toDate}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Duration
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {viewLeave.days} day(s)
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-400">
                    Applied On
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {viewLeave.appliedOn}
                  </p>
                </div>

              </div>

              <div>
                <p className="text-xs uppercase text-slate-400">
                  Reason
                </p>

                <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {viewLeave.reason}
                </p>
              </div>

            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">

              {viewLeave.status === "Pending" && (
                <>
                  <button
                    onClick={() => {
                      updateLeaveStatus(
                        viewLeave.id,
                        "Rejected"
                      );
                      setViewLeave(null);
                    }}
                    className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => {
                      updateLeaveStatus(
                        viewLeave.id,
                        "Approved"
                      );
                      setViewLeave(null);
                    }}
                    className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Approve
                  </button>
                </>
              )}

              <button
                onClick={() =>
                  setViewLeave(null)
                }
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

export default Leaves;