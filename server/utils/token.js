import crypto from 'crypto';

const VERIFICATION_TOKEN_HOURS = 48;

export function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);
  return { token, tokenHash, expiresAt };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
