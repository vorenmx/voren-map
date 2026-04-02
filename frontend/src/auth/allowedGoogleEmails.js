import list from './allowed-google-emails.json';

const ALLOWED_GOOGLE_EMAIL_SET = new Set(
  list.map((e) => String(e).toLowerCase().trim())
);

export function isAllowedGoogleEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return ALLOWED_GOOGLE_EMAIL_SET.has(email.toLowerCase().trim());
}
