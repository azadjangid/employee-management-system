import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";

const ConfirmContext = createContext(null);

/**
 * In-app replacement for window.confirm().
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete?", message: "...", confirmLabel: "Delete", danger: true }))) return;
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    []
  );

  const close = (answer) => {
    request?.resolve(answer);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
          onKeyDown={(e) => e.key === "Escape" && close(false)}
        >
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  request.danger ? "bg-red-50" : "bg-blue-50"
                }`}
              >
                <AlertTriangle className={`h-5 w-5 ${request.danger ? "text-red-600" : "text-blue-600"}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{request.title ?? "Are you sure?"}</h2>
                {request.message && <p className="mt-1 text-sm text-slate-500">{request.message}</p>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => close(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                  request.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {request.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
