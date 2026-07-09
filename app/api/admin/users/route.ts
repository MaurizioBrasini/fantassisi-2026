// app/api/admin/users/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROTECTED_EMAIL = "mabras69@gmail.com";
const VALID_TEAMS = new Set(["Matricole", "Veterani", "Didatti&Docenti"]);

// GET: Lista utenti (con paginazione e ricerca)
export async function GET(request: Request) {
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
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
  const requesterRole = cookies().get("user_role")?.value;
  if (requesterRole !== "admin" && requesterRole !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await request.json();
  const { email, first_name, last_name, team } = body;
  let userRole = body.role;

  if (!email) {
    return NextResponse.json({ message: "Email obbligatoria" }, { status: 400 });
  }

  if (userRole === "admin" && requesterRole !== "admin") {
    userRole = "staff";
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
  const requesterRole = cookies().get("user_role")?.value;
  if (requesterRole !== "admin" && requesterRole !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await request.json();
  const { id, email, first_name, last_name, team } = body;
  let userRole = body.role;

  if (!id) {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }

  const { data: userToUpdate } = await supabase
    .from("users")
    .select("email")
    .eq("id", id)
    .single();

  const isProtectedAccount = userToUpdate?.email === PROTECTED_EMAIL;

  if (userRole === "admin" && requesterRole !== "admin") {
    userRole = "staff";
  }

  const updateData: any = {};

  if (first_name !== undefined) updateData.first_name = first_name;
  if (last_name !== undefined) updateData.last_name = last_name;

  // Stringa vuota → null, valore non valido → null
  if (team !== undefined) {
    updateData.team = team && VALID_TEAMS.has(team) ? team : null;
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
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
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
