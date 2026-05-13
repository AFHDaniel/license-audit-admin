//
// Atlanta Fine Homes brand-styled email templates.
//
// All rendering is server-side and produces an `{ subject, plainText, html }`
// object so every email channel (ACS, plain SMTP later, preview UI) shares
// one source of truth. Emails are built with tables + inline styles because
// Outlook, Apple Mail, Gmail web, and ProtonMail all interpret modern CSS
// differently — tables + inline are the only reliable cross-client format.
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
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not on file';
  return `$${numeric.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatRenewalDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

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

function tierLabel(tier, daysUntilRenewal) {
  const abs = Math.abs(daysUntilRenewal);
  const plural = (n) => (n === 1 ? '' : 'S');
  switch (tier) {
    case 'overdue-severe':
      return `${abs >= 90 ? 'LIKELY LAPSED' : 'SEVERELY OVERDUE'} — ${abs} DAYS PAST DUE`;
    case 'overdue':
      return `OVERDUE BY ${abs} DAY${plural(abs)}`;
    case 'critical':
      return daysUntilRenewal === 0 ? 'RENEWS TODAY' : `RENEWS IN ${daysUntilRenewal} DAY${plural(daysUntilRenewal)}`;
    case 'high':
    case 'medium':
    case 'planning':
    case 'info':
    default:
      return `RENEWS IN ${daysUntilRenewal} DAYS`;
  }
}

function tierColors(tier) {
  switch (tier) {
    case 'overdue-severe':
      return { bg: '#7a0c0c', ink: '#ffffff', accent: '#7a0c0c' };
    case 'overdue':
    case 'critical':
      return { bg: BRAND.dangerBg, ink: BRAND.dangerInk, accent: '#c0392b' };
    case 'high':
      return { bg: BRAND.warnBg, ink: BRAND.warnInk, accent: BRAND.gold };
    case 'medium':
      return { bg: BRAND.okBg, ink: BRAND.okInk, accent: BRAND.gold };
    case 'planning':
      return { bg: '#eef3f8', ink: BRAND.navySoft, accent: BRAND.navy };
    case 'info':
    default:
      return { bg: '#f3f4f6', ink: BRAND.inkSoft, accent: BRAND.navy };
  }
}

function tierMessage(tier, daysUntilRenewal, applicationName) {
  const abs = Math.abs(daysUntilRenewal);
  switch (tier) {
    case 'overdue-severe':
      if (abs >= 90) {
        return `${applicationName} is ${abs} days past its renewal date. At this point the service has very likely been suspended or canceled by the vendor. Confirm directly with the vendor whether the license is still active and either renew, archive the record, or remove it from the Application Tracker.`;
      }
      return `${applicationName} is ${abs} days past its renewal date. The service may already have been suspended or downgraded. Contact the vendor immediately to confirm status and either renew or close out the record in the Application Tracker.`;
    case 'overdue':
      return `${applicationName} was due for renewal ${abs} day${abs === 1 ? '' : 's'} ago and is currently past its renewal date. Confirm the renewal status with the vendor and update the record in the Application Tracker so it doesn't lapse.`;
    case 'critical':
      if (daysUntilRenewal === 0) {
        return `${applicationName} renews today. If the renewal is auto-billed, confirm the payment method on file is current. If it's manual, action is needed right now to avoid a lapse.`;
      }
      return `${applicationName} renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}. If the renewal is auto-billed, confirm the payment method on file is still valid. If it's manual, action is needed this week.`;
    case 'high':
      return `${applicationName} renews in ${daysUntilRenewal} days. This is a heads-up so you can confirm whether you still need the licenses, review payment details, and avoid a last-minute scramble.`;
    case 'medium':
      return `${applicationName} renews in ${daysUntilRenewal} days. No immediate action required — this email is a planning notice so the renewal doesn't surprise the budget.`;
    case 'planning':
      if (daysUntilRenewal > 60) {
        return `${applicationName} renews in ${daysUntilRenewal} days. Long-lead heads-up so the renewal lands in your quarterly budget review with plenty of time to evaluate seats, alternatives, and contract terms.`;
      }
      return `${applicationName} renews in ${daysUntilRenewal} days. Good moment to put it on the next budget review and confirm with the team that the tool is still in active use.`;
    case 'info':
    default:
      return `${applicationName} renews in ${daysUntilRenewal} days. Informational notice from the Application Tracker — no action required yet.`;
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

