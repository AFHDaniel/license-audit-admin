import React, { useEffect, useState } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { IconLoader2, IconLock } from '@tabler/icons-react';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
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
  const { oktaAuth, authState } = useOktaAuth();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (authState?.isAuthenticated) {
      oktaAuth.getUser().then((info) => {
        setUser({
          name: (info.name as string) || '',
          email: (info.email as string) || '',
        });
      });
    }
  }, [oktaAuth, authState]);

  const signOut = () => oktaAuth.signOut();

  return { user, signOut, isAuthenticated: authState?.isAuthenticated ?? false };
}
