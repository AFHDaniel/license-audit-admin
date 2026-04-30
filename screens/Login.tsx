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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle brand wash */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #002349 0, transparent 40%), radial-gradient(circle at 80% 80%, #B89C47 0, transparent 35%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm mx-4 relative"
      >
        <div className="text-center mb-7">
          <img
            src="/brand/afh-vertical-blue.svg"
            alt="Atlanta Fine Homes Sotheby's International Realty"
            className="mx-auto h-24 w-auto mb-5 dark:hidden"
          />
          <img
            src="/brand/afh-vertical-white.svg"
            alt="Atlanta Fine Homes Sotheby's International Realty"
            className="mx-auto h-24 w-auto mb-5 hidden dark:block"
          />
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            Application Tracker
          </h1>
          <p className="text-[10px] text-accent uppercase tracking-[0.32em] mt-2 font-semibold">
            Atlanta Fine Homes
          </p>
        </div>

        <div
          className="rounded-xl border border-border bg-card p-6"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="text-center mb-5">
            <h2 className="text-sm font-semibold text-foreground">Welcome back</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Sign in to access the application tracker
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignIn}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground hover:opacity-95 hover:shadow-md transition-all"
          >
            <IconLogin className="w-4 h-4" />
            Sign in with Okta
          </button>

          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-center text-[10px] text-muted-foreground">
              Internal software application administration
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
