/**
 * Embedded Cap.js (https://capjs.js.org) — no external Cap Standalone required.
 * Storage adapters follow the same hooks as @cap.js/server / ink-battles.
 */

const Cap = require('@cap.js/server')
const logger = require('./logger')

const CHALLENGE_OPTS = {
  challengeCount: 50,
  challengeSize: 32,
  challengeDifficulty: 4,
  expiresMs: 600000 // 10 min
}

function memoryStorage () {
  const challenges = new Map()
  const tokens = new Map()
  return {
    challenges: {
      store: async (token, data) => { challenges.set(token, data) },
      read: async (token) => challenges.get(token) || null,
      delete: async (token) => { challenges.delete(token) },
      deleteExpired: async () => {
        const now = Date.now()
        for (const [k, v] of challenges) {
          if (!v || v.expires < now) challenges.delete(k)
        }
      }
    },
    tokens: {
      store: async (key, expires) => { tokens.set(key, expires) },
      get: async (key) => {
        const exp = tokens.get(key)
        if (!exp) return null
        if (exp < Date.now()) {
          tokens.delete(key)
          return null
        }
        return exp
      },
      delete: async (key) => { tokens.delete(key) },
      deleteExpired: async () => {
        const now = Date.now()
        for (const [k, v] of tokens) {
          if (v < now) tokens.delete(k)
        }
      }
    }
  }
}

/** MongoDB (native driver) — Vercel / self-hosted mongo */
function mongoStorage (db) {
  const challenges = () => db.collection('cap_challenges')
  const tokens = () => db.collection('cap_tokens')
  let indexed = false
  const ensureIndex = () => {
    if (indexed) return
    indexed = true
    challenges().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    tokens().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  }
  return {
    challenges: {
      store: async (token, data) => {
        ensureIndex()
        await challenges().updateOne(
          { token },
          { $set: { token, challenge: data.challenge, expiresAt: new Date(data.expires) } },
          { upsert: true }
        )
      },
      read: async (token) => {
        const doc = await challenges().findOne({ token, expiresAt: { $gt: new Date() } })
        return doc ? { challenge: doc.challenge, expires: doc.expiresAt.getTime() } : null
      },
      delete: async (token) => { await challenges().deleteOne({ token }) },
      deleteExpired: async () => { await challenges().deleteMany({ expiresAt: { $lte: new Date() } }) }
    },
    tokens: {
      store: async (key, expires) => {
        ensureIndex()
        await tokens().updateOne(
          { key },
          { $set: { key, expiresAt: new Date(expires) } },
          { upsert: true }
        )
      },
      get: async (key) => {
        const doc = await tokens().findOne({ key, expiresAt: { $gt: new Date() } })
        return doc ? doc.expiresAt.getTime() : null
      },
      delete: async (key) => { await tokens().deleteOne({ key }) },
      deleteExpired: async () => { await tokens().deleteMany({ expiresAt: { $lte: new Date() } }) }
    }
  }
}

/** LokiJS — self-hosted default */
function lokiStorage (db) {
  const getCol = (name) => {
    let col = db.getCollection(name)
    if (!col) col = db.addCollection(name, { unique: ['key'] })
    return col
  }
  // challenges use token field; tokens use key field
  const getChallengeCol = () => {
    let col = db.getCollection('cap_challenges')
    if (!col) col = db.addCollection('cap_challenges', { unique: ['token'] })
    return col
  }
  const getTokenCol = () => getCol('cap_tokens')
  return {
    challenges: {
      store: async (token, data) => {
        const col = getChallengeCol()
        const existing = col.findOne({ token })
        const row = { token, challenge: data.challenge, expires: data.expires }
        if (existing) col.update({ ...existing, ...row })
        else col.insert(row)
      },
      read: async (token) => {
        const doc = getChallengeCol().findOne({ token })
        if (!doc || doc.expires < Date.now()) return null
        return { challenge: doc.challenge, expires: doc.expires }
      },
      delete: async (token) => { getChallengeCol().findAndRemove({ token }) },
      deleteExpired: async () => {
        getChallengeCol().findAndRemove({ expires: { $lte: Date.now() } })
      }
    },
    tokens: {
      store: async (key, expires) => {
        const col = getTokenCol()
        const existing = col.findOne({ key })
        const row = { key, expires }
        if (existing) col.update({ ...existing, ...row })
        else col.insert(row)
      },
      get: async (key) => {
        const doc = getTokenCol().findOne({ key })
        if (!doc || doc.expires < Date.now()) return null
        return doc.expires
      },
      delete: async (key) => { getTokenCol().findAndRemove({ key }) },
      deleteExpired: async () => {
        getTokenCol().findAndRemove({ expires: { $lte: Date.now() } })
      }
    }
  }
}

