import React, { useEffect, useRef, useState } from 'react';
import {
  IconHome,
  IconListDetails,
  IconChartBar,
  IconDownload,
  IconDotsVertical,
  IconLogout,
} from '@tabler/icons-react';
import { View } from '../types';
import { useAuthUser } from './AuthGate';
import { getDepartmentGrant, isAdmin as checkIsAdmin, getAllowedDepartments } from '../auth/departmentAccess';
import { getInitials } from '../utils/initials';

interface DisplayUser {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface SidebarProps {
  activeView: View;
  setView: (view: View) => void;
  inventoryCount?: number;
  /** Identity to render in the user button. Falls back to the authenticated user. */
  displayUser?: DisplayUser;
  /** True when an admin is viewing the app as another user. */
  isImpersonating?: boolean;
  /** Called when the admin wants to leave impersonation mode. */
  onClearImpersonation?: () => void;
}

type TablerIcon = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;

interface NavItem {
  id: View;
  label: string;
  Icon: TablerIcon;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setView,
  inventoryCount,
  displayUser,
  isImpersonating = false,
  onClearImpersonation,
}) => {
  const { user: authUser, signOut } = useAuthUser();
  const user = displayUser || authUser;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = menuContainerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const grant = getDepartmentGrant(user?.email);
  const admin = checkIsAdmin(grant);
  const departments = getAllowedDepartments(grant) as string[];

  const navItems: NavItem[] = [
    { id: View.DASHBOARD, label: 'Dashboard', Icon: IconHome },
    { id: View.INVENTORY, label: 'Inventory', Icon: IconListDetails },
    { id: View.ANALYTICS, label: 'Analytics', Icon: IconChartBar },
    { id: View.EXPORT, label: 'Export', Icon: IconDownload },
  ];

  const displayName = user?.name?.split(/\s+/)[0] || 'User';
  const initials = getInitials(user?.name);
  const roleLabel = admin ? 'Admin' : 'Manager';
  const roleDetail = admin ? 'All departments' : departments.join(', ') || 'No access';

  return (
    <aside className="w-60 flex flex-col bg-sidebar text-sidebar-foreground shrink-0 h-screen border-r border-sidebar-border">
      {/* Logo / brand */}
      <button
        type="button"
        onClick={() => setView(View.DASHBOARD)}
        aria-label="Application Tracker — go to dashboard"
        className="flex items-center gap-2 px-5 pt-5 pb-4 w-full hover:bg-sidebar-accent/40 transition-colors text-left"
      >
        <img
          src="/brand/afh-horizontal-white.svg"
          alt="Atlanta Fine Homes Application Tracker"
          className="h-8 w-auto"
        />
      </button>

      <div className="mx-3 mb-2 h-px bg-sidebar-border/70" aria-hidden="true" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map(({ id, label, Icon }) => {
            const active = activeView === id
              || (id === View.INVENTORY && activeView === View.LICENSE_DETAIL);
            const showBadge = id === View.INVENTORY && typeof inventoryCount === 'number' && inventoryCount > 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors relative ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-sidebar-primary"
                  />
                )}
                <Icon className={`w-4 h-4 ${active ? 'text-sidebar-primary' : ''}`} />
                {label}
                {showBadge && (
                  <span className="ml-auto text-[10px] bg-sidebar-primary/20 text-sidebar-primary px-1.5 py-0.5 rounded-full font-medium tabular-nums">
                    {inventoryCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-sidebar-border relative" ref={menuContainerRef}>
        {isImpersonating && (
          <div className="mb-2 px-2.5 py-1.5 rounded-md bg-gold/15 border border-gold/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold">
                Viewing as
              </span>
              {onClearImpersonation && (
                <button
                  type="button"
                  onClick={onClearImpersonation}
                  className="text-[9px] font-semibold text-gold/90 hover:text-gold underline-offset-2 hover:underline"
                  aria-label="Exit impersonation"
                >
                  Exit (Esc)
                </button>
              )}
            </div>
            <div className="text-[10px] text-sidebar-foreground/70 mt-0.5 truncate">
              Logged in as {authUser?.email || authUser?.name || 'admin'}
            </div>
          </div>
        )}
        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-full left-3 right-3 mb-2 rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[11px] font-medium text-foreground truncate">{user?.name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{roleDetail}</p>
            </div>
            {isImpersonating && onClearImpersonation && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onClearImpersonation();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gold hover:bg-secondary transition-colors border-b border-border"
              >
                Exit impersonation
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-foreground hover:bg-secondary transition-colors"
            >
              <IconLogout className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={isImpersonating ? `Viewing as ${user?.name}. Click for menu.` : `Account menu for ${user?.name || 'user'}`}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
            isImpersonating
              ? 'bg-gold/10 hover:bg-gold/15 ring-1 ring-gold/30'
              : 'hover:bg-sidebar-accent/60'
          }`}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.name || 'User avatar'}
              className={`w-7 h-7 rounded-full object-cover shrink-0 ${
                isImpersonating ? 'ring-2 ring-gold' : 'ring-1 ring-sidebar-primary/40'
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
            className={`w-7 h-7 rounded-full items-center justify-center text-[11px] font-semibold shrink-0 ${
              isImpersonating
                ? 'bg-gold/20 ring-2 ring-gold text-gold'
                : 'bg-sidebar-primary/15 ring-1 ring-sidebar-primary/40 text-sidebar-primary'
            }`}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <div className="text-[12px] font-medium text-sidebar-foreground truncate">{displayName}</div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1 py-[1px] rounded ${
                admin ? 'bg-sidebar-primary/20 text-sidebar-primary' : 'bg-sidebar-accent text-sidebar-foreground/70'
              }`}>
                {roleLabel}
              </span>
            </div>
            <div className="text-[10px] text-sidebar-foreground/60 truncate">{admin ? 'All departments' : departments.join(', ') || '--'}</div>
          </div>
          <IconDotsVertical className="w-3.5 h-3.5 text-sidebar-foreground/60 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
