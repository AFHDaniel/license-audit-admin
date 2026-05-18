#!/usr/bin/env node
//
// One-off preview tool - renders each renewal-reminder stage with sample
// ("makeup") application data and emails them so the layout can be reviewed
// before the wording is signed off and the scheduler is pointed at it.
//
// Cadence is 90 / 60 / 30 days before, plus a notice on the renewal date
// itself. No post-expiration stage - staff close renewals before they lapse.
//
// Greeting follows the production rule: a single owner is addressed by name,
// multiple owners get "Hi team,". For single-owner previews the name is taken
// from the recipient address so the batch reads naturally for whoever gets it.
//
// Usage:
//   ACS_CONNECTION_STRING=... ACS_SENDER_ADDRESS=... \
//     node scripts/send-reminder-previews.mjs [recipient@example.com]
//
// Credentials are read from the environment - never hard-code them here.
//

import { EmailClient } from '@azure/communication-email';
import { renderRenewalReminder } from '../server/emailTemplate.mjs';

const connectionString = process.env.ACS_CONNECTION_STRING;
const senderAddress = process.env.ACS_SENDER_ADDRESS;
const recipient = process.argv[2] || process.env.PREVIEW_RECIPIENT || 'daniel@atlantafinehomes.com';

if (!connectionString || !senderAddress) {
  console.error('Missing ACS_CONNECTION_STRING or ACS_SENDER_ADDRESS in the environment.');
  process.exit(1);
}

// Best-effort first name from an email address: daniel@... -> "Daniel".
function firstNameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  const token = local.split(/[._+-]/)[0] || local;
  return token ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : 'there';
}

const recipientName = firstNameFromEmail(recipient);

// A renewal date `offsetDays` from today, as YYYY-MM-DD.
function dateOffset(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Four fictional applications - one per reminder stage. `multiOwner` flips the
// greeting to "Hi team," so both variants are visible in one batch.
const previews = [
  {
    stage: '90-day',
    daysUntilRenewal: 90,
    multiOwner: false,
    license: {
      id: 'preview-canva', application: 'Canva Pro', vendor: 'Canva',
      department: 'Marketing', renewalDate: dateOffset(90), renewalMethod: 'Credit Card',
      amount: 1800, length: 'Annually', seats: '12', useCase: 'Design',
    },
  },
  {
    stage: '60-day',
    daysUntilRenewal: 60,
    multiOwner: true,
    license: {
      id: 'preview-zoom', application: 'Zoom Workplace Business', vendor: 'Zoom',
      department: 'Operations', renewalDate: dateOffset(60), renewalMethod: 'ACH',
      amount: 4200, length: 'Annually', seats: '40', useCase: 'Video Conferencing',
    },
  },
  {
    stage: '30-day',
    daysUntilRenewal: 30,
    multiOwner: false,
    license: {
      id: 'preview-dropbox', application: 'Dropbox Business', vendor: 'Dropbox',
      department: 'IT', renewalDate: dateOffset(30), renewalMethod: 'Credit Card',
      amount: 96, length: 'Monthly', seats: '25', useCase: 'File Storage',
    },
  },
  {
    stage: 'expiration',
    daysUntilRenewal: 0,
    multiOwner: false,
    license: {
      id: 'preview-docusign', application: 'DocuSign Standard', vendor: 'DocuSign',
      department: 'Admin', renewalDate: dateOffset(0), renewalMethod: 'ACH',
      amount: 3600, length: 'Annually', seats: '10', useCase: 'Document Signing',
    },
  },
];

async function main() {
  const client = new EmailClient(connectionString);
  console.log(`Sending ${previews.length} reminder previews to ${recipient}\n`);

  let failures = 0;
  for (const preview of previews) {
    const greetName = preview.multiOwner ? undefined : recipientName;
    const rendered = renderRenewalReminder({
      license: preview.license,
      daysUntilRenewal: preview.daysUntilRenewal,
      stage: preview.stage,
      recipientName: greetName,
    });
    const subject = `[Preview · ${preview.stage}] ${rendered.subject}`;
    const greetLabel = greetName ? `Hi ${greetName}` : 'Hi team';
    process.stdout.write(`  ${preview.stage.padEnd(12)} ${preview.license.application.padEnd(24)} (${greetLabel}) ... `);
    try {
      const poller = await client.beginSend({
        senderAddress,
        content: { subject, plainText: rendered.plainText, html: rendered.html },
        recipients: { to: [{ address: recipient }] },
      });
      const result = await poller.pollUntilDone();
      console.log(`${result.status} (id: ${result.id})`);
      if (String(result.status).toLowerCase() !== 'succeeded') failures += 1;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failures += 1;
    }
  }

  console.log(`\nDone. ${previews.length - failures}/${previews.length} delivered.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
