import { useCallback } from 'react';
import { useOktaAuth } from '@okta/okta-react';

export type TokenProvider = () => Promise<string | null>;

const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

/**
 * Returns a memoized callback that resolves the current Okta access token.
 * In dev with VITE_DEV_AUTH_BYPASS=true, returns a dev token instead so
 * local proxies that mock Okta keep working.
 */
export function useAccessTokenProvider(): TokenProvider {
  const { oktaAuth } = useOktaAuth();
  return useCallback(async () => {
    if (DEV_AUTH_BYPASS) {
      return (import.meta.env.VITE_DEV_ACCESS_TOKEN as string) || 'dev-bypass-token';
    }
    const token = oktaAuth.getAccessToken();
    return token || null;
  }, [oktaAuth]);
}
