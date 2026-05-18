# Renewal Reminder Emails - Draft Copy for Review

**Status:** DRAFT - wording only. Not wired into the send pipeline yet.
**For:** Sarah's review before anything goes out.
**Source:** May 15, 2026 review meeting.

---

## What this is

The tracker already has a working renewal-reminder email system (branded template,
scheduler, send log, ACS delivery). What Sarah asked for is a **wording change** - the
current single template is urgency-styled but generic. She wants five distinct, more
*proactive* messages that help department heads get ahead of renewals and offer them
help with negotiation.

These are drafts so Sarah can redline the copy. Once she signs off, the wording gets
folded into `server/emailTemplate.mjs` and the scheduler's trigger days are adjusted.

## Trigger plan (for context - not active yet)

| Email | Fires when | Frequency |
|-------|-----------|-----------|
| 90-day | 90 days before renewal date | Once |
| 60-day | 60 days before renewal date | Once |
| 30-day | 30 days before renewal date | Once |
| Expiration day | On the renewal date | Once |
| Post-expiration | Renewal date has passed, record not updated | Every 30 days until updated |

- **Recipients:** the application's co-owner(s) from Monday. (There is no separate
  single "owner" field - co-owner *is* how ownership is modeled. Flagging in case
  Sarah expects a distinct owner.)
- Apps flagged **"Term Information Missing"** (see in-app fixes) are stale by
  definition - proposal is they receive the Expiration / Post-expiration email so the
  data gets corrected. Confirm with Sarah.

## Fields every email pulls from the record

Recipient name · application name · vendor · term · monthly cost · annual cost ·
renewal date · a link straight to that record in the tracker.

> Note: the current template shows a single "Amount on file." Sarah asked to show what
> they're *currently paying*, so these drafts show **monthly + annual** explicitly.

## Shared "how to update" block (appears in all five)

> **Update it in under a minute:**
> 1. Open the Application Tracker → [link to this record]
> 2. The record opens straight to the renewal details.
> 3. Update the renewal date, term, and cost, then hit **Save** - it writes straight
>    back to Monday, so there's nothing else to do.

---

# 1 - 90-Day Reminder (friendly heads-up)

**Subject:** Heads-up: {{appName}} renews in 90 days

Hi {{recipientName}},

Quick heads-up - **{{appName}}** is set to renew on **{{renewalDate}}**, about 90 days
out. Nothing urgent, but this is the best time to start thinking about it.

Here's what we have on file:

- **Application:** {{appName}} ({{vendor}})
- **Term:** {{term}}
- **Cost:** {{monthlyCost}}/mo · {{annualCost}}/yr
- **Renews:** {{renewalDate}}

If this is a tool you're planning to keep, the 90-day mark is the ideal window to
negotiate - vendors are far more flexible before a deadline is on top of them. If you'd
like, we can help you figure out what this *should* cost and start the conversation
with the vendor on your behalf.

*[how-to-update block]*

Thanks for helping keep our records sharp,
The Application Tracker team · Atlanta Fine Homes

---

# 2 - 60-Day Reminder (nudge + negotiate)

**Subject:** {{appName}} renews in 2 months - a good time to review pricing

Hi {{recipientName}},

**{{appName}}** renews on **{{renewalDate}}** - about two months away. If you haven't
already started the conversation with the vendor, now's the time.

On file:

- **Application:** {{appName}} ({{vendor}})
- **Term:** {{term}}
- **Cost:** {{monthlyCost}}/mo · {{annualCost}}/yr
- **Renews:** {{renewalDate}}

A few things worth checking before it renews:

- Are you still using everything you're paying for - seats, tier, add-ons?
- Has the vendor raised the price since last year?
- Would a longer term or annual prepay bring the rate down?

We're glad to help you negotiate or price out alternatives - just reply and let us know.

*[how-to-update block]*

---

# 3 - 30-Day Reminder (action-oriented)

**Subject:** Action needed: {{appName}} renews in 30 days

Hi {{recipientName}},

**{{appName}}** renews in about 30 days, on **{{renewalDate}}**. This is the point to
lock things in.

On file:

- **Application:** {{appName}} ({{vendor}})
- **Term:** {{term}}
- **Cost:** {{monthlyCost}}/mo · {{annualCost}}/yr
- **Renews:** {{renewalDate}}

**What to do now:**

- Connect with your vendor rep to confirm pricing and terms for the upcoming period.
- **If you've already handled the renewal** - great. Please update the record in the
  tracker so we have the latest date and cost.
- **If the pricing changed**, review and update the cost in the tracker so spend
  reporting stays accurate.

Some agreements require advance notice to change or cancel - if either is on the table,
don't let this one sit.

Want us to help negotiate or look at an alternative? Reply and we'll jump in.

*[how-to-update block]*

---

# 4 - Expiration Day

**Subject:** {{appName}} reached its renewal date today

Hi {{recipientName}},

Our records show **{{appName}}** reached its renewal date today (**{{renewalDate}}**).

On file:

- **Application:** {{appName}} ({{vendor}})
- **Term:** {{term}}
- **Cost:** {{monthlyCost}}/mo · {{annualCost}}/yr

- **If it renewed:** please update the renewal date, term, and cost in the tracker so
  our records reflect the new period.
- **If it's being dropped:** reply and let us know so we can mark it inactive.

Either way, we need an updated entry to keep our application records and spend
reporting accurate.

*[how-to-update block]*

---

# 5 - Post-Expiration (monthly until updated)

**Subject:** Still need an update on {{appName}}

Hi {{recipientName}},

We're still showing **{{appName}}** as past its renewal date (**{{renewalDate}}**) with
no updated information. This is a monthly reminder until the record is refreshed.

On file:

- **Application:** {{appName}} ({{vendor}})
- **Term:** {{term}}
- **Cost:** {{monthlyCost}}/mo · {{annualCost}}/yr

As the owner of this application, you're our source of truth for it. A current record
helps the whole company see what we use and what we spend - and lets us support you
when it's time to renew. We're trusting you to keep this one accurate on the company's
behalf.

It only takes a minute:

*[how-to-update block]*

If this application is no longer in use, just reply and we'll remove it.

---

## Open questions for Sarah

1. Sign-off on tone and wording for each of the five.
2. Should the Post-expiration email really repeat **monthly forever**, or stop after
   a few cycles (e.g. 3) and escalate to the department head instead?
3. Recipients are co-owner(s) only - is that the right audience, or should it also
   copy the department head?
4. OK to also send the Expiration / Post-expiration email to apps that are missing
   their renewal/term info entirely?
