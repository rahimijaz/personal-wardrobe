// Server-only image pipeline: stores uploads and extracts palettes.
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { extractPaletteFromPixels, type ExtractedPalette } from "../lib/palette";
import { detectCategoryFromPixels } from "../lib/garment-utils";
import { nearestColorName } from "../lib/colors";
import type { PersonaCalibration, GarmentCategory, GarmentPattern } from "@/lib/types";

export interface ProcessedUpload {
  publicPath: string;
  dominant: string;
  colorName: string;
  secondary?: string;
  secondaryColorName?: string;
  pattern: GarmentPattern;
  compositeColorName: string;
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
    colorName: extracted.colorName,
    secondary: extracted.secondary,
    secondaryColorName: extracted.secondaryColorName,
    pattern: extracted.pattern,
    compositeColorName: extracted.compositeColorName,
    palette: extracted.palette,
  };
}

export async function paletteFromFile(absPath: string): Promise<ExtractedPalette> {
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
  return extracted;
}

export async function detectCategoryFromFile(absPath: string): Promise<GarmentCategory> {
  try {
    const raw = await sharp(absPath)
      .rotate()
      .resize(96, 96, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return detectCategoryFromPixels(raw.data, raw.info.width, raw.info.height);
  } catch (e) {
    return "tops";
  }
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
 * Samples the background color from image border/corner pixels.
 */
async function sampleBackgroundColor(
  img: ReturnType<typeof sharp>,
  width: number,
  height: number
): Promise<{ r: number; g: number; b: number; alpha: number }> {
  try {
    const raw = await img.clone().raw().toBuffer({ resolveWithObject: true });
    const data = raw.data;
    const channels = raw.info.channels;
    const sample = (x: number, y: number) => {
      const idx = (y * width + x) * channels;
      return [data[idx], data[idx + 1], data[idx + 2]];
    };
    const sampleSize = Math.max(3, Math.min(10, Math.floor(width / 20)));
    const cornerSamples: number[][] = [];
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        cornerSamples.push(sample(dx, dy));
        cornerSamples.push(sample(width - 1 - dx, dy));
        cornerSamples.push(sample(dx, height - 1 - dy));
        cornerSamples.push(sample(width - 1 - dx, height - 1 - dy));
      }
    }
    const rVals = cornerSamples.map((c) => c[0]).sort((a, b) => a - b);
    const gVals = cornerSamples.map((c) => c[1]).sort((a, b) => a - b);
    const bVals = cornerSamples.map((c) => c[2]).sort((a, b) => a - b);
    const mid = Math.floor(rVals.length / 2);
    return { r: rVals[mid], g: gVals[mid], b: bVals[mid], alpha: 1 };
  } catch {
    return { r: 250, g: 250, b: 250, alpha: 1 };
  }
}

/**
 * Automatically detects the person's silhouette and centers/scales them
 * onto a standard 1024x1536 (2:3) portrait canvas with safe 6% head
 * and 8% foot margins so shoes, head, and hair are never cut off by VTON.
 */
export async function autoFramePersonaBuffer(
  inputBuffer: Buffer,
  targetW: number = 1024,
  targetH: number = 1536
): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) return inputBuffer;

  try {
    const img = sharp(inputBuffer).rotate();
    const meta = await img.metadata();
    const W = meta.width;
    const H = meta.height;
    if (!W || !H) return inputBuffer;

    const bg = await sampleBackgroundColor(img, W, H);
    const raw = await img.clone().raw().toBuffer({ resolveWithObject: true });
    const data = raw.data;
    const channels = raw.info.channels;

    let minY = H,
      maxY = 0,
      minX = W,
      maxX = 0,
      count = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * channels;
        const dr = Math.abs(data[idx] - bg.r);
        const dg = Math.abs(data[idx + 1] - bg.g);
        const db = Math.abs(data[idx + 2] - bg.b);
        if (dr + dg + db > 25) {
          count++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    // If no distinct person bounding box is found, fall back to contain resize
    if (count < 100 || maxY <= minY || maxX <= minX) {
      return await sharp(inputBuffer)
        .rotate()
        .resize(targetW, targetH, { fit: "contain", background: bg })
        .png({ quality: 95 })
        .toBuffer();
    }

    const personW = maxX - minX + 1;
    const personH = maxY - minY + 1;

    // Check if the image is already 2:3 and has safe margins (>= 4% top, >= 5% bottom)
    const is23Ratio = Math.abs(W / H - targetW / targetH) < 0.03;
    const topMarginPct = minY / H;
    const bottomMarginPct = (H - 1 - maxY) / H;
    if (is23Ratio && topMarginPct >= 0.04 && bottomMarginPct >= 0.05 && W >= 800 && H >= 1200) {
      return inputBuffer;
    }

    // Person height should occupy ~86% of target frame (leaves 6% head room, 8% shoe room)
    const targetPersonH = Math.round(targetH * 0.86);
    const targetPersonW = Math.round(targetW * 0.82);
    const scale = Math.min(targetPersonH / personH, targetPersonW / personW, 1.0);

    const scaledW = Math.max(1, Math.round(W * scale));
    const scaledH = Math.max(1, Math.round(H * scale));
    const scaledMinX = Math.round(minX * scale);
    const scaledMaxX = Math.round(maxX * scale);
    const scaledMinY = Math.round(minY * scale);

    const targetHeadY = Math.round(targetH * 0.06);
    const pasteY = Math.round(targetHeadY - scaledMinY);
    const personCenterX = (scaledMinX + scaledMaxX) / 2;
    const pasteX = Math.round(targetW / 2 - personCenterX);

    const cropLeft = Math.max(0, -pasteX);
    const cropTop = Math.max(0, -pasteY);
    const canvasLeft = Math.max(0, pasteX);
    const canvasTop = Math.max(0, pasteY);
    const cropWidth = Math.min(scaledW - cropLeft, targetW - canvasLeft);
    const cropHeight = Math.min(scaledH - cropTop, targetH - canvasTop);

    if (cropWidth <= 0 || cropHeight <= 0) {
      return await sharp(inputBuffer)
        .rotate()
        .resize(targetW, targetH, { fit: "contain", background: bg })
        .png({ quality: 95 })
        .toBuffer();
    }

    const cropped = await sharp(inputBuffer)
      .rotate()
      .resize(scaledW, scaledH)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .png()
      .toBuffer();

    return await sharp({
      create: {
        width: targetW,
        height: targetH,
        channels: 4,
        background: bg,
      },
    })
      .composite([{ input: cropped, left: canvasLeft, top: canvasTop }])
      .png({ quality: 95 })
      .toBuffer();
  } catch (err) {
    console.warn("[AutoFrame] Framing error, falling back:", err);
    return inputBuffer;
  }
}

