// Test del motore di gioco: `npm test`. Fissano le regole decise con l'organizzazione, così una
// modifica che le rompe si vede subito, prima di andare in produzione. Nessun database: le parti che
// lo usano ricevono un database finto.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test";

import { buildStandings } from "../lib/standings";
import { planPublicBonus, classesOfSite } from "../lib/publicBonus";
import { planBoost, MAX_POINTS_PER_PERSON } from "../lib/boosts";
import { canonClass, sameClass } from "../lib/classKey";
import { asPin, asUuid, asShortText } from "../lib/http";
import { withLock } from "../lib/userLock";
import { generateUniquePins } from "../lib/utils";
import { cooldownMinutes } from "../lib/qrActions";
import { getVotingPhase, isValidOpensAt } from "../lib/phase";

const user = (id: string, team: string | null, school: string | null, site: string | null, year: string | null) => ({
  id, first_name: id, last_name: "", team, school, site, year,
});

test("voto a una persona: conta per lei, la sua squadra, la sua classe e la sua sede", () => {
  const s = buildStandings([user("a", "Veterani", "SPC", "Roma", "quarto")], [{ recipient_id: "a", points: 2 }], [], [], []);
  assert.deepEqual(s.teams, { Matricole: 0, Veterani: 2 });
  assert.equal(s.pointsByUser.get("a"), 2);
  assert.equal(s.classes[0].key, "SPC||Roma||quarto");
  assert.equal(s.sites.find((x) => x.site === "Roma")!.points, 2);
});

test("pre-iscritti, ex allievi e senza classe: punti solo alla squadra, mai a classe e sede", () => {
  const users = [user("p", "Matricole", "APC", "Roma", "preiscrizione"), user("x", "Veterani", "SPC", "Roma", "specializzato"), user("n", "Veterani", null, null, null)];
  const s = buildStandings(users, [{ recipient_id: "p", points: 1 }, { recipient_id: "x", points: 1 }, { recipient_id: "n", points: 1 }], [], [], []);
  assert.deepEqual(s.teams, { Matricole: 1, Veterani: 2 });
  assert.equal(s.classes.length, 0);
  assert.equal(s.sites.find((x) => x.site === "Roma")!.points, 0);
});

test("grafie vecchie: '4° ANNO 2026' e 'quarto' sono la stessa classe", () => {
  const users = [user("a", "Veterani", "SPC", "Roma", "4° ANNO 2026"), user("b", "Veterani", "SPC", "Roma", "quarto")];
  const qr = [{ team_target: "Veterani", qr_type: "class", class_school: "SPC", class_site: "Roma", class_year: "4° ANNO 2026", points: 3 }];
  const s = buildStandings(users, [{ recipient_id: "a", points: 1 }, { recipient_id: "b", points: 1 }], qr, [], []);
  assert.equal(s.classes.length, 1);
  assert.equal(s.classes[0].points, 5);
  assert.deepEqual(canonClass("CCMA Marco Aurelio", "Marco Aurelio Roma", "1° ANNO 2026"), { school: "CCMA", site: "Roma", year: "primo" });
  assert.ok(sameClass({ school: "APC ROMANIA", site: "Bucarest", year: "2° ANNO 2026" }, { school: "APC", site: "Bucarest", year: "secondo" }));
  assert.ok(!sameClass({ school: "SPC", site: "Roma", year: "terzo" }, { school: "SPC", site: "Roma", year: "quarto" }));
});

test("QR di sede: i punti vanno solo alla sede, non a squadre né classi", () => {
  const qr = [{ team_target: null, qr_type: "site", class_school: null, class_site: "Roma", class_year: null, points: 1 }];
  const s = buildStandings([], [], qr, [], []);
  assert.equal(s.sites.find((x) => x.site === "Roma")!.points, 1);
  assert.deepEqual(s.teams, { Matricole: 0, Veterani: 0 });
  assert.equal(s.classes.length, 0);
});

test("somme del database (sql/09) = calcolo riga per riga", () => {
  const users = [user("a", "Veterani", "SPC", "Roma", "quarto"), user("b", "Matricole", "AIPC", "Bari", "primo")];
  const votes = [{ recipient_id: "a", points: 2 }, { recipient_id: "a", points: 1 }, { recipient_id: "b", points: 2 }];
  const evs = [
    { team_target: "Matricole", qr_type: "team", class_school: null, class_site: null, class_year: null, points: 2 },
    { team_target: "Matricole", qr_type: "team", class_school: null, class_site: null, class_year: null, points: 1 },
    { team_target: "Veterani", qr_type: "class", class_school: "SPC", class_site: "Roma", class_year: "quarto", points: 2 },
  ];
  const rows = buildStandings(users, votes, evs, [], []);
  const summed = buildStandings(
    users,
    [{ recipient_id: "a", points: 3 }, { recipient_id: "b", points: 2 }],
    [evs[2], { ...evs[0], points: 3 }],
    [],
    []
  );
  const pick = (s: ReturnType<typeof buildStandings>) => JSON.stringify([s.teams, s.individuals, s.classes, s.sites]);
  assert.equal(pick(rows), pick(summed));
});

