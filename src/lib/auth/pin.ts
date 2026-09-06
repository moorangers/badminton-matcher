import bcrypt from 'bcryptjs';

const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(pin: string) {
  return PIN_PATTERN.test(pin);
}

export function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}
