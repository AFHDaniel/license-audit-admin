//
// Atlanta Fine Homes brand-styled email templates.
//
// All rendering is server-side and produces an `{ subject, plainText, html }`
// object so every email channel (ACS, plain SMTP later, preview UI) shares
// one source of truth. Emails are built with tables + inline styles because
// Outlook, Apple Mail, Gmail web, and ProtonMail all interpret modern CSS
// differently - tables + inline are the only reliable cross-client format.
//
// Renewal reminders follow the five-stage cadence agreed with Sarah
// (May 15, 2026 review): 90-day, 60-day, 30-day, expiration day, and a
// monthly post-expiration nudge. Each stage has its own wording - proactive
// and negotiation-focused early, action-oriented near the date, and a
// gentle "keep the data fresh" tone once it has lapsed.
//

const BRAND = {
  navy: '#002349',
  navySoft: '#0c365e',
  gold: '#b89c47',
  goldSoft: '#d8c378',
  cream: '#f8f7f4',
  paper: '#ffffff',
  ink: '#111827',
  inkSoft: '#4b5563',
  border: '#e5e7eb',
  dangerBg: '#fdecec',
  dangerInk: '#9b1c1c',
  warnBg: '#fff6e2',
  warnInk: '#8a5a00',
  okBg: '#eaf3ee',
  okInk: '#1f6b3a',
};

