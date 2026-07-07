import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";

const BRANDS = ["CCMA Marco Aurelio", "APC ROMANIA", "SICC", "AIPC", "IGB", "APC", "SPC"];

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

function assignTeam(iscrizione: string, anno: string): string | null {
  if (DIDATTI_DOCENTI.has(iscrizione)) return "Didatti&Docenti";
  if (SEMPRE_MATRICOLE.has(iscrizione)) return "Matricole";
  if (SEMPRE_VETERANI.has(iscrizione)) return "Veterani";
  if (iscrizione === "Allievo in corso") {
    if (ANNI_MATRICOLE.has(anno)) return "Matricole";
    if (ANNI_VETERANI.has(anno)) return "Veterani";
  }
  return null;
}

async function parseRawExcel(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let headers: string[] | null = null;
  const sheetsData: any[][][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (raw.length === 0) continue;
    if (!headers && raw[0].some((cell) => String(cell).trim() === "ISCRIZIONE")) {
      headers = raw[0].map((h) => String(h).trim());
    }
    sheetsData.push(raw);
  }

  if (!headers) {
    throw new Error("Formato del file non riconosciuto: non trovo la colonna 'ISCRIZIONE'.");
  }

  const allRows: Record<string, any>[] = [];
  for (const raw of sheetsData) {
    const isHeaderRow = raw[0].some((cell) => String(cell).trim() === "ISCRIZIONE");
    const dataRows = isHeaderRow ? raw.slice(1) : raw;
    for (const r of dataRows) {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => (obj[h] = r[i] ?? ""));
      allRows.push(obj);
    }
  }

  const seen = new Map<string, Record<string, any>>();
  for (const row of allRows) {
    const email = String(row["Indirizzo email"] || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.set(email, row);
  }

  return Array.from(seen.values()).map((row) => {
    const iscrizione = String(row["ISCRIZIONE"] || "").trim();
    const anno = String(row["ANNO DI FREQUENZA"] || "").trim();
    let { school, site } = splitSchoolSite(String(row["Scuola in cui sei iscritto"] || ""));
    if (!site) {
      const fallback = splitSchoolSite(String(row["SCUOLA DI APPARTENENZA"] || ""));
      school = school || fallback.school;
      site = site || fallback.site;
    }
    return {
      first_name: String(row["NOME"] || "").trim() || null,
      last_name: String(row["COGNOME"] || "").trim() || null,
      email: String(row["Indirizzo email"] || "").trim().toLowerCase(),
      school,
      site,
      year: anno || null,
      role: "student",
      team: assignTeam(iscrizione, anno),
      auth_token: "",
    };
  });
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
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ message: "Nessun file ricevuto" }, { status: 400 });
  }

  const isExcel = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

  let rawRecords: Record<string, any>[];
  try {
    if (isExcel) {
      rawRecords = await parseRawExcel(file);
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await supabase.from("users").select("email, auth_token");
  const existingTokens = new Map((existing || []).map((u) => [u.email, u.auth_token]));

  const validTeams = new Set(["Matricole", "Veterani", "Didatti&Docenti"]);
  const validRoles = new Set(["student", "staff", "admin"]);

  const records = rawRecords
    .filter((r) => r.email)
    .map((r) => {
      const email = String(r.email).trim().toLowerCase();
      const team = r.team && validTeams.has(r.team) ? r.team : null;
      const userRole = validRoles.has(r.role) ? r.role : "student";
      const token =
        existingTokens.get(email) || r.auth_token || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      return {
        email,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        school: r.school || null,
        site: r.site || null,
        year: r.year || null,
        role: userRole,
        team,
        auth_token: token,
      };
    });

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

  if (errors.length > 0) {
    return NextResponse.json(
      { message: `Importati ${imported} su ${records.length}. Errori: ${errors.join(" | ")}` },
      { status: 207 }
    );
  }

  return NextResponse.json({
    message: `✅ Importati/aggiornati ${imported} utenti su ${records.length} righe.`,
  });
}
