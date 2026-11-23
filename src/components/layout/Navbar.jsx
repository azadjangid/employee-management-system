import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  Bell,
  Search,
  ChevronDown,
  Loader2,
  Users,
  CalendarDays,
  Receipt,
  UserCircle,
  LogOut,
  CheckCheck,
} from "lucide-react";

import { useAuth, initials, ROLE_LABELS } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { useApiQuery, useDebounce } from "../../hooks/useApi";

/** Close a popover when clicking outside it or pressing Escape. */
function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function Navbar({ onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Notifications />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}

function GlobalSearch() {
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const q = useDebounce(term.trim(), 250);
  useDismiss(ref, open, () => setOpen(false));

  const { data, loading, error } = useApiQuery(
    (signal) => api.get("/search", { q }, { signal }),
    [q],
    { enabled: q.length > 0 }
  );

  const go = (path) => {
    setOpen(false);
    setTerm("");
    navigate(path);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    // Enter: open the most relevant list page filtered by the search term.
    const target = canManage && (!data || data.employees.length) ? "/employees" : "/leaves";
    go(`${target}?search=${encodeURIComponent(term.trim())}`);
  };

  const groups = data
    ? [
        {
          label: "Employees",
          icon: Users,
          items: data.employees.map((e) => ({
            key: `e${e.id}`,
            title: e.name,
            sub: [e.employeeCode, e.designation, e.department].filter(Boolean).join(" · "),
            path: `/employees?search=${encodeURIComponent(e.name)}`,
          })),
        },
        {
          label: "Leave requests",
          icon: CalendarDays,
          items: data.leaves.map((l) => ({
            key: `l${l.id}`,
            title: `${l.employeeName} · ${l.leaveType}`,
            sub: `${l.fromDate} → ${l.toDate} · ${l.status}`,
            path: `/leaves?search=${encodeURIComponent(l.employeeName)}`,
          })),
        },
        {
          label: "Reimbursements",
          icon: Receipt,
          items: data.reimbursements.map((r) => ({
            key: `r${r.id}`,
            title: `${r.employeeName} · ${formatCurrency(r.amount)}`,
            sub: `${r.category} · ${r.description} · ${r.status}`,
            path: `/reimbursements?search=${encodeURIComponent(r.description)}`,
          })),
        },
      ].filter((g) => g.items.length)
    : [];

  const showPanel = open && q.length > 0;

  return (
    <div ref={ref} className="relative hidden md:block">
      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
        <Search size={18} className="text-slate-400" />
        <input
          type="search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={canManage ? "Search people, leaves, claims..." : "Search your leaves and claims..."}
          className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-400"
          aria-label="Search"
        />
        {loading && q && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </form>

      {showPanel && (
        <div className="absolute left-0 top-12 z-40 max-h-[70vh] w-[26rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {error ? (
            <p className="px-3 py-4 text-sm text-red-600">{error.message}</p>
          ) : !data || (loading && !groups.length) ? (
            <p className="px-3 py-4 text-sm text-slate-500">Searching...</p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">No results for &ldquo;{q}&rdquo;</p>
          ) : (
            groups.map(({ label, icon: Icon, items }) => (
              <div key={label} className="py-1">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                {items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => go(item.path)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                      <span className="block truncate text-xs text-slate-500">{item.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const POLL_MS = 60_000;

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Notifications() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  const { data, meta, loading, error, reload, setData } = useApiQuery(
    (signal) => api.get("/notifications", { limit: 15 }, { signal }),
    []
  );
  const [unreadOverride, setUnreadOverride] = useState(null);
  const unread = unreadOverride ?? meta?.unread ?? 0;

  // Check for new notifications every minute.
  useEffect(() => {
    const t = setInterval(() => {
      setUnreadOverride(null);
      reload();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const markRead = async (n) => {
    if (!n.readAt) {
      setData((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnreadOverride(Math.max(0, unread - 1));
      api.post(`/notifications/${n.id}/read`).catch(() => {});
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    setData((list) => list.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnreadOverride(0);
    api.post("/notifications/read-all").catch(() => {});
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) {
            setUnreadOverride(null);
            reload();
          }
        }}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={21} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                <CheckCheck size={14} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && !data ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Loading...</p>
            ) : error && !data ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">{error.message}</p>
            ) : !data?.length ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
            ) : (
              data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${
                    n.readAt ? "" : "bg-blue-50/40"
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-blue-500"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600">
          <span className="text-sm font-semibold text-white">{initials(user?.name)}</span>
        </div>

        <div className="hidden text-left sm:block">
          <p className="text-sm font-semibold text-slate-800">{user?.firstName}</p>
          <p className="text-xs text-slate-500">{user?.designation}</p>
        </div>

        <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              {ROLE_LABELS[user?.role]}
            </p>
          </div>
          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <UserCircle size={16} />
            My Profile
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default Navbar;
