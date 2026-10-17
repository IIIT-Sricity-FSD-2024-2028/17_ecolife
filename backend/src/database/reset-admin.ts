/**
 * Last-resort recovery for a platform admin who cannot sign in (forgotten password, or the only
 * Super Admin is locked out). Needs access to the server, which is the whole point: there is no
 * email service yet, so recovery is gated by who can run commands on the machine.
 *
 *   STOP THE BACKEND FIRST. The running server keeps its own copy of data.json in memory and
 *   would overwrite this change the next time it saves.
 *
 *   npm run reset-admin -- admin@example.com
 *   RESET_ADMIN_PASSWORD='MyNewPass1!' npm run reset-admin -- admin@example.com
 *
 * Without RESET_ADMIN_PASSWORD a random password is generated and printed once. Sessions issued
 * before the reset stop working, and any lockout is cleared.
 */
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { loadStore, saveStore } from './persistence';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run reset-admin -- <admin email>   (stop the backend first)");
    process.exit(1);
    return;
  }

  const store = loadStore();
  const admin = store.platformAdmins.find((a) => a.email.toLowerCase() === email);
  if (!admin) {
    console.error(`No platform admin with email ${email}.`);
    process.exit(1);
    return;
  }
  if (!admin.isActive) {
    console.error(`${email} is deactivated. Reactivate the account first; this script only resets passwords.`);
    process.exit(1);
    return;
  }

  const supplied = process.env.RESET_ADMIN_PASSWORD;
  if (supplied && !PASSWORD_PATTERN.test(supplied)) {
    console.error('RESET_ADMIN_PASSWORD must be 8-72 characters with upper, lower, a digit and a symbol.');
    process.exit(1);
    return;
  }
  // Generated passwords always satisfy the pattern: random base64url plus one of each class.
  const password = supplied ?? `${randomBytes(9).toString('base64url')}aA1!`;

  admin.passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS ?? 10));
  admin.passwordChangedAt = new Date().toISOString(); // kills every earlier session
  admin.failedLoginCount = 0;
  admin.lockedUntil = null;
  admin.updatedAt = new Date().toISOString();

  // Any pending reset codes/links for this admin are void now.
  for (const t of store.passwordResetTokens) {
    if (t.platformAdminId === admin.id && !t.usedAt) t.usedAt = new Date().toISOString();
  }

  saveStore(store);
  await new Promise((r) => setTimeout(r, 500)); // saveStore is debounced; let it hit the disk

  console.log(`Password reset for ${admin.fullName} <${admin.email}> (${admin.role}).`);
  if (!supplied) console.log(`New password (shown once): ${password}`);
  console.log('Start the backend again, then sign in and change the password in Profile.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
