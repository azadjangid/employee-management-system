import {
    LayoutDashboard,
    Users,
    CalendarCheck,
    CalendarDays,
    Receipt,
    UserCircle,
    X,
    LogOut,
} from "lucide-react";

import {
    NavLink,
    useNavigate,
} from "react-router-dom";

const menuItems = [
    {
        name: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
    },
    {
        name: "Employees",
        path: "/employees",
        icon: Users,
    },
    {
        name: "Attendance",
        path: "/attendance",
        icon: CalendarCheck,
    },
    {
        name: "Leaves",
        path: "/leaves",
        icon: CalendarDays,
    },
    {
        name: "Reimbursements",
        path: "/reimbursements",
        icon: Receipt,
    },
    {
        name: "Profile",
        path: "/profile",
        icon: UserCircle,
    },
];

function Sidebar({ isOpen, onClose }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("employeehub_auth");

        navigate("/login", {
            replace: true,
        });

        onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside
                className={`
                    fixed left-0 top-0 z-50 h-screen w-64
                    border-r border-slate-200 bg-white
                    transition-transform duration-300
                    lg:translate-x-0
                    ${isOpen
                        ? "translate-x-0"
                        : "-translate-x-full"
                    }
                `}
            >
                {/* Logo */}
                <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">

                    <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                            <span className="font-bold text-white">
                                E
                            </span>
                        </div>

                        <div>
                            <h1 className="text-sm font-bold text-slate-900">
                                EmployeeHub
                            </h1>

                            <p className="text-xs text-slate-500">
                                Management System
                            </p>
                        </div>

                    </div>

                    {/* Mobile Close */}
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                    >
                        <X size={20} />
                    </button>

                </div>

                {/* Navigation */}
                <nav className="space-y-1 p-4">

                    <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Main Menu
                    </p>

                    {menuItems.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={onClose}
                                className={({ isActive }) =>
                                    `
                                    flex items-center gap-3 rounded-lg px-3 py-2.5
                                    text-sm font-medium transition
                                    ${
                                        isActive
                                            ? "bg-blue-50 text-blue-600"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    }
                                    `
                                }
                            >
                                <Icon size={19} />

                                <span>
                                    {item.name}
                                </span>
                            </NavLink>
                        );
                    })}

                </nav>

                {/* Bottom User Card */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">

                    <div className="rounded-lg bg-slate-50 p-3">

                        <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                                <span className="text-sm font-semibold text-blue-600">
                                    AD
                                </span>
                            </div>

                            <div className="min-w-0">

                                <p className="truncate text-sm font-semibold text-slate-800">
                                    Admin User
                                </p>

                                <p className="truncate text-xs text-slate-500">
                                    Administrator
                                </p>

                            </div>

                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                            <LogOut size={16} />
                            Logout
                        </button>

                    </div>

                </div>

            </aside>
        </>
    );
}

export default Sidebar;