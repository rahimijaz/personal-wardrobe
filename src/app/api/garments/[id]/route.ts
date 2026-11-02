import { NextResponse } from "next/server";
import { getGarmentById, updateGarment, deleteGarment } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const garment = getGarmentById(id);
  if (!garment) {
    return NextResponse.json({ error: "Garment not found" }, { status: 404 });
  }
  return NextResponse.json({ garment });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const updated = updateGarment(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Garment not found" }, { status: 404 });
  }
  return NextResponse.json({ garment: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteGarment(id);
  if (!deleted) {
    return NextResponse.json({ error: "Garment not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
