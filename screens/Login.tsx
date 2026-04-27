import React from 'react';
import { motion } from 'framer-motion';
import { useOktaAuth } from '@okta/okta-react';
import { IconLogin } from '@tabler/icons-react';

const Login: React.FC = () => {
  const { oktaAuth } = useOktaAuth();

  const handleSignIn = () => {
    oktaAuth.signInWithRedirect({ originalUri: '/dashboard' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm mx-4"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-bold mb-4">
            A
          </div>
          <h1 className="font-display text-3xl tracking-tight text-foreground">AuditAdmin</h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em] mt-1">
            Enterprise Suite
          </p>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-6"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="text-center mb-5">
            <h2 className="text-sm font-semibold text-foreground">Welcome back</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Sign in to access the audit dashboard</p>
          </div>

          <button
            type="button"
            onClick={handleSignIn}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <IconLogin className="w-4 h-4" />
            Sign in with Okta
          </button>

          <p className="text-center text-[10px] text-muted-foreground mt-5">
            Software audit administration
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
