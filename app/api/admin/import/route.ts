import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { generateUniquePins } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import { fetchAllRows } from "@/lib/fetchAll";
import { fetchUsedPins } from "@/lib/pins";
import { VALID_TEAMS, VALID_YEARS, isYearValidForTeam } from "@/lib/config";
import * as XLSX from "xlsx";

const BRANDS = ["CCMA", "APC ROMANIA", "SICC", "AIPC", "IGB", "APC", "SPC"];

const DIDATTI_DOCENTI = new Set([
  "Didatta",
  "Cotrainer e/o conduttore di project",
  "Docente",
]);
const SEMPRE_MATRICOLE = new Set(["Tirocinante APC o SPC"]);
const SEMPRE_VETERANI = new Set(["Ex allievo", "Allievo altre scuole", "Esterno"]);
const ANNI_MATRICOLE = new Set([
  "PRE-ISCRITTI 2027 E 2028",
  "1° ANNO 2026",
  "2° ANNO 2026",
]);
const ANNI_VETERANI = new Set(["3° ANNO 2026", "4° ANNO 2026"]);

// Mappatura anni per il valore normalizzato
const YEAR_MAP: Record<string, string> = {
  "PRE-ISCRITTI 2027 E 2028": "preiscrizione",
  "1° ANNO 2026": "primo",
  "2° ANNO 2026": "secondo",
  "3° ANNO 2026": "terzo",
  "4° ANNO 2026": "quarto",
};

function normalizeYear(raw: string): string | null {
  const trimmed = raw?.trim() || "";
  if (YEAR_MAP[trimmed]) return YEAR_MAP[trimmed];
  // Fallback: estrai numero dall'anno
  const match = trimmed.match(/(\d+)°\s*ANNO/i);
  if (match) {
    const num = parseInt(match[1]);
    const map: Record<number, string> = { 1: "primo", 2: "secondo", 3: "terzo", 4: "quarto" };
    return map[num] || null;
  }
  return null;
}

function splitSchoolSite(raw: string | undefined): { school: string | null; site: string | null } {
  if (!raw || !raw.trim()) return { school: null, site: null };
  const value = raw.trim();
  for (const brand of BRANDS) {
    if (value.toUpperCase().startsWith(brand.toUpperCase())) {
      const site = value.slice(brand.length).trim();
      return { school: brand, site: site || null };
    }
  }
  return { school: null, site: value };
}

// Confronto case-insensitive: nel file capita "docente" minuscolo
const lowerSet = (s: Set<string>) => new Set(Array.from(s).map((v) => v.toLowerCase()));
const DIDATTI_DOCENTI_L = lowerSet(DIDATTI_DOCENTI);
const SEMPRE_MATRICOLE_L = lowerSet(SEMPRE_MATRICOLE);
const SEMPRE_VETERANI_L = lowerSet(SEMPRE_VETERANI);

type Status = "confermato" | "lista_attesa" | "ritirato";
const STATUS_PRIORITY: Record<Status, number> = { confermato: 3, lista_attesa: 2, ritirato: 1 };

function assignTeam(iscrizioneRaw: string, anno: string): string | null {
  const iscrizione = iscrizioneRaw.trim().toLowerCase();
  if (DIDATTI_DOCENTI_L.has(iscrizione)) return "Didatti&Docenti";
  if (SEMPRE_MATRICOLE_L.has(iscrizione)) return "Matricole";
  if (SEMPRE_VETERANI_L.has(iscrizione)) return "Veterani";
  if (iscrizione === "allievo in corso") {
    if (ANNI_MATRICOLE.has(anno)) return "Matricole";
    if (ANNI_VETERANI.has(anno)) return "Veterani";
  }
  return null;
}

// Refusi di battitura frequenti nei domini delle email. Si corregge solo il dominio
// (mai la parte prima della @) e solo per refusi inequivocabili.
const DOMAIN_TYPOS: Record<string, string> = {
  "gamil.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com",
  "gmial.com": "gmail.com", "gnail.com": "gmail.com", "gmaill.com": "gmail.com",
  "gmail.coml": "gmail.com", "gmail.con": "gmail.com", "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.con": "hotmail.com",
  "hotmail.coml": "hotmail.com", "hotmail.itt": "hotmail.it",
  "yahoo.con": "yahoo.com", "yaho.com": "yahoo.com", "yaho.it": "yahoo.it",
  "libero.itt": "libero.it", "libero.con": "libero.it", "outlook.con": "outlook.com",
};

