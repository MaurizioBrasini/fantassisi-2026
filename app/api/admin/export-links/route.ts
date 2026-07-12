import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team"); // filtro opzionale per team

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let allUsers: any[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("users")
      .select("first_name, last_name, email, auth_token, team, site, year")
      .range(from, from + 999);
    if (team) query = query.eq("team", team);
    const { data: page } = await query;
    if (!page || page.length === 0) break;
    allUsers.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }

  const BASE_URL = "https://fantassisi-2026.onrender.com";

  const rows = allUsers
    .filter((u) => u.email && u.auth_token)
    .map((u) => {
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
      const link = `${BASE_URL}/api/auth?token=${u.auth_token}`;
      // Escape campi CSV
      const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
      return [esc(name), esc(u.email), esc(u.team || ""), esc(u.site || ""), esc(u.year || ""), esc(link)].join(",");
    });

  const csv = ["Nome,Email,Team,Sede,Anno,Link personale", ...rows].join("\n");
  const filename = team ? `fantassisi_links_${team}.csv` : "fantassisi_links_tutti.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
