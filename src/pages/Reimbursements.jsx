import { useMemo, useState } from "react";
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
  XCircle,
  Wallet,
} from "lucide-react";

const initialReimbursements = [
  {
    id: 1,
    employeeName: "Rahul Sharma",
    department: "Engineering",
    category: "Travel",
    amount: 12500,
    date: "2026-09-25",
    description: "Client meeting travel expenses",
    status: "Pending",
    paymentMethod: "Bank Transfer",
    receipt: "travel-receipt.pdf",
  },
  {
    id: 2,
    employeeName: "Priya Mehta",
    department: "Design",
    category: "Food",
    amount: 2450,
    date: "2026-09-23",
    description: "Team lunch expenses",
    status: "Approved",
    paymentMethod: "Bank Transfer",
    receipt: "food-receipt.jpg",
  },
  {
    id: 3,
    employeeName: "Amit Patel",
    department: "Engineering",
    category: "Internet",
    amount: 1800,
    date: "2026-09-20",
    description: "Monthly internet reimbursement",
    status: "Paid",
    paymentMethod: "Bank Transfer",
    receipt: "internet-bill.pdf",
  },
  {
    id: 4,
    employeeName: "Neha Singh",
    department: "HR",
    category: "Travel",
    amount: 6800,
    date: "2026-09-18",
    description: "Travel for recruitment event",
    status: "Rejected",
    paymentMethod: "Bank Transfer",
    receipt: "travel-bill.pdf",
  },
  {
    id: 5,
    employeeName: "Vikas Kumar",
    department: "Marketing",
    category: "Equipment",
    amount: 9500,
    date: "2026-09-15",
    description: "Purchase of external monitor",
    status: "Approved",
    paymentMethod: "Bank Transfer",
    receipt: "monitor-invoice.pdf",
  },
  {
    id: 6,
    employeeName: "Anjali Verma",
    department: "Finance",
    category: "Office Supplies",
    amount: 3200,
    date: "2026-09-12",
    description: "Office stationery purchase",
    status: "Pending",
    paymentMethod: "Bank Transfer",
    receipt: "stationery.pdf",
  },
];

const categories = [
  "Travel",
  "Food",
  "Internet",
  "Equipment",
  "Office Supplies",
  "Medical",
  "Other",
];