// Nel file capita una cella con più indirizzi ("a@x.it; b@y.it"): si tiene il primo
// valido, così non nasce un utente con un'email finta che non riceverebbe mai il link.
// Il dominio con un refuso noto viene corretto (es. gamil.com -> gmail.com).
function firstValidEmail(raw: string): string {
  const candidates = raw.toLowerCase().split(/[\s;,]+/).filter(Boolean);
  const valid = candidates.find((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
  if (!valid) return "";
  const at = valid.lastIndexOf("@");
  const domain = valid.slice(at + 1);
  return valid.slice(0, at + 1) + (DOMAIN_TYPOS[domain] ?? domain);
}

async function parseRawExcel(
  file: File
): Promise<{ records: Record<string, any>[]; emailScartate: string[]; attesaGiaConfermata: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let headers: string[] | null = null;
  const sheetsData: { raw: any[][]; status: Status }[] = [];

  const ritirati: Record<string, any>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (raw.length === 0) continue;
    // Foglio cancellati/ritirati: ha solo COGNOME, NOME, EMAIL (formato diverso dagli altri)
    if (/cancell|ritirat/i.test(sheetName)) {
      const h = raw[0].map((c) => String(c).trim().toUpperCase());
      const iEmail = h.indexOf("EMAIL");
      if (iEmail < 0) continue;
      for (const r of raw.slice(1)) {
        ritirati.push({ __status: "ritirato", "Indirizzo email": r[iEmail] ?? "" });
      }
      continue;
    }
    if (!headers && raw[0].some((cell) => String(cell).trim() === "ISCRIZIONE")) {
      headers = raw[0].map((h) => String(h).trim());
    }
    sheetsData.push({ raw, status: /attesa/i.test(sheetName) ? "lista_attesa" : "confermato" });
  }

  if (!headers) {
    throw new Error("Formato del file non riconosciuto: non trovo la colonna 'ISCRIZIONE'.");
  }

  const allRows: Record<string, any>[] = [];
  for (const { raw, status } of sheetsData) {
    const isHeaderRow = raw[0].some((cell) => String(cell).trim() === "ISCRIZIONE");
    const dataRows = isHeaderRow ? raw.slice(1) : raw;
    for (const r of dataRows) {
      const obj: Record<string, any> = { __status: status };
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      allRows.push(obj);
    }
  }

  // Stessa email in più fogli (es. confermato e lista d'attesa): vince lo stato più "forte"
  const seen = new Map<string, Record<string, any>>();
  const emailScartate: string[] = [];
  for (const row of [...allRows, ...ritirati]) {
    const rawEmail = String(row["Indirizzo email"] || "").trim();
    const email = firstValidEmail(rawEmail);
    if (!email) {
      if (rawEmail) emailScartate.push(rawEmail);
      continue;
    }
    const prev = seen.get(email);
    if (prev && STATUS_PRIORITY[prev.__status as Status] >= STATUS_PRIORITY[row.__status as Status]) continue;
    seen.set(email, { ...row, "Indirizzo email": email });
  }

  // Stessa persona in lista d'attesa con un'altra email e già tra i confermati: si tiene
  // solo il confermato (altrimenti nascerebbe un secondo account). Vale solo per la
  // lista d'attesa: due confermati con lo stesso nome potrebbero essere omonimi veri.
  const nameKey = (row: Record<string, any>) =>
    `${row["COGNOME"] || ""} ${row["NOME"] || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/g, " ")
      .split(" ")
      .filter(Boolean)
      .sort()
      .join(" ");
  const confirmedNames = new Set(
    Array.from(seen.values()).filter((r) => r.__status === "confermato").map(nameKey).filter(Boolean)
  );
  const attesaGiaConfermata: string[] = [];
  for (const [email, row] of Array.from(seen.entries())) {
    if (row.__status === "lista_attesa" && confirmedNames.has(nameKey(row))) {
      seen.delete(email);
      attesaGiaConfermata.push(`${String(row["COGNOME"] || "").trim()} ${String(row["NOME"] || "").trim()} <${email}>`);
    }
  }

  const records = Array.from(seen.values()).map((row) => {
    const status = row.__status as Status;
    const iscrizione = String(row["ISCRIZIONE"] || "").trim();
    const anno = String(row["ANNO DI FREQUENZA"] || "").trim();
    let { school, site } = splitSchoolSite(String(row["Scuola in cui sei iscritto"] || ""));
    if (!site) {
      const fallback = splitSchoolSite(String(row["SCUOLA DI APPARTENENZA"] || ""));
      school = school || fallback.school;
      site = site || fallback.site;
    }
    // La compatibilità squadra ↔ anno si controlla più sotto, per Excel e CSV insieme.
    return {
      first_name: String(row["NOME"] || "").trim() || null,
      last_name: String(row["COGNOME"] || "").trim() || null,
      email: String(row["Indirizzo email"] || "").trim().toLowerCase(),
      phone: normalizePhone(row["TELEFONO"]),
      school: school || null,
      site: site || null,
      year: normalizeYear(anno),
      role: "student",
      team: assignTeam(iscrizione, anno),
      status,
      auth_token: "",
    };
  });

  return { records, emailScartate, attesaGiaConfermata };
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { current += char; }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current); current = "";
      } else {
        current += char;
      }
    }
    fields.push(current);
    return fields;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (values[i] || "").trim()));
    return row;
  });
}

export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "Nessun file ricevuto" }, { status: 400 });
  }

  const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

  let rawRecords: Record<string, any>[];
  let emailScartate: string[] = [];
  let attesaGiaConfermata: string[] = [];
  try {
    if (isExcel) {
      const parsed = await parseRawExcel(file);
      rawRecords = parsed.records;
      emailScartate = parsed.emailScartate;
      attesaGiaConfermata = parsed.attesaGiaConfermata;
    } else {
      const text = await file.text();
      rawRecords = parseCSV(text);
    }
  } catch (e: any) {
    return NextResponse.json({ message: "Errore lettura file: " + e.message }, { status: 400 });
  }

  if (rawRecords.length === 0) {
    return NextResponse.json({ message: "Il file è vuoto o non valido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Lettura completa e ordinata di chi è già a sistema (vedi lib/fetchAll.ts): chi non venisse
  // letto sembrerebbe "nuovo" e perderebbe token e PIN. Se la lettura fallisce l'import si ferma
  // qui, prima di scrivere qualsiasi cosa.
  let existing: {
    email: string;
    auth_token: string;
    pin: string | null;
    role: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
  }[];
  let usedPins: Set<string>;
  try {
    existing = await fetchAllRows(supabase, "users", "email, auth_token, pin, role, phone, first_name, last_name", { orderBy: "email" });
    usedPins = await fetchUsedPins(); // anche i PIN di eventi e bonus: lo spazio PIN è unico
  } catch (e: any) {
    return NextResponse.json({ message: `Import annullato, non è stato modificato nulla. ${e.message}` }, { status: 500 });
  }
  // Il ruolo (student/staff/admin) di chi è già a sistema non si tocca mai col reimport:
  // il file Excel non lo contiene e lo riporterebbe a "student".
  const existingRoles = new Map(existing.map((u) => [u.email, u.role]));
  const existingTokens = new Map(existing.map((u) => [u.email, u.auth_token]));
  const existingPins = new Map(existing.map((u) => [u.email, u.pin]));
  const existingPhones = new Map(existing.map((u) => [u.email, u.phone]));

  const validRoles = new Set(["student", "staff", "admin"]);

  const filteredRaw = rawRecords.filter((r) => r.email && r.status !== "ritirato");

  // Cancellati: si segnano come "ritirato" solo se sono già a sistema (restano a database
  // con squadra e dati invariati); chi non c'è ancora non viene creato (il foglio non ha
  // né scuola né anno, quindi non si potrebbe assegnare la squadra).
  const ritiratiEmails = Array.from(
    new Set(
      rawRecords
        .filter((r) => r.email && r.status === "ritirato")
        .map((r) => String(r.email).trim().toLowerCase())
    )
  ).filter((e) => existingTokens.has(e));

  // PIN a 4 cifre (fallback voto senza fotocamera): mai rigenerato per chi
  // ce l'ha già (sennò il PIN già stampato/mostrato smetterebbe di funzionare
  // a ogni reimport), assegnato una volta sola per chi non ce l'ha ancora.
  const emailsNeedingPin: string[] = [];
  const seenEmails = new Set<string>();
  for (const r of filteredRaw) {
    const email = String(r.email).trim().toLowerCase();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    if (!existingPins.get(email)) emailsNeedingPin.push(email);
  }
  const newPins = generateUniquePins(emailsNeedingPin.length, usedPins);
  const pinByEmail = new Map(emailsNeedingPin.map((email, i) => [email, newPins[i]]));

  const records = filteredRaw
    .map((r) => {
      const email = String(r.email).trim().toLowerCase();
      const team = r.team && VALID_TEAMS.includes(r.team) ? r.team : null;
      const existingRole = existingRoles.get(email);
      const userRole =
        existingRole && validRoles.has(existingRole)
          ? existingRole
          : validRoles.has(r.role) ? r.role : "student";
      const year = r.year && VALID_YEARS.includes(r.year) ? r.year : null;

      // Validazione Team ↔ Anno: se l'anno non è compatibile la squadra resta da assegnare
      const finalTeam = team && isYearValidForTeam(team, year) ? team : null;
      // Lista d'attesa: importati con la squadra di competenza (da iscrizione/anno), come i
      // confermati; lo stato serve solo a riconoscerli.
      const status: Status = r.status === "lista_attesa" ? "lista_attesa" : "confermato";

      const token =
        existingTokens.get(email) || r.auth_token || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      return {
        email,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        // Il telefono del file vince; se la cella è vuota o non valida si tiene quello già a sistema.
        phone: r.phone || existingPhones.get(email) || null,
        school: r.school || null,
        site: r.site || null,
        year: year,
        role: userRole,
        team: finalTeam,
        // Chi arriva da roster come Didatti&Docenti può poi scegliere/cambiare/lasciare la
        // squadra liberamente (vedi /api/admin/enroll); un allievo vero non può mai farlo.
        is_didatta: finalTeam === "Didatti&Docenti",
        status,
        auth_token: token,
        pin: existingPins.get(email) || pinByEmail.get(email) || null,
      };
    });

  // Controlli prima di scrivere: un PIN o un token ripetuto farebbe fallire i blocchi a metà
  // e lascerebbe l'import incompleto. Meglio fermarsi prima, senza toccare nulla.
  const pinOwner = new Map<string, string>();
  const tokenOwner = new Map<string, string>();
  for (const r of records) {
    for (const [value, owners, label] of [
      [r.pin, pinOwner, "PIN"],
      [r.auth_token, tokenOwner, "token"],
    ] as const) {
      if (!value) continue;
      const other = owners.get(value);
      if (other && other !== r.email) {
        return NextResponse.json(
          { message: `Import annullato: ${label} duplicato tra ${other} e ${r.email}. Non è stato modificato nulla.` },
          { status: 409 }
        );
      }
      owners.set(value, r.email);
    }
  }
  const recordEmails = new Set(records.map((r) => r.email));
  for (const u of existing) {
    if (recordEmails.has(u.email)) continue;
    const clashPin = u.pin ? pinOwner.get(u.pin) : undefined;
    if (clashPin) {
      return NextResponse.json(
        { message: `Import annullato: il PIN di ${clashPin} coincide con quello di un altro utente. Non è stato modificato nulla.` },
        { status: 409 }
      );
    }
  }

  // Nuovi iscritti con lo stesso nome e cognome di uno già a sistema (altra email): si importano,
  // ma vengono segnalati perché potrebbero essere doppioni (o omonimi veri).
  const normName = (first: string | null, last: string | null) =>
    `${last || ""} ${first || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z ]/g, " ")
      .split(" ")
      .filter(Boolean)
      .sort()
      .join(" ");
  const namesInDb = new Map<string, string[]>();
  for (const u of existing) {
    const k = normName(u.first_name, u.last_name);
    if (k) namesInDb.set(k, [...(namesInDb.get(k) || []), u.email]);
  }
  const possibiliDoppioni = records
    .filter((r) => !existingTokens.has(r.email))
    .map((r) => ({ r, same: namesInDb.get(normName(r.first_name, r.last_name)) || [] }))
    .filter((x) => x.same.length > 0)
    .map((x) => `${x.r.last_name || ""} ${x.r.first_name || ""} <${x.r.email}> ≈ <${x.same[0]}>`);

  const BATCH_SIZE = 200;
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("users").upsert(batch, { onConflict: "email" });
    if (error) {
      errors.push(error.message);
    } else {
      imported += batch.length;
    }
  }

  // Mai ritirare admin/staff, anche se per errore compaiono nel foglio dei cancellati
  const daRitirare = ritiratiEmails.filter((e) => (existingRoles.get(e) || "student") === "student");
  let ritirati = 0;
  for (let i = 0; i < daRitirare.length; i += BATCH_SIZE) {
    const batch = daRitirare.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("users")
      .update({ status: "ritirato" })
      .in("email", batch);
    if (error) {
      errors.push(error.message);
    } else {
      ritirati += batch.length;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { message: `Importati ${imported} su ${records.length}, ritirati ${ritirati}. Errori: ${errors.join(" | ")}` },
      { status: 207 }
    );
  }

  const nuovi = records.filter((r) => !existingTokens.has(r.email)).length;
  const attesa = records.filter((r) => r.status === "lista_attesa").length;
  return NextResponse.json({
    message: `✅ Importati/aggiornati ${imported} utenti su ${records.length} righe (${nuovi} nuovi, ${records.length - nuovi} già presenti; ${records.length - attesa} confermati, ${attesa} in lista d'attesa). Segnati come ritirati: ${ritirati}.${
      emailScartate.length > 0
        ? ` ⚠️ Righe scartate per email non valida (${emailScartate.length}): ${emailScartate.slice(0, 10).join(", ")}`
        : ""
    }${
      possibiliDoppioni.length > 0
        ? ` ⚠️ Nuovi iscritti con lo stesso nome di uno già presente (${possibiliDoppioni.length}), controlla se sono doppioni: ${possibiliDoppioni.slice(0, 10).join("; ")}`
        : ""
    }${
      attesaGiaConfermata.length > 0
        ? ` ℹ️ In lista d'attesa ma già confermati con un'altra email, non importati (${attesaGiaConfermata.length}): ${attesaGiaConfermata.slice(0, 10).join(", ")}`
        : ""
    }`,
  });
}