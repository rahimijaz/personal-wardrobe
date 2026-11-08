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
    const { personId, garmentId, garmentIds, category, garmentPhotoType, params } = body;

    const ids: string[] = [];
    if (Array.isArray(garmentIds) && garmentIds.length > 0) {
      ids.push(...garmentIds.filter(Boolean));
    } else if (garmentId) {
      ids.push(garmentId);
    }

    if (!personId || ids.length === 0) {
      return NextResponse.json(
        { error: "personId and at least one garment (top or bottom) are required" },
        { status: 400 }
      );
    }

    const validCategory = (category && ["tops", "bottoms", "one-pieces"].includes(category)
      ? category
      : "tops") as VtonCategory;

    const validPhotoType = (garmentPhotoType && ["flat-lay", "model"].includes(garmentPhotoType)
      ? garmentPhotoType
      : "flat-lay") as GarmentPhotoType;

    const job = await submitTryOnJob({
      personId,
      garmentIds: ids,
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