const FONT_STACK = `'Benton Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
const SERIF_STACK = `'Mercury Display', 'Freight Big Pro', Georgia, 'Times New Roman', serif`;

const TRACKER_BASE_URL = 'https://applications.atlantafinehomes.com';

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `$${numeric.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatRenewalDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Best-effort billing cadence from the free-text Monday "Length / Term" value.
// Mirrors utils/licenseMetrics.ts:getBillingCadenceFromLength so the email's
// monthly/annual figures match what the dashboard shows.
function billingCadenceFromLength(lengthText) {
  const t = String(lengthText || '').trim().toLowerCase();
  if (!t) return 'Unknown';
  if (/(multi-?year|36\s*months?|3\s*years?)/.test(t)) return 'Multi-Year';
  if (/(quarter|qtr|3\s*months?)/.test(t)) return 'Quarterly';
  if (/(annual|annually|yearly|year|per year|\/yr|\byr\b|12\s*months?)/.test(t)) return 'Annual';
  if (/(month|per month|\/mo|\bmo\b)/.test(t)) return 'Monthly';
  return 'Unknown';
}

// Returns { monthly, annual } as numbers (or null when amount/cadence is unknown).
// `license.amount` is the per-cycle billed amount; cadence decides how to
// normalize it to a monthly and an annual figure.
function computeCosts(license) {
  const amount = Number(license && license.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { monthly: null, annual: null };
  switch (billingCadenceFromLength(license.length)) {
    case 'Monthly': return { monthly: amount, annual: amount * 12 };
    case 'Quarterly': return { monthly: amount / 3, annual: amount * 4 };
    case 'Annual': return { monthly: amount / 12, annual: amount };
    case 'Multi-Year': return { monthly: amount / 36, annual: amount / 3 };
    default: return { monthly: null, annual: null };
  }
}

// Map days-until-renewal to one of the five reminder stages. Callers may also
// pass an explicit stage (the preview tool does this) to bypass the mapping.
export function reminderStage(daysUntilRenewal) {
  if (daysUntilRenewal == null || !Number.isFinite(daysUntilRenewal)) return 'expiration';
  if (daysUntilRenewal < 0) return 'post-expiration';
  if (daysUntilRenewal === 0) return 'expiration';
  if (daysUntilRenewal <= 30) return '30-day';
  if (daysUntilRenewal <= 60) return '60-day';
  return '90-day';
}

// Legacy export - kept for backward compatibility with existing callers/tests.
// Renewal reminders now use reminderStage(); this is no longer used internally.
export function urgencyTier(daysUntilRenewal) {
  if (daysUntilRenewal == null || !Number.isFinite(daysUntilRenewal)) return 'info';
  if (daysUntilRenewal <= -60) return 'overdue-severe';
  if (daysUntilRenewal < 0) return 'overdue';
  if (daysUntilRenewal <= 7) return 'critical';
  if (daysUntilRenewal <= 14) return 'high';
  if (daysUntilRenewal <= 30) return 'medium';
  if (daysUntilRenewal <= 90) return 'planning';
  return 'info';
}

function stageColors(stage) {
  switch (stage) {
    case '90-day':
      return { bg: '#eef3f8', ink: BRAND.navySoft, accent: BRAND.navy };
    case '60-day':
      return { bg: '#faf2d9', ink: BRAND.warnInk, accent: BRAND.gold };
    case '30-day':
      return { bg: BRAND.warnBg, ink: BRAND.warnInk, accent: '#c0392b' };
    case 'expiration':
      return { bg: BRAND.dangerBg, ink: BRAND.dangerInk, accent: '#c0392b' };
    case 'post-expiration':
    default:
      return { bg: '#7a0c0c', ink: '#ffffff', accent: '#7a0c0c' };
  }
}

function stageBannerLabel(stage, daysUntilRenewal) {
  const days = Number(daysUntilRenewal);
  const abs = Math.abs(days);
  switch (stage) {
    case '90-day':
      return Number.isFinite(days) ? `RENEWS IN ${days} DAYS` : 'RENEWS IN ABOUT 90 DAYS';
    case '60-day':
      return Number.isFinite(days) ? `RENEWS IN ${days} DAYS` : 'RENEWS IN ABOUT 2 MONTHS';
    case '30-day':
      return Number.isFinite(days) ? `RENEWS IN ${days} DAYS · ACTION NEEDED` : 'RENEWS SOON · ACTION NEEDED';
    case 'expiration':
      return 'RENEWS TODAY';
    case 'post-expiration':
    default:
      return Number.isFinite(days) && abs > 0
        ? `${abs} DAYS PAST DUE · UPDATE NEEDED`
        : 'PAST ITS RENEWAL DATE · UPDATE NEEDED';
  }
}

// Per-stage copy: the headline subject prefix, the lead paragraph, and a
// short "what to do" checklist. Wording comes straight from the May 15 review.
function stageContent(stage, application, renewalDateText) {
  switch (stage) {
    case '90-day':
      return {
        subjectPrefix: 'Heads-up',
        subjectTail: 'renews in about 90 days',
        message: `${application} is set to renew on ${renewalDateText} - about 90 days out. Nothing urgent yet, but this is the ideal window to get ahead of it. If you're planning to keep ${application}, now is the best time to negotiate pricing: vendors are far more flexible before a deadline is on top of them.`,
        listHeading: 'A good time to:',
        listItems: [
          'Confirm the team still actively uses this tool.',
          'Reach out to the vendor about pricing for the upcoming term.',
          "Tell us if you'd like help benchmarking the cost or weighing alternatives.",
        ],
      };
    case '60-day':
      return {
        subjectPrefix: 'Renewal in 2 months',
        subjectTail: 'a good time to review pricing',
        message: `${application} renews on ${renewalDateText} - roughly two months away. If you haven't already started the conversation with the vendor, now is the time to reach out and negotiate pricing before the renewal locks in.`,
        listHeading: 'Worth checking before it renews:',
        listItems: [
          "Are you still using everything you're paying for - seats, tier, add-ons?",
          'Has the vendor raised the price since last year?',
          'Would a longer term or annual prepay bring the rate down?',
        ],
      };
    case '30-day':
      return {
        subjectPrefix: 'Action needed',
        subjectTail: 'renews in about 30 days',
        message: `${application} renews in about 30 days, on ${renewalDateText}. This is the point to lock things in - connect with your vendor rep to confirm pricing and terms for the upcoming period.`,
        listHeading: 'Please:',
        listItems: [
          'If you have already handled the renewal - great. Update the renewal date and cost in the tracker so our records are current.',
          'If the pricing changed, review and update the cost so spend reporting stays accurate.',
          'If you are considering a change or cancellation, act now - some agreements require advance notice.',
        ],
      };
    case 'expiration':
      return {
        subject: `[ACTION REQUIRED] ${application} renews today`,
        subjectPrefix: 'Renewal date today',
        subjectTail: 'reached its renewal',
        message: `Our records show ${application} renews today, ${renewalDateText}. We need an updated entry to keep our application records and spend reporting accurate.`,
        listHeading: 'Please let us know:',
        listItems: [
          'If you renewed this application, please click the link below and update the new renewal date, term, and cost in the tracker.',
          'If you decided not to renew and are discontinuing this platform, please reply to this email and we will mark it inactive.',
        ],
      };
    case 'post-expiration':
    default:
      return {
        subjectPrefix: 'Still need an update',
        subjectTail: 'is past its renewal date',
        message: `Our records show ${application} is past its renewal date, ${renewalDateText}. As the owner of this application, you are the source of truth. We need an updated entry to keep our application records and spend reporting accurate.`,
        listHeading: 'It only takes a minute:',
        listItems: [
          'Update the renewal date, term, and cost in the tracker.',
          'If the application is no longer in use, reply and we will remove it.',
        ],
      };
  }
}

function styleAttr(props) {
  return Object.entries(props)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${value}`)
    .join('; ');
}

function buttonCell(href, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td bgcolor="${BRAND.navy}" style="${styleAttr({ borderRadius: '6px', padding: '12px 24px' })}">
          <a href="${escapeHtml(href)}" target="_blank" style="${styleAttr({
            fontFamily: FONT_STACK,
            fontSize: '14px',
            fontWeight: '600',
            color: BRAND.cream,
            textDecoration: 'none',
            letterSpacing: '0.02em',
          })}">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="${styleAttr({
        padding: '10px 16px',
        borderBottom: `1px solid ${BRAND.border}`,
        fontFamily: FONT_STACK,
        fontSize: '11px',
        color: BRAND.inkSoft,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        verticalAlign: 'top',
        width: '38%',
      })}">${escapeHtml(label)}</td>
      <td style="${styleAttr({
        padding: '10px 16px',
        borderBottom: `1px solid ${BRAND.border}`,
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: BRAND.ink,
        fontWeight: '500',
        verticalAlign: 'top',
      })}">${escapeHtml(value)}</td>
    </tr>`;
}

// A "what to do" checklist - heading plus gold-marked rows.
function checklistBlock(heading, items, accent) {
  const rows = items.map((item) => `
    <tr>
      <td style="${styleAttr({ padding: '4px 10px 4px 0', verticalAlign: 'top', width: '14px' })}">
        <span style="${styleAttr({ color: accent, fontWeight: '700', fontSize: '15px' })}">&bull;</span>
      </td>
      <td style="${styleAttr({
        padding: '4px 0',
        fontFamily: FONT_STACK,
        fontSize: '14px',
        lineHeight: '1.55',
        color: BRAND.ink,
      })}">${escapeHtml(item)}</td>
    </tr>`).join('');

  return `
    <p style="${styleAttr({
      margin: '0 0 8px 0',
      fontFamily: FONT_STACK,
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: BRAND.inkSoft,
    })}">${escapeHtml(heading)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({ marginBottom: '22px' })}">
      ${rows}
    </table>`;
}

// The "how to update" steps box.
function updateStepsBox(url) {
  const step = (n, text) => `
    <tr>
      <td style="${styleAttr({ padding: '3px 10px 3px 0', verticalAlign: 'top', width: '20px' })}">
        <span style="${styleAttr({
          fontFamily: FONT_STACK,
          fontSize: '12px',
          fontWeight: '700',
          color: BRAND.navy,
        })}">${n}.</span>
      </td>
      <td style="${styleAttr({
        padding: '3px 0',
        fontFamily: FONT_STACK,
        fontSize: '13px',
        lineHeight: '1.55',
        color: BRAND.ink,
      })}">${text}</td>
    </tr>`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({
      backgroundColor: BRAND.cream,
      border: `1px solid ${BRAND.border}`,
      borderRadius: '6px',
      marginBottom: '20px',
    })}">
      <tr>
        <td style="${styleAttr({ padding: '16px 18px' })}">
          <p style="${styleAttr({
            margin: '0 0 10px 0',
            fontFamily: FONT_STACK,
            fontSize: '13px',
            fontWeight: '700',
            color: BRAND.navy,
          })}">Update it in under a minute</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${step(1, `Open the record in the Application Tracker (see button below).`)}
            ${step(2, 'Update the renewal date, term, and cost.')}
            ${step(3, 'Hit <strong>Save</strong> - it writes straight back to Monday, so there is nothing else to do.')}
          </table>
        </td>
      </tr>
    </table>`;
}

/**
 * Render a branded renewal-reminder email.
 * @param {object} input
 * @param {object} input.license             license record (id, application, vendor, department, renewalDate, renewalMethod, amount, length, seats, useCase)
 * @param {number} input.daysUntilRenewal    integer days remaining (negative = overdue, 0 = today)
 * @param {string} [input.stage]             explicit stage override ('90-day'|'60-day'|'30-day'|'expiration'|'post-expiration')
 * @param {string} [input.detailUrl]         override the deep link into the tracker
 * @param {string} [input.recipientName]     personalize greeting (falls back to "team")
 */
export function renderRenewalReminder({ license, daysUntilRenewal, stage, detailUrl, recipientName }) {
  if (!license) throw new Error('renderRenewalReminder requires a license');

  const resolvedStage = stage || reminderStage(daysUntilRenewal);
  const colors = stageColors(resolvedStage);
  const bannerLabel = stageBannerLabel(resolvedStage, daysUntilRenewal);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi team,';

  const application = license.application || 'Unnamed application';
  const vendor = license.vendor || '';
  const department = license.department || 'Unassigned';
  const renewalDateText = formatRenewalDate(license.renewalDate);
  const method = license.renewalMethod || 'Manual';
  const term = license.length ? String(license.length) : 'Not on file';
  const seats = license.seats ? String(license.seats) : '';
  const url = detailUrl || `${TRACKER_BASE_URL}/license/${encodeURIComponent(license.id || '')}`;

  const { monthly, annual } = computeCosts(license);
  const monthlyText = formatCurrency(monthly);
  const annualText = formatCurrency(annual);
  const costDisplay = monthlyText && annualText
    ? `${monthlyText}/mo · ${annualText}/yr`
    : (formatCurrency(license.amount) || 'Not on file');

  const content = stageContent(resolvedStage, application, renewalDateText);
  const subject = content.subject || `${content.subjectPrefix}: ${application} ${content.subjectTail}`;

  const plainText = [
    greeting,
    '',
    content.message,
    '',
    `${content.listHeading}`,
    ...content.listItems.map((item) => `  - ${item}`),
    '',
    'On file:',
    `  Application: ${application}${vendor ? ` (${vendor})` : ''}`,
    `  Department: ${department}`,
    `  Term: ${term}`,
    `  Cost: ${costDisplay}`,
    `  Renewal date: ${renewalDateText}`,
    `  Renewal method: ${method}`,
    seats ? `  Seats: ${seats}` : null,
    '',
    'Update it in under a minute:',
    '  1. Open the record in the Application Tracker (link below).',
    '  2. Update the renewal date, term, and cost.',
    '  3. Hit Save - it writes straight back to Monday.',
    url,
    '',
    'Please reach out to sarah@atlantafinehomes.com or daniel@atlantafinehomes.com for any further assistance.',
  ].filter((line) => line !== null).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="${styleAttr({
    margin: '0',
    padding: '0',
    backgroundColor: BRAND.cream,
    fontFamily: FONT_STACK,
    color: BRAND.ink,
  })}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({ backgroundColor: BRAND.cream, padding: '32px 16px' })}">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({
          maxWidth: '600px',
          width: '100%',
          backgroundColor: BRAND.paper,
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 35, 73, 0.08)',
        })}">

          <!-- Brand header -->
          <tr>
            <td style="${styleAttr({
              backgroundColor: BRAND.navy,
              padding: '20px 28px',
              borderBottom: `3px solid ${BRAND.gold}`,
            })}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="${styleAttr({
                    fontFamily: SERIF_STACK,
                    fontSize: '17px',
                    color: BRAND.cream,
                    letterSpacing: '0.04em',
                  })}">
                    Atlanta Fine Homes
                  </td>
                  <td align="right" style="${styleAttr({
                    fontFamily: FONT_STACK,
                    fontSize: '11px',
                    color: BRAND.goldSoft,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                  })}">
                    Application Tracker
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stage banner -->
          <tr>
            <td style="${styleAttr({
              backgroundColor: colors.bg,
              padding: '14px 28px',
              fontFamily: FONT_STACK,
              fontSize: '12px',
              fontWeight: '700',
              color: colors.ink,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              borderBottom: `1px solid ${BRAND.border}`,
            })}">
              ${escapeHtml(bannerLabel)}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="${styleAttr({ padding: '28px' })}">
              <p style="${styleAttr({
                margin: '0 0 8px 0',
                fontFamily: FONT_STACK,
                fontSize: '14px',
                color: BRAND.inkSoft,
              })}">${greeting}</p>

              <h1 style="${styleAttr({
                margin: '0 0 14px 0',
                fontFamily: SERIF_STACK,
                fontSize: '26px',
                lineHeight: '1.25',
                color: BRAND.navy,
                fontWeight: '600',
              })}">
                ${escapeHtml(application)}
              </h1>

              <p style="${styleAttr({
                margin: '0 0 22px 0',
                fontFamily: FONT_STACK,
                fontSize: '15px',
                lineHeight: '1.6',
                color: BRAND.ink,
              })}">
                ${escapeHtml(content.message)}
              </p>

              ${checklistBlock(content.listHeading, content.listItems, colors.accent)}

              <!-- Info table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({
                border: `1px solid ${BRAND.border}`,
                borderRadius: '6px',
                borderCollapse: 'separate',
                marginBottom: '22px',
              })}">
                ${infoRow('Application', application)}
                ${vendor ? infoRow('Vendor', vendor) : ''}
                ${infoRow('Department', department)}
                ${infoRow('Term', term)}
                ${infoRow('Current cost', costDisplay)}
                ${infoRow('Renewal date', renewalDateText)}
                ${infoRow('Renewal method', method)}
                ${seats ? infoRow('Seats', seats) : ''}
              </table>

              ${updateStepsBox(url)}

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 4px 0 4px 0;">
                    ${buttonCell(url, 'Open in Application Tracker')}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="${styleAttr({
                    paddingTop: '12px',
                    fontFamily: FONT_STACK,
                    fontSize: '12px',
                    color: BRAND.inkSoft,
                  })}">
                    Or paste this into your browser:<br />
                    <a href="${escapeHtml(url)}" style="${styleAttr({ color: BRAND.navy, wordBreak: 'break-all' })}">${escapeHtml(url)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="${styleAttr({
              backgroundColor: BRAND.cream,
              padding: '18px 28px',
              borderTop: `1px solid ${BRAND.border}`,
              fontFamily: FONT_STACK,
              fontSize: '11px',
              color: BRAND.inkSoft,
              lineHeight: '1.6',
            })}">
              Please reach out to <a href="mailto:sarah@atlantafinehomes.com" style="color: ${BRAND.navy}; text-decoration: underline;">sarah@atlantafinehomes.com</a> or <a href="mailto:daniel@atlantafinehomes.com" style="color: ${BRAND.navy}; text-decoration: underline;">daniel@atlantafinehomes.com</a> for any further assistance.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, plainText, html };
}

/**
 * Render an admin test email - same brand chrome, no renewal data.
 */
export function renderAdminTest({ subject, message, requestedBy }) {
  const safeSubject = subject || 'Application Tracker - pipeline test';
  const safeMessage = message || 'This is a test email from the Atlanta Fine Homes Application Tracker confirming ACS delivery is working.';

  const plainText = [
    safeMessage,
    '',
    requestedBy ? `Triggered by: ${requestedBy}` : null,
    `Sent at: ${new Date().toISOString()}`,
    '',
    `- Atlanta Fine Homes Application Tracker`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(safeSubject)}</title>
</head>
<body style="${styleAttr({
    margin: '0',
    padding: '0',
    backgroundColor: BRAND.cream,
    fontFamily: FONT_STACK,
    color: BRAND.ink,
  })}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({ backgroundColor: BRAND.cream, padding: '32px 16px' })}">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({
          maxWidth: '600px',
          width: '100%',
          backgroundColor: BRAND.paper,
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 35, 73, 0.08)',
        })}">
          <tr>
            <td style="${styleAttr({
              backgroundColor: BRAND.navy,
              padding: '20px 28px',
              borderBottom: `3px solid ${BRAND.gold}`,
            })}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="${styleAttr({
                    fontFamily: SERIF_STACK,
                    fontSize: '17px',
                    color: BRAND.cream,
                    letterSpacing: '0.04em',
                  })}">Atlanta Fine Homes</td>
                  <td align="right" style="${styleAttr({
                    fontFamily: FONT_STACK,
                    fontSize: '11px',
                    color: BRAND.goldSoft,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                  })}">Application Tracker</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="${styleAttr({ padding: '28px' })}">
              <p style="${styleAttr({
                margin: '0 0 12px 0',
                fontFamily: FONT_STACK,
                fontSize: '12px',
                color: BRAND.gold,
                fontWeight: '700',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              })}">Pipeline test</p>
              <h1 style="${styleAttr({
                margin: '0 0 18px 0',
                fontFamily: SERIF_STACK,
                fontSize: '24px',
                color: BRAND.navy,
                fontWeight: '600',
              })}">${escapeHtml(safeSubject)}</h1>
              <p style="${styleAttr({
                margin: '0 0 18px 0',
                fontFamily: FONT_STACK,
                fontSize: '15px',
                lineHeight: '1.6',
                color: BRAND.ink,
              })}">${escapeHtml(safeMessage)}</p>
              ${requestedBy ? `<p style="${styleAttr({
                margin: '0',
                fontFamily: FONT_STACK,
                fontSize: '12px',
                color: BRAND.inkSoft,
              })}">Triggered by ${escapeHtml(requestedBy)}.</p>` : ''}
            </td>
          </tr>

          <tr>
            <td style="${styleAttr({
              backgroundColor: BRAND.cream,
              padding: '14px 28px',
              borderTop: `1px solid ${BRAND.border}`,
              fontFamily: FONT_STACK,
              fontSize: '11px',
              color: BRAND.inkSoft,
            })}">
              Sent ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} ·
              Atlanta Fine Homes Application Tracker
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: safeSubject, plainText, html };
}
