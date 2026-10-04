// Esegue una alla volta le azioni con la stessa chiave (es. tutte le azioni di voto di una persona).
//
// Serve perché "controllo se ha già votato / ha coin" e "scrivo il voto" sono due passaggi separati:
// due richieste identiche arrivate nello stesso istante passerebbero entrambe il controllo prima che
// il primo voto sia scritto (scavalcando l'attesa di rivoto e il saldo dei coin). L'app gira in un solo
// processo Node su Render (stessa ipotesi di lib/rateLimit.ts), quindi un blocco in memoria basta;
// con più istanze servirebbe un vincolo nel database.
const tails = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(fn, fn); // parte dopo la precedente, anche se questa è fallita
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  // Pulizia: se nessuno si è accodato nel frattempo, la chiave si toglie.
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
