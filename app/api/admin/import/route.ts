import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current);
        current = "";
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

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return NextResponse.json({ message: "Il file è vuoto o non valido" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existing } = await supabase.from("users").select("email, auth_token");
  const existingTokens = new Map((existing || []).map((u) => [u.email, u.auth_token]));

  const validTeams = new Set(["Matricole", "Veterani"]);
  const validRoles = new Set(["student", "staff", "admin"]);

  const records = rows
    .filter((r) => r.email)
    .map((r) => {
      const email = r.email.trim().toLowerCase();
      const team = validTeams.has(r.team) ? r.team : null;
      const role = validRoles.has(r.role) ? r.role : "student";
      const token =
        existingTokens.get(email) || r.auth_token || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      return {
        email,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        school: r.school || null,
        site: r.site || null,
        year: r.year || null,
        role,
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

  return NextResponse.json({ message: `✅ Importati/aggiornati ${imported} utenti su ${records.length} righe.` });
}
