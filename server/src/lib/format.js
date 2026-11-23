// Text helpers for notification and email copy.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-05" -> "5 Oct" */
export const shortDate = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export const describeRange = (from, to) =>
  from === to ? shortDate(from) : `${shortDate(from)} - ${shortDate(to)}`;

export const formatAmount = (n) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