/**
 * Render a branded renewal-reminder email.
 * @param {object} input
 * @param {object} input.license             license record (id, application, vendor, department, renewalDate, renewalMethod, amount, seats, useCase)
 * @param {number} input.daysUntilRenewal    integer days remaining (negative = overdue)
 * @param {string} [input.detailUrl]         override the dashboard URL (defaults to applications.atlantafinehomes.com)
 * @param {string} [input.recipientName]     personalize greeting (falls back to "team")
 */
export function renderRenewalReminder({ license, daysUntilRenewal, detailUrl, recipientName }) {
  if (!license) throw new Error('renderRenewalReminder requires a license');
  const tier = urgencyTier(daysUntilRenewal);
  const colors = tierColors(tier);
  const label = tierLabel(tier, daysUntilRenewal);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi team,';

  const application = license.application || 'Unnamed application';
  const vendor = license.vendor || '';
  const department = license.department || 'Unassigned';
  const renewalDate = formatRenewalDate(license.renewalDate);
  const method = license.renewalMethod || 'Manual';
  const amount = formatCurrency(license.amount);
  const seats = license.seats ? String(license.seats) : '';
  const url = detailUrl || `https://applications.atlantafinehomes.com/license/${encodeURIComponent(license.id || '')}`;
  const message = tierMessage(tier, daysUntilRenewal, application);

  const subjectPrefix = tier === 'overdue-severe'
      ? (Math.abs(daysUntilRenewal) >= 90 ? 'LAPSED' : 'SEVERELY OVERDUE')
    : tier === 'overdue' ? 'OVERDUE'
    : tier === 'critical' ? (daysUntilRenewal === 0 ? 'Renews today' : 'Action needed')
    : tier === 'high' ? 'Renewal in 2 weeks'
    : tier === 'medium' ? 'Renewal notice'
    : tier === 'planning' ? (daysUntilRenewal > 60 ? 'Renewal heads-up (90d)' : 'Renewal heads-up')
    : 'Renewal notice';
  const subject = `${subjectPrefix}: ${application} — ${label.toLowerCase()}`;

  const plainText = [
    `${greeting}`,
    '',
    message,
    '',
    `Application: ${application}${vendor ? ` (vendor: ${vendor})` : ''}`,
    `Department: ${department}`,
    `Renewal date: ${renewalDate}`,
    `Renewal method: ${method}`,
    `Amount on file: ${amount}`,
    seats ? `Seats: ${seats}` : null,
    '',
    `Review and update in the Application Tracker:`,
    url,
    '',
    `— Atlanta Fine Homes Application Tracker`,
    `This is an automated notification. To stop receiving these, contact daniel@atlantafinehomes.com.`,
  ].filter(Boolean).join('\n');

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

          <!-- Urgency banner -->
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
              ${escapeHtml(label)}
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
                margin: '0 0 24px 0',
                fontFamily: FONT_STACK,
                fontSize: '15px',
                lineHeight: '1.6',
                color: BRAND.ink,
              })}">
                ${escapeHtml(message)}
              </p>

              <!-- Info table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${styleAttr({
                border: `1px solid ${BRAND.border}`,
                borderRadius: '6px',
                borderCollapse: 'separate',
                marginBottom: '24px',
              })}">
                ${infoRow('Application', application)}
                ${vendor ? infoRow('Vendor', vendor) : ''}
                ${infoRow('Department', department)}
                ${infoRow('Renewal date', renewalDate)}
                ${infoRow('Renewal method', method)}
                ${infoRow('Amount on file', amount)}
                ${seats ? infoRow('Seats', seats) : ''}
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 4px 0;">
                    ${buttonCell(url, 'Review in Application Tracker')}
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
              This is an automated reminder from the Atlanta Fine Homes Application Tracker.<br />
              Records are sourced from Monday.com and resynced every 30 seconds.<br />
              Questions or want to unsubscribe? Email
              <a href="mailto:daniel@atlantafinehomes.com" style="color: ${BRAND.navy}; text-decoration: underline;">daniel@atlantafinehomes.com</a>.
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
 * Render an admin test email — same brand chrome, no renewal data.
 */
export function renderAdminTest({ subject, message, requestedBy }) {
  const safeSubject = subject || 'Application Tracker — pipeline test';
  const safeMessage = message || 'This is a test email from the Atlanta Fine Homes Application Tracker confirming ACS delivery is working.';

  const plainText = [
    safeMessage,
    '',
    requestedBy ? `Triggered by: ${requestedBy}` : null,
    `Sent at: ${new Date().toISOString()}`,
    '',
    `— Atlanta Fine Homes Application Tracker`,
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
