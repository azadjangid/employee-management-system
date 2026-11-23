import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

/** Centered spinner for a section that is loading. */
export function LoadingState({ label = "Loading...", className = "py-16" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Error message with an optional retry button. */
export function ErrorState({ error, onRetry, className = "py-16" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-4 text-center ${className}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-5 w-5 text-red-600" />
      </div>
      <div>
        <p className="font-medium text-slate-800">Something went wrong</p>
        <p className="mt-1 text-sm text-slate-500">
          {error?.message || "Could not load data."}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description, className = "py-12" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-5 text-center ${className}`}>
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
  );
}

/** Inline error box for forms. */
export function FormError({ error }) {
  if (!error) return null;
  const details = error.details?.filter((d) => d.field) ?? [];
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="font-medium">{details.length > 1 ? "Please fix the following:" : error.message}</p>
      {details.length > 1 && (
        <ul className="mt-1 list-inside list-disc">
          {details.map((d) => (
            <li key={d.field}>{d.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Thin progress bar shown over a table while it refreshes with data already on screen. */
export function RefreshBar({ active }) {
  if (!active) return null;
  return (
    <div className="h-0.5 w-full animate-pulse bg-blue-500" />
  );
}
