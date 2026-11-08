import { NextResponse } from "next/server";
import {
  getPersonById,
  updatePerson,
  setDefaultPerson,
  deletePerson,
} from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const person = getPersonById(id);
  if (!person) {
    return NextResponse.json({ error: "Person profile not found" }, { status: 404 });
  }
  return NextResponse.json({ person });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.isDefault) {
    setDefaultPerson(id);
  }

  const { isDefault, ...otherUpdates } = body;
  let updated = getPersonById(id);
  if (Object.keys(otherUpdates).length > 0) {
    updated = updatePerson(id, otherUpdates);
  }

  if (!updated) {
    return NextResponse.json({ error: "Person profile not found" }, { status: 404 });
  }
  return NextResponse.json({ person: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deletePerson(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Cannot delete the only remaining person profile" },
      { status: 400 }
    );
  }
  return NextResponse.json({ success: true });
}
