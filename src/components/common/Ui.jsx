import { useEffect } from "react";
import { X } from "lucide-react";

/** Dialog with a title bar. Closes on Escape or the X button. */
export function Modal({ title, subtitle, onClose, children, size = "max-w-xl" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:static print:block print:bg-white print:p-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${size} overflow-y-auto rounded-2xl bg-white shadow-2xl print:max-h-none print:max-w-none print:overflow-visible print:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value || "-"}</p>
    </div>
  );
}

export function SummaryCard({ title, value, icon, iconClass = "bg-slate-100 text-slate-700" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <h2 className="mt-2 truncate text-2xl font-bold text-slate-900">{value}</h2>
        </div>
        {icon && <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>}
      </div>
    </div>
  );
}

/** Pill-style tab switcher. tabs: [{ id, label }] */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            value === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const BADGE = {
  Draft: "bg-amber-50 text-amber-700 border-amber-200",
  Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status, className }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        className ?? BADGE[status] ?? "bg-slate-50 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}
