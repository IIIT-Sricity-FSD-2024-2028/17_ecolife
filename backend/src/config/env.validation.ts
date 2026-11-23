import { z } from 'zod';
import { isValidGstin } from '../common/utils/gstin.util';

const envSchema = z.object({
  DATABASE_URL: z.string().min(10, 'DATABASE_URL must be a valid PostgreSQL connection string'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  ALLOW_DEV_PREVIEW_TOKENS: z.enum(['true', 'false']).default('false'),
  ALLOW_SUPERUSER_DB: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be 64 hex characters').optional(),
  JWT_EXPIRES_IN: z.string().default('12h'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('Tropos ERP <no-reply@tropos.in>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(10),
  // Billing identity. All three must be set before the platform can issue a GST invoice; none is assumed.
  BILLING_SUPPLIER_GSTIN: z.string().trim().toUpperCase().refine(isValidGstin, 'BILLING_SUPPLIER_GSTIN must be a valid GSTIN').optional(),
  BILLING_SUPPLIER_NAME: z.string().trim().min(2).optional(),
  BILLING_SUPPLIER_ADDRESS: z.string().trim().min(5).optional(),
  BILLING_SAC_CODE: z.string().trim().regex(/^\d{6}$/, 'BILLING_SAC_CODE must be 6 digits').optional(),
  BILLING_GST_RATE_PCT: z.coerce.number().min(0).max(40).optional(),
  BILLING_PAYMENT_TERMS_DAYS: z.coerce.number().int().min(0).max(120).default(15),
  // Online payment. Keys come from the environment only; never from the app or chat. Use Razorpay TEST keys until launch.
  // Shown to customers on the billing page when online payment is off: bank or UPI details, or who to contact.
  PAYMENT_INSTRUCTIONS: z.string().trim().max(600).optional().default(''),
  PAYMENT_PROVIDER: z.enum(['none', 'razorpay']).default('none'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_API_BASE: z.string().url().default('https://api.razorpay.com/v1'),
  STORAGE_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('tropos-evidence')
}).superRefine((v, ctx) => {
  if (v.STORAGE_PROVIDER === 'supabase' && (!v.SUPABASE_URL || !v.SUPABASE_SERVICE_ROLE_KEY)) ctx.addIssue({ code: 'custom', path: ['STORAGE_PROVIDER'], message: 'STORAGE_PROVIDER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });
});

export type AppEnv = Omit<z.infer<typeof envSchema>, 'JWT_SECRET'> & { JWT_SECRET: string };

/** Dev-preview tokens (reset/verify tokens echoed in API responses) need BOTH a non-production NODE_ENV and an explicit opt-in. */
export function devPreviewEnabled(): boolean {
  const e = getEnv();
  return e.NODE_ENV !== 'production' && e.ALLOW_DEV_PREVIEW_TOKENS === 'true';
}

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const data = parsed.data;
  let secret = data.JWT_SECRET;
  if (!secret) {
    if (data.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration: JWT_SECRET (min 32 chars) is required in production');
    }
    secret = 'tropos-dev-only-secret-never-use-in-production-0000';
  }
  if (data.NODE_ENV === 'production' && /change-me|replace-with|dev-only/i.test(secret)) {
    throw new Error('Invalid environment configuration: JWT_SECRET looks like a placeholder; set a random 64-hex secret');
  }
  cachedEnv = { ...data, JWT_SECRET: secret };
  return cachedEnv;
}
