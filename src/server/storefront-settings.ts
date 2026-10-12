import { prisma } from '../lib/prisma';
import { isDemoCatalogEnabled, policies } from './catalog';
import { withOriginalDemoContactFallback } from '../lib/original-store-content';

export interface StorefrontSettings {
  storeName: string;
  logoUrl: string;
  tagline: string;
  homeTitle: string;
  homeDescription: string;
  announcement: string;
  supportPhone: string;
  supportTechnicalPhone: string;
  supportEmail: string;
  footerText: string;
  socialLinks: { facebook: string; instagram: string; whatsapp: string };
}

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = {
  storeName: 'Dev-X Book Store',
  logoUrl: '',
  tagline: 'كتب وتيشرتات ونوت بوك ومنتجات متنوعة لعشاق التعلّم والتقنية.',
  homeTitle: 'كل اللي محتاجه للتعلّم في مكان واحد',
  homeDescription: 'كتب، تيشرتات، نوت بوك ومنتجات متنوعة لعشاق التعلّم والتقنية من Dev-X Book Store.',
  announcement: '',
  supportPhone: '',
  supportTechnicalPhone: '',
  supportEmail: '',
  footerText: 'كتب وتيشرتات ونوت بوك ومنتجات متنوعة لعشاق التعلّم والتقنية.',
  socialLinks: { facebook: '', instagram: '', whatsapp: '' },
};

export function parseStorefrontSettings(value: unknown): StorefrontSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_STOREFRONT_SETTINGS;
  const input = value as Record<string, unknown>;
  const social = input.socialLinks && typeof input.socialLinks === 'object' && !Array.isArray(input.socialLinks)
    ? input.socialLinks as Record<string, unknown> : {};
  const text = (key: keyof Omit<StorefrontSettings, 'socialLinks'>) =>
    typeof input[key] === 'string' ? input[key] as string : DEFAULT_STOREFRONT_SETTINGS[key];
  return {
    storeName: text('storeName'),
    logoUrl: text('logoUrl'),
    tagline: text('tagline'),
    homeTitle: text('homeTitle'),
    homeDescription: text('homeDescription'),
    announcement: text('announcement'),
    supportPhone: text('supportPhone'),
    supportTechnicalPhone: text('supportTechnicalPhone'),
    supportEmail: text('supportEmail'),
    footerText: text('footerText'),
    socialLinks: {
      facebook: typeof social.facebook === 'string' ? social.facebook : '',
      instagram: typeof social.instagram === 'string' ? social.instagram : '',
      whatsapp: typeof social.whatsapp === 'string' ? social.whatsapp : '',
    },
  };
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  if (isDemoCatalogEnabled()) {
    return withOriginalDemoContactFallback(DEFAULT_STOREFRONT_SETTINGS);
  }
  const setting = await prisma.storeSetting.findUnique({ where: { key: 'storefront' }, select: { value: true } });
  const storefront = parseStorefrontSettings(setting?.value);
  return process.env.NODE_ENV === 'production' ? storefront : withOriginalDemoContactFallback(storefront);
}

export const defaultPolicies = policies;
