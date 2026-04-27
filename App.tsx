
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { IconLoader2, IconLock } from '@tabler/icons-react';
import Sidebar from './components/Sidebar';
import TopNav, { TopNavHandle } from './components/TopNav';
import { useToast } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { getPendingRenewalsCount } from './utils/licenseMetrics';
import Dashboard from './screens/Dashboard';
import Inventory from './screens/Inventory';
import Analytics from './screens/Analytics';
import ExportReports from './screens/ExportReports';
import LicenseDetail from './screens/LicenseDetail';
import { View, License, InventoryFilterPreset } from './types';
import { fetchLicenses } from './services/licensesApi';
import { buildGlobalInventoryPreset } from './utils/globalSearchPreset';
import { buildSuggestionCorpus } from './utils/predictiveSearch';
import { useScopedLicenses } from './hooks/useScopedLicenses';
import { canAccessLicense, getDepartmentGrant, isAdmin as checkIsAdmin } from './auth/departmentAccess';
import { useAuthUser } from './components/AuthGate';

function pathToView(pathname: string): View {
  if (pathname.startsWith('/inventory')) return View.INVENTORY;
  if (pathname.startsWith('/analytics')) return View.ANALYTICS;
  if (pathname.startsWith('/export')) return View.EXPORT;
  if (pathname.startsWith('/license/')) return View.LICENSE_DETAIL;
  return View.DASHBOARD;
}

