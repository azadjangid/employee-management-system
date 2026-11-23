import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Pencil, Trash2, Users, UserCheck, Loader2, Crown } from "lucide-react";

import { api } from "../lib/api";
import { inputClass, primaryButton, secondaryButton } from "../lib/ui";
import { getInitials } from "../lib/format";
import { useApiQuery, useMutation } from "../hooks/useApi";
import { useEmployeeOptions } from "../hooks/useDepartments";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { LoadingState, ErrorState, EmptyState, FormError } from "../components/common/States";
import { Modal, Field, SummaryCard } from "../components/common/Ui";

const emptyForm = { name: "", description: "", headId: "" };

function Departments() {
  const { isAdmin, canManage } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const list = useApiQuery((signal) => api.get("/departments", undefined, { signal }), []);
  const departments = list.data ?? [];
  const { employees } = useEmployeeOptions(isAdmin);

  const [editing, setEditing] = useState(null); // null | "new" | department
  const [form, setForm] = useState(emptyForm);

  const save = useMutation((body) =>
    editing === "new" ? api.post("/departments", body) : api.put(`/departments/${editing.id}`, body)
  );
  const remove = useMutation((id) => api.delete(`/departments/${id}`));

  const openForm = (dept) => {
    save.reset();
    setEditing(dept ?? "new");
    setForm(
      dept
        ? { name: dept.name, description: dept.description ?? "", headId: dept.headId ? String(dept.headId) : "" }
        : emptyForm
    );
  };

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await save.run({
        name: form.name,
        description: form.description || null,
        headId: form.headId ? Number(form.headId) : null,
      });
      toast.success(editing === "new" ? `${form.name} created` : `${form.name} updated`);
      setEditing(null);
      list.reload();
    } catch {
      // shown in the form
    }
  };

  const handleDelete = async (dept) => {
    const ok = await confirm({
      title: `Delete ${dept.name}?`,
      message: dept.employeeCount
        ? `${dept.employeeCount} employee(s) in this department will be left without a department.`
        : "This department has no employees.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.run(dept.id);
      toast.success(`${dept.name} deleted`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const totalPeople = departments.reduce((n, d) => n + d.employeeCount, 0);
  const totalActive = departments.reduce((n, d) => n + d.activeCount, 0);
  const withHead = departments.filter((d) => d.headId).length;
  const loaded = !!list.data;

  // Department heads should be active people.
  const headOptions = employees.filter((e) => e.status !== "Inactive");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin ? "Create departments and choose who heads each one" : "Departments and who leads them"}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => openForm(null)} className={primaryButton}>
            <Plus size={18} />
            Add Department
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard title="Departments" value={loaded ? departments.length : "…"} icon={<Building2 size={20} />} />
        <SummaryCard title="Active employees" value={loaded ? `${totalActive} of ${totalPeople}` : "…"} icon={<Users size={20} />} iconClass="bg-blue-100 text-blue-700" />
        <SummaryCard title="With a head" value={loaded ? `${withHead} of ${departments.length}` : "…"} icon={<UserCheck size={20} />} iconClass="bg-emerald-100 text-emerald-700" />
      </div>

      {list.loading && !list.data ? (
        <LoadingState label="Loading departments..." />
      ) : list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : departments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState title="No departments yet" description={isAdmin ? "Add your first department to get started." : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <article key={d.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">{d.name}</h2>
                    <p className="text-xs text-slate-500">
                      {d.employeeCount} {d.employeeCount === 1 ? "person" : "people"}
                      {d.employeeCount !== d.activeCount && ` · ${d.activeCount} active`}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openForm(d)} aria-label={`Edit ${d.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(d)} disabled={remove.pending} aria-label={`Delete ${d.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-3 flex-1 text-sm text-slate-600">{d.description || <span className="text-slate-400">No description</span>}</p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                {d.headName ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {getInitials(d.headName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{d.headName}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Crown size={11} /> Head of department
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No head assigned</p>
                )}
                {canManage && (
                  <Link to={`/employees?search=${encodeURIComponent(d.name)}`} className="text-xs font-semibold text-blue-600 hover:underline">
                    View people
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add Department" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <FormError error={save.error} />
            <Field label="Name">
              <input name="name" required maxLength={100} value={form.name} onChange={handleChange} className={inputClass} placeholder="e.g. Finance" />
            </Field>
            <Field label="Description">
              <textarea name="description" rows="3" maxLength={500} value={form.description} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="What does this team do?" />
            </Field>
            <Field label="Head of department" hint="Shown on this page. Manager access is set by each person's role on the Employees page.">
              <select name="headId" value={form.headId} onChange={handleChange} className={inputClass}>
                <option value="">No head</option>
                {headOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.designation || e.department || "No title"})
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={save.pending} className={primaryButton}>
                {save.pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing === "new" ? "Create Department" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Departments;
