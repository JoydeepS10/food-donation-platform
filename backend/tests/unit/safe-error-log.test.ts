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

test('multi-line messages never reach the log, even when they look like frames', () => {
  const error = new Error(
    [
      'Contact donor.verified@food-demo.test',
      'Deliver to 12 Market Street',
      '    at 12 Market Street (donor.verified@food-demo.test)',
    ].join('\n'),
  );

  const safe = describeErrorForLog(error);
  const serialized = JSON.stringify(safe);

  assert.doesNotMatch(serialized, /donor\.verified@food-demo\.test|12 Market Street/);
  assert.ok(safe.stackFrames === null || /^\s+at\s/m.test(safe.stackFrames));
});

test('only lines that end in a source location are kept as frames', () => {
  const error = new Error('boom');
  error.stack = [
    'Error: Contact donor.verified@food-demo.test',
    'second message line at 12 Market Street',
    '    at 12 Market Street (donor.verified@food-demo.test)',
    '    at realFrame (C:\\app\\file.ts:10:5)',
    '    at async file:///app/other.ts:20:7',
  ].join('\r\n');

  assert.deepEqual(describeErrorForLog(error), {
    errorName: 'Error',
    errorCode: null,
    stackFrames:
      '    at realFrame (C:\\app\\file.ts:10:5)\n    at async file:///app/other.ts:20:7',
  });
});

test('at most twenty stack frames are logged', () => {
  const error = new Error('too many frames');
  const frames = Array.from({ length: 25 }, (_value, index) => `    at frame${index} (C:\\app\\file.ts:1:${index})`);
  error.stack = ['Error: too many frames', ...frames].join('\n');

  const safe = describeErrorForLog(error);

  assert.ok(safe.stackFrames !== null);
  assert.equal(safe.stackFrames.split('\n').length, 20);
  assert.match(safe.stackFrames, /frame0/);
  assert.doesNotMatch(safe.stackFrames, /frame20/);
});

test('errors without a usable stack log no frames', () => {
  const emptyStack = new Error('no stack');
  emptyStack.stack = '';

  const nonStringStack = new Error('odd stack');
  Object.defineProperty(nonStringStack, 'stack', { value: 42 });

  assert.deepEqual(describeErrorForLog(emptyStack), {
    errorName: 'Error',
    errorCode: null,
    stackFrames: null,
  });
  assert.deepEqual(describeErrorForLog(nonStringStack), {
    errorName: 'Error',
    errorCode: null,
    stackFrames: null,
  });
});

test('unknown thrown values are logged as UnknownError', () => {
  assert.deepEqual(describeErrorForLog('not an error'), {
    errorName: 'UnknownError',
    errorCode: null,
    stackFrames: null,
  });
});
