import { httpError } from './errors.js';

export function normalizeSessionCode(value) {
  return requireNonEmptyString(value, 'code', { maxLength: 12 }).toUpperCase();
}

export function requireNonEmptyString(value, fieldName, { maxLength = 255 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `Le champ ${fieldName} est requis`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw httpError(400, `Le champ ${fieldName} est trop long`);
  }
  return trimmed;
}

export function requirePlayerName(value, fieldName = 'playerName') {
  const name = requireNonEmptyString(value, fieldName, { maxLength: 32 });
  // Collapse whitespace so "Lucas  " and "Lucas" cannot create twin rows.
  return name.replace(/\s+/g, ' ');
}

export function requirePositiveInteger(value, fieldName) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw httpError(400, `Le champ ${fieldName} doit être un entier positif`);
  }
  return parsed;
}

export function requireIntegerInRange(value, fieldName, { min, max }) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw httpError(400, `Le champ ${fieldName} doit être un entier entre ${min} et ${max}`);
  }
  return parsed;
}

export function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw httpError(400, `Le champ ${fieldName} doit être un booléen`);
  }
  return value;
}

export function optionalInteger(value, fieldName, options) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireIntegerInRange(value, fieldName, options);
}

export function optionalBoolean(value, fieldName) {
  if (value === undefined || value === null) return undefined;
  return requireBoolean(value, fieldName);
}
