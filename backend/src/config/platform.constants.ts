/** Product-wide constants that both the API and the screens must agree on. The screens read them from GET /meta/public. */
export const TRIAL_DAYS = 30;

/** States and union territories of India (as listed by the Government of India). */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
] as const;

/** Every module is on during the trial; we never guess what a company needs from its size. */
export const ALL_MODULES = ['FUELS', 'ELECTRICITY', 'WATER', 'WASTE', 'REFRIGERANTS', 'AIR', 'MATERIALS', 'VALUE_CHAIN', 'GREEN_ECONOMY', 'TARGETS', 'ASSURANCE'] as const;
/** Plan that carries every feature. Plan-based limits come later, once pricing is decided. */
export const TRIAL_PLAN_CODE = 'ENTERPRISE_BRSR';

/** Full address of a screen, for links in emails. APP_BASE_URL wins; otherwise the frontend origin. */
export function appLink(path: string): string {
  const base = (process.env.APP_BASE_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}
