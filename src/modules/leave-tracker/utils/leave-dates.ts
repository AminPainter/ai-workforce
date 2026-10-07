const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = toUtcDate(date);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcDate(date).getTime() + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

export function isWeekend(date: string): boolean {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 || day === 6;
}

export function expandDateRange(
  start: string,
  end: string,
  maxDays: number,
): string[] {
  const dates: string[] = [];
  for (
    let date = start;
    date <= end && dates.length < maxDays;
    date = addDays(date, 1)
  )
    dates.push(date);
  return dates;
}

function nextWeekday(date: string): string {
  let next = addDays(date, 1);
  while (isWeekend(next)) next = addDays(next, 1);
  return next;
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(toUtcDate(date));
}

export function formatDateRanges(dates: string[]): string {
  const sorted = [...new Set(dates)].sort();
  const ranges: Array<[string, string]> = [];
  for (const date of sorted) {
    const last = ranges.at(-1);
    if (last && nextWeekday(last[1]) === date) last[1] = date;
    else ranges.push([date, date]);
  }
  return ranges
    .map(([start, end]) =>
      start === end
        ? formatShortDate(start)
        : `${formatShortDate(start)} to ${formatShortDate(end)}`,
    )
    .join(', ');
}
