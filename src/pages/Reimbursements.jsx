import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Check,
  X,
  CreditCard,
  Receipt,
  Wallet,
  Loader2,
  FileText,
  Paperclip,
  Upload,
  Download,
  ExternalLink,
} from "lucide-react";

import { api, apiUrl } from "../lib/api";
import { formatCurrency, formatDate, getInitials, todayISO } from "../lib/format";
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

const categories = ["Travel", "Food", "Internet", "Equipment", "Office Supplies", "Medical", "Other"];
const paymentMethods = ["Bank Transfer", "Cash", "Company Card"];

const RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_RECEIPT_MB = 5;

/** Returns an error message, or null if the file is fine to upload. */
function checkReceipt(file) {
  if (!RECEIPT_TYPES.includes(file.type)) return "Receipts must be a PDF, JPG, PNG or WebP file";
  if (file.size > MAX_RECEIPT_MB * 1024 * 1024) return `Receipt must be ${MAX_RECEIPT_MB} MB or smaller`;
  return null;
}

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function uploadReceipt(id, file) {
  const body = new FormData();
  body.append("receipt", file);
  return api.post(`/reimbursements/${id}/receipt`, body);
}

const emptyForm = {
  employeeId: "",
  category: "Travel",
  amount: "",
  date: "",
  description: "",
  paymentMethod: "Bank Transfer",
};

