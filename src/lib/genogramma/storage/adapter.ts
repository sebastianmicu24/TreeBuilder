import type { Pedigree } from "../model/types";
import type { PatientAnswers } from "../wizard/patient";

/**
 * Persistenza solo locale. L'interfaccia esiste per isolare IndexedDB e
 * facilitare i test: non è prevista alcuna sincronizzazione cloud.
 */
export interface DraftMeta {
  id: string;
  kind: "pedigree" | "patient";
  /** Dove riaprirla: editor clinico o percorso paziente. */
  view?: "doctor" | "patient";
  title: string;
  updatedAt: string;
  revision: number;
}

export interface StoredDraft extends DraftMeta {
  pedigree?: Pedigree;
  answers?: PatientAnswers;
}

export type PutResult = { ok: true; revision: number } | { ok: false; conflict: StoredDraft };

export interface StorageAdapter {
  /** false = memoria (storage non disponibile o modalità senza salvataggio). */
  readonly persistent: boolean;
  list(): Promise<DraftMeta[]>;
  get(id: string): Promise<StoredDraft | null>;
  /** Scrive se la revisione salvata è quella attesa (controllo di conflitto tra schede). */
  put(draft: Omit<StoredDraft, "revision">, expectedRevision: number | null): Promise<PutResult>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const DB_NAME = "treebuilder-genogramma";
export const MODE_KEY = "treebuilder:genogramma-mode";
export const OPEN_KEY = "treebuilder:genogramma-open";
export const CHANNEL = "treebuilder-genogramma";

/** Archivio in memoria: fallback e test (stessa semantica delle revisioni). */
export class MemoryStorage implements StorageAdapter {
  readonly persistent = false;
  private data = new Map<string, StoredDraft>();

  async list(): Promise<DraftMeta[]> {
    return [...this.data.values()]
      .map(({ id, kind, view, title, updatedAt, revision }) => ({ id, kind, view, title, updatedAt, revision }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<StoredDraft | null> {
    const d = this.data.get(id);
    return d ? structuredClone(d) : null;
  }

  async put(draft: Omit<StoredDraft, "revision">, expectedRevision: number | null): Promise<PutResult> {
    const current = this.data.get(draft.id);
    if (current && expectedRevision !== null && current.revision !== expectedRevision) {
      return { ok: false, conflict: structuredClone(current) };
    }
    const revision = (current?.revision ?? 0) + 1;
    this.data.set(draft.id, structuredClone({ ...draft, revision }));
    return { ok: true, revision };
  }

  async remove(id: string): Promise<void> {
    this.data.delete(id);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}
