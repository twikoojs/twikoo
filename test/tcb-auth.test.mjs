import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasCustomLogin,
  isCustomUser,
  signInAnonymously,
  signInWithCustomTicket
} from '../src/client/utils/tcb-auth.mjs'

test('signs in anonymously with the CloudBase SDK 4 API', async () => {
  const expected = { user: { providers: [{ id: 'anonymous' }] } }
  const auth = {
    signInAnonymously: async () => expected
  }

  assert.equal(await signInAnonymously(auth), expected)
})

test('configures and uses CloudBase SDK 4 custom ticket login', async () => {
  const expected = { user: { providers: [{ id: 'custom' }] } }
  let getTicket
  const auth = {
    setCustomSignFunc: (callback) => { getTicket = callback },
    signInWithCustomTicket: async () => expected
  }

  assert.equal(await signInWithCustomTicket(auth, 'ticket'), expected)
  assert.equal(await getTicket(), 'ticket')
})

test('recognizes CloudBase SDK 4 custom providers', async () => {
  const user = { providers: [{ id: 'anonymous' }, { id: 'custom' }] }
  const auth = { getCurrentUser: async () => user }

  assert.equal(isCustomUser(user), true)
  assert.equal(await hasCustomLogin(auth), true)
})

test('rejects anonymous, missing, and unrelated providers', () => {
  assert.equal(isCustomUser(null), false)
  assert.equal(isCustomUser({}), false)
  assert.equal(isCustomUser({ providers: [{ id: 'anonymous' }] }), false)
})

test('keeps compatibility with the legacy custom login marker', () => {
  assert.equal(isCustomUser({ loginType: 'CUSTOM' }), true)
})
