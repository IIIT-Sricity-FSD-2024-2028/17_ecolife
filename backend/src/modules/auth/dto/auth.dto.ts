import { z } from 'zod';

export const loginDtoSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
  totpCode: z.string().optional(),
  recoveryCode: z.string().optional()
});
export type LoginDto = z.infer<typeof loginDtoSchema>;

export const registerDtoSchema = z.object({
  organizationName: z.string().min(2).max(160),
  industrySector: z.string().min(2).max(120).optional(),
  city: z.string().min(2).max(80).default('Pune'),
  state: z.string().min(2).max(80).default('Maharashtra'),
  preset: z.string().optional(), // ignored: kept so older clients still work
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128)
});
export type RegisterDto = z.infer<typeof registerDtoSchema>;

export const verifyEmailDtoSchema = z.object({ token: z.string().min(10) });
export const forgotPasswordDtoSchema = z.object({ email: z.string().email() });
export const resetPasswordDtoSchema = z.object({ token: z.string().min(10), newPassword: z.string().min(10).max(128) });
export const changePasswordDtoSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) });
export const enable2faDtoSchema = z.object({ code: z.string().length(6) });
export const disable2faDtoSchema = z.object({ password: z.string().min(1), code: z.string().length(6).optional(), recoveryCode: z.string().min(4).max(20).optional() });
export const acceptInviteDtoSchema = z.object({ fullName: z.string().min(2).max(120), password: z.string().min(10).max(128) });
