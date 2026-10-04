import { CONFIG_ISCRIZIONE } from "./config";

// Una classe è (scuola, sede, anno). Nei dati arrivati dai fogli di iscrizione e dai primi QR le tre
// parti hanno anche grafie vecchie: l'anno come "4° ANNO 2026" invece di "quarto", la scuola come
// "CCMA Marco Aurelio" o "APC ROMANIA", la sede come "Marco Aurelio Roma". Tutti i confronti tra
// classi (classifiche, QR di classe, Anteprima, blocco dei duplicati) passano da qui, così la stessa
// classe è sempre riconosciuta qualunque sia la grafia salvata.
const YEARS: Record<string, string> = {
  "PRE-ISCRITTI 2027 E 2028": "preiscrizione",
  "1° ANNO 2026": "primo",
  "2° ANNO 2026": "secondo",
  "3° ANNO 2026": "terzo",
  "4° ANNO 2026": "quarto",
};
const BY_NUMBER: Record<string, string> = { "1": "primo", "2": "secondo", "3": "terzo", "4": "quarto" };
const VALID_YEARS = CONFIG_ISCRIZIONE.anni.map((a) => a.value).filter(Boolean);

export function canonYear(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (VALID_YEARS.includes(t)) return t;
  if (YEARS[t.toUpperCase()]) return YEARS[t.toUpperCase()];
  const m = t.match(/(\d)\s*°?\s*ANNO/i);
  if (m && BY_NUMBER[m[1]]) return BY_NUMBER[m[1]];
  if (/PRE[\s-]*ISCRI/i.test(t)) return "preiscrizione";
  return t;
}

export function canonSchool(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  return CONFIG_ISCRIZIONE.scuole.find((s) => upper === s || upper.startsWith(s + " ")) || t;
}

export function canonSite(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  const exact = CONFIG_ISCRIZIONE.sedi.find((s) => s.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  if (/marco aurelio/i.test(t) && /roma/i.test(t)) return "Roma";
  return t;
}

export type ClassParts = { school: string | null; site: string | null; year: string | null };

export function canonClass(school: string | null | undefined, site: string | null | undefined, year: string | null | undefined): ClassParts {
  return { school: canonSchool(school), site: canonSite(site), year: canonYear(year) };
}

/** Due classi (in qualunque grafia) sono la stessa? */
export function sameClass(a: ClassParts, b: ClassParts): boolean {
  const x = canonClass(a.school, a.site, a.year);
  const y = canonClass(b.school, b.site, b.year);
  return !!x.school && x.school === y.school && x.site === y.site && x.year === y.year;
}
