import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";

import { api } from "../lib/api";
import AuthCard from "../components/layout/AuthCard";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email }, { skipAuthRedirect: true });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    // The API only returns devResetUrl outside production (no email provider yet).
    const devPath = result.devResetUrl && new URL(result.devResetUrl).pathname + new URL(result.devResetUrl).search;
    return (
      <AuthCard title="Check your email" subtitle={result.message} icon={MailCheck}>
        {devPath && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Development mode</p>
            <p className="mt-1">
              Email isn&apos;t set up yet, so here is the link that would have been sent (it is also printed in the
              server console):
            </p>
            <Link to={devPath} className="mt-2 inline-block font-semibold text-amber-900 underline">
              Reset my password
            </Link>
          </div>
        )}
        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your work email and we'll send you a link to reset it."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
            Email Address
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              name="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          Send reset link
        </button>

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}

export default ForgotPassword;
