
import { formatInTimeZone } from 'date-fns-tz';

// Helper function to format game time
export function formatGameTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

// Helper function to get date in specific time zone (YYYY-MM-DD)
export function getDateInTimeZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}

// Helper function to check if a date falls on specific day in time zone
export function isDateOnDayInTimeZone(
  date: Date,
  targetDate: Date,
  timeZone: string
): boolean {
  const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
  const targetDateStr = formatInTimeZone(targetDate, timeZone, 'yyyy-MM-dd');
  return dateStr === targetDateStr;
}
