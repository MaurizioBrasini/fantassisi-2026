// Limitatore di tentativi in memoria (un solo processo Node su Render: basta così).
// Conta solo i tentativi falliti; si azzera da solo alla scadenza della finestra o a ogni riavvio.
type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function isBlocked(key: string, max: number): boolean {
  const e = buckets.get(key);
  if (!e) return false;
  if (Date.now() > e.resetAt) {
    buckets.delete(key);
    return false;
  }
  return e.count >= max;
}

export function registerFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now > e.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    e.count += 1;
  }
  // Pulizia occasionale per non far crescere la mappa.
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (now > v.resetAt) buckets.delete(k);
    });
  }
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}
