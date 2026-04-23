// All stream-end datetimes on the site are understood to be in Europe/Warsaw.
// The admin form uses <input type="datetime-local">, which strips the timezone,
// so we need to re-attach it here. This ensures the countdown ticks to the
// same absolute moment everywhere — a viewer in Warsaw, New York, and Tokyo
// all see the clock hit zero at the same instant.

const WARSAW_TZ = "Europe/Warsaw";

// Parses an ISO string as Europe/Warsaw local time and returns UTC ms.
// If the string already carries explicit TZ info (Z or ±HH:MM), it's parsed
// directly — admin can paste an offset-aware ISO if they want.
export function parseWarsawToMs(input: string | null | undefined): number | null {
  if (!input) return null;
  const iso = input.trim();
  if (!iso) return null;

  // Already has timezone suffix — trust it.
  if (/Z$|[+-]\d{2}:?\d{2}$/i.test(iso)) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : null;
  }

  // Naive ISO like "2026-04-26T16:00" or "2026-04-26T16:00:00".
  // Interpret those wall-clock digits as Europe/Warsaw.
  //
  // Trick: parse the naive string AS IF it were UTC, then measure the gap
  // between that instant and the same wall-clock time in Warsaw. The gap is
  // the Warsaw offset at that moment (handles CET/CEST automatically).
  const asUtcMs = Date.parse(iso + "Z");
  if (!Number.isFinite(asUtcMs)) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WARSAW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(asUtcMs));

  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  // `en-GB` formatToParts with hour12:false can return hour "24" at midnight;
  // normalize that to "00" and bump the day.
  let hour = m.hour;
  let day = m.day;
  if (hour === "24") hour = "00";

  const warsawWallClockUtc = Date.parse(
    `${m.year}-${m.month}-${day}T${hour}:${m.minute}:${m.second}Z`,
  );
  if (!Number.isFinite(warsawWallClockUtc)) return null;

  const offsetMs = warsawWallClockUtc - asUtcMs;
  return asUtcMs - offsetMs;
}

// Human-friendly Warsaw label for the admin dashboard ("Kończy się: Nd, 26 kwi 2026, 16:00").
export function formatWarsawLabel(input: string | null | undefined): string | null {
  const ms = parseWarsawToMs(input);
  if (ms == null) return null;
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: WARSAW_TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
