import { NextResponse } from "next/server";
import { getOutfits, createOutfit } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const outfits = getOutfits();
  return NextResponse.json({ outfits });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, personId, garmentIds, resultImage, category, favorite } = body;

    if (!personId || !garmentIds || !resultImage) {
      return NextResponse.json(
        { error: "personId, garmentIds, and resultImage are required" },
        { status: 400 }
      );
    }

    const outfit = createOutfit({
      name,
      personId,
      garmentIds: Array.isArray(garmentIds) ? garmentIds : [garmentIds],
      resultImage,
      category,
      favorite,
    });

    return NextResponse.json({ outfit }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating outfit:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save outfit" },
      { status: 500 }
    );
  }
}
