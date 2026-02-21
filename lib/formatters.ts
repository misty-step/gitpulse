export function formatReportDate(
  startDate: number,
  endDate: number,
  timeZone?: string
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const sameDay = start.toDateString() === end.toDateString();
  const tz = timeZone ? { timeZone } : {};

  if (sameDay) {
    return end.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      ...tz,
    });
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", ...tz })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...tz })}`;
}
