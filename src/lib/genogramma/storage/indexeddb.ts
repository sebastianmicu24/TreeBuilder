import { migrate } from "../model/migrate";
import { DB_NAME, MemoryStorage, MODE_KEY, OPEN_KEY, type DraftMeta, type PutResult, type StorageAdapter, type StoredDraft } from "./adapter";

/**
 * IndexedDB del browser (nessun server). Ogni accesso è protetto: in
 * navigazione privata, con lo storage bloccato o pieno si ripiega sulla
 * memoria e lo strumento continua a funzionare.
 */
const STORE = "drafts";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("blocked"));
  });
}

class IdbStorage implements StorageAdapter {
  readonly persistent = true;
  constructor(private db: IDBDatabase) {}

  async list(): Promise<DraftMeta[]> {
    const all = (await req(this.db.transaction(STORE, "readonly").objectStore(STORE).getAll())) as StoredDraft[];
    return all
      .map(({ id, kind, view, title, updatedAt, revision }) => ({ id, kind, view, title, updatedAt, revision }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<StoredDraft | null> {
    const d = (await req(this.db.transaction(STORE, "readonly").objectStore(STORE).get(id))) as StoredDraft | undefined;
    if (!d) return null;
    // Una bozza è comunque un dato esterno: si rilegge in modo difensivo.
    if (d.pedigree) {
      const m = migrate(d.pedigree);
      if (!m.ok) return null;
      d.pedigree = m.pedigree;
    }
    return d;
  }

  put(draft: Omit<StoredDraft, "revision">, expectedRevision: number | null): Promise<PutResult> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let result: PutResult | null = null;
      const g = store.get(draft.id);
      g.onsuccess = () => {
        const current = g.result as StoredDraft | undefined;
        if (current && expectedRevision !== null && current.revision !== expectedRevision) {
          result = { ok: false, conflict: current };
          return;
        }
        const revision = (current?.revision ?? 0) + 1;
        store.put({ ...draft, revision });
        result = { ok: true, revision };
      };
      tx.oncomplete = () => resolve(result!);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async remove(id: string): Promise<void> {
    await req(this.db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
  }

  async clear(): Promise<void> {
    await req(this.db.transaction(STORE, "readwrite").objectStore(STORE).clear());
  }
}

function safeLocal(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function isNoSaveMode(): boolean {
  try {
    return safeLocal()?.getItem(MODE_KEY) === "nosave";
  } catch {
    return false;
  }
}

export function setNoSaveMode(on: boolean): void {
  try {
    if (on) safeLocal()?.setItem(MODE_KEY, "nosave");
    else safeLocal()?.removeItem(MODE_KEY);
  } catch {
    // Preferenza non salvabile: resta valida per questa pagina.
  }
}

let shared: Promise<StorageAdapter> | null = null;

/** Archivio locale: IndexedDB se disponibile e se il salvataggio è attivo, altrimenti memoria. */
export function getStorage(): Promise<StorageAdapter> {
  if (shared) return shared;
  shared = (async () => {
    if (isNoSaveMode() || typeof indexedDB === "undefined") return new MemoryStorage();
    try {
      return new IdbStorage(await open());
    } catch {
      return new MemoryStorage();
    }
  })();
  return shared;
}

export function resetStorage(): void {
  shared = null;
}

/** Cancella tutti i dati locali dello strumento (database, preferenze, richieste di apertura). */
export async function wipeLocalData(): Promise<void> {
  try {
    const s = await getStorage();
    await s.clear();
  } catch {
    // Si prova comunque a eliminare il database.
  }
  resetStorage();
  await new Promise<void>((resolve) => {
    try {
      const r = indexedDB.deleteDatabase(DB_NAME);
      r.onsuccess = r.onerror = r.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
  try {
    safeLocal()?.removeItem(MODE_KEY);
    sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // Storage non disponibile: niente da cancellare.
  }
}

/** Bozza da aprire nella pagina di destinazione (solo l'ID locale, mai i dati, mai nell'URL). */
export function requestOpen(id: string): void {
  try {
    sessionStorage.setItem(OPEN_KEY, id);
  } catch {
    // Senza sessionStorage la pagina parte vuota.
  }
}

export function takeOpenRequest(): string | null {
  try {
    const id = sessionStorage.getItem(OPEN_KEY);
    sessionStorage.removeItem(OPEN_KEY);
    return id;
  } catch {
    return null;
  }
}