function viewToPath(view: View): string {
  switch (view) {
    case View.DASHBOARD: return '/dashboard';
    case View.INVENTORY: return '/inventory';
    case View.ANALYTICS: return '/analytics';
    case View.EXPORT: return '/export';
    default: return '/dashboard';
  }
}

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const activeView = pathToView(location.pathname);

  const [licenses, setLicenses] = useState<License[]>([]);
  const [syncLoading, setSyncLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [inventoryPreset, setInventoryPreset] = useState<InventoryFilterPreset | null>(null);
  const [inventoryPresetKey, setInventoryPresetKey] = useState(0);
  const [analyticsMetricsDepartment, setAnalyticsMetricsDepartment] = useState<string | null>(null);
  const [analyticsMetricsDepartmentKey, setAnalyticsMetricsDepartmentKey] = useState(0);
  const [lastMainPath, setLastMainPath] = useState('/dashboard');
  const [viewAsEmail, setViewAsEmail] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { user } = useAuthUser();
  const realIsAdmin = checkIsAdmin(getDepartmentGrant(user?.email));
  const { scopedLicenses, grant, allowedDepartments, isAdmin, isLoading: scopeLoading, isViewingAs } = useScopedLicenses(licenses, viewAsEmail);
  const topNavRef = useRef<TopNavHandle | null>(null);
  const toast = useToast();
  const pending30 = useMemo(() => getPendingRenewalsCount(scopedLicenses, 30), [scopedLicenses]);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;

    const loadFromMonday = async (showLoading = false, forceRefresh = false) => {
      if (inFlight) return;
      inFlight = true;

      if (showLoading) {
        setSyncLoading(true);
      }

      try {
        const payload = await fetchLicenses({ refresh: forceRefresh });
        if (disposed) return;
        setLicenses(payload.licenses);
        setBoardName(payload.boardName);
        setLastSyncedAt(payload.fetchedAt);
        setSyncError(null);
      } catch (error) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : 'Unable to sync Monday data.';
        setSyncError(message);
      } finally {
        if (!disposed) {
          setSyncLoading(false);
        }
        inFlight = false;
      }
    };

    void loadFromMonday(true, refreshNonce > 0);
    const timer = window.setInterval(() => {
      void loadFromMonday(false, false);
    }, 30000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [refreshNonce]);

  const refreshLicensesNow = () => {
    setRefreshNonce((current) => current + 1);
  };

  const removeSoftware = (id: string) => {
    void id;
    toast.info(
      'Synced from Monday',
      'Delete the item in Monday -- it will disappear here on the next auto-sync.',
    );
  };

  const selectedLicenseId = activeView === View.LICENSE_DETAIL ? (params.id || null) : null;

  const selectedLicense = useMemo(
    () => licenses.find((license) => license.id === selectedLicenseId) || null,
    [licenses, selectedLicenseId],
  );

  const selectedLicenseAccessDenied = selectedLicense != null && !canAccessLicense(selectedLicense, grant);

  const topNavSuggestionCorpus = useMemo(() => buildSuggestionCorpus(scopedLicenses), [scopedLicenses]);

  const handleSetView = (view: View) => {
    if (activeView !== View.LICENSE_DETAIL) {
      setLastMainPath(viewToPath(activeView));
    }
    startTransition(() => {
      navigate(viewToPath(view));
    });
  };

  const openInventoryWithPreset = (preset: InventoryFilterPreset) => {
    setInventoryPreset(preset);
    setInventoryPresetKey((current) => current + 1);
    setLastMainPath('/inventory');
    startTransition(() => {
      navigate('/inventory');
    });
  };

  const handleTopNavSearchSubmit = (query: string) => {
    openInventoryWithPreset(buildGlobalInventoryPreset(query));
  };

  const openLicenseDetail = (license: License) => {
    if (activeView !== View.LICENSE_DETAIL) {
      setLastMainPath(location.pathname);
    }
    startTransition(() => {
      navigate(`/license/${license.id}`);
    });
  };

  const openAnalyticsDepartmentMetrics = (departmentName: string) => {
    setAnalyticsMetricsDepartment(departmentName || 'ALL');
    setAnalyticsMetricsDepartmentKey((current) => current + 1);
    setLastMainPath('/analytics');
    startTransition(() => {
      navigate('/analytics');
    });
  };

  const closeLicenseDetail = () => {
    const backPath = lastMainPath.startsWith('/license') ? '/inventory' : lastMainPath;
    startTransition(() => {
      navigate(backPath);
    });
  };

  const allowedDeptStrings = allowedDepartments as string[];

  const isInitialLoading = scopeLoading || (syncLoading && licenses.length === 0);

  const renderContent = () => {
    if (isInitialLoading) {
      return (
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="text-center space-y-3">
            <IconLoader2 className="mx-auto size-10 text-muted-foreground animate-spin" strokeWidth={1.5} />
            <p className="text-sm font-medium text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      );
    }

    if (!isAdmin && allowedDepartments.length === 0 && scopedLicenses.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="text-center space-y-4 max-w-md">
            <div className="mx-auto size-14 rounded-full bg-muted flex items-center justify-center">
              <IconLock size={28} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-xl font-semibold text-foreground font-display">No departments assigned</p>
            <p className="text-sm text-muted-foreground">
              Your account does not have access to any departments yet. Contact Daniel or Sarah to get set up.
            </p>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case View.DASHBOARD:
        return (
          <Dashboard
            licenses={scopedLicenses}
            allLicenses={licenses}
            onNavigateInventory={openInventoryWithPreset}
            onSelectLicense={openLicenseDetail}
            onOpenDepartmentAnalytics={openAnalyticsDepartmentMetrics}
          />
        );
      case View.INVENTORY:
        return (
          <Inventory
            licenses={scopedLicenses}
            onRemove={removeSoftware}
            onSelectLicense={openLicenseDetail}
            externalPreset={inventoryPreset}
            externalPresetKey={inventoryPresetKey}
            allowedDepartments={allowedDeptStrings}
          />
        );
      case View.ANALYTICS:
        return (
          <Analytics
            licenses={scopedLicenses}
            onSelectLicense={openLicenseDetail}
            onNavigateInventory={openInventoryWithPreset}
            metricsDepartmentOverride={analyticsMetricsDepartment}
            metricsDepartmentOverrideKey={analyticsMetricsDepartmentKey}
            allowedDepartments={allowedDeptStrings}
          />
        );
      case View.EXPORT:
        return (
          <ExportReports licenses={scopedLicenses} allowedDepartments={allowedDeptStrings} />
        );
      case View.LICENSE_DETAIL:
        return (
          <LicenseDetail
            license={selectedLicenseAccessDenied ? null : selectedLicense}
            accessDenied={selectedLicenseAccessDenied}
            isSyncing={syncLoading && licenses.length === 0}
            onBack={closeLicenseDetail}
            onOpenInventory={openInventoryWithPreset}
            onLicenseUpdated={refreshLicensesNow}
          />
        );
      default:
        return <Dashboard licenses={scopedLicenses} allLicenses={licenses} />;
    }
  };

  const scopeLabel = isAdmin
    ? ''
    : allowedDeptStrings.length > 0
      ? ` Showing ${scopedLicenses.length} of ${licenses.length} records for ${allowedDeptStrings.join(', ')} plus any shared co-owned records.`
      : ` Showing ${scopedLicenses.length} shared co-owned records.`;

  const syncBannerText = syncError
    ? `Monday sync error: ${syncError}`
    : syncLoading
      ? 'Refreshing from Monday...'
      : `Synced from Monday${boardName ? ` (${boardName})` : ''}${lastSyncedAt ? ` at ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}.${scopeLabel}`;

  // Don't double-up spinner + banner during initial load.
  // Show banner only for errors, or for subsequent background syncs.
  const showSyncBanner = !isInitialLoading && (syncError != null || (syncLoading && licenses.length > 0));

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        activeView={activeView}
        setView={handleSetView}
        inventoryCount={scopedLicenses.length}
        onFocusSearch={() => topNavRef.current?.focusSearch()}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav
          ref={topNavRef}
          onSearchSubmit={handleTopNavSearchSubmit}
          suggestionCorpus={topNavSuggestionCorpus}
          showViewAs={realIsAdmin}
          viewAsEmail={viewAsEmail}
          onViewAsChange={setViewAsEmail}
          notificationCount={pending30}
          onNotificationClick={() => openInventoryWithPreset({
            quickFilter: 'UPCOMING_30',
            renewalWindow: 'UPCOMING_30',
            contextLabel: 'Pending renewals: next 30 days',
          })}
        />

        {showSyncBanner && (
          <div className="px-6 pt-2">
            <div className={`rounded-md border px-3 py-1.5 text-[11px] font-medium ${
              syncError
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-secondary/60 text-muted-foreground'
            }`}>
              {syncBannerText}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary key={location.pathname}>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default App;
