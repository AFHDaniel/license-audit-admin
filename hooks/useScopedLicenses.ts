import { useMemo } from 'react';
import { useAuthUser } from '../components/AuthGate';
import { DepartmentGrant, License } from '../types';
import {
  getDepartmentGrant,
  isAdmin as checkIsAdmin,
  getAllowedDepartments,
  filterLicensesByGrant,
} from '../auth/departmentAccess';

export interface ScopedLicensesResult {
  scopedLicenses: License[];
  grant: DepartmentGrant;
  allowedDepartments: readonly string[];
  isAdmin: boolean;
  isLoading: boolean;
  isViewingAs: boolean;
}

export function useScopedLicenses(licenses: License[], viewAsEmail?: string | null): ScopedLicensesResult {
  const { user } = useAuthUser();

  return useMemo(() => {
    if (!user?.email) {
      return {
        scopedLicenses: [],
        grant: getDepartmentGrant(null),
        allowedDepartments: [],
        isAdmin: false,
        isLoading: true,
        isViewingAs: false,
      };
    }

    const realGrant = getDepartmentGrant(user.email);
    const realIsAdmin = checkIsAdmin(realGrant);

    const effectiveEmail = realIsAdmin && viewAsEmail ? viewAsEmail : user.email;
    const effectiveGrant = effectiveEmail === user.email ? realGrant : getDepartmentGrant(effectiveEmail);
    const admin = checkIsAdmin(effectiveGrant);
    const allowed = getAllowedDepartments(effectiveGrant);
    const scoped = filterLicensesByGrant(licenses, effectiveGrant);

    return {
      scopedLicenses: scoped,
      grant: effectiveGrant,
      allowedDepartments: allowed,
      isAdmin: admin,
      isLoading: false,
      isViewingAs: realIsAdmin && viewAsEmail != null && viewAsEmail !== user.email,
    };
  }, [licenses, user?.email, viewAsEmail]);
}
