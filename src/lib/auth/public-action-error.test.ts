import assert from 'node:assert/strict';
import test from 'node:test';
import { publicActionError } from './public-action-error';

test('Prisma internals become a generic public error', () => {
  assert.equal(publicActionError(new Error('Unique constraint failed on database.table'), 'Falha pública.'), 'Falha pública.');
});

test('known commercial message remains available', () => {
  assert.equal(publicActionError(new Error('Saldo insuficiente para concluir a operação.'), 'Falha.'), 'Saldo insuficiente para concluir a operação.');
});

test('non Error values never leak', () => {
  assert.equal(publicActionError({ stack: 'secret' }, 'Falha pública.'), 'Falha pública.');
});
