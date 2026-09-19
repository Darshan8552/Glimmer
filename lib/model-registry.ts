import { getHiddenModels, toggleHiddenModel } from "./model-health";

export interface RegistryModel {
  id: string;
  name: string;
  context: number;
  free: boolean | null;
  inModalities: string[];
  outModalities: string[];
  tools: boolean | null;
  custom: boolean;
}

export interface CatalogSpec {
  id: string;
  name: string;
  context: number;
  free: boolean | null;
  inModalities: string[];
  outModalities: string[];
  tools: boolean | null;
}

export interface RegistryState {
  imported: RegistryModel[];
  removed: string[];
}

const EMPTY: RegistryState = { imported: [], removed: [] };

function storageKey(provider: string) {
  return `glimmer:provider-registry:${provider}`;
}

function prefixed(provider: string, slug: string) {
  return `${provider}:${slug}`;
}

export function readRegistry(provider: string): RegistryState {
  let state: RegistryState = { imported: [], removed: [] };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(storageKey(provider));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RegistryState>;
        if (Array.isArray(parsed.imported)) {
          state.imported = parsed.imported.filter(
            (m) => m && typeof m.id === "string"
          );
        }
        if (Array.isArray(parsed.removed)) {
          state.removed = parsed.removed.filter((v) => typeof v === "string");
        }
      }
    } catch (e) {
      console.warn("model-registry: read failed, using empty registry", e instanceof Error ? e.message : e);
      state = { imported: [], removed: [] };
    }
    const legacy = getHiddenModels()
      .filter((id) => id.startsWith(`${provider}:`))
      .map((id) => id.slice(provider.length + 1))
      .filter((slug) => !state.removed.includes(slug));
    if (legacy.length > 0) {
      state = { ...state, removed: [...state.removed, ...legacy] };
      writeRegistry(provider, state);
    }
  }
  return state.imported.length === 0 && state.removed.length === 0
    ? EMPTY
    : state;
}

export function writeRegistry(provider: string, state: RegistryState) {
  try {
    window.localStorage.setItem(storageKey(provider), JSON.stringify(state));
  } catch (e) {
    console.warn("model-registry: persist failed", e instanceof Error ? e.message : e);
  }
}

export function importCatalogModels(
  provider: string,
  entries: CatalogSpec[],
  freeOnly: boolean
): RegistryState {
  const state = readRegistry(provider);
  const byId = new Map(state.imported.map((m) => [m.id, m]));
  for (const e of entries) {
    if (freeOnly && e.free !== true) continue;
    const prev = byId.get(e.id);
    byId.set(e.id, {
      id: e.id,
      name: e.name,
      context: e.context,
      free: e.free,
      inModalities: e.inModalities,
      outModalities: e.outModalities,
      tools: e.tools,
      custom: prev?.custom ?? false,
    });
  }
  const next = { ...state, imported: [...byId.values()] };
  writeRegistry(provider, next);
  return next;
}

export function addRegistryModel(
  provider: string,
  entry: CatalogSpec & { custom: boolean }
): { state: RegistryState; duplicate: boolean } {
  const state = readRegistry(provider);
  if (state.imported.some((m) => m.id === entry.id)) {
    return { state, duplicate: true };
  }
  const next = {
    ...state,
    imported: [...state.imported, { ...entry }],
    removed: state.removed.filter((id) => id !== entry.id),
  };
  writeRegistry(provider, next);
  return { state: next, duplicate: false };
}

export function removeRegistryModel(provider: string, slug: string): RegistryState {
  const state = readRegistry(provider);
  const full = prefixed(provider, slug);
  if (!getHiddenModels().includes(full)) toggleHiddenModel(full);
  const next = state.removed.includes(slug)
    ? state
    : { ...state, removed: [...state.removed, slug] };
  writeRegistry(provider, next);
  return next;
}

export function restoreRegistryModel(provider: string, slug: string): RegistryState {
  const state = readRegistry(provider);
  const full = prefixed(provider, slug);
  if (getHiddenModels().includes(full)) toggleHiddenModel(full);
  const next = { ...state, removed: state.removed.filter((id) => id !== slug) };
  writeRegistry(provider, next);
  return next;
}
