import extraAllowedEmails from './allowed-google-emails.json';

const ALLOWED_DOMAIN = 'voren.com.mx';
const EXTRA_ALLOWED = new Set(extraAllowedEmails.map((e) => e.toLowerCase().trim()));

export function isAllowedGoogleEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`) || EXTRA_ALLOWED.has(normalized);
}