/** CloudBase / TCB database */
function tcbStorage (db) {
  const _ = db.command
  return {
    challenges: {
      store: async (token, data) => {
        const col = db.collection('cap_challenges')
        try {
          await col.doc(token).set({
            token,
            challenge: data.challenge,
            expires: data.expires
          })
        } catch (e) {
          // doc may exist
          await col.doc(token).update({
            challenge: data.challenge,
            expires: data.expires
          })
        }
      },
      read: async (token) => {
        try {
          const res = await db.collection('cap_challenges').doc(token).get()
          const doc = res.data && res.data[0]
          if (!doc || doc.expires < Date.now()) return null
          return { challenge: doc.challenge, expires: doc.expires }
        } catch (e) {
          return null
        }
      },
      delete: async (token) => {
        try { await db.collection('cap_challenges').doc(token).remove() } catch (e) {}
      },
      deleteExpired: async () => {
        try {
          await db.collection('cap_challenges').where({ expires: _.lte(Date.now()) }).remove()
        } catch (e) {}
      }
    },
    tokens: {
      store: async (key, expires) => {
        // CloudBase doc id cannot contain ':'
        const id = key.replace(/:/g, '_')
        try {
          await db.collection('cap_tokens').doc(id).set({ key, expires })
        } catch (e) {
          await db.collection('cap_tokens').doc(id).update({ key, expires })
        }
      },
      get: async (key) => {
        try {
          const id = key.replace(/:/g, '_')
          const res = await db.collection('cap_tokens').doc(id).get()
          const doc = res.data && res.data[0]
          if (!doc || doc.expires < Date.now()) return null
          return doc.expires
        } catch (e) {
          return null
        }
      },
      delete: async (key) => {
        try {
          const id = key.replace(/:/g, '_')
          await db.collection('cap_tokens').doc(id).remove()
        } catch (e) {}
      },
      deleteExpired: async () => {
        try {
          await db.collection('cap_tokens').where({ expires: _.lte(Date.now()) }).remove()
        } catch (e) {}
      }
    }
  }
}

/**
 * EdgeOne Blob-style store: expects { get(key), set(key, value), del(key) }
 * value is JSON-serializable.
 */
function kvStorage (kv) {
  return {
    challenges: {
      store: async (token, data) => { await kv.set(`cap:c:${token}`, data) },
      read: async (token) => {
        const data = await kv.get(`cap:c:${token}`)
        if (!data || data.expires < Date.now()) return null
        return data
      },
      delete: async (token) => { await kv.del(`cap:c:${token}`) },
      deleteExpired: async () => {}
    },
    tokens: {
      store: async (key, expires) => { await kv.set(`cap:t:${key}`, { expires }) },
      get: async (key) => {
        const data = await kv.get(`cap:t:${key}`)
        if (!data || data.expires < Date.now()) return null
        return data.expires
      },
      delete: async (key) => { await kv.del(`cap:t:${key}`) },
      deleteExpired: async () => {}
    }
  }
}

function createCap (storage) {
  return new Cap({
    noFSState: true,
    storage: storage || memoryStorage()
  })
}

async function createChallenge (cap) {
  return cap.createChallenge(CHALLENGE_OPTS)
}

async function redeemChallenge (cap, body) {
  const token = body && body.token
  const solutions = body && body.solutions
  if (!token || !solutions || !Array.isArray(solutions)) {
    return { success: false, error: 'Missing token or solutions' }
  }
  return cap.redeemChallenge({ token, solutions })
}

async function validateToken (cap, token) {
  if (!token) return false
  try {
    const { success } = await cap.validateToken(token)
    return !!success
  } catch (e) {
    logger.error('Cap validateToken failed:', e)
    return false
  }
}

/** CAPTCHA_PROVIDER=Cap and no CAP_API_ENDPOINT → use embedded Cap */
function isBuiltinCap (config) {
  return config && config.CAPTCHA_PROVIDER === 'Cap' && !config.CAP_API_ENDPOINT
}

module.exports = {
  createCap,
  memoryStorage,
  mongoStorage,
  lokiStorage,
  tcbStorage,
  kvStorage,
  createChallenge,
  redeemChallenge,
  validateToken,
  isBuiltinCap,
  CHALLENGE_OPTS
}
