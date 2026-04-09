// Promise-wrapped IndexedDB access for user-uploaded sound clips.
//
// Schema
//   database: soundblasterblaster (v1)
//   store:    clips, keyPath 'id'
//   index:    by_order on 'order' (non-unique)
//   record:   { id, name, blob, mimeType, order, createdAt }

const DB_NAME = 'soundblasterblaster'
const DB_VERSION = 1
const STORE = 'clips'

let dbPromise = null

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('by_order', 'order', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

export async function getAllClips() {
  const store = await tx('readonly')
  const rows = await promisify(store.getAll())
  return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export async function addClip({ name, blob, mimeType }) {
  // Compute next order without a second transaction by scanning in one txn.
  const store = await tx('readwrite')
  const existing = await promisify(store.getAll())
  const nextOrder = existing.reduce((m, c) => Math.max(m, c.order), -1) + 1
  const record = {
    id: crypto.randomUUID(),
    name,
    blob,
    mimeType,
    order: nextOrder,
    createdAt: Date.now(),
  }
  await promisify(store.add(record))
  return record
}

export async function updateClip(id, patch) {
  const store = await tx('readwrite')
  const current = await promisify(store.get(id))
  if (!current) throw new Error(`Clip ${id} not found`)
  const next = { ...current, ...patch, id: current.id }
  await promisify(store.put(next))
}

export async function deleteClip(id) {
  const store = await tx('readwrite')
  await promisify(store.delete(id))
}

// Rewrite order values for every id in the supplied sequence inside a single
// readwrite transaction so a crash mid-reorder cannot leave inconsistent state.
export async function reorderClips(idsInNewOrder) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)

    idsInNewOrder.forEach((id, idx) => {
      const getReq = store.get(id)
      getReq.onsuccess = () => {
        const record = getReq.result
        if (!record) return
        record.order = idx
        store.put(record)
      }
    })
  })
}
