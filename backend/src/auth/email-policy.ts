/**
 * Basic "is this a real organization?" screening based on the email address
 * used to register it.
 *
 * What this does: rejects personal mailbox providers (Gmail, Yahoo...) and
 * throwaway/disposable domains, so an organization signs up with an address
 * on its own company domain.
 *
 * What this does NOT do: prove the person owns that mailbox or domain. That
 * needs an email verification step (send a confirmation link and require it
 * to be clicked), which the app can't do yet because email delivery is mocked.
 */

// Free / personal mailbox providers.
const PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'rediffmail.com',
  'tutanota.com',
  'fastmail.com',
]);

// Regional variants of the big providers, e.g. yahoo.co.in, outlook.in, hotmail.co.uk.
const PERSONAL_REGIONAL = /^(yahoo|hotmail|outlook|live|gmail)\.[a-z]{2,3}(\.[a-z]{2})?$/;

// Throwaway inbox services.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
]);

const DOMAIN_FORMAT = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;

export type WorkEmailResult =
  | { ok: true; domain: string }
  | { ok: false; reason: 'INVALID' | 'PERSONAL' | 'DISPOSABLE'; domain: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

export function checkWorkEmail(email: string): WorkEmailResult {
  const domain = getEmailDomain(normalizeEmail(email));

  if (!DOMAIN_FORMAT.test(domain)) return { ok: false, reason: 'INVALID', domain };
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: 'DISPOSABLE', domain };
  if (PERSONAL_DOMAINS.has(domain) || PERSONAL_REGIONAL.test(domain)) {
    return { ok: false, reason: 'PERSONAL', domain };
  }
  return { ok: true, domain };
}

export const WORK_EMAIL_MESSAGES: Record<'INVALID' | 'PERSONAL' | 'DISPOSABLE', string> = {
  INVALID: 'Please enter a valid work email address.',
  PERSONAL:
    'Please use your work email address. Personal providers like Gmail or Yahoo can’t be used to register an organization.',
  DISPOSABLE: 'Temporary email addresses can’t be used to register an organization. Please use your work email.',
};
