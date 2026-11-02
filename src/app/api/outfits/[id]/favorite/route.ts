import { NextResponse } from "next/server";
import { toggleFavoriteOutfit } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const outfit = toggleFavoriteOutfit(id);
  if (!outfit) {
    return NextResponse.json({ error: "Outfit not found" }, { status: 404 });
  }
  return NextResponse.json({ outfit });
}
