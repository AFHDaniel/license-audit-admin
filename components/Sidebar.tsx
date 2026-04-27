import React, { useEffect, useRef, useState } from 'react';
import {
  IconHome,
  IconListDetails,
  IconChartBar,
  IconDownload,
  IconSearch,
  IconChevronDown,
  IconDotsVertical,
  IconLogout,
} from '@tabler/icons-react';
import { View } from '../types';
import { useAuthUser } from './AuthGate';
import { getDepartmentGrant, isAdmin as checkIsAdmin, getAllowedDepartments } from '../auth/departmentAccess';

interface SidebarProps {
  activeView: View;
  setView: (view: View) => void;
  inventoryCount?: number;
  onFocusSearch?: () => void;
}

type TablerIcon = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;

interface NavItem {
  id: View;
  label: string;
  Icon: TablerIcon;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setView, inventoryCount, onFocusSearch }) => {
  const { user, signOut } = useAuthUser();
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

  const displayName = user?.name?.split(' ')[0] || 'User';
  const initials = (user?.name || '')
    .split(' ')
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'U';
  const roleLabel = admin ? 'Admin' : 'Manager';
  const roleDetail = admin ? 'All departments' : departments.join(', ') || 'No access';

  return (
    <aside className="w-56 flex flex-col border-r border-border bg-sidebar shrink-0 h-screen">
      {/* Logo */}
      <button
        type="button"
        onClick={() => setView(View.DASHBOARD)}
        aria-label="Go to dashboard"
        className="flex items-center gap-2.5 px-5 py-5 w-full hover:bg-secondary/50 transition-colors text-left"
      >
        <div
          aria-hidden="true"
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0"
        >
          A
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">AuditAdmin</span>
        <IconChevronDown className="ml-auto w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      </button>

      {/* Search pill (Cmd+K hint) */}
      <div className="px-3 mb-1">
        <button
          type="button"
          onClick={onFocusSearch}
          aria-label="Focus search"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground text-[11px] hover:bg-secondary/70 transition-colors"
        >
          <IconSearch className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Search...</span>
          <kbd className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border border-border font-sans" aria-hidden="true">K</kbd>
        </button>
      </div>

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
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                  active
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {showBadge && (
                  <span className="ml-auto text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-medium tabular-nums">
                    {inventoryCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border relative" ref={menuContainerRef}>
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
          aria-label={`Account menu for ${user?.name || 'user'}`}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-secondary/60 cursor-pointer transition-colors"
        >
          <div aria-hidden="true" className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-[11px] font-semibold text-accent shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <div className="text-[12px] font-medium text-foreground truncate">{displayName}</div>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1 py-[1px] rounded ${
                admin ? 'bg-accent/15 text-accent' : 'bg-secondary text-muted-foreground'
              }`}>
                {roleLabel}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{admin ? 'All departments' : departments.join(', ') || '--'}</div>
          </div>
          <IconDotsVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
