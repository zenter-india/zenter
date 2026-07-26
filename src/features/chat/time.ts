/**
 * Chat time formatting (Epic 5). Ported from web `js/chat.js` (`formatRelativeTime`
 * for the conversation-list timestamp and `formatTime` for the bubble clock), but
 * formatted manually so they never depend on the RN Intl/`toLocale*` build.
 * Pure — no I/O, no React.
 */

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Conversation-row relative time: `now` / `Nm` / `Nh` / `Nd`, falling back to
 * `D Mon` (e.g. `5 Jul`) beyond a week — matching web `formatRelativeTime`.
 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/**
 * Message-bubble clock: 12-hour `h:mm AM/PM` — the web `formatTime`
 * (`toLocaleTimeString('2-digit','2-digit')`) rendered without Intl.
 */
export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${hr}:${mm} ${ampm}`;
}
