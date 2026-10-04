import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserCircle,
} from "lucide-react";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError("Please enter your email and password.");
      return;
    }

    /*
      Temporary frontend authentication.

      Later this will be replaced with:
      POST /api/auth/login
    */

    if (
      formData.email === "admin@employeehub.com" &&
      formData.password === "admin123"
    ) {
      localStorage.setItem(
        "employeehub_auth",
        JSON.stringify({
          isAuthenticated: true,
          user: {
            name: "Admin User",
            email: "admin@employeehub.com",
            role: "Administrator",
          },
        })
      );

      navigate("/");
      return;
    }

    setError("Invalid email or password.");
  };

  return (
    <div className="min-h-screen bg-slate-100">

      <div className="grid min-h-screen lg:grid-cols-2">

        {/* Left Section */}
        <div className="hidden bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-900">
                <UserCircle size={26} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-white">
                  EmployeeHub
                </h1>

                <p className="text-xs text-slate-400">
                  Management System
                </p>
              </div>

            </div>

          </div>

          <div className="max-w-lg">

            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Employee Management
            </p>

            <h2 className="text-4xl font-bold leading-tight text-white">
              Manage your workforce from one powerful dashboard.
            </h2>

            <p className="mt-6 text-base leading-7 text-slate-400">
              Manage employees, attendance, leaves, reimbursements,
              and organization information from a single platform.
            </p>

          </div>

          <p className="text-sm text-slate-500">
            © 2026 EmployeeHub. All rights reserved.
          </p>

        </div>

        {/* Right Section */}
        <div className="flex items-center justify-center p-5 sm:p-8">

          <div className="w-full max-w-md">

            {/* Mobile Logo */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                <UserCircle size={26} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  EmployeeHub
                </h1>

                <p className="text-xs text-slate-500">
                  Management System
                </p>
              </div>

            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">

              <div className="mb-8">

                <h2 className="text-2xl font-bold text-slate-900">
                  Welcome back
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Sign in to access your dashboard
                </p>

              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >

                {/* Email */}
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email Address
                  </label>

                  <div className="relative">

                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="admin@employeehub.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />

                  </div>

                </div>

                {/* Password */}
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className="relative">

                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 pr-11 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((prev) => !prev)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>

                  </div>

                </div>

                {/* Remember */}
                <div className="flex items-center justify-between">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">

                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />

                    Remember me

                  </label>

                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    Forgot password?
                  </button>

                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <LogIn size={18} />
                  Sign In
                </button>

              </form>

              {/* Demo Credentials */}
              <div className="mt-6 rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Demo Credentials
                </p>

                <div className="mt-2 space-y-1 text-sm text-slate-600">

                  <p>
                    <span className="font-semibold">
                      Email:
                    </span>{" "}
                    admin@employeehub.com
                  </p>

                  <p>
                    <span className="font-semibold">
                      Password:
                    </span>{" "}
                    admin123
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Login;