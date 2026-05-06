import React, { useEffect, useState } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { IconLoader2, IconLock } from '@tabler/icons-react';
import {
  AuthClaims,
  AuthUser,
  getAuthUserPictureFromClaims,
  resolveAuthUserFromClaims,
} from '../auth/authUser';

interface AuthGateProps {
  children: React.ReactNode;
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
      isLoading: false,
    };
  }

  const { oktaAuth, authState } = useOktaAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isUserLoaded, setIsUserLoaded] = useState(false);

  useEffect(() => {
    if (!authState?.isAuthenticated) {
      setUser(null);
      setIsUserLoaded(false);
      return;
    }

    let cancelled = false;
    setIsUserLoaded(false);

    (async () => {
      const tokenClaims = [
        authState.idToken?.claims as AuthClaims | undefined,
        authState.accessToken?.claims as AuthClaims | undefined,
      ];
      let info: AuthClaims | null = null;

      try {
        info = await oktaAuth.getUser();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[okta] userinfo lookup failed; using token claims only.', error);
      }

      const resolvedUser = resolveAuthUserFromClaims(info, ...tokenClaims);
      // Prefer the OIDC `picture` claim if Okta is mapped to AAD photos.
      const oidcPicture = getAuthUserPictureFromClaims(info, ...tokenClaims);
      const graphPhoto = oidcPicture || !resolvedUser.email
        ? undefined
        : await fetchGraphAvatarUrl(resolvedUser.email);

      if (cancelled) return;
      setUser({
        ...resolvedUser,
        avatarUrl: oidcPicture || graphPhoto,
      });
      setIsUserLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [oktaAuth, authState]);

  const signOut = () => oktaAuth.signOut();

  return {
    user,
    signOut,
    isAuthenticated: authState?.isAuthenticated ?? false,
    isLoading: Boolean(authState?.isAuthenticated && !isUserLoaded),
  };
}
