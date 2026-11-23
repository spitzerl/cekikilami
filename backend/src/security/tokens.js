import crypto from 'node:crypto';

const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const SESSION_CODE_LENGTH = 6;

export function generateSessionCode() {
  let code = '';
  for (let index = 0; index < SESSION_CODE_LENGTH; index += 1) {
    code += SESSION_CODE_ALPHABET[crypto.randomInt(SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

export function generatePlayerToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAvatarSeed() {
  return crypto.randomBytes(12).toString('base64url');
}

export function generateUploadFilename(extension) {
  return `${crypto.randomBytes(16).toString('hex')}${extension}`;
}
