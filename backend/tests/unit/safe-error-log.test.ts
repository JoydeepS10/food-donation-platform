import test from 'node:test';
import assert from 'node:assert/strict';
import { describeErrorForLog } from '../../src/utils/safe-error-log.ts';

test('Prisma errors log only their name and stable code', () => {
  const error = new Error(
    'Invalid `prisma.user.findUnique()` invocation: query arguments include donor.verified@food-demo.test',
  );
  error.name = 'PrismaClientKnownRequestError';
  Object.defineProperty(error, 'code', { value: 'P2002', enumerable: true });

  const safe = describeErrorForLog(error);

  assert.deepEqual(safe, {
    errorName: 'PrismaClientKnownRequestError',
    errorCode: 'P2002',
    stackFrames: null,
  });
  assert.doesNotMatch(JSON.stringify(safe), /donor\.verified@food-demo\.test|query arguments/i);
});

test('generic errors keep call frames but not the message line', () => {
  const error = new Error('contact donor.verified@food-demo.test at 12 Market Street');
  const safe = describeErrorForLog(error);

  assert.equal(safe.errorName, 'Error');
  assert.equal(safe.errorCode, null);
  assert.ok(safe.stackFrames === null || !safe.stackFrames.includes('donor.verified@food-demo.test'));
  assert.ok(safe.stackFrames === null || !safe.stackFrames.includes('12 Market Street'));
});

test('unknown thrown values are logged as UnknownError', () => {
  assert.deepEqual(describeErrorForLog('not an error'), {
    errorName: 'UnknownError',
    errorCode: null,
    stackFrames: null,
  });
});