/**
 * Transforms an input person buffer by applying the user's calibrated
 * zoom and X/Y pan offsets to align with the standard 2:3 (1024x1536)
 * target frame without cutting off head, shoes, or hands.
 */
export async function applyCalibrationFraming(
  inputBuffer: Buffer,
  calibration?: PersonaCalibration
): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) {
    return inputBuffer;
  }

  try {
    const TARGET_W = 1024;
    const TARGET_H = 1536;

    const img = sharp(inputBuffer).rotate();
    const meta = await img.metadata();
    const W = meta.width;
    const H = meta.height;
    if (!W || !H) return inputBuffer;

    const zoom = Math.max(0.5, Math.min(2.5, calibration?.zoom ?? 1.0));
    const xOffset = Math.max(-50, Math.min(50, calibration?.xOffset ?? 0));
    const yOffset = Math.max(-50, Math.min(50, calibration?.yOffset ?? 0));

    // If default zoom/offsets and already 1024x1536, keep as is
    if (zoom === 1.0 && xOffset === 0 && yOffset === 0 && W === TARGET_W && H === TARGET_H) {
      return inputBuffer;
    }

    const bg = await sampleBackgroundColor(img, W, H);

    // Fit image inside TARGET_W x TARGET_H with user zoom factor
    const baseScale = Math.min(TARGET_W / W, TARGET_H / H);
    const effectiveScale = baseScale * zoom;
    const scaledW = Math.max(1, Math.round(W * effectiveScale));
    const scaledH = Math.max(1, Math.round(H * effectiveScale));

    const centerX = TARGET_W / 2 + (xOffset / 100) * TARGET_W;
    const centerY = TARGET_H / 2 + (yOffset / 100) * TARGET_H;

    const pasteX = Math.round(centerX - scaledW / 2);
    const pasteY = Math.round(centerY - scaledH / 2);

    const cropLeft = Math.max(0, -pasteX);
    const cropTop = Math.max(0, -pasteY);
    const canvasLeft = Math.max(0, pasteX);
    const canvasTop = Math.max(0, pasteY);
    const cropWidth = Math.min(scaledW - cropLeft, TARGET_W - canvasLeft);
    const cropHeight = Math.min(scaledH - cropTop, TARGET_H - canvasTop);

    if (cropWidth <= 0 || cropHeight <= 0) {
      return await sharp(inputBuffer)
        .rotate()
        .resize(TARGET_W, TARGET_H, { fit: "contain", background: bg })
        .png({ quality: 95 })
        .toBuffer();
    }

    const cropped = await sharp(inputBuffer)
      .rotate()
      .resize(scaledW, scaledH)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .png()
      .toBuffer();

    return await sharp({
      create: {
        width: TARGET_W,
        height: TARGET_H,
        channels: 4,
        background: bg,
      },
    })
      .composite([{ input: cropped, left: canvasLeft, top: canvasTop }])
      .png({ quality: 95 })
      .toBuffer();
  } catch (err) {
    console.warn("[Calibration] Framing transform failed, using original person buffer:", err);
    return inputBuffer;
  }
}

