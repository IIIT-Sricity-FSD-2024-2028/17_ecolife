import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * react-hook-form wired to a zod schema. Fields validate when the user leaves
 * them, then live as they correct them, and the form can't submit while any
 * rule is broken. Submit handlers receive the schema's parsed output
 * (trimmed strings, real numbers), never raw input text.
 */
export function useZodForm(schema, defaultValues, options = {}) {
  return useForm({ resolver: zodResolver(schema), defaultValues, mode: 'onTouched', reValidateMode: 'onChange', ...options });
}
