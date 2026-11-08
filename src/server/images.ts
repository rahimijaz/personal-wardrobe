// Server-only image pipeline: stores uploads and extracts palettes.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { extractPaletteFromPixels } from "../lib/palette";
import { nearestColorName } from "../lib/colors";
import type { PersonaCalibration } from "@/lib/types";

export interface ProcessedUpload {
  publicPath: string;
  dominant: string;
  colorName: string;
  palette: string[];
}

export async function processUpload(
  buffer: Buffer,
  id: string,
): Promise<ProcessedUpload> {
  const destDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(destDir, { recursive: true });
  const fileName = `${id}.webp`;
  const outPath = path.join(destDir, fileName);

  const base = sharp(buffer).rotate();

  const raw = await base
    .clone()
    .resize(96, 96, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const extracted = extractPaletteFromPixels(
    raw.data,
    raw.info.width,
    raw.info.height,
  );

  await base
    .clone()
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(outPath);

  return {
    publicPath: `/uploads/${fileName}`,
    dominant: extracted.dominant,
    colorName: nearestColorName(extracted.dominant),
    palette: extracted.palette,
  };
}

export async function paletteFromFile(absPath: string): Promise<{
  dominant: string;
  colorName: string;
  palette: string[];
}> {
  const raw = await sharp(absPath)
    .rotate()
    .resize(96, 96, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const extracted = extractPaletteFromPixels(
    raw.data,
    raw.info.width,
    raw.info.height,
  );
  return {
    dominant: extracted.dominant,
    colorName: nearestColorName(extracted.dominant),
    palette: extracted.palette,
  };
}

export async function removeUpload(publicPath: string): Promise<void> {
  if (!publicPath.startsWith("/uploads/")) return;
  try {
    await fs.unlink(path.join(process.cwd(), "public", publicPath));
  } catch {
    // already gone
  }
}

/**
 * Transforms an input person buffer by applying the user's calibrated
 * zoom and X/Y pan offsets to align with the DensePose 3:4 target frame.
 */
export async function applyCalibrationFraming(
  inputBuffer: Buffer,
  calibration?: PersonaCalibration
): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) {
    return inputBuffer;
  }

  try {
    const img = sharp(inputBuffer).rotate();
    const meta = await img.metadata();
    const W = meta.width;
    const H = meta.height;
    if (!W || !H) return inputBuffer;

    const A = 3 / 4; // Target portrait aspect ratio (0.75)

    // Base 3:4 cover dimensions on the original photo
    let Vw: number, Vh: number;
    if (W / H > A) {
      Vh = H;
      Vw = H * A;
    } else {
      Vw = W;
      Vh = W / A;
    }

    const zoom = Math.max(0.5, Math.min(2.5, calibration?.zoom ?? 1.0));
    const xOffset = Math.max(-50, Math.min(50, calibration?.xOffset ?? 0));
    const yOffset = Math.max(-50, Math.min(50, calibration?.yOffset ?? 0));

    // Visible window scaled by 1/zoom
    const cropW = Vw / zoom;
    const cropH = Vh / zoom;

    // Inverse shift: moving the image right (+x) brings the left side into the frame
    const shiftX = -(xOffset / 100) * Vw;
    const shiftY = -(yOffset / 100) * Vh;

    const centerX = W / 2 + shiftX;
    const centerY = H / 2 + shiftY;

    let width = Math.round(cropW);
    let height = Math.round(cropH);

    // If zoomed out beyond image bounds, clamp dimensions
    if (width > W) {
      width = W;
      height = Math.round(W / A);
    }
    if (height > H) {
      height = H;
      width = Math.round(H * A);
    }

    const left = Math.max(0, Math.min(W - width, Math.round(centerX - width / 2)));
    const top = Math.max(0, Math.min(H - height, Math.round(centerY - height / 2)));

    return await sharp(inputBuffer)
      .rotate()
      .extract({ left, top, width, height })
      .resize(768, 1024, { fit: "fill" })
      .png({ quality: 95 })
      .toBuffer();
  } catch (err) {
    console.warn("[Calibration] Framing transform failed, using original person buffer:", err);
    return inputBuffer;
  }
}

