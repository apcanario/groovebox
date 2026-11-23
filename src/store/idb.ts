/** IndexedDB behind the library's key-value interface (G5). */
import type { Kv, StoreName } from "./library.ts";

const DB = "groovebox";
const STORES: StoreName[] = ["songs", "logs", "meta"];

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openIdb(): Promise<Kv> {
  const open = indexedDB.open(DB, 1);
  open.onupgradeneeded = () => {
    for (const s of STORES) if (!open.result.objectStoreNames.contains(s)) open.result.createObjectStore(s);
  };
  const db = await req(open);
  const tx = <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    return new Promise((resolve, reject) => {
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    get: <T>(store: StoreName, key: string) => tx(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
    put: async (store, key, value) => {
      await tx(store, "readwrite", (s) => s.put(value, key));
    },
    del: async (store, key) => {
      await tx(store, "readwrite", (s) => s.delete(key));
    },
    all: <T>(store: StoreName) => tx(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  };
}
