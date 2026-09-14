import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { hashPin, verifyPin } from '../auth/pin';

const actionsUrl = new URL('./user-actions.ts', import.meta.url);
const formUrl = new URL('../../components/users/user-form-modal.tsx', import.meta.url);
const dialogUrl = new URL('../../components/users/reset-pin-dialog.tsx', import.meta.url);

test('access PIN helper creates a valid bcrypt hash and validates only the correct PIN', async () => {
  const hash = await hashPin('1234');
  assert.match(hash, /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
  assert.equal(await verifyPin('1234', hash), true);
  assert.equal(await verifyPin('9999', hash), false);
  assert.notEqual(hash, '1234');
});

test('administrative creation stores the access PIN hash and never uses N/A', async () => {
  const source = await readFile(actionsUrl, 'utf8');
  const createSection = source.slice(source.indexOf('export async function createUserAction'), source.indexOf('/**\n * Update an existing user'));
  assert.match(createSection, /hashAccessPin\(validatedData\.pin\)/);
  assert.match(createSection, /pinAccessHash,/);
  assert.doesNotMatch(createSection, /authorizationPinHash/);
  assert.doesNotMatch(createSection, /['"]N\/A['"]/);
  assert.match(source, /pin: z\.string\(\)\.regex\(\/\^\\d\{4\}\$\//);
});

test('access PIN reset is tenant scoped, permission protected, and updates only pinAccessHash', async () => {
  const source = await readFile(actionsUrl, 'utf8');
  const resetSection = source.slice(source.indexOf('export async function resetUserAccessPinAction'), source.indexOf('/**\n * Update an existing user'));
  assert.match(resetSection, /requirePermission\('USUARIOS', 'RESET_PIN'\)/);
  assert.match(resetSection, /tenantEntityWhere\(userId, session\.companyId\)/);
  assert.match(resetSection, /if \(!\/\^\\d\{4\}\$\/\.test\(newPin\)\)/);
  assert.match(resetSection, /data: \{ pinAccessHash \}/);
  assert.doesNotMatch(resetSection, /authorizationPinHash/);
  assert.doesNotMatch(resetSection, /pinResetRequired/);
});

test('UI never loads an existing PIN and requires a confirmed four-digit access PIN', async () => {
  const [form, dialog] = await Promise.all([
    readFile(formUrl, 'utf8'),
    readFile(dialogUrl, 'utf8'),
  ]);
  assert.match(form, /pin: '', \/\/ Never populate pin on edit/);
  assert.match(dialog, /resetUserAccessPinAction\(userId, pin\)/);
  assert.match(dialog, /pin !== confirmPin/);
  assert.match(dialog, /maxLength=\{4\}/);
  assert.doesNotMatch(dialog, /pinAccessHash|generatedPin|tempPin/);
});
