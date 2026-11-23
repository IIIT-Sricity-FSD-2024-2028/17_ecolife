import { BadRequestException } from '@nestjs/common';

// Small deny-list of the most common passwords; NIST SP 800-63B asks verifiers to reject commonly-used/compromised values.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'qwerty123', 'qwertyuiop', '12345678', '123456789', '1234567890',
  'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein123', 'abc12345', 'tropos123', 'changeme', 'india1234', 'india@123'
]);

export function assertPasswordPolicy(password: string, email?: string) {
  if (password.length < 10) throw new BadRequestException('Password must be at least 10 characters long.');
  if (password.length > 128) throw new BadRequestException('Password must be at most 128 characters long.');
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) throw new BadRequestException('That password is too common. Choose something harder to guess.');
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) throw new BadRequestException('Password must not contain your e-mail name.');
  if (/^(.)\1+$/.test(password)) throw new BadRequestException('Password must not be a single repeated character.');
}
