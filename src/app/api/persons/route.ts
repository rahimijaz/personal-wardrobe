import { NextResponse } from "next/server";
import { getPersons, createPerson, getDefaultPerson } from "@/server/storage";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const persons = getPersons();
  const defaultPerson = getDefaultPerson();
  return NextResponse.json({ persons, defaultPerson });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let name = "Persona";
    let image = "";
    let isDefault = false;

    let calibration = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = (formData.get("name") as string) || "Persona";
      isDefault = formData.get("isDefault") === "true";
      const calRaw = formData.get("calibration");
      if (typeof calRaw === "string") {
        try {
          calibration = JSON.parse(calRaw);
        } catch {}
      }

      const file = formData.get("image");
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = file.name.split(".").pop() || "png";
        const fileName = `person-${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);
        image = `/uploads/${fileName}`;
      } else if (typeof formData.get("image") === "string") {
        image = formData.get("image") as string;
      }
    } else {
      const body = await req.json();
      name = body.name || "Persona";
      image = body.image || "";
      isDefault = Boolean(body.isDefault);
      calibration = body.calibration;
    }

    if (!image) {
      return NextResponse.json({ error: "Person image is required" }, { status: 400 });
    }

    const person = createPerson(name, image, isDefault, calibration);
    return NextResponse.json({ person }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating person profile:", err);
    return NextResponse.json({ error: err.message || "Failed to create person profile" }, { status: 500 });
  }
}
