import {
  Users,
  UserCheck,
  CalendarDays,
  Clock3,
} from "lucide-react";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import StatsCard from "../components/common/StatsCard";

const attendanceData = [
  {
    day: "Mon",
    present: 102,
    absent: 8,
  },
  {
    day: "Tue",
    present: 108,
    absent: 2,
  },
  {
    day: "Wed",
    present: 98,
    absent: 12,
  },
  {
    day: "Thu",
    present: 110,
    absent: 0,
  },
  {
    day: "Fri",
    present: 105,
    absent: 5,
  },
  {
    day: "Sat",
    present: 70,
    absent: 10,
  },
];

const departmentData = [
  {
    name: "Engineering",
    value: 45,
  },
  {
    name: "Design",
    value: 20,
  },
  {
    name: "Marketing",
    value: 18,
  },
  {
    name: "HR",
    value: 12,
  },
  {
    name: "Sales",
    value: 25,
  },
];

const recentEmployees = [
  {
    id: 1,
    name: "Rahul Sharma",
    role: "Frontend Developer",
    department: "Engineering",
    status: "Active",
  },
  {
    id: 2,
    name: "Priya Mehta",
    role: "UI/UX Designer",
    department: "Design",
    status: "Active",
  },
  {
    id: 3,
    name: "Amit Patel",
    role: "Backend Developer",
    department: "Engineering",
    status: "Active",
  },
  {
    id: 4,
    name: "Neha Singh",
    role: "HR Executive",
    department: "HR",
    status: "On Leave",
  },
  {
    id: 5,
    name: "Vikas Kumar",
    role: "Sales Executive",
    department: "Sales",
    status: "Active",
  },
];

const leaveRequests = [
  {
    id: 1,
    name: "Rahul Sharma",
    type: "Casual Leave",
    dates: "Oct 2 - Oct 3",
    days: 2,
  },
  {
    id: 2,
    name: "Priya Mehta",
    type: "Sick Leave",
    dates: "Oct 4",
    days: 1,
  },
  {
    id: 3,
    name: "Amit Patel",
    type: "Earned Leave",
    dates: "Oct 7 - Oct 9",
    days: 3,
  },
];

const pieColors = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#ea580c",
];

function Dashboard() {
  return (
    <div className="space-y-6">

      {/* Header */}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Welcome back, Admin. Here is what's happening today.
        </p>
      </div>

      {/* Statistics */}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

        <StatsCard
          title="Total Employees"
          value="120"
          change="+8.2%"
          description="vs last month"
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatsCard
          title="Present Today"
          value="98"
          change="+4.5%"
          description="vs yesterday"
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />

        <StatsCard
          title="On Leave"
          value="12"
          change="-2.4%"
          description="vs last week"
          icon={CalendarDays}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />

        <StatsCard
          title="Pending Requests"
          value="7"
          change="+3"
          description="new requests"
          icon={Clock3}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />

      </div>

      {/* Charts */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Attendance Chart */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">

          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Attendance Overview
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Employee attendance for this week
            </p>
          </div>

          <div className="h-80">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart data={attendanceData}>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="present"
                  stroke="#2563eb"
                  fill="#dbeafe"
                  strokeWidth={2}
                />

                <Area
                  type="monotone"
                  dataKey="absent"
                  stroke="#f97316"
                  fill="#ffedd5"
                  strokeWidth={2}
                />

              </AreaChart>
            </ResponsiveContainer>

          </div>

        </div>

        {/* Department Chart */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Departments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Employees by department
            </p>
          </div>

          <div className="h-80">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>

                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {departmentData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={pieColors[index]}
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend
                  verticalAlign="bottom"
                  height={36}
                />

              </PieChart>
            </ResponsiveContainer>

          </div>

        </div>

      </div>

      {/* Bottom Section */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Recent Employees */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">

          <div className="flex items-center justify-between border-b border-slate-200 p-5">

            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Employees
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Recently added employees
              </p>
            </div>

            <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              View All
            </button>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[650px]">

              <thead className="bg-slate-50">

                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Department
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {recentEmployees.map((employee) => (

                  <tr
                    key={employee.id}
                    className="hover:bg-slate-50"
                  >

                    <td className="px-5 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
                          {employee.name
                            .split(" ")
                            .map((word) => word[0])
                            .join("")}
                        </div>

                        <div>
                          <p className="font-medium text-slate-900">
                            {employee.name}
                          </p>
                        </div>

                      </div>

                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.department}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {employee.role}
                    </td>

                    <td className="px-5 py-4">

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          employee.status === "Active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {employee.status}
                      </span>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

        {/* Leave Requests */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">

            <h2 className="text-lg font-semibold text-slate-900">
              Pending Leave Requests
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Requests waiting for approval
            </p>

          </div>

          <div className="divide-y divide-slate-100">

            {leaveRequests.map((request) => (

              <div
                key={request.id}
                className="p-5"
              >

                <div className="flex items-start justify-between gap-3">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">
                      {request.name
                        .split(" ")
                        .map((word) => word[0])
                        .join("")}
                    </div>

                    <div>

                      <p className="font-medium text-slate-900">
                        {request.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {request.type}
                      </p>

                    </div>

                  </div>

                  <span className="text-xs font-medium text-slate-500">
                    {request.days} day
                    {request.days > 1 ? "s" : ""}
                  </span>

                </div>

                <p className="mt-3 text-sm text-slate-500">
                  {request.dates}
                </p>

                <div className="mt-3 flex gap-2">

                  <button className="flex-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
                    Approve
                  </button>

                  <button className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100">
                    Reject
                  </button>

                </div>

              </div>

            ))}

          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;