/** Shared input rules, used by both the register route and the sign-in form. */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;
export const NAME_MAX = 60;

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Deliberately permissive. The only addresses worth rejecting here are ones
 * that cannot be an address at all; anything stricter rejects valid mail.
 * Real confirmation that an address exists needs a verification email.
 */
export function emailProblem(email: string): string | null {
  if (!email) return 'Enter your email address.';
  if (email.length > 254) return 'That email address is too long.';
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) return 'That does not look like an email address.';
  return null;
}

/**
 * Length is the requirement. Composition rules ("one capital, one symbol")
 * push people towards predictable substitutions and measurably do not help,
 * so the only other check is against the handful of passwords that show up
 * first in every credential-stuffing list.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', '1234567890', '12345678901',
  'qwertyuiop', 'qwerty123', 'iloveyou1', 'letmein123', 'welcome123', 'admin123456',
  'abc123456', 'password1234', 'football123', 'cubetimer', 'rubikscube',
]);

export function passwordProblem(password: string): string | null {
  if (!password) return 'Choose a password.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return 'That password is too long.';
  if (COMMON.has(password.toLowerCase())) return 'That password is too easy to guess.';
  return null;
}

export function nameProblem(name: string): string | null {
  if (name.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters.`;
  return null;
}

/**
 * The name shown on the leaderboard. Falls back to the local part of the
 * address so the board never shows a full email.
 */
export function displayNameFrom(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  const local = email.split('@')[0] ?? 'cuber';
  return local.slice(0, NAME_MAX);
}
