import { useEffect, useRef, useState } from 'react';

export interface PersonProfile {
  email: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
  /** URL the browser can use as <img src>. Falls back to initials when the photo 404s. */
  avatarUrl?: string;
}

interface CachedProfile {
  profile: PersonProfile | null;
  fetchedAtMs: number;
}

const PROFILE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CachedProfile>();

/**
 * Fetches a person's Microsoft Graph profile (display name, job title) and
 * builds a photo URL that the browser can lazily load. Returns `null` while
 * loading or when no email is supplied; a best-effort fallback profile when
 * Graph is unavailable.
 */
export function usePersonProfile(email: string | null | undefined): PersonProfile | null {
  const [profile, setProfile] = useState<PersonProfile | null>(() => {
    if (!email) return null;
    const cached = cache.get(email.toLowerCase());
    if (cached && Date.now() - cached.fetchedAtMs < PROFILE_TTL_MS) return cached.profile;
    return null;
  });
  const lastEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (!email) {
      setProfile(null);
      lastEmailRef.current = null;
      return;
    }
    const normalized = email.toLowerCase();
    lastEmailRef.current = normalized;

    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.fetchedAtMs < PROFILE_TTL_MS) {
      setProfile(cached.profile);
      return;
    }

    let cancelled = false;
    (async () => {
      let resolved: PersonProfile | null = null;
      try {
        const res = await fetch(`/api/profile/lookup?email=${encodeURIComponent(normalized)}`);
        if (res.ok) {
          const data = await res.json();
          resolved = {
            email: data.email || normalized,
            name: data.displayName || normalized,
            jobTitle: data.jobTitle || null,
            department: data.department || null,
            avatarUrl: `/api/profile/photo?email=${encodeURIComponent(normalized)}`,
          };
        }
      } catch {
        // Network failure — keep best-effort fallback below.
      }

      if (!resolved) {
        // Graceful fallback: use the email as the name so the UI still shows
        // *something* when Azure isn't configured.
        resolved = {
          email: normalized,
          name: normalized,
          avatarUrl: `/api/profile/photo?email=${encodeURIComponent(normalized)}`,
        };
      }

      cache.set(normalized, { profile: resolved, fetchedAtMs: Date.now() });
      if (cancelled) return;
      if (lastEmailRef.current !== normalized) return;
      setProfile(resolved);
    })();

    return () => { cancelled = true; };
  }, [email]);

  return profile;
}
