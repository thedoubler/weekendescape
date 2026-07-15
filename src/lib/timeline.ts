export type TimelineMonths = 1 | 2 | 3 | 6;

function formatTequilaDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function timelineRange(
  months: number,
  today: Date
): { dateFrom: string; dateTo: string } {
  const to = new Date(today);
  to.setMonth(to.getMonth() + months);
  return { dateFrom: formatTequilaDate(today), dateTo: formatTequilaDate(to) };
}
