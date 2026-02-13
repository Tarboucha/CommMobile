/**
 * Format a timestamp as relative time (e.g., "2h ago", "5d ago")
 * @param timestamp ISO timestamp string
 * @returns Formatted relative time string
 */
export function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  // Convert to seconds
  const seconds = Math.floor(diff / 1000);

  // Less than a minute
  if (seconds < 60) {
    return 'just now';
  }

  // Convert to minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  // Convert to hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  // Convert to days
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d`;
  }

  // Convert to months
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo`;
  }

  // Convert to years
  const years = Math.floor(months / 12);
  return `${years}y`;
}

/**
 * Format a timestamp as full date and time
 * @param timestamp ISO timestamp string
 * @returns Formatted date string (e.g., "Dec 29, 2025 at 3:45 PM")
 */
export function formatFullDateTime(timestamp: string): string {
  const date = new Date(timestamp);

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const formattedDate = date.toLocaleDateString('en-US', dateOptions);
  const formattedTime = date.toLocaleTimeString('en-US', timeOptions);

  return `${formattedDate} at ${formattedTime}`;
}
