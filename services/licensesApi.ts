import { License } from '../types';

export type TokenProvider = () => Promise<string | null> | string | null;

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
  getAccessToken?: TokenProvider;
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

async function resolveToken(provider?: TokenProvider): Promise<string | null> {
  if (!provider) return null;
  try {
    const result = provider();
    return result instanceof Promise ? await result : result;
  } catch {
    return null;
  }
}

function authHeaders(token: string | null, extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchLicenses(options: FetchLicensesOptions = {}): Promise<LicensesApiResponse> {
  const url = options.refresh ? '/api/licenses?refresh=1' : '/api/licenses';
  const token = await resolveToken(options.getAccessToken);
  const response = await fetch(url, {
    signal: options.signal,
    headers: authHeaders(token),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || `Failed to fetch licenses (${response.status})`);
  }

  return response.json();
}

export async function updateLicenseRenewal(
  licenseId: string,
  payload: UpdateLicenseRenewalRequest,
  options: { getAccessToken?: TokenProvider } = {},
): Promise<UpdateLicenseRenewalResponse> {
  const token = await resolveToken(options.getAccessToken);
  const response = await fetch(`/api/licenses/${encodeURIComponent(licenseId)}/renewal`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || `Failed to update license renewal (${response.status})`);
  }

  return response.json();
}
