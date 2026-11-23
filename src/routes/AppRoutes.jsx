import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/Login";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Employees = lazy(() => import("../pages/Employees"));
const Attendance = lazy(() => import("../pages/Attendance"));
const Leaves = lazy(() => import("../pages/Leaves"));
const Reimbursements = lazy(() => import("../pages/Reimbursements"));
const Profile = lazy(() => import("../pages/Profile"));
const Departments = lazy(() => import("../pages/Departments"));
const Payroll = lazy(() => import("../pages/Payroll"));
const AuditLogs = lazy(() => import("../pages/AuditLogs"));

function AppRoutes() {
  return (
    <Routes>

      {/* Public Routes */}

      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />


      {/* Protected Routes */}

      <Route element={<ProtectedRoute />}>

        <Route element={<DashboardLayout />}>

          <Route path="/" element={<Dashboard />} />

          {/* Admins and managers only */}
          <Route element={<ProtectedRoute roles={["admin", "manager"]} />}>
            <Route
              path="/employees"
              element={<Employees />}
            />
            <Route
              path="/departments"
              element={<Departments />}
            />
          </Route>

          {/* Admins only */}
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route
              path="/audit-logs"
              element={<AuditLogs />}
            />
          </Route>

          <Route
            path="/payroll"
            element={<Payroll />}
          />

          <Route
            path="/attendance"
            element={<Attendance />}
          />

          <Route
            path="/leaves"
            element={<Leaves />}
          />

          <Route
            path="/reimbursements"
            element={<Reimbursements />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

        </Route>

      </Route>

      {/* Unknown URLs go to the dashboard (or login if signed out) */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}

export default AppRoutes;