import { NextResponse } from "next/server";
import { getPersons, createPerson, getDefaultPerson } from "@/server/storage";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { detectBodySilhouetteFromPixels } from "@/lib/persona-utils";
import { autoFramePersonaBuffer } from "@/server/images";

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
        const rawBuffer = Buffer.from(await file.arrayBuffer());
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Auto-frame person into standard 2:3 VTON portrait frame (1024x1536)
        // so head, hair, arms, and shoes are never cut off
        const framedBuffer = await autoFramePersonaBuffer(rawBuffer);

        const fileName = `person-${crypto.randomUUID()}.png`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, framedBuffer);
        image = `/uploads/${fileName}`;

        // Auto-detect silhouette if not provided
        if (!calibration?.bodySilhouette) {
          try {
            const raw = await sharp(filePath)
              .resize(128, 256, { fit: "fill" })
              .ensureAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });
            const sil = detectBodySilhouetteFromPixels(raw.data, raw.info.width, raw.info.height);
            calibration = { ...(calibration || {}), bodySilhouette: sil };
          } catch (e) {
            console.warn("Server-side body silhouette detection fallback:", e);
          }
        }
      } else if (typeof formData.get("image") === "string") {
        image = formData.get("image") as string;
      }
    } else {
      const body = await req.json();
      name = body.name || "Persona";
      image = body.image || "";
      isDefault = Boolean(body.isDefault);
      calibration = body.calibration;

      // If image is a base64 or public path, save & detect
      if (image.startsWith("data:")) {
        try {
          const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches) {
            const rawBuffer = Buffer.from(matches[2], "base64");
            const uploadsDir = path.join(process.cwd(), "public", "uploads");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Auto-frame person into standard 2:3 VTON portrait frame (1024x1536)
            const framedBuffer = await autoFramePersonaBuffer(rawBuffer);

            const fileName = `person-${crypto.randomUUID()}.png`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, framedBuffer);
            image = `/uploads/${fileName}`;

            if (!calibration?.bodySilhouette) {
              const raw = await sharp(filePath)
                .resize(128, 256, { fit: "fill" })
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              const sil = detectBodySilhouetteFromPixels(raw.data, raw.info.width, raw.info.height);
              calibration = { ...(calibration || {}), bodySilhouette: sil };
            }
          }
        } catch (e) {
          console.warn("Could not save data URI person image:", e);
        }
      }
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
