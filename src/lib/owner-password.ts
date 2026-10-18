import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';

const options = {N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024};
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
  });
}
export function validateOwnerPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 15 && value.length <= 128;
}
export async function hashOwnerPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return 'scrypt-v1:' + salt + ':' + (await derive(password, salt)).toString('hex');
}
export async function verifyOwnerPassword(password: string, stored: string | null | undefined) {
  // Unknown accounts use the same work factor as approved accounts.
  const valid = /^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored || '');
  const [, salt, expected] = valid ? stored!.split(':') : ['', '0'.repeat(32), '0'.repeat(128)];
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && valid;
}
