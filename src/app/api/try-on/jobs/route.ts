import { NextResponse } from "next/server";
import { getVtonJobs } from "@/server/storage";
import { submitTryOnJob } from "@/server/vton-client";
import type { VtonCategory, GarmentPhotoType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = getVtonJobs();
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { personId, garmentId, category, garmentPhotoType, params } = body;

    if (!personId || !garmentId) {
      return NextResponse.json(
        { error: "personId and garmentId are required" },
        { status: 400 }
      );
    }

    const validCategory = (["tops", "bottoms", "one-pieces"].includes(category)
      ? category
      : "tops") as VtonCategory;

    const validPhotoType = (["flat-lay", "model"].includes(garmentPhotoType)
      ? garmentPhotoType
      : "flat-lay") as GarmentPhotoType;

    const job = await submitTryOnJob({
      personId,
      garmentId,
      category: validCategory,
      garmentPhotoType: validPhotoType,
      params,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (err: any) {
    console.error("Error creating try-on job:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create try-on job" },
      { status: 500 }
    );
  }
}
