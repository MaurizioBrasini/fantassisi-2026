import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin, TEAM_PINS } from "@/lib/pins";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventRow = { id: string; title: string | null; qr_code: string; pin: string | null; created_at: string };
const FIELDS = "id, title, qr_code, pin, created_at";

// Fase Anteprima: a ogni partecipante servono il QR (e il PIN) della propria squadra e della propria
// classe, da mettere nelle slides delle relazioni. Sono i normali QR di voto (votable_events), che
// scansionati votano solo quando il voto è aperto. Il QR di classe, se manca, si crea qui al primo
// bisogno: così ogni classe ha il suo senza doverli generare uno per uno dal pannello.
export async function GET() {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("users").select("team, school, site, year").eq("id", userId).maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }
  if (user.team !== "Matricole" && user.team !== "Veterani") {
    return NextResponse.json({ team: null, class: null });
  }

  // QR di squadra: quello col PIN fisso se esiste, altrimenti il più vecchio.
  const { data: teamEvents } = await supabase
    .from("votable_events")
    .select(FIELDS)
    .eq("qr_type", "team")
    .eq("team_target", user.team)
    .neq("active", false)
    .order("created_at", { ascending: true });
  const teamRows = (teamEvents || []) as EventRow[];
  const teamEvent = teamRows.find((e) => e.pin === TEAM_PINS[user.team as "Matricole" | "Veterani"]) || teamRows[0] || null;

  // QR di classe: solo se la persona ha scuola, sede e anno.
  let classEvent: EventRow | null = null;
  let classLabel = "";
  if (user.school && user.site && user.year) {
    const yearLabel = CONFIG_ISCRIZIONE.anni.find((a) => a.value === user.year)?.label || user.year;
    classLabel = `${user.school} · ${user.site} · ${yearLabel}`;

    const findClass = async () => {
      const { data } = await supabase
        .from("votable_events")
        .select(FIELDS)
        .eq("qr_type", "class")
        .eq("class_school", user.school)
        .eq("class_site", user.site)
        .eq("class_year", user.year)
        .neq("active", false)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      return (data || []) as EventRow[];
    };

    let rows = await findClass();
    if (rows.length === 0) {
      const teamTarget = (CONFIG_ISCRIZIONE.teamAnniValid.Matricole as string[]).includes(user.year) ? "Matricole" : "Veterani";
      const { error } = await supabase.from("votable_events").insert({
        title: `${user.school} ${user.site} ${yearLabel}`,
        qr_type: "class",
        team_target: teamTarget,
        class_school: user.school,
        class_site: user.site,
        class_year: user.year,
        qr_code: `QR:${randomUUID()}`,
        pin: await generateUnusedPin(),
        active: true,
      });
      if (error) console.error("Anteprima: creazione QR classe fallita:", error.message);
      rows = await findClass();
      // Due compagni di classe possono averlo creato insieme: si tiene il più vecchio e si tolgono gli altri.
      for (const extra of rows.slice(1)) {
        await supabase.from("votable_events").delete().eq("id", extra.id);
      }
    }
    classEvent = rows[0] || null;
  }

  const pick = (e: EventRow | null) => (e ? { title: e.title, qr_code: e.qr_code, pin: e.pin } : null);
  return NextResponse.json(
    { team: pick(teamEvent), class: pick(classEvent), className: classLabel },
    { headers: { "Cache-Control": "no-store" } }
  );
}
