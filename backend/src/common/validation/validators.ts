import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * Shared validation building blocks, so every DTO enforces the same rules
 * (trimming, length caps, password strength, date ordering) instead of each
 * one re-inventing a slightly different version.
 */

export const trimValue = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value;

export const MAX_EMAIL = 254;
/** bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated. */
export const MAX_PASSWORD = 72;
export const PASSWORD_PATTERN = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
export const PASSWORD_RULE_MESSAGE = 'Password must include an uppercase letter, a lowercase letter, and a number';

/** Required text: trimmed, non-empty, capped. */
export function RequiredText(max: number, emptyMessage = 'This field is required') {
  return applyDecorators(
    Transform(trimValue),
    IsString({ message: emptyMessage }),
    IsNotEmpty({ message: emptyMessage }),
    MaxLength(max, { message: `Must be at most ${max} characters` }),
  );
}

/** Optional text: trimmed and capped; an empty string is allowed (used to clear a value). */
export function OptionalText(max: number) {
  return applyDecorators(
    IsOptional(),
    Transform(trimValue),
    IsString(),
    MaxLength(max, { message: `Must be at most ${max} characters` }),
  );
}

/** Trimmed + lower-cased, valid format, RFC-length cap. */
export function IsEmailAddress() {
  return applyDecorators(
    Transform(normalizeEmail),
    IsEmail({}, { message: 'Please enter a valid email address' }),
    MaxLength(MAX_EMAIL, { message: `Email must be at most ${MAX_EMAIL} characters` }),
  );
}

/** New-password rules: 8–72 chars with upper, lower and a digit. */
export function IsNewPassword() {
  return applyDecorators(
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters' }),
    MaxLength(MAX_PASSWORD, { message: `Password must be at most ${MAX_PASSWORD} characters` }),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }),
  );
}

/** A list of trimmed strings (use with IsString({ each: true }) etc). */
export const TrimEach = () => Transform(trimEach);

/** The decorated date must be the same as or later than another property of the same DTO. */
export function IsNotBefore(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotBefore',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: { message: `${propertyName} cannot be before ${property}`, ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[args.constraints[0]];
          if (typeof value !== 'string' || typeof other !== 'string') return true; // other validators report missing/invalid dates
          const a = new Date(value).getTime();
          const b = new Date(other).getTime();
          return Number.isNaN(a) || Number.isNaN(b) || a >= b;
        },
      },
    });
  };
}

/** Strict ISO date options: rejects impossible dates such as 2026-02-30. */
export const STRICT_DATE = { strict: true } as const;
