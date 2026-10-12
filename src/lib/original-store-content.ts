export interface OriginalDemoBranch {
  id: string;
  name: string;
  address: string;
  hours: string;
  phone: string;
  mapUrl: string;
}

export const ORIGINAL_DEMO_BRANCHES: readonly OriginalDemoBranch[] = [
  { id: 'b1', name: 'The Best', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b2', name: 'The First', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b3', name: 'I Learn — حلوان', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b4', name: 'I Learn — المعادي', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b5', name: 'مصر استارت', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b6', name: 'حورس', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b7', name: 'الأحمد', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b8', name: 'IQ — البراجيل', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b9', name: 'سنتر أوسيم التعليمي', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b10', name: 'براح الدقي', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b11', name: 'فرع أكتوبر', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b12', name: 'فرع مايو', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b13', name: 'فرع راعي روض الفرج', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b14', name: 'فرع زهراء مصر القديمة', address: '', hours: '', phone: '', mapUrl: '' },
  { id: 'b15', name: 'فرع الهرم', address: '', hours: '', phone: '', mapUrl: '' },
];

export const ORIGINAL_STORE_CONTACTS = {
  pagePhone: '01507410800',
  technicalPhone: '01043160916',
  facebookUrl: 'https://www.facebook.com/share/1FpcRH3JF9/',
  whatsappUrl: 'https://wa.me/201507410800',
} as const;

export function withOriginalDemoContactFallback<T extends {
  supportPhone: string;
  supportTechnicalPhone: string;
  socialLinks: { facebook: string; instagram: string; whatsapp: string };
}>(settings: T): T {
  return {
    ...settings,
    supportPhone: settings.supportPhone.trim() ? settings.supportPhone : ORIGINAL_STORE_CONTACTS.pagePhone,
    supportTechnicalPhone: settings.supportTechnicalPhone.trim() ? settings.supportTechnicalPhone : ORIGINAL_STORE_CONTACTS.technicalPhone,
    socialLinks: {
      ...settings.socialLinks,
      facebook: settings.socialLinks.facebook.trim() ? settings.socialLinks.facebook : ORIGINAL_STORE_CONTACTS.facebookUrl,
      whatsapp: settings.socialLinks.whatsapp.trim() ? settings.socialLinks.whatsapp : ORIGINAL_STORE_CONTACTS.whatsappUrl,
    },
  };
}

export const DEMO_PAYMENT_OPTIONS = [
  {
    id: 'FAWRY',
    label: 'فوري',
    description: 'طريقة محفوظة في التصميم الأصلي؛ لا يوجد حساب استقبال أو تكامل دفع مهيّأ.',
    image: '/images/payments/fawry.webp',
  },
  {
    id: 'INSTAPAY',
    label: 'إنستا باي',
    description: 'طريقة محفوظة في التصميم الأصلي؛ لا يوجد حساب استقبال أو تكامل دفع مهيّأ.',
    image: '/images/payments/instapay.webp',
  },
  {
    id: 'WALLET',
    label: 'المحفظة الإلكترونية',
    description: 'طريقة محفوظة في التصميم الأصلي؛ لا يوجد حساب استقبال أو تكامل دفع مهيّأ.',
    image: '/images/payments/wallet.webp',
    providers: [{ name: 'Vodafone', image: '/images/payments/vodafone.webp' }],
  },
  {
    id: 'CARD',
    label: 'Visa / Mastercard',
    description: 'مثال Visa/Mastercard توضيحي مضاف للعرض فقط؛ لا يوجد مزوّد بطاقات مربوط.',
    image: null,
  },
] as const;

export type DemoPaymentMethod = (typeof DEMO_PAYMENT_OPTIONS)[number]['id'];

export function simulateDemoPayment(method: DemoPaymentMethod): string {
  const option = DEMO_PAYMENT_OPTIONS.find((candidate) => candidate.id === method);
  if (!option) throw new Error('Unknown demo payment method.');
  return `تمت محاكاة اختيار ${option.label} للعرض فقط. لم يتم إرسال طلب أو إنشاء معاملة، ولم يُخصم أي مبلغ.`;
}
