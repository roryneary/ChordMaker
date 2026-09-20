/**
 * Firestore refuses a document with an `undefined` anywhere in it — not just
 * at the top — and refuses the whole write, not the one field. This app leaves
 * keys absent on purpose (`capo`, `shared`, `copiedFrom`: see types/song.ts),
 * and an object spread can carry one through as an explicit `undefined`.
 *
 * Pure, and apart from the modules that call Firestore, so it can be tested in
 * plain node without the SDK.
 */
export function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) out[k] = withoutUndefined(v);
  }
  return out as T;
}
