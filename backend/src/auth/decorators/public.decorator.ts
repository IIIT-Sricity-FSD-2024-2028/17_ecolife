import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Explicitly marks a route (or controller) as reachable without a token.
 * Every route must carry either this or @OrgAuth/@PlatformAuth; the global
 * AuthRequiredGuard rejects anything that has neither (deny by default).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
