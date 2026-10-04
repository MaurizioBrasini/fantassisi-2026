// Prova di carico di FantAssisi (R1). Simula molti partecipanti che usano l'app nello stesso momento.
// Fa SOLO letture (apertura app, classifiche, controllo premi, tabellone): non vota e non modifica nulla.
//
// Uso (dalla cartella del progetto, serve Node 18 o più recente):
//   node scripts/load-test.mjs --users 300 --minutes 3
//   node scripts/load-test.mjs --users 300 --minutes 3 --cookie "session_sig=VALORE"
// Opzioni:
//   --url      indirizzo del sito (predefinito: https://fantassisi-2026.onrender.com)
//   --users    partecipanti simulati contemporaneamente (predefinito 100)
//   --minutes  durata della prova (predefinito 2)
//   --ramp     secondi per far entrare gradualmente tutti gli utenti (predefinito 30)
//   --cookie   cookie di sessione di un account (anche admin) per provare anche le pagine con accesso:
//              Chrome -> F12 -> Application -> Cookies -> sito -> copia il valore di "session_sig"
//              e passalo come "session_sig=VALORE". Senza cookie si provano solo le parti pubbliche.
// Vedi docs/EVENTO.md per quando e come farla (con Render su Standard, non sul piano gratuito).

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
);
const BASE = (args.url || "https://fantassisi-2026.onrender.com").replace(/\/+$/, "");
const USERS = Math.max(1, Number(args.users || 100));
const MINUTES = Math.max(0.25, Number(args.minutes || 2));
const RAMP_S = Math.max(0, Number(args.ramp ?? 30));
const COOKIE = args.cookie || "";
const ABORT_ERROR_RATE = 0.25; // si ferma da sola se più di 1 richiesta su 4 fallisce

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

// Cosa fa un partecipante, con il peso di ogni azione (quanto spesso capita).
const withSession = [
  { w: 30, name: "apertura app", steps: ["/", "/api/me", "/api/standings?view=dashboard", "/api/premio", "/api/fase"] },
  { w: 25, name: "controllo premi (automatico ogni 20 s)", steps: ["/api/premio"] },
  { w: 15, name: "controllo apertura voto (automatico ogni 30 s)", steps: ["/api/fase"] },
  { w: 10, name: "classifica individuale", steps: ["/ranking/individuali", "/api/standings?view=individuali"] },
  { w: 8, name: "classifica classi", steps: ["/api/standings?view=classi"] },
  { w: 7, name: "classifica sedi", steps: ["/api/standings?view=sedi"] },
  { w: 5, name: "pagina Vota", steps: ["/scan"] },
];
const publicOnly = [
  { w: 40, name: "controllo premi", steps: ["/api/premio"] },
  { w: 25, name: "controllo apertura voto", steps: ["/api/fase"] },
  { w: 20, name: "pagina iniziale", steps: ["/"] },
  { w: 10, name: "tabellone", steps: ["/api/tabellone"] },
  { w: 5, name: "pagina accedi", steps: ["/accedi"] },
];
const SCENARIOS = COOKIE ? withSession : publicOnly;
const totalW = SCENARIOS.reduce((s, x) => s + x.w, 0);
const pickScenario = () => {
  let r = Math.random() * totalW;
  for (const s of SCENARIOS) if ((r -= s.w) <= 0) return s;
  return SCENARIOS[0];
};

const stats = new Map(); // percorso -> { ok, err, ms: [] }
const recent = []; // [time, ok] per il controllo di sicurezza
let stop = false;

function record(path, ok, ms) {
  const key = path.split("?")[0] + (path.includes("view=") ? "?" + path.split("?")[1] : "");
  const s = stats.get(key) || { ok: 0, err: 0, ms: [] };
  ok ? s.ok++ : s.err++;
  s.ms.push(ms);
  stats.set(key, s);
  recent.push([Date.now(), ok]);
}

