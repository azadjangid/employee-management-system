import { useMemo, useState } from "react";
import {
  Search,
  CalendarDays,
  Clock3,
  Users,
  UserCheck,
  X,
  Pencil,
} from "lucide-react";

const initialAttendance = [
  {
    id: 1,
    employeeId: 1,
    name: "Rahul Sharma",
    department: "Engineering",
    date: "2026-10-01",
    checkIn: "09:05 AM",
    checkOut: "06:15 PM",
    status: "Present",
  },
  {
    id: 2,
    employeeId: 2,
    name: "Priya Mehta",
    department: "Design",
    date: "2026-10-01",
    checkIn: "09:20 AM",
    checkOut: "06:05 PM",
    status: "Late",
  },
  {
    id: 3,
    employeeId: 3,
    name: "Amit Patel",
    department: "Engineering",
    date: "2026-10-01",
    checkIn: "08:55 AM",
    checkOut: "06:10 PM",
    status: "Present",
  },
  {
    id: 4,
    employeeId: 4,
    name: "Neha Singh",
    department: "HR",
    date: "2026-10-01",
    checkIn: "-",
    checkOut: "-",
    status: "Absent",
  },
  {
    id: 5,
    employeeId: 5,
    name: "Vikas Kumar",
    department: "Sales",
    date: "2026-10-01",
    checkIn: "09:00 AM",
    checkOut: "01:00 PM",
    status: "Half Day",
  },
  {
    id: 6,
    employeeId: 6,
    name: "Anjali Verma",
    department: "Marketing",
    date: "2026-10-01",
    checkIn: "09:02 AM",
    checkOut: "06:00 PM",
    status: "Present",
  },
  {
    id: 7,
    employeeId: 7,
    name: "Rohit Gupta",
    department: "Engineering",
    date: "2026-10-01",
    checkIn: "-",
    checkOut: "-",
    status: "Absent",
  },
  {
    id: 8,
    employeeId: 8,
    name: "Sneha Joshi",
    department: "HR",
    date: "2026-10-01",
    checkIn: "08:58 AM",
    checkOut: "06:12 PM",
    status: "Present",
  },
];

const emptyAttendance = {
  employeeId: "",
  name: "",
  department: "",
  date: "2026-10-01",
  checkIn: "",
  checkOut: "",
  status: "Present",
};

function Attendance() {
  const [attendance, setAttendance] =
    useState(initialAttendance);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  const [dateFilter, setDateFilter] =
    useState("2026-10-01");

  const [showModal, setShowModal] =
    useState(false);

  const [editingAttendance, setEditingAttendance] =
    useState(null);

  const [formData, setFormData] =
    useState(emptyAttendance);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((record) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        record.name.toLowerCase().includes(searchText) ||
        record.department
          .toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "All" ||
        record.status === statusFilter;

      const matchesDate =
        !dateFilter ||
        record.date === dateFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [
    attendance,
    search,
    statusFilter,
    dateFilter,
  ]);

  const presentCount = attendance.filter(
    (record) =>
      record.date === dateFilter &&
      record.status === "Present"
  ).length;

  const lateCount = attendance.filter(
    (record) =>
      record.date === dateFilter &&
      record.status === "Late"
  ).length;

  const absentCount = attendance.filter(
    (record) =>
      record.date === dateFilter &&
      record.status === "Absent"
  ).length;

  const halfDayCount = attendance.filter(
    (record) =>
      record.date === dateFilter &&
      record.status === "Half Day"
  ).length;

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setEditingAttendance(null);
    setFormData(emptyAttendance);
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingAttendance(record);

    setFormData({
      employeeId: record.employeeId,
      name: record.name,
      department: record.department,
      date: record.date,
      checkIn:
        record.checkIn === "-"
          ? ""
          : record.checkIn,
      checkOut:
        record.checkOut === "-"
          ? ""
          : record.checkOut,
      status: record.status,
    });

    setShowModal(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const updatedRecord = {
      ...formData,
      employeeId:
        Number(formData.employeeId) || Date.now(),
      id: editingAttendance
        ? editingAttendance.id
        : Date.now(),
      checkIn: formData.checkIn || "-",
      checkOut: formData.checkOut || "-",
    };

    if (editingAttendance) {
      setAttendance((previous) =>
        previous.map((record) =>
          record.id === editingAttendance.id
            ? updatedRecord
            : record
        )
      );
    } else {
      setAttendance((previous) => [
        updatedRecord,
        ...previous,
      ]);
    }

    setShowModal(false);
    setEditingAttendance(null);
    setFormData(emptyAttendance);
  };

  const getStatusClass = (status) => {
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
            Attendance
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track and manage employee attendance.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <UserCheck className="h-4 w-4" />
          Mark Attendance
        </button>

      </div>

      {/* Summary Cards */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Present
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {presentCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Late
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {lateCount}
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
                Absent
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {absentCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <Users className="h-5 w-5 text-red-600" />
            </div>

          </div>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Half Day
              </p>

              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                {halfDayCount}
              </h2>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50">
              <Clock3 className="h-5 w-5 text-purple-600" />
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

          <div className="relative">

            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="date"
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
            />

          </div>

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

            <option value="Present">
              Present
            </option>

            <option value="Late">
              Late
            </option>

            <option value="Absent">
              Absent
            </option>

            <option value="Half Day">
              Half Day
            </option>
          </select>

        </div>

      </div>

      {/* Attendance Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <h2 className="font-semibold text-slate-900">
            Attendance Records
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredAttendance.length} attendance
            records.
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px]">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Department
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Check In
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Check Out
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Action
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {filteredAttendance.map((record) => (

                <tr
                  key={record.id}
                  className="hover:bg-slate-50"
                >

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                        {getInitials(record.name)}
                      </div>

                      <div>
                        <p className="font-medium text-slate-900">
                          {record.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          {record.date}
                        </p>
                      </div>

                    </div>

                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.department}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.checkIn}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.checkOut}
                  </td>

                  <td className="px-5 py-4">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        record.status
                      )}`}
                    >
                      {record.status}
                    </span>

                  </td>

                  <td className="px-5 py-4 text-right">

                    <button
                      onClick={() =>
                        openEditModal(record)
                      }
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {filteredAttendance.length === 0 && (
            <div className="px-5 py-12 text-center">

              <p className="font-medium text-slate-700">
                No attendance records found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing the date, search or status.
              </p>

            </div>
          )}

        </div>

      </div>

      {/* Add / Edit Modal */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingAttendance
                    ? "Edit Attendance"
                    : "Mark Attendance"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter attendance details.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
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
                    Employee ID
                  </label>

                  <input
                    type="number"
                    name="employeeId"
                    required
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    placeholder="Employee ID"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Employee name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>

                  <input
                    type="text"
                    name="department"
                    required
                    value={formData.department}
                    onChange={handleInputChange}
                    placeholder="Department"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Date
                  </label>

                  <input
                    type="date"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Check In
                  </label>

                  <input
                    type="text"
                    name="checkIn"
                    value={formData.checkIn}
                    onChange={handleInputChange}
                    placeholder="09:00 AM"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Check Out
                  </label>

                  <input
                    type="text"
                    name="checkOut"
                    value={formData.checkOut}
                    onChange={handleInputChange}
                    placeholder="06:00 PM"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="sm:col-span-2">

                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Attendance Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Present">
                      Present
                    </option>

                    <option value="Late">
                      Late
                    </option>

                    <option value="Absent">
                      Absent
                    </option>

                    <option value="Half Day">
                      Half Day
                    </option>
                  </select>

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
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {editingAttendance
                    ? "Update Attendance"
                    : "Save Attendance"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default Attendance;