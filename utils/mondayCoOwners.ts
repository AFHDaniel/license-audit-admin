import { LicenseCoOwner } from '../types';

interface MondayUserRecord {
  id: string;
  name: string;
  email: string;
}

interface MondayColumnEntry {
  text?: string | null;
  value?: unknown;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '').trim();
}

function parseNamesFromText(text: string | null | undefined): string[] {
  return String(text || '')
    .split(',')
    .map((part) => normalizeName(part))
    .filter(Boolean);
}

function uniqueCoOwners(coOwners: LicenseCoOwner[]): LicenseCoOwner[] {
  const seen = new Set<string>();
  const result: LicenseCoOwner[] = [];

  for (const coOwner of coOwners) {
    const email = normalizeEmail(coOwner.email);
    const name = normalizeName(coOwner.name);
    const dedupeKey = email || `name:${name.toLowerCase()}`;
    if (!dedupeKey || seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    result.push({
      name,
      email,
    });
  }

  return result;
}

function readPeopleEntries(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray((value as { personsAndTeams?: unknown }).personsAndTeams)) {
    return (value as { personsAndTeams: Array<Record<string, unknown>> }).personsAndTeams;
  }

  if (Array.isArray((value as { persons_and_teams?: unknown }).persons_and_teams)) {
    return (value as { persons_and_teams: Array<Record<string, unknown>> }).persons_and_teams;
  }

  return [];
}

export function resolveCoOwnersFromMondayColumn(
  column: MondayColumnEntry | null | undefined,
  userDirectory: Map<string, MondayUserRecord>,
): LicenseCoOwner[] {
  if (!column) return [];

  const namesFromText = parseNamesFromText(column.text);
  const resolved: LicenseCoOwner[] = [];

  for (const person of readPeopleEntries(column.value)) {
    const id = String(person.id || '').trim();
    const directName = normalizeName(
      typeof person.name === 'string'
        ? person.name
        : typeof person.display_name === 'string'
          ? person.display_name
          : '',
    );
    const directEmail = normalizeEmail(
      typeof person.email === 'string'
        ? person.email
        : typeof person.user_email === 'string'
          ? person.user_email
          : '',
    );

    const matchedUser = id ? userDirectory.get(id) : null;
    resolved.push({
      name: directName || matchedUser?.name || '',
      email: directEmail || matchedUser?.email || '',
    });
  }

  if (resolved.length > 0) {
    return uniqueCoOwners(resolved);
  }

  return uniqueCoOwners(
    namesFromText.map((name) => ({
      name,
      email: '',
    })),
  );
}
