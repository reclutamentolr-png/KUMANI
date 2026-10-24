// Angolo Bambini: l'album dei disegni finiti, nel telefono (IndexedDB), mai
// sul server. Al massimo 60 disegni per bambino: i più vecchi si tolgono.

export type AlbumItem = { id: string; owner: string; profileId: string; drawingId: string; createdAt: number; png: Blob }

const DB = 'kumani-kids'
const STORE = 'album'
const MAX_PER_CHILD = 60

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('child', ['owner', 'profileId'])
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

export async function listAlbum(owner: string, profileId: string): Promise<AlbumItem[]> {
  try {
    const db = await open()
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('child').getAll([owner, profileId])
    const items = await new Promise<AlbumItem[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as AlbumItem[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return items.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

export async function addToAlbum(item: AlbumItem) {
  try {
    const existing = await listAlbum(item.owner, item.profileId)
    const db = await open()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.put(item)
    existing.slice(MAX_PER_CHILD - 1).forEach((old) => store.delete(old.id))
    await done(tx)
    db.close()
    return true
  } catch {
    return false
  }
}

export async function removeFromAlbum(id: string) {
  try {
    const db = await open()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    await done(tx)
    db.close()
  } catch {
    // niente
  }
}

// Bambino tolto dal genitore: via anche i suoi disegni
export async function clearChildAlbum(owner: string, profileId: string) {
  const items = await listAlbum(owner, profileId)
  await Promise.all(items.map((item) => removeFromAlbum(item.id)))
}
