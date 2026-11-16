import crypto from 'node:crypto';

export const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString('base64url');
export const randomId = (prefix: string): string => `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
export const uuid = (): string => crypto.randomUUID();

export function randomInt(maxExclusive: number): number {
  return crypto.randomInt(maxExclusive);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
