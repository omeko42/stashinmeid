#!/usr/bin/env node
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}

if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');

console.log('\nSet SUPERADMIN_PASSWORD_HASH to this value in your deployment environment:\n');
console.log(`${salt}:${hash}\n`);
console.log('The plaintext password is not stored.');
