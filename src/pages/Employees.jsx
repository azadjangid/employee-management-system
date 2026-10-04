import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Filter,
  X,
} from "lucide-react";

const initialEmployees = [
  {
    id: 1,
    name: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    phone: "+91 98765 43210",
    role: "Frontend Developer",
    department: "Engineering",
    status: "Active",
    joiningDate: "2025-01-15",
  },
  {
    id: 2,
    name: "Priya Mehta",
    email: "priya.mehta@example.com",
    phone: "+91 98765 43211",
    role: "UI/UX Designer",
    department: "Design",
    status: "Active",
    joiningDate: "2024-11-10",
  },
  {
    id: 3,
    name: "Amit Patel",
    email: "amit.patel@example.com",
    phone: "+91 98765 43212",
    role: "Backend Developer",
    department: "Engineering",
    status: "Active",
    joiningDate: "2025-02-20",
  },
  {
    id: 4,
    name: "Neha Singh",
    email: "neha.singh@example.com",
    phone: "+91 98765 43213",
    role: "HR Executive",
    department: "HR",
    status: "On Leave",
    joiningDate: "2024-08-05",
  },
  {
    id: 5,
    name: "Vikas Kumar",
    email: "vikas.kumar@example.com",
    phone: "+91 98765 43214",
    role: "Sales Executive",
    department: "Sales",
    status: "Active",
    joiningDate: "2025-03-12",
  },
  {
    id: 6,
    name: "Anjali Verma",
    email: "anjali.verma@example.com",
    phone: "+91 98765 43215",
    role: "Marketing Executive",
    department: "Marketing",
    status: "Active",
    joiningDate: "2025-04-01",
  },
  {
    id: 7,
    name: "Rohit Gupta",
    email: "rohit.gupta@example.com",
    phone: "+91 98765 43216",
    role: "QA Engineer",
    department: "Engineering",
    status: "Inactive",
    joiningDate: "2023-12-18",
  },
  {
    id: 8,
    name: "Sneha Joshi",
    email: "sneha.joshi@example.com",
    phone: "+91 98765 43217",
    role: "HR Manager",
    department: "HR",
    status: "Active",
    joiningDate: "2023-06-22",
  },
  {
    id: 9,
    name: "Karan Shah",
    email: "karan.shah@example.com",
    phone: "+91 98765 43218",
    role: "Sales Manager",
    department: "Sales",
    status: "Active",
    joiningDate: "2022-10-14",
  },
  {
    id: 10,
    name: "Pooja Nair",
    email: "pooja.nair@example.com",
    phone: "+91 98765 43219",
    role: "Product Designer",
    department: "Design",
    status: "On Leave",
    joiningDate: "2024-05-30",
  },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  role: "",
  department: "Engineering",
  status: "Active",
  joiningDate: "",
};

