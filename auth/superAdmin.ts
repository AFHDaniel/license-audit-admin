const DEFAULT_SUPER_ADMIN = 'daniel@atlantafinehomes.com';

function readEnvOverride(): string {
  const env = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env)
    ? (import.meta as { env: Record<string, string> }).env
    : undefined;
  return (env?.VITE_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
}

export function getSuperAdminEmail(): string {
  return readEnvOverride() || DEFAULT_SUPER_ADMIN;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getSuperAdminEmail();
}
