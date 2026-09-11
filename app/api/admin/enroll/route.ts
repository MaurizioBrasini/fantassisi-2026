import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

const VALID_TEAMS = new Set(["Matricole", "Veterani", "Didatti&Docenti"]);

export async function POST(request: Request) {
  const userId = getVerifiedUserId();

  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { team, site, school, year } = await request.json();
  if (!VALID_TEAMS.has(team)) {
    return NextResponse.json({ error: "Team non valido" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Non ci si fida del cookie: si rilegge sempre lo stato reale dal DB
  const { data: user } = await supabase
    .from("users")
    .select("team, is_didatta, first_name, last_name")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  // Può scegliere/cambiare/lasciare la squadra solo chi non è già bloccato in una squadra
  // assegnata dall'import (Matricole/Veterani in base all'anno) — quindi chi è Didatti&Docenti,
  // chi non ha ancora nessuna squadra (es. account creati senza team), o chi è già stato
  // Didatti&Docenti in passato (is_didatta). Un allievo importato direttamente come
  // Matricola/Veterano non può mai cambiarla.
  const canChooseTeam =
    (user.team !== "Matricole" && user.team !== "Veterani") || user.is_didatta === true;
  if (!canChooseTeam) {
    return NextResponse.json({ error: "Non puoi cambiare squadra" }, { status: 403 });
  }

  // Sede e classe hanno senso solo entrando in una squadra reale; sono facoltative,
  // ma se indicate devono essere coerenti tra loro, con la sede e col team.
  let finalSite: string | null = null;
  let finalSchool: string | null = null;
  let finalYear: string | null = null;

  if (team !== "Didatti&Docenti" && site) {
    if (!CONFIG_ISCRIZIONE.sedi.includes(site)) {
      return NextResponse.json({ error: "Sede non valida" }, { status: 400 });
    }
    finalSite = site;

    if (school || year) {
      const validSchools = CONFIG_ISCRIZIONE.scuolePerSede[site] || [];
      const validYears = CONFIG_ISCRIZIONE.teamAnniValid[team] || [];
      if (!school || !year || !validSchools.includes(school) || !validYears.includes(year)) {
        return NextResponse.json({ error: "Classe non valida per questa sede/team" }, { status: 400 });
      }
      finalSchool = school;
      finalYear = year;
    }
  }

  const { error } = await supabase
    .from("users")
    .update({
      team,
      site: finalSite,
      school: finalSchool,
      year: finalYear,
      is_didatta: true, // una volta ottenuto il permesso di scegliere, resta per sempre
    })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Errore durante il cambio squadra" }, { status: 500 });
  }

  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return NextResponse.json({ success: true, team, site: finalSite, school: finalSchool, year: finalYear, name });
}
