import { ArrowUpRight } from "lucide-react";

function StatsCard({
  title,
  value,
  change,
  description,
  icon: Icon,
  iconBg,
  iconColor,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </h2>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
          <ArrowUpRight className="h-4 w-4" />
          {change}
        </span>

        <span className="text-sm text-slate-400">
          {description}
        </span>
      </div>
    </div>
  );
}

export default StatsCard;