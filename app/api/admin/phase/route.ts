import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getVotingPhase, isValidOpensAt, updatePhase, type PhaseMode } from "@/lib/phase";
import { forbidden, readJsonObject } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET: fase corrente — admin o staff.
// POST { mode?, opensAt? (null = da definire), closesAt? (null = nessuna fine) }: cambia modalità e/o date — solo admin.
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
  const opensAt = body?.opensAt;
  const closesAt = body?.closesAt; // null = nessuna fine
  if (mode === undefined && opensAt === undefined && closesAt === undefined) {
    return NextResponse.json({ message: "Niente da cambiare" }, { status: 400 });
  }
  if (mode !== undefined && mode !== "auto" && mode !== "preview" && mode !== "open") {
    return NextResponse.json({ message: "Modalità non valida" }, { status: 400 });
  }
  if (opensAt !== undefined && opensAt !== null && !isValidOpensAt(opensAt)) {
    return NextResponse.json({ message: "Data di apertura non valida (deve essere nel 2026-2027)" }, { status: 400 });
  }
  if (closesAt !== undefined && closesAt !== null && !isValidOpensAt(closesAt)) {
    return NextResponse.json({ message: "Data di fine non valida (deve essere nel 2026-2027)" }, { status: 400 });
  }

  const error = await updatePhase(
    { mode: mode as PhaseMode | undefined, opensAt: opensAt as string | null | undefined, closesAt: closesAt as string | null | undefined },
    requester.id
  );
  if (error) {
    return NextResponse.json(
      { message: "Impossibile salvare (hai eseguito sql/05_app_settings.sql?): " + error },
      { status: 500 }
    );
  }
  return NextResponse.json(await getVotingPhase());
}
