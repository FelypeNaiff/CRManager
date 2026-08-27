import assert from 'node:assert/strict';
import test from 'node:test';
import { executeAuthenticatedAIAction } from './ai-action-security';

test('unauthenticated AI action is denied before external execution', async () => {
  let executed = false;
  await assert.rejects(executeAuthenticatedAIAction(async () => { throw new Error('unauthenticated'); }, {}, async () => { executed = true; return {}; }));
  assert.equal(executed, false);
});

test('authenticated AI action may execute', async () => {
  const result = await executeAuthenticatedAIAction(async () => ({ userId: 'user-a' }), 'input', async input => `${input}-ok`);
  assert.equal(result, 'input-ok');
});
