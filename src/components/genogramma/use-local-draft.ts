"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHANNEL, type StorageAdapter, type StoredDraft } from "@/lib/genogramma/storage/adapter";
import { getStorage } from "@/lib/genogramma/storage/indexeddb";

/**
 * Salvataggio automatico locale di una bozza, con controllo dei conflitti
 * tra schede: la revisione salvata deve essere quella letta; un'altra
 * scheda che salva lo stesso genogramma viene segnalata (il messaggio sul
 * BroadcastChannel contiene solo l'ID e la revisione, mai i dati).
 */
export interface LocalDraft {
  persistent: boolean | null;
  conflict: StoredDraft | null;
  save: (draft: Omit<StoredDraft, "revision">) => void;
  /** Accetta la versione dell'altra scheda. */
  reloadFromConflict: () => StoredDraft | null;
  /** Sovrascrive con la versione di questa scheda. */
  overwrite: () => void;
  /** Salva questa versione come nuova bozza (nuovo ID). */
  saveAsCopy: (newId: string) => void;
  /** Riparte la revisione per una bozza appena aperta. */
  adopt: (d: StoredDraft) => void;
}

export function useLocalDraft(): LocalDraft {
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [conflict, setConflict] = useState<StoredDraft | null>(null);
  const storage = useRef<StorageAdapter | null>(null);
  const revision = useRef(new Map<string, number>());
  const pending = useRef<Omit<StoredDraft, "revision"> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const conflictRef = useRef<StoredDraft | null>(null);

  useEffect(() => {
    let alive = true;
    getStorage()
      .then((s) => {
        if (!alive) return;
        storage.current = s;
        setPersistent(s.persistent);
      })
      .catch(() => setPersistent(false));
    try {
      channel.current = new BroadcastChannel(CHANNEL);
      channel.current.onmessage = (e: MessageEvent<{ id?: string; revision?: number }>) => {
        const { id, revision: rev } = e.data ?? {};
        if (!id || typeof rev !== "number") return;
        const mine = revision.current.get(id);
        if (mine !== undefined && rev > mine && storage.current) {
          storage.current.get(id).then((d) => {
            if (d && alive) {
              conflictRef.current = d;
              setConflict(d);
            }
          });
        }
      };
    } catch {
      channel.current = null;
    }
    return () => {
      alive = false;
      channel.current?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const write = useCallback(async (draft: Omit<StoredDraft, "revision">, force = false) => {
    const s = storage.current;
    if (!s || conflictRef.current) return;
    try {
      const expected = force ? null : (revision.current.get(draft.id) ?? null);
      const res = await s.put(draft, expected);
      if (res.ok) {
        revision.current.set(draft.id, res.revision);
        channel.current?.postMessage({ id: draft.id, revision: res.revision });
      } else {
        conflictRef.current = res.conflict;
        setConflict(res.conflict);
      }
    } catch {
      setPersistent(false);
    }
  }, []);

  const save = useCallback(
    (draft: Omit<StoredDraft, "revision">) => {
      pending.current = draft;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (pending.current) write(pending.current);
      }, 700);
    },
    [write]
  );

  const adopt = useCallback((d: StoredDraft) => {
    revision.current.set(d.id, d.revision);
  }, []);

  return {
    persistent,
    conflict,
    save,
    reloadFromConflict: () => {
      const c = conflictRef.current;
      if (c) revision.current.set(c.id, c.revision);
      conflictRef.current = null;
      setConflict(null);
      return c;
    },
    overwrite: () => {
      conflictRef.current = null;
      setConflict(null);
      if (pending.current) write(pending.current, true);
    },
    saveAsCopy: (newId: string) => {
      conflictRef.current = null;
      setConflict(null);
      if (pending.current) {
        const copy = { ...pending.current, id: newId, title: `${pending.current.title} (copia)` };
        if (copy.pedigree) copy.pedigree = { ...copy.pedigree, id: newId };
        pending.current = copy;
        write(copy);
      }
    },
    adopt,
  };
}
