import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Security, LoginCallback, useOktaAuth } from '@okta/okta-react';
import { toRelativeUrl } from '@okta/okta-auth-js';
import { IconLoader2 } from '@tabler/icons-react';
import { oktaAuth } from './services/oktaConfig';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './components/ToastProvider';
import Login from './screens/Login';
import App from './App';

const DEV_AUTH_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true';

const RequireAuth: React.FC = () => {
  if (DEV_AUTH_BYPASS) {
    return <Outlet />;
  }

  const { authState } = useOktaAuth();

  if (!authState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <IconLoader2 className="mx-auto size-10 text-muted-foreground animate-spin" strokeWidth={1.5} />
          <p className="text-sm font-medium text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const navigate = useNavigate();

  const restoreOriginalUri = (_oktaAuth: unknown, originalUri: string) => {
    navigate(toRelativeUrl(originalUri || '/dashboard', window.location.origin), { replace: true });
  };

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<App />} />
          <Route path="/inventory" element={<App />} />
          <Route path="/analytics" element={<App />} />
          <Route path="/export" element={<App />} />
          <Route path="/license/:id" element={<App />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Security>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
