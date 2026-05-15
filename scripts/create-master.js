#!/usr/bin/env node
const admin = require('firebase-admin')
const fs = require('fs')

function usage() {
  console.log('Usage: node scripts/create-master.js --key /path/to/serviceAccount.json --empresa <empresaId> [--id felype] [--email email] [--nome "FELYPE NAIFF"]')
  process.exit(1)
}

// Simple args parser (no external deps)
const rawArgs = process.argv.slice(2)
const argv = {}
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a.startsWith('--')) {
    const key = a.slice(2)
    const next = rawArgs[i+1]
    if (next && !next.startsWith('--')) {
      argv[key] = next
      i++
    } else {
      argv[key] = true
    }
  }
}

const keyPath = argv.key || process.env.GOOGLE_APPLICATION_CREDENTIALS
// Default to single-tenant 'trupe-kids' as requested
const empresaId = argv.empresa || 'trupe-kids'
const userId = argv.id || 'felype'
const userEmail = argv.email || 'felypenaiff01@gmail.com'
const userNome = argv.nome || 'FELYPE NAIFF'

if (!keyPath || !empresaId) usage()

if (!fs.existsSync(keyPath)) {
  console.error('Service account key not found at', keyPath)
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
})

const db = admin.firestore()

async function run() {
  try {
    // 1. Check for existing admin group in the company
    const groupsRef = db.collection('grupos_usuarios')
    const q = groupsRef.where('empresa_id', '==', empresaId).where('is_admin', '==', true).limit(1)
    const snap = await q.get()
    let grupoId
    if (!snap.empty) {
      grupoId = snap.docs[0].id
      console.log('Found existing admin group:', grupoId)
    } else {
      const res = await groupsRef.add({
        nome: 'Administradores (seed)',
        empresa_id: empresaId,
        is_admin: true,
        criado_em: admin.firestore.FieldValue.serverTimestamp()
      })
      grupoId = res.id
      console.log('Created admin group:', grupoId)
    }

    // 2. Create or overwrite the master user with the provided id
    const userRef = db.collection('usuarios').doc(userId)
    await userRef.set({
      nome: userNome,
      email: userEmail,
      empresa_id: empresaId,
      grupo_id: grupoId,
      status: 'ATIVO',
      permitir_acesso: true,
      pin_acesso: '1234',
      cargo: 'MASTER',
      criado_em: admin.firestore.FieldValue.serverTimestamp(),
      atualizado_em: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    console.log('Master user created/updated with id:', userId)
    process.exit(0)
  } catch (e) {
    console.error('Error creating master user', e)
    process.exit(2)
  }
}

run()