function Reimbursements() {
  const [reimbursements, setReimbursements] = useState(
    initialReimbursements
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedReimbursement, setSelectedReimbursement] =
    useState(null);

  const [openMenu, setOpenMenu] = useState(null);

  const [formData, setFormData] = useState({
    employeeName: "",
    department: "",
    category: "Travel",
    amount: "",
    date: "",
    description: "",
    paymentMethod: "Bank Transfer",
    receipt: "",
  });

  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter((item) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        item.employeeName.toLowerCase().includes(searchText) ||
        item.department.toLowerCase().includes(searchText) ||
        item.description.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      const matchesCategory =
        categoryFilter === "All" ||
        item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [reimbursements, search, statusFilter, categoryFilter]);

  const pendingAmount = reimbursements
    .filter((item) => item.status === "Pending")
    .reduce((total, item) => total + item.amount, 0);

  const approvedAmount = reimbursements
    .filter((item) => item.status === "Approved")
    .reduce((total, item) => total + item.amount, 0);

  const paidAmount = reimbursements
    .filter((item) => item.status === "Paid")
    .reduce((total, item) => total + item.amount, 0);

  const totalAmount = reimbursements.reduce(
    (total, item) => total + item.amount,
    0
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusClasses = (status) => {
    if (status === "Pending") {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }

    if (status === "Approved") {
      return "bg-blue-50 text-blue-700 border-blue-200";
    }

    if (status === "Paid") {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (status === "Rejected") {
      return "bg-red-50 text-red-700 border-red-200";
    }

    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const resetForm = () => {
    setFormData({
      employeeName: "",
      department: "",
      category: "Travel",
      amount: "",
      date: "",
      description: "",
      paymentMethod: "Bank Transfer",
      receipt: "",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddReimbursement = (e) => {
    e.preventDefault();

    const newReimbursement = {
      id: Date.now(),
      ...formData,
      amount: Number(formData.amount),
      status: "Pending",
    };

    setReimbursements((prev) => [
      newReimbursement,
      ...prev,
    ]);

    resetForm();
    setShowAddModal(false);
  };

  const openEditModal = (item) => {
    setSelectedReimbursement(item);

    setFormData({
      employeeName: item.employeeName,
      department: item.department,
      category: item.category,
      amount: item.amount,
      date: item.date,
      description: item.description,
      paymentMethod: item.paymentMethod,
      receipt: item.receipt,
    });

    setShowEditModal(true);
    setOpenMenu(null);
  };

  const handleEditReimbursement = (e) => {
    e.preventDefault();

    setReimbursements((prev) =>
      prev.map((item) =>
        item.id === selectedReimbursement.id
          ? {
              ...item,
              ...formData,
              amount: Number(formData.amount),
            }
          : item
      )
    );

    setShowEditModal(false);
    setSelectedReimbursement(null);
    resetForm();
  };

  const handleDelete = (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this reimbursement?"
    );

    if (!confirmed) return;

    setReimbursements((prev) =>
      prev.filter((item) => item.id !== id)
    );

    setOpenMenu(null);
  };

  const updateStatus = (id, status) => {
    setReimbursements((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
            }
          : item
      )
    );

    setOpenMenu(null);

    if (selectedReimbursement?.id === id) {
      setSelectedReimbursement((prev) => ({
        ...prev,
        status,
      }));
    }
  };

  const openViewModal = (item) => {
    setSelectedReimbursement(item);
    setShowViewModal(true);
    setOpenMenu(null);
  };

  const closeAllModals = () => {
    setShowAddModal(false);
    setShowViewModal(false);
    setShowEditModal(false);
    setSelectedReimbursement(null);
    resetForm();
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reimbursements
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage employee expense reimbursements
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Plus size={18} />
          Add Reimbursement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          title="Total Reimbursements"
          value={formatCurrency(totalAmount)}
          icon={<Wallet size={20} />}
          iconClass="bg-slate-100 text-slate-700"
        />

        <SummaryCard
          title="Pending Amount"
          value={formatCurrency(pendingAmount)}
          icon={<Receipt size={20} />}
          iconClass="bg-amber-100 text-amber-700"
        />

        <SummaryCard
          title="Approved Amount"
          value={formatCurrency(approvedAmount)}
          icon={<Check size={20} />}
          iconClass="bg-blue-100 text-blue-700"
        />

        <SummaryCard
          title="Paid Amount"
          value={formatCurrency(paidAmount)}
          icon={<CreditCard size={20} />}
          iconClass="bg-emerald-100 text-emerald-700"
        />

      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search employee or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            onChange={(e) => setCategoryFilter(e.target.value)}
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

        <div className="overflow-x-auto">

          <table className="min-w-[1000px] w-full">

            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {filteredReimbursements.map((item) => (

                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50"
                >

                  <td className="px-5 py-4">

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {item.employeeName
                          .split(" ")
                          .map((name) => name[0])
                          .join("")
                          .slice(0, 2)}
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.employeeName}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.department}
                        </p>
                      </div>

                    </div>

                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {item.category}
                    </span>
                  </td>

                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {formatCurrency(item.amount)}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {formatDate(item.date)}
                  </td>

                  <td className="px-5 py-4">

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>

                  </td>

                  <td className="relative px-5 py-4 text-right">

                    <button
                      onClick={() =>
                        setOpenMenu(
                          openMenu === item.id ? null : item.id
                        )
                      }
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {openMenu === item.id && (

                      <div className="absolute right-5 top-12 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl">

                        <ActionButton
                          icon={<Eye size={15} />}
                          label="View"
                          onClick={() => openViewModal(item)}
                        />

                        <ActionButton
                          icon={<Pencil size={15} />}
                          label="Edit"
                          onClick={() => openEditModal(item)}
                        />

                        {item.status === "Pending" && (
                          <>
                            <ActionButton
                              icon={<Check size={15} />}
                              label="Approve"
                              onClick={() =>
                                updateStatus(item.id, "Approved")
                              }
                            />

                            <ActionButton
                              icon={<X size={15} />}
                              label="Reject"
                              onClick={() =>
                                updateStatus(item.id, "Rejected")
                              }
                            />
                          </>
                        )}

                        {item.status === "Approved" && (
                          <ActionButton
                            icon={<CreditCard size={15} />}
                            label="Mark as Paid"
                            onClick={() =>
                              updateStatus(item.id, "Paid")
                            }
                          />
                        )}

                        <ActionButton
                          danger
                          icon={<Trash2 size={15} />}
                          label="Delete"
                          onClick={() => handleDelete(item.id)}
                        />

                      </div>
                    )}

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

          {filteredReimbursements.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-slate-700">
                No reimbursements found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your search or filters.
              </p>
            </div>
          )}

        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {filteredReimbursements.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">
              {reimbursements.length}
            </span>{" "}
            reimbursements
          </p>
        </div>

      </div>

      {/* Add Modal */}
      {showAddModal && (
        <ReimbursementModal
          title="Add Reimbursement"
          submitText="Add Reimbursement"
          formData={formData}
          onChange={handleInputChange}
          onSubmit={handleAddReimbursement}
          onClose={closeAllModals}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <ReimbursementModal
          title="Edit Reimbursement"
          submitText="Save Changes"
          formData={formData}
          onChange={handleInputChange}
          onSubmit={handleEditReimbursement}
          onClose={closeAllModals}
        />
      )}

      {/* View Modal */}
      {showViewModal && selectedReimbursement && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">

          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Reimbursement Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  View expense reimbursement information
                </p>
              </div>

              <button
                onClick={closeAllModals}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <XCircle size={20} />
              </button>

            </div>

            <div className="space-y-6 p-6">

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
                    {selectedReimbursement.employeeName
                      .split(" ")
                      .map((name) => name[0])
                      .join("")
                      .slice(0, 2)}
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedReimbursement.employeeName}
                    </p>

                    <p className="text-sm text-slate-500">
                      {selectedReimbursement.department}
                    </p>
                  </div>

                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                    selectedReimbursement.status
                  )}`}
                >
                  {selectedReimbursement.status}
                </span>

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <DetailItem
                  label="Category"
                  value={selectedReimbursement.category}
                />

                <DetailItem
                  label="Amount"
                  value={formatCurrency(
                    selectedReimbursement.amount
                  )}
                />

                <DetailItem
                  label="Date"
                  value={formatDate(
                    selectedReimbursement.date
                  )}
                />

                <DetailItem
                  label="Payment Method"
                  value={
                    selectedReimbursement.paymentMethod
                  }
                />

                <DetailItem
                  label="Receipt"
                  value={
                    selectedReimbursement.receipt || "No receipt"
                  }
                />

                <DetailItem
                  label="Department"
                  value={selectedReimbursement.department}
                />

              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Description
                </p>

                <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {selectedReimbursement.description}
                </div>
              </div>

              {selectedReimbursement.status === "Pending" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedReimbursement.id,
                        "Rejected"
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <X size={17} />
                    Reject
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedReimbursement.id,
                        "Approved"
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Check size={17} />
                    Approve
                  </button>

                </div>
              )}

              {selectedReimbursement.status === "Approved" && (
                <div className="flex justify-end">

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedReimbursement.id,
                        "Paid"
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CreditCard size={17} />
                    Mark as Paid
                  </button>

                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  iconClass,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  danger = false,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function ReimbursementModal({
  title,
  submitText,
  formData,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">

      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter reimbursement details
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>

        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 p-6"
        >

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <InputField
              label="Employee Name"
              name="employeeName"
              value={formData.employeeName}
              onChange={onChange}
              placeholder="Enter employee name"
              required
            />

            <InputField
              label="Department"
              name="department"
              value={formData.department}
              onChange={onChange}
              placeholder="Enter department"
              required
            />

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Category
              </label>

              <select
                name="category"
                value={formData.category}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
                required
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <InputField
              label="Amount"
              name="amount"
              type="number"
              value={formData.amount}
              onChange={onChange}
              placeholder="Enter amount"
              required
            />

            <InputField
              label="Expense Date"
              name="date"
              type="date"
              value={formData.date}
              onChange={onChange}
              required
            />

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Payment Method
              </label>

              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              >
                <option value="Bank Transfer">
                  Bank Transfer
                </option>

                <option value="Cash">
                  Cash
                </option>

                <option value="Company Card">
                  Company Card
                </option>
              </select>
            </div>

          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Receipt
            </label>

            <input
              type="text"
              name="receipt"
              value={formData.receipt}
              onChange={onChange}
              placeholder="receipt.pdf"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Description
            </label>

            <textarea
              name="description"
              value={formData.description}
              onChange={onChange}
              rows="4"
              placeholder="Describe the expense..."
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {submitText}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
      />
    </div>
  );
}

export default Reimbursements;