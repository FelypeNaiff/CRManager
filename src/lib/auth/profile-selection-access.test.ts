import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { requireProfileSelectionIdentity } from './profile-selection-access'

test('authenticated base identity remains on profile selection without a selector', async () => {
  let redirected = false
  const identity = await requireProfileSelectionIdentity(
    async () => ({ email: 'user@example.test' }),
    () => { redirected = true; throw new Error('redirect') }
  )

  assert.equal(identity.email, 'user@example.test')
  assert.equal(redirected, false)
})

test('unauthenticated base identity redirects to login', async () => {
  let destination = ''

  await assert.rejects(
    requireProfileSelectionIdentity(
      async () => { throw new Error('unauthenticated') },
      () => { destination = '/login'; throw new Error('redirect') }
    ),
    /redirect/
  )

  assert.equal(destination, '/login')
})

test('profile selection uses base auth, modern logout and keeps PIN as selector boundary', async () => {
  const page = await readFile('src/app/selecionar-perfil/page.tsx', 'utf8')
  const client = await readFile('src/app/selecionar-perfil/profile-selection-client.tsx', 'utf8')
  const actions = await readFile('src/lib/auth/actions.ts', 'utf8')

  assert.match(page, /resolveBaseServerAuthContext/)
  assert.doesNotMatch(page + client, /legacy-stubs|legacy-auth-stubs|useUser\(|useAuth\(/)
  assert.match(client, /validateProfilePin\(/)
  assert.match(client, /logoutSession\(/)
  assert.match(actions, /validateProfilePin[\s\S]*cookieStore\.set\(PROFILE_SESSION_COOKIE/)
  assert.doesNotMatch(actions.slice(0, actions.indexOf('export async function validateProfilePin')), /cookieStore\.set\(PROFILE_SESSION_COOKIE/)
})
