import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { TODAY } from '../../core/services/today';
import { DemoData } from '../repositories/demo-data';
import { LocalCollections, loadDemoSeed } from './demo-seed';

/** Chave do `localStorage` com todas as coleções da demo. */
export const LOCAL_DATABASE_KEY = 'gestao-financeira:demo-data';
/** Versão do formato salvo; dados de outra versão são descartados e o seed é recarregado. */
const STORAGE_VERSION = 1;

interface StoredDatabase {
  version: number;
  collections: LocalCollections;
}

export class LocalRecordNotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(`${collection}/${id} not found`);
    this.name = 'LocalRecordNotFoundError';
  }
}

/**
 * Banco da demonstração publicada: as coleções ficam no `localStorage` (só dados fictícios) e
 * começam pelo seed. Se o `localStorage` estiver indisponível, os dados ficam só em memória.
 */
@Injectable()
export class LocalDatabase extends DemoData {
  private readonly today = inject(TODAY);
  private data: Promise<LocalCollections> | null = null;

  /** Cópia da coleção. */
  async read<K extends keyof LocalCollections>(name: K): Promise<LocalCollections[K]> {
    const data = await this.load();
    return structuredClone(data[name]);
  }

  /**
   * Altera a coleção e salva. `change` roda de forma síncrona sobre os dados carregados, então
   * alterações simultâneas nunca se sobrescrevem. Devolve uma cópia do resultado.
   */
  async mutate<K extends keyof LocalCollections, R>(
    name: K,
    change: (records: LocalCollections[K]) => R,
  ): Promise<R> {
    const data = await this.load();
    const result = change(data[name]);
    persist(data);
    return structuredClone(result);
  }

  async restoreInitialData(): Promise<void> {
    this.data = this.seed();
    await this.data;
  }

  private load(): Promise<LocalCollections> {
    this.data ??= Promise.resolve(restore()).then((stored) => stored ?? this.seed());
    return this.data;
  }

  private async seed(): Promise<LocalCollections> {
    const data = await loadDemoSeed(this.today());
    persist(data);
    return data;
  }
}

/**
 * Coleção de registros de um usuário, com a mesma semântica do JSON Server: as operações
 * devolvem cópias e alterar um registro inexistente é erro.
 */
export class LocalCollection<K extends Exclude<keyof LocalCollections, 'users'>> {
  constructor(
    private readonly database: LocalDatabase,
    private readonly name: K,
  ) {}

  listByUser(userId: string): Observable<LocalCollections[K]> {
    return defer(async () => {
      const records = await this.database.read(this.name);
      return records.filter((record) => record.userId === userId) as LocalCollections[K];
    });
  }

  findById(id: string): Observable<Item<K> | null> {
    return defer(async () => {
      const records = (await this.database.read(this.name)) as Item<K>[];
      return records.find((record) => record.id === id) ?? null;
    });
  }

  insert(record: Item<K>): Observable<Item<K>> {
    return this.mutate((records) => {
      records.push(structuredClone(record));
      return record;
    });
  }

  patch(id: string, changes: Partial<Item<K>>): Observable<Item<K>> {
    return this.mutate((records) => {
      const index = this.indexOf(records, id);
      records[index] = { ...records[index], ...changes };
      return records[index];
    });
  }

  remove(id: string): Observable<void> {
    return this.mutate((records) => {
      records.splice(this.indexOf(records, id), 1);
    });
  }

  private mutate<R>(change: (records: Item<K>[]) => R): Observable<R> {
    return defer(() => this.database.mutate(this.name, (records) => change(records as Item<K>[])));
  }

  private indexOf(records: Item<K>[], id: string): number {
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) {
      throw new LocalRecordNotFoundError(this.name, id);
    }
    return index;
  }
}

type Item<K extends keyof LocalCollections> = LocalCollections[K][number];

function restore(): LocalCollections | null {
  try {
    const stored = JSON.parse(
      localStorage.getItem(LOCAL_DATABASE_KEY) ?? 'null',
    ) as StoredDatabase | null;
    return stored?.version === STORAGE_VERSION ? stored.collections : null;
  } catch {
    return null;
  }
}

function persist(collections: LocalCollections): void {
  try {
    const stored: StoredDatabase = { version: STORAGE_VERSION, collections };
    localStorage.setItem(LOCAL_DATABASE_KEY, JSON.stringify(stored));
  } catch {
    // Sem localStorage (modo privado, cota cheia): os dados seguem só em memória nesta aba.
  }
}
