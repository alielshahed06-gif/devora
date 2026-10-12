import test from 'node:test';
import assert from 'node:assert/strict';
import { validEmailAddress, validHttpsUrl, validPhoneLink } from '../src/lib/storefront-contacts';

test('contact helpers accept valid contact values and reject blank or malformed values', () => {
  assert.deepEqual(validPhoneLink(' +20 (100) 123-4567 '), {
    label: '+20 (100) 123-4567',
    href: 'tel:+201001234567',
  });
  assert.equal(validPhoneLink(''), null);
  assert.equal(validPhoneLink('call me'), null);
  assert.equal(validEmailAddress(' support@example.com '), 'support@example.com');
  assert.equal(validEmailAddress('not-an-email'), null);
});

test('social contact links require credential-free HTTPS URLs', () => {
  assert.equal(validHttpsUrl('https://social.example/account'), 'https://social.example/account');
  assert.equal(validHttpsUrl('javascript:alert(1)'), null);
  assert.equal(validHttpsUrl('/relative/path'), null);
  assert.equal(validHttpsUrl('https://user:pass@social.example/account'), null);
});