test("premio palese a una sede: metà squadre (50/50), metà classi, nessun punto perso", () => {
  for (const site of ["Roma", "Bari", "Bucarest", "L'Aquila", "Verona"]) {
    for (const points of [1, 2, 3, 7, 50, 101, 999]) {
      const { allocations } = planPublicBonus({ type: "site", site }, points);
      assert.equal(allocations.reduce((s, a) => s + a.points, 0), points, `${site} ${points}`);
      assert.ok(allocations.every((a) => a.points > 0));
      const teams = allocations.filter((a) => a.team).reduce((s, a) => s + a.points, 0);
      assert.equal(teams, Math.round(points / 2));
    }
  }
  assert.equal(classesOfSite("Roma").length, 13);
});

test("premio a una classe: classe, sede e squadra della classe", () => {
  const { allocations } = planPublicBonus({ type: "class", school: "SPC", site: "Roma", year: "secondo" }, 20);
  const s = buildStandings([], [], [], [], allocations);
  assert.deepEqual(s.teams, { Matricole: 20, Veterani: 0 });
  assert.equal(s.classes[0].points, 20);
  assert.equal(s.sites.find((x) => x.site === "Roma")!.points, 20);
});

test("bonus nascosto: tutti i punti assegnati, mai più di 4 a persona", () => {
  const people = Array.from({ length: 50 }, (_, i) => "p" + i);
  for (const total of [1, 7, 100, 500]) {
    const { allocations, peoplePoints, teamPoints } = planBoost(people, total, 0, 60_000);
    assert.equal(peoplePoints + teamPoints, total);
    assert.equal(allocations.reduce((s, a) => s + a.points, 0), total);
    const perPerson = new Map<string, number>();
    for (const a of allocations) if (a.user_id) perPerson.set(a.user_id, (perPerson.get(a.user_id) || 0) + a.points);
    assert.ok(Array.from(perPerson.values()).every((p) => p <= MAX_POINTS_PER_PERSON));
  }
});

test("bonus nascosto enorme (99.999 punti): tutti i punti, poche migliaia di righe", () => {
  const people = Array.from({ length: 480 }, (_, i) => "p" + i);
  const { allocations, peoplePoints, teamPoints } = planBoost(people, 99999, 0, 60_000);
  assert.equal(peoplePoints + teamPoints, 99999);
  assert.equal(allocations.reduce((s, a) => s + a.points, 0), 99999);
  assert.ok(allocations.length < 3000, `righe: ${allocations.length}`);
  // i bonus normali restano a pezzi da 1-2 punti
  const small = planBoost(people, 500, 0, 60_000).allocations.filter((a) => !a.user_id);
  assert.ok(small.every((a) => a.points <= 2));
});

test("PIN generati: mai 1212/3434 se riservati, mai ripetuti", () => {
  const used = new Set(["1212", "3434", "0001"]);
  const pins = generateUniquePins(500, used);
  assert.equal(new Set(pins).size, 500);
  assert.ok(pins.every((p) => /^\d{4}$/.test(p) && !used.has(p)));
});

test("input dall'esterno: PIN, uuid e codici fuori formato sono scartati", () => {
  assert.equal(asPin("1212"), "1212");
  assert.equal(asPin(1212), "1212");
  for (const bad of ["abcd", "12345", "", null, {}, [], "x".repeat(20000)]) assert.equal(asPin(bad), null);
  assert.equal(asUuid("20565f48-56eb-44a8-ad19-1ceb37827fee"), "20565f48-56eb-44a8-ad19-1ceb37827fee");
  assert.equal(asUuid("' or 1=1 --"), null);
  assert.equal(asShortText("x".repeat(121)), null);
});

test("attese di rivoto: squadra 15 min (5 durante il karaoke), classe 1 ora", () => {
  const at = (iso: string) => Date.parse(iso);
  // sabato 17 ottobre 2026: karaoke 16:00-19:00 ora italiana = 14:00-17:00 UTC
  assert.equal(cooldownMinutes("team", at("2026-10-17T13:59:00Z")), 15);
  assert.equal(cooldownMinutes("team", at("2026-10-17T14:00:00Z")), 5);
  assert.equal(cooldownMinutes("team", at("2026-10-17T16:59:00Z")), 5);
  assert.equal(cooldownMinutes("team", at("2026-10-17T17:00:00Z")), 15);
  assert.equal(cooldownMinutes("class", at("2026-10-17T15:00:00Z")), 60);
  assert.equal(cooldownMinutes("class", at("2026-10-16T10:00:00Z")), 60);
});

test("fase: apertura predefinita giovedì 15 ottobre 00:00 (ora italiana), date accettate solo nel 2026", async () => {
  const phase = await getVotingPhase(); // senza database: valori predefiniti
  assert.equal(phase.mode, "auto");
  assert.equal(phase.opensAt, null);
  assert.equal(phase.previewStarted, false); // senza data di inizio l'Anteprima è "da definire": in attesa
  assert.ok(isValidOpensAt("2026-10-15T08:00:00.000Z"));
  assert.ok(!isValidOpensAt("2062-10-15T08:00:00.000Z"));
  assert.ok(!isValidOpensAt("domani"));
});

test("azioni di voto della stessa persona: una alla volta", async () => {
  const log: string[] = [];
  const job = (name: string, ms: number) => withLock("u1", async () => { log.push("inizio " + name); await new Promise((r) => setTimeout(r, ms)); log.push("fine " + name); });
  await Promise.all([job("A", 20), job("B", 1), job("C", 1)]);
  assert.deepEqual(log, ["inizio A", "fine A", "inizio B", "fine B", "inizio C", "fine C"]);
});
