import React, { useMemo, useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  IconSearch,
  IconBell,
  IconSun,
  IconMoon,
  IconEye,
} from '@tabler/icons-react';
import { getPredictiveSuggestions } from '../utils/predictiveSearch';
import { USER_GRANTS, getAllowedDepartments } from '../auth/departmentAccess';
import { useTheme } from '../hooks/useTheme';
import { useAuthUser } from './AuthGate';
import { getInitials } from '../utils/initials';

export interface TopNavHandle {
  focusSearch: () => void;
}

interface DisplayUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface TopNavProps {
  onSearchSubmit?: (query: string) => void;
  suggestionCorpus?: string[];
  showViewAs?: boolean;
  viewAsEmail?: string | null;
  onViewAsChange?: (email: string | null) => void;
  notificationCount?: number;
  onNotificationClick?: () => void;
  /** Identity to render in the avatar tile. Falls back to the authenticated user. */
  displayUser?: DisplayUser;
  /** True when an admin is viewing the app as another user. */
  isImpersonating?: boolean;
  /** Called when admin clicks the gold-ringed avatar to leave impersonation mode. */
  onClearImpersonation?: () => void;
}

const TopNav = forwardRef<TopNavHandle, TopNavProps>(({
  onSearchSubmit,
  suggestionCorpus = [],
  showViewAs,
  viewAsEmail,
  onViewAsChange,
  notificationCount = 0,
  onNotificationClick,
  displayUser,
  isImpersonating = false,
  onClearImpersonation,
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { user: authUser } = useAuthUser();
  const user = displayUser || authUser;

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
  }), []);

  // Cmd+K (mac) / Ctrl+K (everywhere else) focuses the search input.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
      if (!isCmdK) return;
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || '');
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  const suggestions = useMemo(
    () => getPredictiveSuggestions(searchQuery, suggestionCorpus, 6),
    [searchQuery, suggestionCorpus],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSuggestions(false);
    onSearchSubmit?.(searchQuery);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    onSearchSubmit?.(suggestion);
  };

  const viewAsOptions = useMemo(() => {
    return USER_GRANTS.map((g) => {
      const depts = getAllowedDepartments(g);
      const label = g.departments === 'ALL'
        ? `${g.email.split('@')[0]} (Admin)`
        : `${g.email.split('@')[0]} (${(depts as string[]).join(', ')})`;
      return { email: g.email, label };
    });
  }, []);

  const userInitials = getInitials(user?.name);

  return (
    <header className="flex items-center gap-3 px-5 h-11 border-b border-border bg-background shrink-0 sticky top-0 z-10">
      <form onSubmit={handleSubmit} className="relative flex-1 max-w-sm">
        <div
          className={`flex items-center gap-2 px-2.5 h-7 rounded-md border text-[12px] transition-colors ${
            searchFocused ? 'border-ring bg-background ring-2 ring-ring/30' : 'border-border bg-secondary/50'
          }`}
        >
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground w-full text-[12px]"
            placeholder="Search applications..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setSearchFocused(false);
              window.setTimeout(() => setShowSuggestions(false), 120);
            }}
          />
          <kbd className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border shrink-0 font-sans">{shortcutLabel}</kbd>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg z-20">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="w-full text-left px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-secondary transition-colors"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        {showViewAs && (
          <div className="flex items-center gap-1.5 mr-1">
            <IconEye className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={viewAsEmail || ''}
              onChange={(event) => onViewAsChange?.(event.target.value || null)}
              aria-label="View as user"
              className={`h-8 leading-none rounded-md border pl-2 pr-7 py-0 text-[12px] font-medium transition-colors max-w-[220px] truncate ${
                viewAsEmail
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-border bg-background text-foreground hover:bg-secondary/60'
              }`}
            >
              <option value="">My view</option>
              {viewAsOptions.map((opt) => (
                <option key={opt.email} value={opt.email}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          {theme === 'dark'
            ? <IconSun className="w-4 h-4 text-muted-foreground" />
            : <IconMoon className="w-4 h-4 text-muted-foreground" />}
        </button>

        <button
          type="button"
          onClick={onNotificationClick}
          aria-label={
            notificationCount > 0
              ? `${notificationCount} pending renewals in the next 30 days`
              : 'Notifications'
          }
          className="relative p-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          <IconBell className="w-4 h-4 text-muted-foreground" />
          {notificationCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-semibold"
            >
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {/* Avatar (image with initials fallback). When impersonating, click to exit. */}
        <button
          type="button"
          onClick={isImpersonating ? onClearImpersonation : undefined}
          aria-label={
            isImpersonating
              ? `Viewing as ${user?.name || 'user'} — click to exit`
              : user?.name ? `Signed in as ${user.name}` : 'Current user'
          }
          title={
            isImpersonating
              ? `Viewing as ${user?.name || 'user'} — click to exit`
              : user?.name || ''
          }
          className={`relative shrink-0 ml-0.5 rounded-full ${isImpersonating ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className={`w-7 h-7 rounded-full object-cover ${
                isImpersonating ? 'ring-2 ring-gold' : 'ring-1 ring-border'
              }`}
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            aria-hidden="true"
            style={{ display: user?.avatarUrl ? 'none' : 'flex' }}
            className={`w-7 h-7 rounded-full items-center justify-center text-[11px] font-semibold ${
              isImpersonating
                ? 'bg-gold/20 ring-2 ring-gold text-gold'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {userInitials}
          </div>
        </button>
      </div>
    </header>
  );
});

TopNav.displayName = 'TopNav';

export default TopNav;
