import { DepartmentGrant, License } from '../types';
import { hasCoOwnerAccess } from '../utils/licenseOwnership';

const ALL_DEPARTMENTS = [
  'IT',
  'Accounting',
  'Marketing',
  'Operations',
  'Listings',
  'Relocations',
  'Admin',
  'Property Management',
  'HR',
] as const;

const DEMO_DOMAIN = '@example.com';

const DEMO_GRANTS: ReadonlyArray<DepartmentGrant> = [
  { email: `it.lead${DEMO_DOMAIN}`, role: 'admin', departments: ['IT'] },
  { email: `ops.lead${DEMO_DOMAIN}`, role: 'manager', departments: ['Operations', 'Admin'] },
  { email: `marketing.lead${DEMO_DOMAIN}`, role: 'manager', departments: ['Marketing', 'Listings'] },
  { email: `accounting.lead${DEMO_DOMAIN}`, role: 'manager', departments: ['Accounting'] },
  { email: `admin1${DEMO_DOMAIN}`, role: 'admin', departments: 'ALL' },
  { email: `admin2${DEMO_DOMAIN}`, role: 'admin', departments: 'ALL' },
];

function parseGrantsFromEnv(): ReadonlyArray<DepartmentGrant> {
  // import.meta.env is Vite-only; falls back to DEMO_GRANTS in node:test.
  const raw = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env)
    ? (import.meta as { env: Record<string, string> }).env.VITE_USER_GRANTS_JSON
    : undefined;
  if (!raw) return DEMO_GRANTS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEMO_GRANTS;

    return parsed
      .filter((g): g is DepartmentGrant => {
        if (!g || typeof g !== 'object') return false;
        if (typeof g.email !== 'string' || !g.email) return false;
        if (g.role !== 'admin' && g.role !== 'manager') return false;
        if (g.departments !== 'ALL' && !Array.isArray(g.departments)) return false;
        return true;
      })
      .map((g) => ({ ...g, email: g.email.toLowerCase() }));
  } catch {
    return DEMO_GRANTS;
  }
}

const USER_GRANTS: ReadonlyArray<DepartmentGrant> = parseGrantsFromEnv();

const GRANT_BY_EMAIL = new Map<string, DepartmentGrant>(
  USER_GRANTS.map((grant) => [grant.email.toLowerCase(), grant]),
);

const ZERO_ACCESS_GRANT: DepartmentGrant = {
  email: '',
  role: 'manager',
  departments: [],
};

export function getDepartmentGrant(email: string | null | undefined): DepartmentGrant {
  if (!email) return ZERO_ACCESS_GRANT;
  const normalized = email.trim().toLowerCase();
  return GRANT_BY_EMAIL.get(normalized) || { ...ZERO_ACCESS_GRANT, email: normalized };
}

export function isAdmin(grant: DepartmentGrant): boolean {
  return grant.departments === 'ALL';
}

export function getAllowedDepartments(grant: DepartmentGrant): readonly string[] {
  if (grant.departments === 'ALL') return ALL_DEPARTMENTS;
  return grant.departments;
}

export function filterLicensesByGrant(licenses: readonly License[], grant: DepartmentGrant): License[] {
  if (grant.departments === 'ALL') return [...licenses];
  return licenses.filter((license) => canAccessLicense(license, grant));
}

export function canAccessLicense(license: License, grant: DepartmentGrant): boolean {
  if (grant.departments === 'ALL') return true;

  const allowed = new Set(grant.departments.map((d) => d.toLowerCase()));
  if (allowed.has((license.department || '').toLowerCase())) {
    return true;
  }

  return hasCoOwnerAccess(license, grant.email);
}

export { ALL_DEPARTMENTS, USER_GRANTS };
