import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomainStatusPayload } from './acsDomainStatus.mjs';

const sampleConfig = {
  subscriptionId: 'sub',
  resourceGroup: 'rg',
  emailServiceName: 'svc',
  domainName: 'applications.atlantafinehomes.com',
  senderAddress: 'no-reply@applications.atlantafinehomes.com',
};

test('normalizeDomainStatusPayload flattens verificationStates + records into checks[]', () => {
  const payload = {
    name: 'applications.atlantafinehomes.com',
    properties: {
      fromSenderDomain: 'applications.atlantafinehomes.com',
      verificationStates: {
        Domain: { status: 'Verified' },
        SPF: { status: 'Verified' },
        DKIM: { status: 'VerificationFailed', errorCode: 'NoRecord' },
        DKIM2: { status: 'Verified' },
      },
      verificationRecords: {
        SPF: { type: 'TXT', name: '@', value: 'v=spf1 include:_spf.azurecomm.net -all', ttl: 3600 },
        DKIM: { type: 'CNAME', name: 'selector1._domainkey', value: 'selector1.azurecomm.net' },
      },
    },
  };
  const result = normalizeDomainStatusPayload(payload, sampleConfig);
  assert.equal(result.overall, 'Failed');
  assert.equal(result.fromSenderDomain, 'applications.atlantafinehomes.com');
  assert.equal(result.checks.length, 4);
  const spf = result.checks.find((c) => c.record === 'SPF');
  assert.equal(spf?.status, 'Verified');
  assert.equal(spf?.recordType, 'TXT');
  assert.equal(spf?.recordValue, 'v=spf1 include:_spf.azurecomm.net -all');
  const dkim = result.checks.find((c) => c.record === 'DKIM');
  assert.equal(dkim?.status, 'VerificationFailed');
  assert.equal(dkim?.errorCode, 'NoRecord');
});

test('normalizeDomainStatusPayload reports overall=Verified when every check passes', () => {
  const payload = {
    name: 'applications.atlantafinehomes.com',
    properties: {
      verificationStates: {
        Domain: { status: 'Verified' },
        SPF: { status: 'Verified' },
        DKIM: { status: 'Verified' },
      },
      verificationRecords: {},
    },
  };
  const result = normalizeDomainStatusPayload(payload, sampleConfig);
  assert.equal(result.overall, 'Verified');
});

test('normalizeDomainStatusPayload returns overall=Unknown when no checks are present', () => {
  const result = normalizeDomainStatusPayload({ name: 'x', properties: {} }, sampleConfig);
  assert.equal(result.overall, 'Unknown');
  assert.equal(result.checks.length, 0);
});
