import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { fetchAllRows } from "@/lib/fetchAll";
import { personalLink } from "@/lib/urls";

export async function GET(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team"); // filtro opzionale per team

  const allUsers = await fetchAllRows<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    auth_token: string | null;
    team: string | null;
    site: string | null;
    year: string | null;
    status: string | null;
  }>(getSupabaseAdmin(), "users", "first_name, last_name, email, auth_token, team, site, year, status", {
    filter: team ? (q) => q.eq("team", team) : undefined,
  });

  // Escape campi CSV
  const esc = (s: string | null | undefined) => `"${(s || "").replace(/"/g, '""')}"`;

  const rows = allUsers
    .filter((u) => u.email && u.auth_token)
    .map((u) => {
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
      return [esc(name), esc(u.email), esc(u.team), esc(u.site), esc(u.year), esc(u.status || "confermato"), esc(personalLink(u.auth_token!))].join(",");
    });

  const csv = ["Nome,Email,Team,Sede,Anno,Stato,Link personale", ...rows].join("\n");
  const filename = team ? `fantassisi_links_${team}.csv` : "fantassisi_links_tutti.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