async function hit(path) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { headers: COOKIE ? { cookie: COOKIE } : {}, redirect: "manual" });
    await res.arrayBuffer();
    record(path, res.status < 400, performance.now() - t0);
  } catch {
    record(path, false, performance.now() - t0);
  }
}

async function virtualUser(i, endAt) {
  await sleep((RAMP_S * 1000 * i) / USERS); // ingresso graduale
  while (!stop && Date.now() < endAt) {
    for (const step of pickScenario().steps) {
      if (stop) break;
      await hit(step);
      await sleep(rand(200, 800)); // tra una richiesta e l'altra della stessa azione
    }
    await sleep(rand(2000, 6000)); // la persona guarda lo schermo prima della prossima azione
  }
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

async function main() {
  console.log(`Prova di carico su ${BASE}`);
  console.log(`${USERS} partecipanti simulati per ${MINUTES} minuti (ingresso graduale in ${RAMP_S} s), ${COOKIE ? "CON sessione" : "solo parti pubbliche"}.\n`);
  const started = Date.now();
  const endAt = started + MINUTES * 60_000;

  const monitor = setInterval(() => {
    const cutoff = Date.now() - 30_000;
    while (recent.length && recent[0][0] < cutoff) recent.shift();
    const errors = recent.filter((r) => !r[1]).length;
    const rate = recent.length ? errors / recent.length : 0;
    const total = Array.from(stats.values()).reduce((s, x) => s + x.ok + x.err, 0);
    process.stdout.write(`  ${Math.round((Date.now() - started) / 1000)} s · richieste ${total} · ultimi 30 s: ${(recent.length / 30).toFixed(1)}/s, errori ${(rate * 100).toFixed(1)}%\n`);
    if (recent.length > 50 && rate > ABORT_ERROR_RATE) {
      console.log(`\n!! Troppi errori (${(rate * 100).toFixed(0)}%): prova interrotta per non sovraccaricare il sito.`);
      stop = true;
    }
  }, 10_000);

  await Promise.all(Array.from({ length: USERS }, (_, i) => virtualUser(i, endAt)));
  clearInterval(monitor);

  const seconds = (Date.now() - started) / 1000;
  const rows = Array.from(stats.entries()).sort((a, b) => b[1].ok + b[1].err - (a[1].ok + a[1].err));
  let totalReq = 0, totalErr = 0, allMs = [];
  console.log("\nRisultati per funzione (tempi in millisecondi):");
  console.log("percorso".padEnd(38) + "richieste".padStart(10) + "errori".padStart(8) + "mediana".padStart(9) + "p95".padStart(7) + "p99".padStart(7) + "max".padStart(7));
  for (const [path, s] of rows) {
    totalReq += s.ok + s.err;
    totalErr += s.err;
    allMs = allMs.concat(s.ms);
    console.log(path.padEnd(38) + String(s.ok + s.err).padStart(10) + String(s.err).padStart(8) + String(pct(s.ms, 50)).padStart(9) + String(pct(s.ms, 95)).padStart(7) + String(pct(s.ms, 99)).padStart(7) + String(Math.round(Math.max(...s.ms))).padStart(7));
  }
  const p95 = pct(allMs, 95);
  const errRate = totalReq ? totalErr / totalReq : 0;
  console.log(`\nTotale: ${totalReq} richieste in ${seconds.toFixed(0)} s (${(totalReq / seconds).toFixed(1)} al secondo), errori ${(errRate * 100).toFixed(2)}%, p95 complessivo ${p95} ms.`);
  const verdict =
    errRate > 0.02 ? "NON OK: troppi errori (oltre il 2%)." :
    p95 > 2000 ? "AL LIMITE: il 5% delle richieste supera i 2 secondi." :
    p95 > 1000 ? "ACCETTABILE: tempi un po' alti nei momenti di punta." :
    "OK: il sito regge questo carico con tempi buoni.";
  console.log(`Verdetto: ${verdict}`);
}

main().catch((e) => {
  console.error("Errore della prova:", e);
  process.exit(1);
});