function Employees() {
  const [employees, setEmployees] = useState(initialEmployees);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const [openMenu, setOpenMenu] = useState(null);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        employee.name.toLowerCase().includes(searchText) ||
        employee.email.toLowerCase().includes(searchText) ||
        employee.role.toLowerCase().includes(searchText);

      const matchesDepartment =
        department === "All" ||
        employee.department === department;

      const matchesStatus =
        status === "All" ||
        employee.status === status;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
    });
  }, [employees, search, department, status]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openAddForm = () => {
    setEditingEmployee(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (employee) => {
    setEditingEmployee(employee);

    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      department: employee.department,
      status: employee.status,
      joiningDate: employee.joiningDate,
    });

    setShowForm(true);
    setOpenMenu(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (editingEmployee) {
      setEmployees((previous) =>
        previous.map((employee) =>
          employee.id === editingEmployee.id
            ? {
                ...employee,
                ...formData,
              }
            : employee
        )
      );
    } else {
      const newEmployee = {
        id: Date.now(),
        ...formData,
      };

      setEmployees((previous) => [
        newEmployee,
        ...previous,
      ]);
    }

    setFormData(emptyForm);
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleDelete = (id) => {
    const employee = employees.find(
      (item) => item.id === id
    );

    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee?.name}?`
    );

    if (!confirmed) {
      return;
    }

    setEmployees((previous) =>
      previous.filter((employee) => employee.id !== id)
    );

    setOpenMenu(null);
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getStatusClass = (employeeStatus) => {
    if (employeeStatus === "Active") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (employeeStatus === "On Leave") {
      return "bg-orange-50 text-orange-700";
    }

    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Employees
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your organization's employees.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>

      </div>

      {/* Filters */}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 lg:flex-row">

          {/* Search */}

          <div className="relative flex-1">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

          </div>

          {/* Department */}

          <div className="flex items-center gap-2">

            <Filter className="h-4 w-4 text-slate-400" />

            <select
              value={department}
              onChange={(event) =>
                setDepartment(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Marketing">Marketing</option>
              <option value="HR">HR</option>
              <option value="Sales">Sales</option>
            </select>

          </div>

          {/* Status */}

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Inactive">Inactive</option>
          </select>

        </div>

      </div>

      {/* Employee Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="font-semibold text-slate-900">
                All Employees
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredEmployees.length} of{" "}
                {employees.length} employees
              </p>
            </div>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[900px]">

            <thead className="bg-slate-50">

              <tr>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employee
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Role
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Department
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Joining Date
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

              {filteredEmployees.map((employee) => (

                <tr
                  key={employee.id}
                  className="transition hover:bg-slate-50"
                >

                  {/* Employee */}

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                        {getInitials(employee.name)}
                      </div>

                      <div>

                        <p className="font-medium text-slate-900">
                          {employee.name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {employee.email}
                        </p>

                      </div>

                    </div>

                  </td>

                  {/* Role */}

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {employee.role}
                  </td>

                  {/* Department */}

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {employee.department}
                  </td>

                  {/* Joining Date */}

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {employee.joiningDate}
                  </td>

                  {/* Status */}

                  <td className="px-5 py-4">

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        employee.status
                      )}`}
                    >
                      {employee.status}
                    </span>

                  </td>

                  {/* Actions */}

                  <td className="relative px-5 py-4 text-right">

                    <button
                      onClick={() =>
                        setOpenMenu(
                          openMenu === employee.id
                            ? null
                            : employee.id
                        )
                      }
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {openMenu === employee.id && (
                      <div className="absolute right-5 top-14 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg">

                        <button
                          onClick={() => {
                            setViewEmployee(employee);
                            setOpenMenu(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>

                        <button
                          onClick={() =>
                            openEditForm(employee)
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(employee.id)
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>

                      </div>
                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {filteredEmployees.length === 0 && (
            <div className="px-5 py-12 text-center">

              <p className="font-medium text-slate-700">
                No employees found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or filters.
              </p>

            </div>
          )}

        </div>

      </div>

      {/* Add / Edit Modal */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingEmployee
                    ? "Edit Employee"
                    : "Add Employee"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingEmployee
                    ? "Update employee information."
                    : "Enter employee information below."}
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                {/* Name */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Full Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Email */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="employee@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Phone */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Role */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Role
                  </label>

                  <input
                    type="text"
                    name="role"
                    required
                    value={formData.role}
                    onChange={handleInputChange}
                    placeholder="Frontend Developer"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* Department */}

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
                    <option value="Design">Design</option>
                    <option value="Marketing">
                      Marketing
                    </option>
                    <option value="HR">HR</option>
                    <option value="Sales">Sales</option>
                  </select>
                </div>

                {/* Status */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">
                      On Leave
                    </option>
                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                {/* Joining Date */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Joining Date
                  </label>

                  <input
                    type="date"
                    name="joiningDate"
                    required
                    value={formData.joiningDate}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

              </div>

              {/* Buttons */}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {editingEmployee
                    ? "Update Employee"
                    : "Add Employee"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* View Employee Modal */}

      {viewEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <h2 className="text-lg font-bold text-slate-900">
                Employee Details
              </h2>

              <button
                onClick={() => setViewEmployee(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <div className="space-y-5 p-6">

              <div className="flex items-center gap-4">

                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                  {getInitials(viewEmployee.name)}
                </div>

                <div>

                  <h3 className="text-xl font-bold text-slate-900">
                    {viewEmployee.name}
                  </h3>

                  <p className="text-sm text-slate-500">
                    {viewEmployee.role}
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Email
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {viewEmployee.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Phone
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {viewEmployee.phone}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Department
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {viewEmployee.department}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Joining Date
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {viewEmployee.joiningDate}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      viewEmployee.status
                    )}`}
                  >
                    {viewEmployee.status}
                  </span>
                </div>

              </div>

            </div>

            <div className="border-t border-slate-200 px-6 py-4 text-right">

              <button
                onClick={() => setViewEmployee(null)}
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

export default Employees;