// Ripristina un backup JSON ("Scarica backup" dal pannello admin) in un database Supabase.
//
// Uso (da cartella del progetto, dopo aver eseguito sql/00_INSTALLAZIONE_COMPLETA.sql sul progetto nuovo):
//   node scripts/restore-backup.mjs <backup.json> --env <file.env>          prova a vuoto: mostra solo i conteggi
//   node scripts/restore-backup.mjs <backup.json> --env <file.env> --yes    scrive davvero
//
// <file.env> deve contenere NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY del progetto DI DESTINAZIONE
// (di solito il file render.env aggiornato col nuovo progetto). Si rifiuta di scrivere se la tabella users
// del database di destinazione non e' vuota, per non mescolare dati.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--env") + 1]);
const envPath = args[args.indexOf("--env") + 1];
const write = args.includes("--yes");
if (!file || args.indexOf("--env") < 0 || !envPath) {
  console.error("Uso: node scripts/restore-backup.mjs <backup.json> --env <file.env> [--yes]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Nel file env mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, "utf8"));
// Ordine di caricamento: prima le tabelle a cui le altre rimandano (chiave esterna).
const ORDER = [
  ["users", "id"],
  ["app_settings", "key"],
  ["votable_events", "id"],
  ["bonus_qr", "id"],
  ["team_boosts", "id"],
  ["boost_allocations", "id"],
  ["votes", "id"],
  ["event_votes", "id"],
  ["bonus_redemptions", "id"],
];

console.log(`Backup del ${backup.created_at} (${backup.app})`);
console.log(`Destinazione: ${url}`);
for (const [t] of ORDER) console.log(`  ${t}: ${(backup.tables?.[t] || []).length} righe`);
if (backup.missing?.length) console.log("ATTENZIONE, tabelle mancanti nel backup:", backup.missing);

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { count, error: countError } = await supabase.from("users").select("id", { count: "exact", head: true });
if (countError) {
  console.error("Impossibile leggere users nel database di destinazione (hai eseguito 00_INSTALLAZIONE_COMPLETA.sql?):", countError.message);
  process.exit(1);
}
if (count > 0) {
  console.error(`La tabella users di destinazione ha gia' ${count} righe: non scrivo.`);
  process.exit(1);
}
if (!write) {
  console.log("\nProva a vuoto: niente scritto. Aggiungi --yes per ripristinare.");
  process.exit(0);
}

for (const [table, pk] of ORDER) {
  const rows = backup.tables?.[table] || [];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500), { onConflict: pk });
    if (error) {
      console.error(`ERRORE su ${table} (righe ${i}-${i + 499}): ${error.message}`);
      process.exit(1);
    }
  }
  const { count: after } = await supabase.from(table).select("*", { count: "exact", head: true });
  console.log(`${table}: ${after}/${rows.length}${after === rows.length ? " ok" : "  <-- NON COMBACIA"}`);
}
console.log("Fatto. In admin, Stato del sistema -> Esegui controllo.");
