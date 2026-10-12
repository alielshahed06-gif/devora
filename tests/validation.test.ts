import test from 'node:test'; import assert from 'node:assert/strict';
import { normPhone, validPhone, validEmail } from '../src/lib/validation';
import { pct, egpToPiasters, assertPiasters } from '../src/lib/money';
test('phone', () => { assert.equal(normPhone('+20 101-234-5678'), '01012345678'); assert.ok(validPhone('01012345678')); assert.ok(!validPhone('01312345678')); assert.ok(!validPhone('123')); });
test('email', () => { assert.ok(validEmail('a@b.co')); assert.ok(!validEmail('a@b')); });
test('money', () => { assert.equal(egpToPiasters(12.34), 1234); assert.equal(pct(1000, 15), 150); assert.throws(() => assertPiasters(1.5)); });
