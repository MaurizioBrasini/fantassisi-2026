// app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";
import { generateUnusedPin } from "@/lib/pins";
import { personalLink } from "@/lib/urls";
import { forbidden, readJsonObject } from "@/lib/http";
import { VALID_TEAMS, VALID_YEARS, isYearValidForTeam } from "@/lib/config";

const PROTECTED_EMAIL = "mabras69@gmail.com";

// GET: Lista utenti (con paginazione e ricerca) — solo admin: contiene token di accesso e PIN di tutti
export async function GET(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  let query = getSupabaseAdmin()
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
    return forbidden();
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ message: "Richiesta non valida" }, { status: 400 });
  }
  const { first_name, last_name, team, site, school, year } = body as Record<string, string>;
  // Sempre minuscola e senza spazi: /accedi cerca la mail così, e due maiuscole diverse sarebbero due utenti.
  const email = String(body.email ?? "").trim().toLowerCase();
  let userRole = body.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Email obbligatoria e valida" }, { status: 400 });
  }

  // Solo un admin può assegnare un ruolo diverso da "student" in fase di creazione
  if (requester.role !== "admin" || !["student", "staff", "admin"].includes(String(userRole))) {
    userRole = "student";
  }

  // Validazione Team ↔ Anno
  if (team && year && !isYearValidForTeam(team, year)) {
    return NextResponse.json({
      message: `⚠️ L'anno "${year}" non è valido per il team "${team}"`
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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
  const teamValue = team && VALID_TEAMS.includes(team) ? team : null;
  const yearValue = year && VALID_YEARS.includes(year) ? year : null;

  const pin = await generateUnusedPin();

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
      pin,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "✅ Utente creato!",
    user: data,
    link: personalLink(authToken),
  });
}

// PUT: Aggiorna un utente — solo admin
export async function PUT(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return forbidden();
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ message: "Richiesta non valida" }, { status: 400 });
  }
  const { id, email, first_name, last_name, team, site, school, year, is_didatta } = body as Record<string, any>;
  let userRole = body.role as string | undefined;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }
  if (userRole !== undefined && !["student", "staff", "admin"].includes(userRole)) {
    return NextResponse.json({ message: "Ruolo non valido" }, { status: 400 });
  }
  // Nessuno può cambiare il proprio ruolo (un admin che si declassa lascerebbe il pannello senza admin).
  if (id === requester.id && userRole !== undefined && userRole !== requester.role) {
    return NextResponse.json({ message: "Non puoi cambiare il tuo stesso ruolo" }, { status: 400 });
  }

  // Validazione Team ↔ Anno
  if (team && year && !isYearValidForTeam(team, year)) {
    return NextResponse.json({
      message: `⚠️ L'anno "${year}" non è valido per il team "${team}"`
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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
    updateData.team = team && VALID_TEAMS.includes(team) ? team : null;
  }
  if (site !== undefined) {
    updateData.site = site || null;
  }
  if (school !== undefined) {
    updateData.school = school || null;
  }
  if (year !== undefined) {
    updateData.year = year && VALID_YEARS.includes(year) ? year : null;
  }
  // Permette di correggere manualmente chi è docente/staff ma è stato registrato
  // come Matricola/Veterano prima che esistesse il cambio squadra (o comunque non
  // arrivato dall'import come Didatti&Docenti): senza questo flag non vede i
  // pulsanti per scegliere/cambiare/lasciare la squadra.
  if (is_didatta !== undefined) {
    updateData.is_didatta = !!is_didatta;
  }

  if (!isProtectedAccount) {
    if (email) updateData.email = String(email).trim().toLowerCase();
    if (userRole !== undefined) updateData.role = userRole;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "Niente da aggiornare" }, { status: 400 });
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

// DELETE: Elimina un utente — solo admin
export async function DELETE(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return forbidden();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
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