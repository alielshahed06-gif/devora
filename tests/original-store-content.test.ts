import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PAYMENT_OPTIONS, ORIGINAL_DEMO_BRANCHES, ORIGINAL_STORE_CONTACTS, simulateDemoPayment, withOriginalDemoContactFallback } from '../src/lib/original-store-content';

test('original branch entries retain only the fifteen saved example names', () => {
  assert.equal(ORIGINAL_DEMO_BRANCHES.length, 15);
  assert.equal(ORIGINAL_DEMO_BRANCHES[0].name, 'The Best');
  assert.equal(ORIGINAL_DEMO_BRANCHES[14].name, 'فرع الهرم');
  assert.ok(ORIGINAL_DEMO_BRANCHES.every((branch) => !branch.address && !branch.hours && !branch.phone && !branch.mapUrl));
});

test('original support contacts and social links are restored from the reference data', () => {
  assert.equal(ORIGINAL_STORE_CONTACTS.pagePhone, '01507410800');
  assert.equal(ORIGINAL_STORE_CONTACTS.technicalPhone, '01043160916');
  assert.equal(ORIGINAL_STORE_CONTACTS.facebookUrl, 'https://www.facebook.com/share/1FpcRH3JF9/');
  assert.equal(ORIGINAL_STORE_CONTACTS.whatsappUrl, 'https://wa.me/201507410800');
});

test('demo contact fallback fills missing values without overriding configured settings', () => {
  const demo = withOriginalDemoContactFallback({
    supportPhone: '',
    supportTechnicalPhone: '01112223334',
    socialLinks: { facebook: '', instagram: 'https://instagram.com/store', whatsapp: '' },
  });
  assert.equal(demo.supportPhone, ORIGINAL_STORE_CONTACTS.pagePhone);
  assert.equal(demo.supportTechnicalPhone, '01112223334');
  assert.equal(demo.socialLinks.facebook, ORIGINAL_STORE_CONTACTS.facebookUrl);
  assert.equal(demo.socialLinks.instagram, 'https://instagram.com/store');
  assert.equal(demo.socialLinks.whatsapp, ORIGINAL_STORE_CONTACTS.whatsappUrl);
});

test('demo payment simulation is explicit and creates no transaction or payment reference', () => {
  assert.deepEqual(DEMO_PAYMENT_OPTIONS.map((option) => option.id), ['FAWRY', 'INSTAPAY', 'WALLET', 'CARD']);
  assert.deepEqual(DEMO_PAYMENT_OPTIONS.find((option) => option.id === 'WALLET')?.providers, [
    { name: 'Vodafone', image: '/images/payments/vodafone.webp' },
  ]);
  const result = simulateDemoPayment('CARD');
  assert.match(result, /محاكاة/);
  assert.match(result, /لم يتم إرسال طلب أو إنشاء معاملة/);
  assert.match(result, /لم يُخصم أي مبلغ/);
});
