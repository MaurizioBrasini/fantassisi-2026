// app/api/admin/users/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { randomUUID } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROTECTED_EMAIL = "mabras69@gmail.com";
const VALID_TEAMS = new Set(["Matricole", "Veterani", "Didatti&Docenti"]);
const VALID_ANNI = ["preiscrizione", "primo", "secondo", "terzo", "quarto", "specializzato"];

// Vincoli Team ↔ Anno (FILTRO OBBLIGATORIO)
const TEAM_ANNI_VALID: Record<string, string[]> = {
  'Matricole': ['preiscrizione', 'primo', 'secondo'],
  'Veterani': ['terzo', 'quarto', 'specializzato'],
  'Didatti&Docenti': ['preiscrizione', 'primo', 'secondo', 'terzo', 'quarto', 'specializzato'],
};

function isValidYearForTeam(team: string | null, year: string | null): boolean {
  if (!year) return true;
  const validYears = team ? TEAM_ANNI_VALID[team] || [] : VALID_ANNI;
  return validYears.includes(year);
}

// GET: Lista utenti (con paginazione e ricerca)
export async function GET(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

// POST: Crea un nuovo utente
export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await request.json();
  const { email, first_name, last_name, team, site, school, year } = body;
  let userRole = body.role;

  if (!email) {
    return NextResponse.json({ message: "Email obbligatoria" }, { status: 400 });
  }

  // Solo un admin può assegnare un ruolo diverso da "student" in fase di creazione
  if (requester.role !== "admin") {
    userRole = "student";
  }

  // Validazione Team ↔ Anno
  if (team && year && !isValidYearForTeam(team, year)) {
    const yearLabel = VALID_ANNI.includes(year) ? year : year;
    return NextResponse.json({ 
      message: `⚠️ L'anno "${yearLabel}" non è valido per il team "${team}"` 
    }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Email già registrata" }, { status: 400 });
  }

  const authToken = randomUUID();

  // Stringa vuota → null, valore non valido → null
  const teamValue = team && VALID_TEAMS.has(team) ? team : null;
  const yearValue = year && VALID_ANNI.includes(year) ? year : null;

  const { data, error } = await supabase
    .from("users")
    .insert({
      id: randomUUID(),
      email,
      first_name: first_name || "",
      last_name: last_name || "",
      team: teamValue,
      role: userRole || "student",
      auth_token: authToken,
      site: site || null,
      school: school || null,
      year: yearValue,
      // Chi entra come Didatti&Docenti può poi scegliere/cambiare/lasciare la squadra
      // liberamente (vedi /api/admin/enroll); vedi anche il PUT sotto per correggere
      // manualmente i casi di docenti registrati come Matricola/Veterano.
      is_didatta: teamValue === "Didatti&Docenti",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "✅ Utente creato!",
    user: data,
    link: `https://fantassisi-2026.onrender.com/api/auth?token=${authToken}`,
  });
}

// PUT: Aggiorna un utente
export async function PUT(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await request.json();
  const { id, email, first_name, last_name, team, site, school, year, is_didatta } = body;
  let userRole = body.role;

  if (!id) {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }

  // Validazione Team ↔ Anno
  if (team && year && !isValidYearForTeam(team, year)) {
    const yearLabel = VALID_ANNI.includes(year) ? year : year;
    return NextResponse.json({ 
      message: `⚠️ L'anno "${yearLabel}" non è valido per il team "${team}"` 
    }, { status: 400 });
  }

  const { data: userToUpdate } = await supabase
    .from("users")
    .select("email")
    .eq("id", id)
    .single();

  const isProtectedAccount = userToUpdate?.email === PROTECTED_EMAIL;

  // Solo un admin può cambiare il ruolo di un utente. Uno staff può modificare
  // nome/cognome/team/email ma non toccare il campo role in alcun modo.
  if (requester.role !== "admin") {
    userRole = undefined;
  }

  const updateData: any = {};

  if (first_name !== undefined) updateData.first_name = first_name;
  if (last_name !== undefined) updateData.last_name = last_name;

  // Stringa vuota → null, valore non valido → null
  if (team !== undefined) {
    updateData.team = team && VALID_TEAMS.has(team) ? team : null;
  }
  if (site !== undefined) {
    updateData.site = site || null;
  }
  if (school !== undefined) {
    updateData.school = school || null;
  }
  if (year !== undefined) {
    updateData.year = year && VALID_ANNI.includes(year) ? year : null;
  }
  // Permette di correggere manualmente chi è docente/staff ma è stato registrato
  // come Matricola/Veterano prima che esistesse il cambio squadra (o comunque non
  // arrivato dall'import come Didatti&Docenti): senza questo flag non vede i
  // pulsanti per scegliere/cambiare/lasciare la squadra.
  if (is_didatta !== undefined) {
    updateData.is_didatta = !!is_didatta;
  }

  if (!isProtectedAccount) {
    if (email) updateData.email = email;
    if (userRole !== undefined) updateData.role = userRole;
  }

  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "✅ Utente aggiornato!", user: data });
}

// DELETE: Elimina un utente
export async function DELETE(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }

  const { data: userToDelete } = await supabase
    .from("users")
    .select("email")
    .eq("id", id)
    .single();

  if (userToDelete?.email === PROTECTED_EMAIL) {
    return NextResponse.json({ message: "Non puoi eliminare l'admin principale" }, { status: 403 });
  }

  await supabase.from("votes").delete().eq("voter_id", id);
  await supabase.from("votes").delete().eq("recipient_id", id);

  const { error } = await supabase.from("users").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "✅ Utente eliminato!" });
}