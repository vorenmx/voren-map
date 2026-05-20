const ALLOWED_DOMAIN = 'voren.com.mx';

export function isAllowedGoogleEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return email.toLowerCase().trim().endsWith(`@${ALLOWED_DOMAIN}`);
}
