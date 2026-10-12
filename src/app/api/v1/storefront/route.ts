import { handle, ok } from '@/server/http';
import { getStorefrontSettings } from '@/server/storefront-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async () => ok({ settings: await getStorefrontSettings() }));
