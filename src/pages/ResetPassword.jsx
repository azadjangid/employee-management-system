import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react";

import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import AuthCard from "../components/layout/AuthCard";

function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <AuthCard title="Invalid link" subtitle="This password reset link is missing its token.">
        <Link to="/forgot-password" className="block text-center text-sm font-semibold text-slate-900 hover:underline">
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password }, { skipAuthRedirect: true });
      toast.success("Password reset. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 pr-11 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  return (
    <AuthCard title="Choose a new password" subtitle="Use at least 8 characters." icon={KeyRound}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            {/expired|invalid/i.test(error) && (
              <Link to="/forgot-password" className="ml-1 font-semibold underline">
                Request a new link
              </Link>
            )}
          </div>
        )}

        {[
          ["New Password", password, setPassword, "new-password"],
          ["Confirm Password", confirm, setConfirm, "confirm-password"],
        ].map(([label, value, setter, id]) => (
          <div key={id}>
            <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">
              {label}
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id={id}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={value}
                onChange={(e) => {
                  setter(e.target.value);
                  setError("");
                }}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          Reset password
        </button>

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 hover:underline">
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}

export default ResetPassword;
