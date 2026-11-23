import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { LoadingState } from "../common/States";

function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-64">
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 sm:p-6">
          <Suspense fallback={<LoadingState label="Loading page..." />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;