import React, { useEffect, useState } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { IconLoader2, IconLock } from '@tabler/icons-react';

interface AuthGateProps {
  children: React.ReactNode;
}

interface AuthUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

const DEV_USER_BASE = {
  email: (import.meta.env.VITE_DEV_AUTH_USER_EMAIL as string) || 'daniel@atlantafinehomes.com',
  name: (import.meta.env.VITE_DEV_AUTH_USER_NAME as string) || 'Daniel (Local Admin)',
  avatarUrl: (import.meta.env.VITE_DEV_AUTH_USER_PHOTO_URL as string) || undefined,
};

/**
 * Resolve a user's avatar URL via the server's Graph proxy. Returns `undefined`
 * when no photo is available so callers can fall back to initials.
 */
async function fetchGraphAvatarUrl(email: string): Promise<string | undefined> {
  if (!email) return undefined;
  try {
    const res = await fetch(`/api/profile/photo?email=${encodeURIComponent(email)}`);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return undefined;
  }
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  if (DEV_AUTH_BYPASS) {
    return <>{children}</>;
  }

  const { oktaAuth, authState } = useOktaAuth();

  useEffect(() => {
    if (authState === null) return;
    if (authState.isAuthenticated) return;

    oktaAuth.signInWithRedirect();
  }, [oktaAuth, authState]);

  if (authState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <IconLoader2 className="mx-auto size-10 text-muted-foreground animate-spin" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="mx-auto size-12 rounded-md bg-muted flex items-center justify-center">
            <IconLock size={22} className="text-muted-foreground" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Redirecting to sign-in...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGate;

export function useAuthUser() {
  // Dev bypass: render as a configured admin and pull the photo from Graph
  // so local matches production end-to-end.
  if (DEV_AUTH_BYPASS) {
    const [user, setUser] = useState<AuthUser>(DEV_USER_BASE);

    useEffect(() => {
      // If a photo URL was hard-coded via env, respect it; otherwise hit Graph.
      if (DEV_USER_BASE.avatarUrl) return;
      let cancelled = false;
      (async () => {
        const avatarUrl = await fetchGraphAvatarUrl(DEV_USER_BASE.email);
        if (cancelled || !avatarUrl) return;
        setUser((prev) => ({ ...prev, avatarUrl }));
      })();
      return () => { cancelled = true; };
    }, []);

    return {
      user,
      signOut: () => {
        // eslint-disable-next-line no-console
        console.warn('[dev bypass] signOut() ignored — auth is disabled in this build.');
      },
      isAuthenticated: true,
    };
  }

  const { oktaAuth, authState } = useOktaAuth();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!authState?.isAuthenticated) return;

    let cancelled = false;
    (async () => {
      const info = await oktaAuth.getUser();
      const email = (info.email as string) || '';
      // Prefer the OIDC `picture` claim if Okta is mapped to AAD photos.
      const oidcPicture = (info.picture as string) || undefined;
      const graphPhoto = oidcPicture ? undefined : await fetchGraphAvatarUrl(email);

      if (cancelled) return;
      setUser({
        name: (info.name as string) || '',
        email,
        avatarUrl: oidcPicture || graphPhoto,
      });
    })();

    return () => { cancelled = true; };
  }, [oktaAuth, authState]);

  const signOut = () => oktaAuth.signOut();

  return { user, signOut, isAuthenticated: authState?.isAuthenticated ?? false };
}
