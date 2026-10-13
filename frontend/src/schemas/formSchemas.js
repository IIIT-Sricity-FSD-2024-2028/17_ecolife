import { z } from 'zod';

/**
 * One place for every form's validation rules. They mirror the backend DTOs
 * (same limits, same messages) so a value the UI accepts is a value the API
 * accepts, and a bad value is stopped before it ever leaves the browser.
 */

// ---- Primitives --------------------------------------------------------------

export const LIMITS = {
  name: 120,
  email: 254,
  password: 72,
  note: 1000,
  longNote: 2000,
};

export const text = (label, max = LIMITS.name) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/** Optional free text; empty is allowed. */
export const optionalText = (label, max) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`).optional().default('');

export const emailField = z
  .string({ required_error: 'Email is required', invalid_type_error: 'Email is required' })
  .trim()
  .min(1, 'Email is required')
  .max(LIMITS.email, `Email must be at most ${LIMITS.email} characters`)
  .email('Please enter a valid email address');

const PASSWORD_PATTERN = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
export const newPasswordField = z
  .string({ required_error: 'Password is required', invalid_type_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(LIMITS.password, `Password must be at most ${LIMITS.password} characters`)
  .regex(PASSWORD_PATTERN, 'Include an uppercase letter, a lowercase letter, and a number');

/** For sign-in only: presence and a sane cap (strength is enforced when a password is set). */
export const signInPasswordField = z
  .string({ required_error: 'Password is required' })
  .min(1, 'Password is required')
  .max(128, 'Password is too long');

export const phoneField = z
  .string()
  .trim()
  .max(30, 'Phone number must be at most 30 characters')
  .regex(/^[+()\-\s\d]*$/, 'Use digits, spaces, + ( ) and - only')
  .optional()
  .default('');

export const uuidField = (message) => z.string({ required_error: message }).min(1, message).uuid(message);

const isRealDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
export const dateField = (label) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .min(1, `${label} is required`)
    .refine(isRealDate, `${label} must be a valid date`);

/**
 * A number typed into an <input>. Arrives as a string; leaves as a number.
 * `gt` = exclusive minimum, `min` = inclusive minimum.
 */
export function numberField(label, { min, gt, max, int = false, decimals } = {}) {
  let num = z.number({ invalid_type_error: `${label} must be a number` });
  if (int) num = num.int(`${label} must be a whole number`);
  if (gt !== undefined) num = num.gt(gt, `${label} must be greater than ${gt}`);
  if (min !== undefined) num = num.min(min, `${label} must be at least ${min}`);
  if (max !== undefined) num = num.max(max, `${label} must be at most ${max.toLocaleString()}`);
  return z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => Number.isFinite(Number(v)), `${label} must be a number`)
    .refine(
      (v) => decimals === undefined || Math.abs(Number(v) * 10 ** decimals - Math.round(Number(v) * 10 ** decimals)) < 1e-6,
      `${label} can have at most ${decimals} decimal places`,
    )
    .transform(Number)
    .pipe(num);
}

/** Same, but an empty input means "not provided" (becomes undefined). */
export function optionalNumberField(label, opts) {
  const inner = numberField(label, opts);
  return z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : v))
    .pipe(z.union([z.undefined(), inner]));
}

const periodOrder = (d, ctx) => {
  if (d.periodStart && d.periodEnd && d.periodEnd < d.periodStart) {
    ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end cannot be before the start date' });
  }
};

// ---- Auth ----------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailField,
  password: signInPasswordField,
  remember: z.boolean().optional().default(false),
});

const confirmMatches = (field) => (d, ctx) => {
  if (d[field] !== d.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  }
};
const confirmField = z.string({ required_error: 'Please confirm your password' }).min(1, 'Please confirm your password');

export const registerOrgSchema = z
  .object({
    organizationName: text('Organization name'),
    fullName: text('Your full name'),
    email: emailField,
    password: newPasswordField,
    confirmPassword: confirmField,
  })
  .superRefine(confirmMatches('password'));

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ newPassword: newPasswordField, confirmPassword: confirmField })
  .superRefine(confirmMatches('newPassword'));

// ---- Profile ---------------------------------------------------------------------

export const profileDetailsSchema = z.object({ fullName: text('Full name'), jobTitle: optionalText('Job title', 80), phone: phoneField });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required').max(128),
    newPassword: newPasswordField,
    confirmPassword: confirmField,
  })
  .superRefine((d, ctx) => {
    confirmMatches('newPassword')(d, ctx);
    if (d.currentPassword && d.newPassword === d.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'New password must be different from the current one' });
    }
  });

// ---- Organization admin -------------------------------------------------------------

export const departmentSchema = z.object({
  name: text('Department name'),
  description: optionalText('Description', 500),
});

export const ORG_ROLES = ['ORG_ADMIN', 'CONTRIBUTOR', 'REVIEWER', 'EXECUTIVE'];
export const inviteUserSchema = z
  .object({
    fullName: text('Full name'),
    email: emailField,
    role: z.enum(ORG_ROLES, { errorMap: () => ({ message: 'Choose a role' }) }),
    departmentId: z.string().optional().default(''),
    temporaryPassword: newPasswordField,
  })
  .superRefine((d, ctx) => {
    if (d.role === 'CONTRIBUTOR' && !d.departmentId) {
      ctx.addIssue({ code: 'custom', path: ['departmentId'], message: 'Choose a department for a contributor' });
    }
  });

export const locationSchema = z.object({
  departmentId: uuidField('Choose a department'),
  name: text('Location name'),
  address: optionalText('Address', 250),
});

// ---- Reviewer --------------------------------------------------------------------------

export const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];

export const targetSchema = z
  .object({
    name: optionalText('Name', 100),
    notes: optionalText('Notes', 500),
    departmentId: z.string().optional().default(''),
    resourceCategory: z.string().optional().default(''),
    metric: z.enum(['usage', 'cost', 'emissions'], { errorMap: () => ({ message: 'Choose a metric' }) }),
    targetValue: numberField('Target value', { gt: 0, max: 1e12, decimals: 4 }),
    periodStart: dateField('Period start'),
    periodEnd: dateField('Period end'),
  })
  .superRefine(periodOrder);

export const reportSchema = z
  .object({ title: text('Title', 200), periodStart: dateField('Period start'), periodEnd: dateField('Period end') })
  .superRefine(periodOrder);

export const factorSchema = z.object({
  sourceId: uuidField('Choose a source'),
  gas: text('Gas', 20),
  factorValue: numberField('Factor value', { min: 0, max: 1e6, decimals: 8 }),
  gwp: numberField('GWP', { gt: 0, max: 1e5, decimals: 4 }),
  unit: text('Factor unit', 50),
  effectiveFrom: dateField('Effective from'),
  notes: optionalText('Notes', 500),
});

/** An organization override must say why it exists (auditors ask for the reference). */
export const overrideFactorSchema = factorSchema.extend({ notes: text('Reason or reference', 500) });

// ---- Platform admin -----------------------------------------------------------------------

export const adminInviteSchema = z.object({
  email: emailField,
  fullName: text('Full name'),
  role: z.enum(['SUPER_ADMIN', 'PLATFORM_ADMIN'], { errorMap: () => ({ message: 'Choose a role' }) }),
  temporaryPassword: newPasswordField,
});

export const sourceSchema = z.object({
  name: text('Source name', 200),
  publisher: text('Publisher', 200),
  referenceUrl: z
    .string()
    .trim()
    .max(500, 'URL must be at most 500 characters')
    .optional()
    .default('')
    .refine((v) => v === '' || /^https?:\/\/\S+\.\S+/.test(v), 'Enter a valid http(s) URL'),
});

const parseUnits = (s) => s.split(',').map((u) => u.trim()).filter(Boolean);
export const resourceTypeSchema = z
  .object({
    name: text('Name'),
    category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
    description: optionalText('Description', 500),
    defaultUnit: text('Default unit', 30),
    units: z.string({ required_error: 'List at least one unit' }).trim().min(1, 'List at least one unit'),
    evidenceThreshold: optionalNumberField('Evidence threshold', { min: 0, max: 1e9 }),
  })
  .superRefine((d, ctx) => {
    const units = parseUnits(d.units);
    if (units.some((u) => u.length > 30)) ctx.addIssue({ code: 'custom', path: ['units'], message: 'Each unit must be at most 30 characters' });
    if (new Set(units.map((u) => u.toLowerCase())).size !== units.length) {
      ctx.addIssue({ code: 'custom', path: ['units'], message: 'Units must be unique' });
    }
    if (units.length + (units.includes(d.defaultUnit) ? 0 : 1) > 20) {
      ctx.addIssue({ code: 'custom', path: ['units'], message: 'At most 20 units are allowed' });
    }
  });

export const planSchema = z.object({
  name: text('Plan name', 60),
  description: optionalText('Description', 200),
  priceMonthly: numberField('Monthly price', { min: 0, max: 1e6, decimals: 2 }),
  priceAnnual: numberField('Annual price', { min: 0, max: 1e6, decimals: 2 }),
  maxDepartments: numberField('Max departments', { min: 1, max: 999, int: true }),
  maxUsers: numberField('Max users', { min: 1, max: 999, int: true }),
  maxResourceTypes: numberField('Max resource types', { min: 1, max: 999, int: true }),
  reportFrequency: z.enum(['monthly', 'weekly'], { errorMap: () => ({ message: 'Choose a frequency' }) }),
});

// ---- Ad-hoc (non-react-hook-form) forms ------------------------------------------------------

/** Run a schema and flatten the result to `{ field: message }` (first message per field). */
export function validate(schema, values) {
  const r = schema.safeParse(values);
  if (r.success) return { ok: true, data: r.data, errors: {} };
  const errors = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, data: null, errors };
}

/** Reviewer / executive decision comment. `required` for reject / request-changes / revision. */
export const commentSchema = (required, requiredMessage = 'A comment is required') =>
  z.object({
    comment: required
      ? z.string().trim().min(1, requiredMessage).max(LIMITS.note, `Comment must be at most ${LIMITS.note} characters`)
      : z.string().trim().max(LIMITS.note, `Comment must be at most ${LIMITS.note} characters`),
  });

export const recordEditSchema = z.object({
  quantity: numberField('Quantity', { gt: 0, max: 1e9, decimals: 4 }),
  cost: optionalNumberField('Cost', { min: 0, max: 1e9, decimals: 2 }),
  notes: optionalText('Notes', LIMITS.note),
});

export const alertResponseSchema = (needsMeasures) =>
  z
    .object({
      explanation: text('Explanation', 1200),
      measures: needsMeasures ? text('Corrective measures', 700) : optionalText('Corrective measures', 700),
    });

export const amendmentSchema = z
  .object({
    recordId: z.string().min(1, 'Choose the approved entry to amend'),
    quantity: optionalNumberField('Corrected quantity', { gt: 0, max: 1e9, decimals: 4 }),
    cost: optionalNumberField('Corrected cost', { min: 0, max: 1e9, decimals: 2 }),
    reason: text('Reason', 1000),
  })
  .superRefine((d, ctx) => {
    if (d.quantity === undefined && d.cost === undefined) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Enter a corrected quantity or cost' });
    }
  });

export const submissionPeriodSchema = z
  .object({ periodStart: dateField('Period start'), periodEnd: dateField('Period end'), notes: optionalText('Notes', LIMITS.note) })
  .superRefine(periodOrder)
  .superRefine((d, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (d.periodStart && d.periodStart > today) {
      ctx.addIssue({ code: 'custom', path: ['periodStart'], message: 'You can’t log usage for a future period' });
    }
  });

export const entryRowSchema = z.object({
  resourceTypeId: z.string().min(1, 'Choose a resource type'),
  unit: z.string().min(1, 'Choose a unit'),
  quantity: numberField('Quantity', { gt: 0, max: 1e9, decimals: 4 }),
  cost: optionalNumberField('Cost', { min: 0, max: 1e9, decimals: 2 }),
});

// ---- Files ------------------------------------------------------------------------------------------

const EVIDENCE_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/csv',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const EVIDENCE_EXT = /\.(pdf|jpe?g|png|gif|webp|csv|xls|xlsx)$/i;

/** Returns an error message, or null if the file is acceptable as evidence. */
export function evidenceFileError(file) {
  if (!file) return 'Choose a file';
  if (file.size === 0) return 'That file is empty';
  if (file.size > 10 * 1024 * 1024) return 'File exceeds the 10 MB limit';
  if (!(EVIDENCE_TYPES.includes(file.type) || (!file.type && EVIDENCE_EXT.test(file.name)))) {
    return 'Accepted types: PDF, JPEG, PNG, GIF, WebP, CSV, Excel';
  }
  return null;
}

export function csvFileError(file) {
  if (!file) return 'Choose a CSV file';
  if (file.size === 0) return 'That file is empty';
  if (file.size > 5 * 1024 * 1024) return 'File exceeds the 5 MB limit';
  if (!(file.type === 'text/csv' || /\.csv$/i.test(file.name))) return 'Only .csv files are accepted';
  return null;
}
