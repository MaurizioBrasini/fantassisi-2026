// Legge una tabella intera a pagine da 1000 righe (il limite di Supabase per richiesta).
//
// L'ordinamento è obbligatorio: senza ORDER BY il database non garantisce che due pagine
// consecutive vedano le righe nello stesso ordine, e mentre arrivano nuovi voti una riga può
// essere saltata o contata due volte. Per questo l'helper ordina sempre (per id, di default).
//
// Se una pagina fallisce la riprova una volta, poi lancia l'errore: meglio nessun dato che
// un punteggio calcolato su dati incompleti senza che nessuno se ne accorga.
const PAGE_SIZE = 1000;

type TableClient = { from: (table: string) => any };

export async function fetchAllRows<T = any>(
  client: TableClient,
  table: string,
  columns: string,
  options: { filter?: (query: any) => any; orderBy?: string } = {}
): Promise<T[]> {
  const { filter, orderBy = "id" } = options;
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let page: T[] | null = null;
    let lastError: { message?: string } | null = null;

    for (let attempt = 0; attempt < 2 && page === null; attempt++) {
      let query = client.from(table).select(columns);
      if (filter) query = filter(query);
      const { data, error } = await query.order(orderBy).range(from, from + PAGE_SIZE - 1);
      if (error) lastError = error;
      else page = (data || []) as T[];
    }

    if (page === null) {
      throw new Error(`Lettura di "${table}" non riuscita: ${lastError?.message ?? "errore sconosciuto"}`);
    }
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}
