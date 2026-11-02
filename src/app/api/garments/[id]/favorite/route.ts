import { NextResponse } from "next/server";
import { toggleFavoriteGarment } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const garment = toggleFavoriteGarment(id);
  if (!garment) {
    return NextResponse.json({ error: "Garment not found" }, { status: 404 });
  }
  return NextResponse.json({ garment });
}
