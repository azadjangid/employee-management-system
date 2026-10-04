import { Routes, Route } from "react-router-dom";

import DashboardLayout from "../components/layout/DashboardLayout";
import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/Login";

import Dashboard from "../pages/Dashboard";
import Employees from "../pages/Employees";
import Attendance from "../pages/Attendance";
import Leaves from "../pages/Leaves";
import Reimbursements from "../pages/Reimbursements";
import Profile from "../pages/Profile";

function AppRoutes() {
  return (
    <Routes>

      {/* Public Routes */}

      <Route path="/login" element={<Login />} />


      {/* Protected Routes */}

      <Route element={<ProtectedRoute />}>

        <Route element={<DashboardLayout />}>

          <Route path="/" element={<Dashboard />} />

          <Route
            path="/employees"
            element={<Employees />}
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

    </Routes>
  );
}

export default AppRoutes;