function getStatusClasses(status) {
  if (status === "Pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "Approved") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "Paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function Reimbursements() {
  const { user, canManage, isAdmin } = useAuth();

  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  // The top bar's search can link here with ?search=...
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
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
        "/reimbursements",
        { search: debouncedSearch, status: statusFilter, category: categoryFilter, page, limit: PAGE_SIZE },
        { signal }
      ),
    [debouncedSearch, statusFilter, categoryFilter, page]
  );
  const summary = useApiQuery((signal) => api.get("/reimbursements/summary", undefined, { signal }), []);
  const items = list.data ?? [];

  // "add" | "edit" | null
  const [formMode, setFormMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const { employees } = useEmployeeOptions(canManage);

  const save = useMutation((body) =>
    formMode === "edit" ? api.put(`/reimbursements/${selected.id}`, body) : api.post("/reimbursements", body)
  );
  const changeStatus = useMutation(({ id, status }) => api.patch(`/reimbursements/${id}/status`, { status }));
  const remove = useMutation((id) => api.delete(`/reimbursements/${id}`));
  const receiptUpload = useMutation(({ id, file }) => uploadReceipt(id, file));
  const receiptRemove = useMutation((id) => api.delete(`/reimbursements/${id}/receipt`));

  const refreshAll = () => {
    list.reload();
    summary.reload();
  };

  const setFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const isOwn = (item) => item.employeeId === user.id;
  const canDecide = (item) => item.status === "Pending" && canManage && (isAdmin || !isOwn(item));
  const canPay = (item) => item.status === "Approved" && isAdmin;
  const canEdit = (item) => item.status === "Pending" && (isOwn(item) || canManage);
  const canChangeReceipt = (item) => isAdmin || canEdit(item);
  const canDelete = (item) => (item.status === "Pending" && (isOwn(item) || canManage)) || isAdmin;

  const chooseReceipt = (e) => {
    const file = e.target.files?.[0] ?? null;
    const problem = file && checkReceipt(file);
    setReceiptError(problem);
    setReceiptFile(problem ? null : file);
    if (problem) e.target.value = "";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setFormData(emptyForm);
    setReceiptFile(null);
    setReceiptError(null);
    setSelected(null);
    save.reset();
    setFormMode("add");
  };

  const openEditModal = (item) => {
    setSelected(item);
    setFormData({
      employeeId: String(item.employeeId),
      category: item.category,
      amount: String(item.amount),
      date: item.date,
      description: item.description,
      paymentMethod: item.paymentMethod,
    });
    setReceiptFile(null);
    setReceiptError(null);
    save.reset();
    setFormMode("edit");
    setOpenMenu(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { employeeId, ...rest } = formData;
    let saved;
    try {
      saved = await save.run({
        ...rest,
        amount: Number(formData.amount),
        ...(formMode === "add" && employeeId && { employeeId: Number(employeeId) }),
      });
    } catch {
      return; // shown in the form
    }
    toast.success(formMode === "edit" ? "Claim updated" : "Claim submitted");
    setFormMode(null);
    if (receiptFile) {
      try {
        await receiptUpload.run({ id: saved.data.id, file: receiptFile });
        toast.success("Receipt attached");
      } catch (err) {
        toast.error(`The claim was saved, but the receipt didn't upload: ${err.message}`);
      }
    }
    refreshAll();
  };

  const updateStatus = async (item, status) => {
    setOpenMenu(null);
    try {
      const res = await changeStatus.run({ id: item.id, status });
      if (viewItem?.id === item.id) setViewItem(res.data);
      toast.success(
        status === "Paid"
          ? `${formatCurrency(item.amount)} marked as paid`
          : `${item.employeeName}'s claim ${status.toLowerCase()}`
      );
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const attachToViewed = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkReceipt(file);
    if (problem) return toast.error(problem);
    try {
      const res = await receiptUpload.run({ id: viewItem.id, file });
      setViewItem(res.data);
      toast.success("Receipt attached");
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeViewedReceipt = async () => {
    const ok = await confirm({
      title: "Remove this receipt?",
      message: viewItem.receipt,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await receiptRemove.run(viewItem.id);
      setViewItem(res.data);
      toast.success("Receipt removed");
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (item) => {
    setOpenMenu(null);
    const ok = await confirm({
      title: `Delete this ${formatCurrency(item.amount)} claim?`,
      message: `${item.category}: ${item.description}`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.run(item.id);
      setViewItem(null);
      toast.success("Claim deleted");
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = summary.data;
  const total = s ? Object.values(s).reduce((n, x) => n + x.total, 0) : 0;
  const money = (v) => (s ? formatCurrency(v) : summary.error ? "–" : "…");
  const busy = changeStatus.pending || remove.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reimbursements</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? "Manage employee expense reimbursements" : "Submit and track your expense claims"}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={18} />
          {canManage ? "Add Reimbursement" : "New Claim"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Reimbursements" value={money(total)} icon={<Wallet size={20} />} iconClass="bg-slate-100 text-slate-700" />
        <SummaryCard title="Pending Amount" value={money(s?.Pending.total)} icon={<Receipt size={20} />} iconClass="bg-amber-100 text-amber-700" />
        <SummaryCard title="Approved Amount" value={money(s?.Approved.total)} icon={<Check size={20} />} iconClass="bg-blue-100 text-blue-700" />
        <SummaryCard title="Paid Amount" value={money(s?.Paid.total)} icon={<CreditCard size={20} />} iconClass="bg-emerald-100 text-emerald-700" />
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={canManage ? "Search employee or description..." : "Search description..."}
              value={search}
              onChange={(e) => setFilter(setSearch)(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setFilter(setStatusFilter)(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Paid">Paid</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setFilter(setCategoryFilter)(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400"
          >
            <option value="All">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <RefreshBar active={list.loading && !!list.data} />

        {list.loading && !list.data ? (
          <LoadingState label="Loading reimbursements..." />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {["Employee", "Category", "Amount", "Date", "Status"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {h}
                      </th>
                    ))}
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                            {getInitials(item.employeeName)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.employeeName}</p>
                            <p className="text-xs text-slate-500">{item.department || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{item.category}</span>
                        {item.hasReceipt && (
                          <Paperclip size={14} className="ml-2 inline text-slate-400" aria-label="Has a receipt" />
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(item.amount)}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{formatDate(item.date)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="relative px-5 py-4 text-right">
                        <button
                          onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Actions"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {openMenu === item.id && (
                          <div className="absolute right-5 top-12 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                            <ActionButton icon={<Eye size={15} />} label="View" onClick={() => { setViewItem(item); setOpenMenu(null); }} />
                            {canEdit(item) && <ActionButton icon={<Pencil size={15} />} label="Edit" onClick={() => openEditModal(item)} />}
                            {canDecide(item) && (
                              <>
                                <ActionButton icon={<Check size={15} />} label="Approve" disabled={busy} onClick={() => updateStatus(item, "Approved")} />
                                <ActionButton icon={<X size={15} />} label="Reject" disabled={busy} onClick={() => updateStatus(item, "Rejected")} />
                              </>
                            )}
                            {canPay(item) && (
                              <ActionButton icon={<CreditCard size={15} />} label="Mark as Paid" disabled={busy} onClick={() => updateStatus(item, "Paid")} />
                            )}
                            {canDelete(item) && (
                              <ActionButton danger icon={<Trash2 size={15} />} label={isOwn(item) && !isAdmin ? "Cancel claim" : "Delete"} disabled={busy} onClick={() => handleDelete(item)} />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {items.length === 0 && (
                <EmptyState title="No reimbursements found" description="Try changing your search or filters." />
              )}
            </div>
            <Pagination meta={list.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {formMode && (
        <Modal title={formMode === "edit" ? "Edit Reimbursement" : "Add Reimbursement"} onClose={() => setFormMode(null)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <FormError error={save.error} />

            {canManage && formMode === "add" && (
              <Field label="Employee">
                <select name="employeeId" value={formData.employeeId} onChange={handleInputChange} className={inputClass}>
                  <option value="">Myself ({user.name})</option>
                  {employees
                    .filter((e) => e.id !== user.id && e.status !== "Inactive")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.department || "No department"})
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {formMode === "edit" && (
              <p className="text-sm text-slate-500">
                Claim by <span className="font-semibold text-slate-700">{selected.employeeName}</span>
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select name="category" value={formData.category} onChange={handleInputChange} className={inputClass}>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount (₹)">
                <input type="number" name="amount" required min="1" step="0.01" value={formData.amount} onChange={handleInputChange} placeholder="0" className={inputClass} />
              </Field>
              <Field label="Expense Date">
                <input type="date" name="date" required max={todayISO()} value={formData.date} onChange={handleInputChange} className={inputClass} />
              </Field>
              <Field label="Payment Method">
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={inputClass}>
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea name="description" required rows="3" value={formData.description} onChange={handleInputChange} placeholder="What was this expense for?" className={`${inputClass} resize-none`} />
            </Field>

            {(formMode === "add" || selected?.status === "Pending") && (
              <Field label={formMode === "edit" && selected.hasReceipt ? "Replace receipt (optional)" : "Receipt (optional)"}>
                <input
                  type="file"
                  accept={RECEIPT_TYPES.join(",")}
                  onChange={chooseReceipt}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className={`mt-1 text-xs ${receiptError ? "text-red-600" : "text-slate-400"}`}>
                  {receiptError ||
                    (receiptFile
                      ? `${receiptFile.name} (${formatSize(receiptFile.size)})`
                      : `PDF, JPG, PNG or WebP, up to ${MAX_RECEIPT_MB} MB`)}
                </p>
              </Field>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setFormMode(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={save.pending || receiptUpload.pending} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {(save.pending || receiptUpload.pending) && <Loader2 className="h-4 w-4 animate-spin" />}
                {formMode === "edit" ? "Save Changes" : "Submit Claim"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Modal */}
      {viewItem && (
        <Modal title="Reimbursement Details" onClose={() => setViewItem(null)}>
          <div className="space-y-5 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                {getInitials(viewItem.employeeName)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{viewItem.employeeName}</h3>
                <p className="text-sm text-slate-500">{viewItem.department}</p>
              </div>
              <span className={`ml-auto inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(viewItem.status)}`}>
                {viewItem.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Detail label="Category" value={viewItem.category} />
              <Detail label="Amount" value={formatCurrency(viewItem.amount)} />
              <Detail label="Expense Date" value={formatDate(viewItem.date)} />
              <Detail label="Payment Method" value={viewItem.paymentMethod} />
              <Detail label="Submitted" value={formatDate(viewItem.createdAt?.slice(0, 10))} />
              {viewItem.reviewedBy && <Detail label="Reviewed By" value={viewItem.reviewedBy} />}
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Description</p>
              <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{viewItem.description}</p>
            </div>

            <div>
              <p className="text-xs uppercase text-slate-400">Receipt</p>
              {viewItem.hasReceipt ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                  <FileText size={18} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{viewItem.receipt}</p>
                    {viewItem.receiptSize && <p className="text-xs text-slate-400">{formatSize(viewItem.receiptSize)}</p>}
                  </div>
                  <a href={apiUrl(`/reimbursements/${viewItem.id}/receipt`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                    <ExternalLink size={14} /> View
                  </a>
                  <a href={apiUrl(`/reimbursements/${viewItem.id}/receipt?download=1`)} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline">
                    <Download size={14} /> Download
                  </a>
                  {canChangeReceipt(viewItem) && (
                    <button onClick={removeViewedReceipt} disabled={receiptRemove.pending} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline disabled:opacity-50">
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No receipt attached.</p>
              )}
              {canChangeReceipt(viewItem) && (
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  {receiptUpload.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={16} />}
                  {viewItem.hasReceipt ? "Replace receipt" : "Attach receipt"}
                  <input type="file" accept={RECEIPT_TYPES.join(",")} onChange={attachToViewed} disabled={receiptUpload.pending} className="sr-only" />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            {canDecide(viewItem) && (
              <>
                <button onClick={() => updateStatus(viewItem, "Rejected")} disabled={busy} className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                  Reject
                </button>
                <button onClick={() => updateStatus(viewItem, "Approved")} disabled={busy} className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                  Approve
                </button>
              </>
            )}
            {canPay(viewItem) && (
              <button onClick={() => updateStatus(viewItem, "Paid")} disabled={busy} className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                Mark as Paid
              </button>
            )}
            <button onClick={() => setViewItem(null)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-slate-400";

function SummaryCard({ title, value, icon, iconClass }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">{value}</h2>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
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

export default Reimbursements;
