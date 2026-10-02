import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase con la chiave di servizio, SOLO lato server (route API e funzioni server).
// Creato alla prima richiesta e poi riusato: niente connessioni nuove a ogni chiamata, e niente
// lettura delle variabili d'ambiente durante la build.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return client;
}
