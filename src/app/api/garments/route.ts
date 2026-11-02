import { NextResponse } from "next/server";
import { getGarments, createGarment } from "@/server/storage";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { GarmentCategory, GarmentPhotoType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const sort = url.searchParams.get("sort") || undefined;

  const garments = getGarments({ category, q, sort });
  return NextResponse.json({ garments });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let name = "";
    let category: GarmentCategory = "tops";
    let photoType: GarmentPhotoType = "flat-lay";
    let type = "";
    let color = "";
    let colorHex = "#17140e";
    let image = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = (formData.get("name") as string) || "";
      category = (formData.get("category") as GarmentCategory) || "tops";
      photoType = (formData.get("photoType") as GarmentPhotoType) || "flat-lay";
      type = (formData.get("type") as string) || "";
      color = (formData.get("color") as string) || "";
      colorHex = (formData.get("colorHex") as string) || "#17140e";

      const file = formData.get("image");
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `garment-${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);
        image = `/uploads/${fileName}`;
      } else if (typeof formData.get("image") === "string") {
        image = formData.get("image") as string;
      }
    } else {
      const body = await req.json();
      name = body.name || "";
      category = body.category || "tops";
      photoType = body.photoType || "flat-lay";
      type = body.type || "";
      color = body.color || "";
      colorHex = body.colorHex || "#17140e";
      image = body.image || "";
    }

    if (!name.trim()) {
      return NextResponse.json({ error: "Garment name is required" }, { status: 400 });
    }
    if (!image) {
      return NextResponse.json({ error: "Garment image is required" }, { status: 400 });
    }

    const garment = createGarment({
      name,
      category,
      photoType,
      type,
      color,
      colorHex,
      image,
      favorite: false,
    });

    return NextResponse.json({ garment }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating garment:", err);
    return NextResponse.json({ error: err.message || "Failed to create garment" }, { status: 500 });
  }
}
