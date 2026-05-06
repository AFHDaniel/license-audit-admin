export interface AuthUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

export type AuthClaims = Record<string, unknown>;

const EMAIL_CLAIM_KEYS = ['email', 'preferred_username', 'login', 'upn', 'unique_name'] as const;
const NAME_CLAIM_KEYS = ['name', 'displayName'] as const;

function claimString(source: AuthClaims | null | undefined, key: string): string {
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function firstClaimString(
  sources: Array<AuthClaims | null | undefined>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    for (const source of sources) {
      const value = claimString(source, key);
      if (value) return value;
    }
  }
  return '';
}

function resolveEmail(sources: Array<AuthClaims | null | undefined>): string {
  const candidates: string[] = [];

  for (const key of EMAIL_CLAIM_KEYS) {
    for (const source of sources) {
      const value = claimString(source, key);
      if (value) candidates.push(value);
    }
  }

  return (candidates.find((value) => value.includes('@')) || candidates[0] || '').toLowerCase();
}

function resolveName(sources: Array<AuthClaims | null | undefined>, email: string): string {
  const explicitName = firstClaimString(sources, NAME_CLAIM_KEYS);
  if (explicitName) return explicitName;

  for (const source of sources) {
    const givenName = claimString(source, 'given_name');
    const familyName = claimString(source, 'family_name');
    const fullName = [givenName, familyName].filter(Boolean).join(' ');
    if (fullName) return fullName;
  }

  return email ? email.split('@')[0] : '';
}

export function getAuthUserPictureFromClaims(
  ...sources: Array<AuthClaims | null | undefined>
): string | undefined {
  const picture = firstClaimString(sources, ['picture']);
  return picture || undefined;
}

export function resolveAuthUserFromClaims(
  ...sources: Array<AuthClaims | null | undefined>
): AuthUser {
  const email = resolveEmail(sources);

  return {
    name: resolveName(sources, email),
    email,
  };
}
