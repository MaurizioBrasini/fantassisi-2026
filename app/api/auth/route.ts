import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token mancante" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Cerca l'utente con il token
  const { data: user, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, team, role, class, site")
    .eq("auth_token", token)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: "Token non valido" },
      { status: 401 }
    );
  }

  // Crea la risposta con redirect alla dashboard
  const response = NextResponse.redirect(new URL("/", request.url));

  // Imposta i cookie con scadenza 14 giorni (maxAge in secondi)
  // 60 secondi * 60 minuti * 24 ore * 14 giorni = 1.209.600 secondi
  const maxAge = 60 * 60 * 24 * 14;

  response.cookies.set("user_id", user.id, {
    maxAge,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  response.cookies.set("user_team", user.team || "", {
    maxAge,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  response.cookies.set("user_role", user.role || "student", {
    maxAge,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Opzionale: cookie aggiuntivi per informazioni utili
  if (user.class) {
    response.cookies.set("user_class", user.class, {
      maxAge,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  if (user.site) {
    response.cookies.set("user_site", user.site, {
      maxAge,
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return response;
}
