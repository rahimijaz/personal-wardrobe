import type { BodySilhouette } from "./types";

/**
 * Analyzes body proportions from image RGBA pixel data to automatically determine
 * body silhouette: athletic, curvy, slim, relaxed, or regular.
 */
export function detectBodySilhouetteFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): BodySilhouette {
  // Check if image has transparency (cutout)
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < minAlpha) minAlpha = a;
    if (a > maxAlpha) maxAlpha = a;
  }
  const isCutout = maxAlpha - minAlpha > 25;
  const alphaThresh = isCutout ? minAlpha + (maxAlpha - minAlpha) * 0.45 : 128;

  // Background estimate from border pixels
  let bgR = 0,
    bgG = 0,
    bgB = 0,
    borderCount = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, 1, height - 2, height - 1]) {
      const idx = (y * width + x) * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      borderCount++;
    }
  }
  bgR /= borderCount;
  bgG /= borderCount;
  bgB /= borderCount;

  function isFg(x: number, y: number): boolean {
    const idx = (y * width + x) * 4;
    if (isCutout) return data[idx + 3] >= alphaThresh;
    const dr = data[idx] - bgR;
    const dg = data[idx + 1] - bgG;
    const db = data[idx + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) > 22;
  }

  // Find person bounding box
  let minY = height,
    maxY = 0,
    minX = width,
    maxX = 0;
  let totalFg = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFg(x, y)) {
        totalFg++;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  if (totalFg < 80) return "regular";

  const personH = maxY - minY + 1;
  const personW = maxX - minX + 1;

  // Helper to measure horizontal width across a vertical zone of the body
  function getWidthAtFraction(
    startFrac: number,
    endFrac: number,
    mode: "min" | "max" | "avg" = "avg"
  ): number {
    const yStart = minY + Math.floor(personH * startFrac);
    const yEnd = minY + Math.floor(personH * endFrac);
    const widths: number[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      let rMin = width;
      let rMax = -1;
      for (let x = 0; x < width; x++) {
        if (isFg(x, y)) {
          if (x < rMin) rMin = x;
          if (x > rMax) rMax = x;
        }
      }
      if (rMax >= rMin) widths.push(rMax - rMin + 1);
    }
    if (widths.length === 0) return 0;
    if (mode === "min") return Math.min(...widths);
    if (mode === "max") return Math.max(...widths);
    return widths.reduce((a, b) => a + b, 0) / widths.length;
  }

  // Anatomical landmark width estimations
  const shoulderW = getWidthAtFraction(0.18, 0.28, "max");
  const waistW = getWidthAtFraction(0.36, 0.46, "min");
  const hipW = getWidthAtFraction(0.48, 0.58, "max");

  const shoulderToWaist = shoulderW / Math.max(1, waistW);
  const hipToWaist = hipW / Math.max(1, waistW);
  const widthToHeight = personW / Math.max(1, personH);

  // Classification rules based on anthropometric silhouettes
  if (hipToWaist >= 1.25 && shoulderW <= hipW * 1.1) {
    return "curvy";
  }
  if (shoulderToWaist >= 1.32 && shoulderW >= hipW * 1.05) {
    return "athletic";
  }
  if (widthToHeight <= 0.28 || (shoulderToWaist < 1.18 && widthToHeight <= 0.32)) {
    return "slim";
  }
  if (waistW / Math.max(1, shoulderW) >= 0.88 || widthToHeight >= 0.4) {
    return "relaxed";
  }
  return "regular";
}

/**
 * Client-side helper that loads an image URL into an offscreen canvas
 * and determines the body silhouette automatically.
 */
export function detectBodySilhouetteFromImageSrc(imageSrc: string): Promise<BodySilhouette> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve("regular");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 128;
        const h = 256;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("regular");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const silhouette = detectBodySilhouetteFromPixels(imgData.data, w, h);
        resolve(silhouette);
      } catch (e) {
        resolve("regular");
      }
    };
    img.onerror = () => resolve("regular");
    img.src = imageSrc;
  });
}

