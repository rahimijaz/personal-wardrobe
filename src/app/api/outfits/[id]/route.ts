import { NextResponse } from "next/server";
import { getOutfitById, deleteOutfit } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const outfit = getOutfitById(id);
  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }
  return NextResponse.json({ outfit });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteOutfit(id);
  if (!ok) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
