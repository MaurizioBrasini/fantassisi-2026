// app/api/admin/reset/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  // 1. Verifica che l'utente sia admin o staff
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  // 2. Leggi il tipo di reset richiesto
  const { type } = await request.json();
  
  // 3. Accetta anche "today" come opzione valida
  if (type !== "scores" && type !== "full" && type !== "today") {
    return NextResponse.json({ 
      message: "Tipo di reset non valido. Usa: 'scores', 'full' o 'today'" 
    }, { status: 400 });
  }

  // 4. Crea il client Supabase con service_role_key (bypassa RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 5. Mappa i tipi alle funzioni RPC
  const functionMap = {
    scores: "reset_scores",   // cancella TUTTI i voti
    full: "reset_full",        // cancella TUTTO (voti, eventi, bonus)
    today: "reset_today"       // cancella solo i voti di OGGI
  };

  const rpcFunction = functionMap[type as keyof typeof functionMap];
  
  // 6. Esegui la funzione RPC
  const { error } = await supabase.rpc(rpcFunction);

  if (error) {
    console.error("Errore reset:", error);
    return NextResponse.json({ 
      message: "Errore reset: " + error.message 
    }, { status: 500 });
  }

  // 7. Restituisci successo
  return NextResponse.json({ message: "✅ Reset completato!" });
}
