/**
 * Build a 1–2 char initials string from a person's display name.
 *
 * Skips non-alphabetic leading characters so names like
 * "Daniel (Local Admin)" return "D" rather than "D(".
 */
export function getInitials(name: string | null | undefined, fallback = 'U'): string {
  const raw = (name || '').trim();
  if (!raw) return fallback;

  const letters = raw
    .split(/\s+/)
    .map((word) => {
      const stripped = word.replace(/[^A-Za-z]/g, '');
      return stripped ? stripped[0].toUpperCase() : '';
    })
    .filter(Boolean);

  if (letters.length === 0) return fallback;
  return letters.slice(0, 2).join('');
}
