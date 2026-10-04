import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getVotingPhase, setPhaseMode, type PhaseMode } from "@/lib/phase";
import { forbidden, readJsonObject } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET: fase corrente — admin o staff. POST { mode }: cambia fase — solo admin.
export async function GET() {
  if (!(await requireRole("admin", "staff"))) {
    return forbidden();
  }
  return NextResponse.json(await getVotingPhase());
}

export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return forbidden();
  }

  const body = await readJsonObject(request);
  const mode = body?.mode;
  if (mode !== "auto" && mode !== "preview" && mode !== "open") {
    return NextResponse.json({ message: "Modalità non valida" }, { status: 400 });
  }

  const error = await setPhaseMode(mode as PhaseMode, requester.id);
  if (error) {
    return NextResponse.json(
      { message: "Impossibile salvare (hai eseguito sql/05_app_settings.sql?): " + error },
      { status: 500 }
    );
  }
  return NextResponse.json(await getVotingPhase());
}
