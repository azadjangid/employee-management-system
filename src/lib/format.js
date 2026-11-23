// Display helpers shared by the pages.

/** "2026-10-05" -> "05 Oct 2026" (no time-zone shift). */
export function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", options);
}

/** "18:15" -> "06:15 PM"; null -> "-". */
export function formatTime(value) {
  if (!value) return "-";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ₹ amount, whole rupees by default; pass 2 to show paise when there are any. */
export function formatCurrency(value, maxDecimals = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(Number(value) || 0);
}

/** Today's date as YYYY-MM-DD in the browser's time zone. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getInitials(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}
