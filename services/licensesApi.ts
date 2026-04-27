import { License } from '../types';

export interface LicensesApiResponse {
  source: 'monday';
  boardName: string | null;
  boardNames?: string[];
  fetchedAt: string;
  licenses: License[];
}

export interface FetchLicensesOptions {
  signal?: AbortSignal;
  refresh?: boolean;
}

export interface UpdateLicenseRenewalRequest {
  recordBoardId: string;
  amount?: number | null;
  length?: string;
  renewalMethod?: string;
  renewalDate?: string;
  seats?: string;
  useCase?: string;
}

export interface UpdateLicenseRenewalResponse {
  ok: true;
  updated: License | null;
}

export async function fetchLicenses(options: FetchLicensesOptions = {}): Promise<LicensesApiResponse> {
  const url = options.refresh ? '/api/licenses?refresh=1' : '/api/licenses';
  const response = await fetch(url, { signal: options.signal });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || `Failed to fetch licenses (${response.status})`);
  }

  return response.json();
}

export async function updateLicenseRenewal(
  licenseId: string,
  payload: UpdateLicenseRenewalRequest,
): Promise<UpdateLicenseRenewalResponse> {
  const response = await fetch(`/api/licenses/${encodeURIComponent(licenseId)}/renewal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || `Failed to update license renewal (${response.status})`);
  }

  return response.json();
}
