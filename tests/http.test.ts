import test from 'node:test';
import assert from 'node:assert/strict';
import { fail } from '../src/server/http';

test('unexpected API errors do not disclose database or secret-bearing error messages', async () => {
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const response = fail(new Error('postgresql://user:secret@private-host/db'));
    const body = await response.json() as { ok: boolean; error: { code: string; message: string } };
    assert.equal(response.status, 500);
    assert.deepEqual(body, { ok: false, error: { code: 'internal', message: 'حدث خطأ غير متوقع.' } });
    assert.equal(JSON.stringify(logged).includes('secret'), false);
    assert.deepEqual(logged, [['Unhandled API error:', 'Error']]);
  } finally {
    console.error = originalError;
  }
});
