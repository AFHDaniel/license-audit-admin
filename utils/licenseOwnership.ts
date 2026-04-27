import { License } from '../types';

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function emailLocalPart(email: string): string {
  const at = email.indexOf('@');
  return at === -1 ? email : email.slice(0, at);
}

function firstNameToken(name: string | null | undefined): string {
  return String(name || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
}

export function hasCoOwnerAccess(license: License, email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  const localPart = emailLocalPart(normalizedEmail);

  return (license.coOwners || []).some((coOwner) => {
    const coEmail = normalizeEmail(coOwner.email);
    if (coEmail && coEmail === normalizedEmail) return true;

    // Text-column co-owners come through with no email -- match by first-name token
    // against the email local part (e.g. "Beth" -> "beth@example.com").
    if (!coEmail && localPart) {
      const coFirst = firstNameToken(coOwner.name);
      if (coFirst && coFirst === localPart) return true;
    }
    return false;
  });
}

export function getLicenseReminderRecipients(license: License): string[] {
  const recipients = new Set<string>();

  for (const coOwner of license.coOwners || []) {
    const normalizedEmail = normalizeEmail(coOwner.email);
    if (normalizedEmail) {
      recipients.add(normalizedEmail);
    }
  }

  return Array.from(recipients);
}
