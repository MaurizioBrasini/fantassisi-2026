import { CONFIG_ISCRIZIONE, CLASS_YEARS, teamForYear, yearLabel } from "./config";

// Bonus PALESI (premi con banner): punti dati a una persona, a una classe o a una sede, subito.
// Come si ramificano (tutto a punti interi, i resti si arrotondano):
//  - persona: conta come voto ricevuto, quindi sale anche la sua squadra, classe e sede;
//  - classe: i punti vanno alla classe, alla sede e alla squadra della classe (come un QR di classe);
//  - sede: metà alle squadre (50/50 tra Matricole e Veterani, il punto dispari a sorte) e metà alle
//    classi della sede (divisa tra le sue classi, i resti a sorte). I punti delle classi salgono anche
//    nella sede, ma non nelle squadre, che hanno già avuto la loro metà.
// Le righe prodotte sono quelle di `boost_allocations` (vedi sql/07_public_bonuses.sql).
export type PublicTarget =
  | { type: "person"; userId: string }
  | { type: "class"; school: string; site: string; year: string }
  | { type: "site"; site: string };

export type PublicAllocation = {
  user_id: string | null;
  team: string | null;
  points: number;
  class_school: string | null;
  class_site: string | null;
  class_year: string | null;
};

const row = (p: Partial<PublicAllocation> & { points: number }): PublicAllocation => ({
  user_id: null, team: null, class_school: null, class_site: null, class_year: null, ...p,
});


/** Le classi che esistono davvero in una sede: per ogni scuola i primi N anni (N da `classiPerSedeScuola`). */
export function classesOfSite(site: string): { school: string; year: string }[] {
  const schools = (CONFIG_ISCRIZIONE.scuolePerSede as Record<string, string[]>)[site] || [];
  return schools.flatMap((school) => {
    const n = CONFIG_ISCRIZIONE.classiPerSedeScuola.eccezioni[`${site}||${school}`] ?? CONFIG_ISCRIZIONE.classiPerSedeScuola.default;
    return CLASS_YEARS.slice(0, n).map((year) => ({ school, year }));
  });
}

/** Controlla che sede/scuola/anno esistano; restituisce il messaggio d'errore oppure null. */
export function validateClass(school: string, site: string, year: string): string | null {
  const schools = (CONFIG_ISCRIZIONE.scuolePerSede as Record<string, string[]>)[site];
  if (!schools) return "Sede non valida";
  if (!schools.includes(school)) return `La scuola ${school} non esiste a ${site}`;
  if (!CLASS_YEARS.includes(year)) return "Anno non valido (1°-4°)";
  return null;
}

/** Piano di un bonus palese. `personTeam` serve solo per il bonus a una persona. */
export function planPublicBonus(
  target: PublicTarget,
  points: number,
  personTeam: string | null = null,
  random: () => number = Math.random
): { allocations: PublicAllocation[]; summary: string } {
  if (target.type === "person") {
    return {
      allocations: [row({ user_id: target.userId, team: personTeam, points })],
      summary: `${points} punti alla persona (salgono anche squadra, classe e sede)`,
    };
  }

  if (target.type === "class") {
    return {
      allocations: [row({ team: teamForYear(target.year), class_school: target.school, class_site: target.site, class_year: target.year, points })],
      summary: `${points} punti a ${target.school} ${target.site} ${yearLabel(target.year)} (salgono anche la sede e la squadra ${teamForYear(target.year)})`,
    };
  }

  // Sede
  const teamHalf = Math.round(points / 2);
  const classHalf = points - teamHalf;
  const matricole = Math.floor(teamHalf / 2) + (teamHalf % 2 === 1 && random() < 0.5 ? 1 : 0);
  const veterani = teamHalf - matricole;

  const classes = classesOfSite(target.site);
  const perClass = classes.map(() => (classes.length ? Math.floor(classHalf / classes.length) : 0));
  let remainder = classes.length ? classHalf - perClass.reduce((s, n) => s + n, 0) : 0;
  const order = classes.map((_, i) => i).sort(() => random() - 0.5);
  for (const i of order) {
    if (remainder <= 0) break;
    perClass[i] += 1;
    remainder -= 1;
  }

  const allocations: PublicAllocation[] = [];
  if (matricole > 0) allocations.push(row({ team: "Matricole", points: matricole }));
  if (veterani > 0) allocations.push(row({ team: "Veterani", points: veterani }));
  classes.forEach((c, i) => {
    if (perClass[i] > 0) allocations.push(row({ class_school: c.school, class_site: target.site, class_year: c.year, points: perClass[i] }));
  });

  return {
    allocations,
    summary: `${teamHalf} punti alle squadre (${matricole} Matricole, ${veterani} Veterani) e ${classHalf} alle ${classes.length} classi di ${target.site}`,
  };
}
