import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Filter,
  X,
  Loader2,
} from "lucide-react";

import { api } from "../lib/api";
import { formatDate, getInitials } from "../lib/format";
import { useApiQuery, useDebounce, useMutation } from "../hooks/useApi";
import { useDepartments } from "../hooks/useDepartments";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth, ROLE_LABELS } from "../context/AuthContext";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  FormError,
  RefreshBar,
} from "../components/common/States";
import Pagination from "../components/common/Pagination";

const PAGE_SIZE = 10;

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  status: "Active",
  joiningDate: "",
  location: "",
  role: "employee",
  password: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500";

function Employees() {
  const { isAdmin, user } = useAuth();
  const { departments } = useDepartments();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  // The top bar's search can link here with ?search=...
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch);
  if (urlSearch !== prevUrlSearch) {
    setPrevUrlSearch(urlSearch);
    setSearch(urlSearch);
    setPage(1);
  }

  const { data, meta, loading, error, reload } = useApiQuery(
    (signal) =>
      api.get(
        "/employees",
        { search: debouncedSearch, department, status, page, limit: PAGE_SIZE },
        { signal }
      ),
    [debouncedSearch, department, status, page]
  );
  const employees = data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [openMenu, setOpenMenu] = useState(null);

  const save = useMutation((body) =>
    editingEmployee
      ? api.put(`/employees/${editingEmployee.id}`, body)
      : api.post("/employees", body)
  );
  const remove = useMutation((id) => api.delete(`/employees/${id}`));

  // Reset to the first page whenever a filter changes.
  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const openAddForm = () => {
    setEditingEmployee(null);
    setFormData({ ...emptyForm, department: departments[0]?.name ?? "" });
    save.reset();
    setShowForm(true);
  };

  const openEditForm = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone ?? "",
      designation: employee.designation ?? "",
      department: employee.department ?? "",
      status: employee.status,
      joiningDate: employee.joiningDate ?? "",
      location: employee.location ?? "",
      role: employee.role,
      password: "",
    });
    save.reset();
    setShowForm(true);
    setOpenMenu(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { password, ...rest } = formData;
    const body = {
      ...rest,
      department: rest.department || null,
      joiningDate: rest.joiningDate || undefined,
      ...(password && { password }),
    };
    try {
      await save.run(body);
      toast.success(editingEmployee ? `${formData.name} updated` : `${formData.name} added`);
      setShowForm(false);
      setEditingEmployee(null);
      reload();
    } catch {
      // error is shown in the form
    }
  };

  const handleDelete = async (employee) => {
    setOpenMenu(null);
    const confirmed = await confirm({
      title: `Delete ${employee.name}?`,
      message: "Their attendance, leaves and reimbursements will be deleted too. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await remove.run(employee.id);
      toast.success(`${employee.name} deleted`);
      // Step back a page if we just removed the last row on it.
      if (employees.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getStatusClass = (employeeStatus) => {
    if (employeeStatus === "Active") return "bg-emerald-50 text-emerald-700";
    if (employeeStatus === "On Leave") return "bg-orange-50 text-orange-700";
    return "bg-slate-100 text-slate-600";
  };

  const firstLoad = loading && !data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? "Manage your organization's employees."
              : `People in your department${user?.department ? ` (${user.department})` : ""}.`}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, ID or job title..."
              value={search}
              onChange={(event) => setFilter(setSearch)(event.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={department}
                onChange={(event) => setFilter(setDepartment)(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="All">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            value={status}
            onChange={(event) => setFilter(setStatus)(event.target.value)}
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
          <h2 className="font-semibold text-slate-900">All Employees</h2>
          <p className="mt-1 text-sm text-slate-500">
            {meta ? `${meta.total} employee${meta.total === 1 ? "" : "s"} found` : "Loading..."}
          </p>
        </div>
        <RefreshBar active={loading && !!data} />

        {firstLoad ? (
          <LoadingState label="Loading employees..." />
        ) : error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    {["Employee", "Job Title", "Department", "Joining Date", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                            {getInitials(employee.name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {employee.name}
                              {employee.role !== "employee" && (
                                <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
                                  {ROLE_LABELS[employee.role]}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {employee.employeeCode} · {employee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{employee.designation || "-"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{employee.department || "-"}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(employee.joiningDate)}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(employee.status)}`}
                        >
                          {employee.status}
                        </span>
                      </td>
                      <td className="relative px-5 py-4 text-right">
                        <button
                          onClick={() => setOpenMenu(openMenu === employee.id ? null : employee.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Actions for ${employee.name}`}
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
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openEditForm(employee)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                                {employee.id !== user?.id && (
                                  <button
                                    onClick={() => handleDelete(employee)}
                                    disabled={remove.pending}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {employees.length === 0 && (
                <EmptyState
                  title="No employees found"
                  description="Try changing your search or filters."
                />
              )}
            </div>
            <Pagination meta={meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingEmployee ? "Edit Employee" : "Add Employee"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingEmployee ? "Update employee information." : "Enter employee information below."}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <FormError error={save.error} />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Full Name">
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} placeholder="Enter full name" className={inputClass} />
                </Field>
                <Field label="Email">
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="employee@example.com" className={inputClass} />
                </Field>
                <Field label="Phone">
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+91 98765 43210" className={inputClass} />
                </Field>
                <Field label="Job Title">
                  <input type="text" name="designation" required value={formData.designation} onChange={handleInputChange} placeholder="Frontend Developer" className={inputClass} />
                </Field>
                <Field label="Department">
                  <select name="department" value={formData.department} onChange={handleInputChange} className={selectClass}>
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" value={formData.status} onChange={handleInputChange} className={selectClass}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </Field>
                <Field label="Joining Date">
                  <input type="date" name="joiningDate" required value={formData.joiningDate} onChange={handleInputChange} className={inputClass} />
                </Field>
                <Field label="Location">
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="Pune, Maharashtra" className={inputClass} />
                </Field>
                <Field label="Access Role" hint="Managers see and approve requests for their department.">
                  <select name="role" value={formData.role} onChange={handleInputChange} className={selectClass}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </Field>
                <Field
                  label={editingEmployee ? "New Password" : "Initial Password"}
                  hint={
                    editingEmployee
                      ? "Leave blank to keep the current password."
                      : "Optional. Without one they can use “Forgot password”."
                  }
                >
                  <input type="password" name="password" minLength={8} autoComplete="new-password" value={formData.password} onChange={handleInputChange} placeholder="At least 8 characters" className={inputClass} />
                </Field>
              </div>

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
                  disabled={save.pending}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {save.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingEmployee ? "Update Employee" : "Add Employee"}
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
              <h2 className="text-lg font-bold text-slate-900">Employee Details</h2>
              <button onClick={() => setViewEmployee(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                  {getInitials(viewEmployee.name)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{viewEmployee.name}</h3>
                  <p className="text-sm text-slate-500">{viewEmployee.designation}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Detail label="Employee ID" value={viewEmployee.employeeCode} />
                <Detail label="Access Role" value={ROLE_LABELS[viewEmployee.role]} />
                <Detail label="Email" value={viewEmployee.email} />
                <Detail label="Phone" value={viewEmployee.phone} />
                <Detail label="Department" value={viewEmployee.department} />
                <Detail label="Location" value={viewEmployee.location} />
                <Detail label="Joining Date" value={formatDate(viewEmployee.joiningDate)} />
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Status</p>
                  <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(viewEmployee.status)}`}>
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value || "-"}</p>
    </div>
  );
}

export default Employees;
