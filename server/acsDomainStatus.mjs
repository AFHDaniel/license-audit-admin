const armTokenCache = { token: '', expiresAtMs: 0 };

async function fetchArmAccessToken({ fetchImpl = fetch } = {}) {
  const tenantId = process.env.AZURE_TENANT_ID || '';
  const clientId = process.env.ACS_ARM_CLIENT_ID || process.env.AZURE_CLIENT_ID || '';
  const clientSecret = process.env.ACS_ARM_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET || '';
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure ARM credentials are not configured (AZURE_TENANT_ID, ACS_ARM_CLIENT_ID, ACS_ARM_CLIENT_SECRET).');
  }
  if (armTokenCache.token && Date.now() < armTokenCache.expiresAtMs - 60_000) {
    return armTokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://management.azure.com/.default',
  });

  const res = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`ARM token request failed (${res.status}): ${text || 'unknown error'}`);
  }
  const json = await res.json();
  armTokenCache.token = json.access_token;
  armTokenCache.expiresAtMs = Date.now() + (Number(json.expires_in || 3600) * 1000);
  return armTokenCache.token;
}

export function getDomainStatusConfig() {
  return {
    subscriptionId: process.env.ACS_SUBSCRIPTION_ID || '',
    resourceGroup: process.env.ACS_RESOURCE_GROUP || '',
    emailServiceName: process.env.ACS_EMAIL_SERVICE_NAME || '',
    domainName: process.env.ACS_DOMAIN_NAME || '',
    senderAddress: process.env.ACS_SENDER_ADDRESS || '',
  };
}

export function normalizeDomainStatusPayload(json, config) {
  const props = (json && json.properties) || {};
  const states = props.verificationStates || {};
  const records = props.verificationRecords || {};
  const recordKeys = ['Domain', 'SPF', 'DKIM', 'DKIM2', 'DMARC'];
  const checks = recordKeys
    .filter((key) => states[key] || records[key])
    .map((key) => ({
      record: key,
      status: states[key]?.status || 'Unknown',
      errorCode: states[key]?.errorCode || null,
      recordType: records[key]?.type || null,
      recordName: records[key]?.name || null,
      recordValue: records[key]?.value || null,
      ttl: records[key]?.ttl || null,
    }));

  const overall = checks.length > 0 && checks.every((c) => c.status === 'Verified')
    ? 'Verified'
    : checks.some((c) => c.status === 'VerificationFailed')
      ? 'Failed'
      : checks.length === 0
        ? 'Unknown'
        : 'Pending';

  return {
    overall,
    domainName: json?.name || config.domainName,
    fromSenderDomain: props.fromSenderDomain || null,
    mailFromSenderDomain: props.mailFromSenderDomain || null,
    senderAddress: config.senderAddress,
    dataLocation: props.dataLocation || null,
    userEngagementTracking: props.userEngagementTracking || null,
    checks,
  };
}

export async function fetchAcsDomainStatus({ fetchImpl = fetch } = {}) {
  const config = getDomainStatusConfig();
  const missing = Object.entries(config)
    .filter(([key, value]) => !value && key !== 'senderAddress')
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `ACS domain status is missing env: ${missing.join(', ')}. ` +
      'Set ACS_SUBSCRIPTION_ID, ACS_RESOURCE_GROUP, ACS_EMAIL_SERVICE_NAME, ACS_DOMAIN_NAME on the server.',
    );
  }

  const token = await fetchArmAccessToken({ fetchImpl });
  const url =
    `https://management.azure.com/subscriptions/${config.subscriptionId}` +
    `/resourceGroups/${config.resourceGroup}` +
    `/providers/Microsoft.Communication/emailServices/${config.emailServiceName}` +
    `/domains/${config.domainName}?api-version=2023-04-01`;

  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = typeof res.text === 'function' ? await res.text() : '';
    throw new Error(`ACS domain lookup failed (${res.status}): ${text || 'unknown error'}`);
  }
  const json = await res.json();
  return normalizeDomainStatusPayload(json, config);
}

export function clearArmTokenCacheForTest() {
  armTokenCache.token = '';
  armTokenCache.expiresAtMs = 0;
}
