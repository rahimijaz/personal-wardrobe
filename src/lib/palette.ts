// Dominant-colour extraction from raw RGBA pixels. Pure, client-safe.
//
// Strategy: garments sit centre-frame on some background. We find the
// background colour family from the image's border stripe, suppress
// buckets belonging to it, then rank the rest with a centre bias.
// If nearly everything central reads as "background" (e.g. an ecru
// shirt on cream linen), we assume the garment really is that colour
// and skip suppression.
import { rgbToHex, nearestColorName, type RGB } from "./colors";
import type { GarmentPattern } from "./types";

export interface ExtractedPalette {
  dominant: string;
  colorName: string;
  secondary?: string;
  secondaryColorName?: string;
  palette: string[];
  pattern: GarmentPattern;
  compositeColorName: string;
}

interface Bucket {
  w: number; // centre-biased weight
  wc: number; // centre-only weight
  r: number;
  g: number;
  b: number;
}

function rgbDist(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const BG_THRESHOLD = 34;
const MIN_BG_SHARE = 0.08;
const MIN_CENTER_SHARE = 0.15;

export function extractPaletteFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): ExtractedPalette {
  const buckets = new Map<number, Bucket>();
  const borderBuckets = new Map<number, Bucket>();
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const maxD = Math.hypot(cx, cy) || 1;
  const total = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / 9000)));
  const bx = Math.max(2, Math.floor(width * 0.09));
  const by = Math.max(2, Math.floor(height * 0.09));

  // Determine alpha threshold dynamically so cutouts with partial/soft alpha ranges
  // are never completely discarded down to 0 pixels.
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let i = 3; i < data.length; i += 16) {
    const a = data[i];
    if (a < minAlpha) minAlpha = a;
    if (a > maxAlpha) maxAlpha = a;
  }
  const isCutout = (maxAlpha - minAlpha) > 20;
  const alphaThreshold = isCutout ? minAlpha + (maxAlpha - minAlpha) * 0.45 : 128;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha !== undefined && alpha < alphaThreshold) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

      // border stripe → plain count (background detection)
      if (x < bx || x > width - bx || y < by || y > height - by) {
        const bb = borderBuckets.get(key);
        if (bb) {
          bb.w += 1;
          bb.r += r;
          bb.g += g;
          bb.b += b;
        } else {
          borderBuckets.set(key, { w: 1, wc: 0, r, g, b });
        }
      }

      const d = Math.hypot(x - cx, y - cy) / maxD;
      const wgt = 1 + 2.4 * (1 - d);
      const isCenter =
        x >= width * 0.25 && x <= width * 0.75 && y >= height * 0.25 && y <= height * 0.75;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.w += wgt;
        if (isCenter) bucket.wc += wgt;
        bucket.r += r * wgt;
        bucket.g += g * wgt;
        bucket.b += b * wgt;
      } else {
        buckets.set(key, { w: wgt, wc: isCenter ? wgt : 0, r: r * wgt, g: g * wgt, b: b * wgt });
      }
    }
  }

  const withAvg = [...buckets.values()].map((b) => ({
    ...b,
    rgb: { r: b.r / b.w, g: b.g / b.w, b: b.b / b.w } as RGB,
  }));

  if (withAvg.length === 0) {
    return {
      dominant: "#1a1815",
      colorName: "Jet black",
      palette: ["#1a1815"],
      pattern: "solid",
      compositeColorName: "Jet black",
    };
  }

  // background colour = border mode
  const borderTop = [...borderBuckets.values()].sort((a, b) => b.w - a.w)[0];
  const bg: RGB | null = borderTop
    ? { r: borderTop.r / borderTop.w, g: borderTop.g / borderTop.w, b: borderTop.b / borderTop.w }
    : null;

  const totalW = withAvg.reduce((s, b) => s + b.w, 0);
  const totalWc = withAvg.reduce((s, b) => s + b.wc, 0);
  const kept = bg ? withAvg.filter((b) => rgbDist(b.rgb, bg) >= BG_THRESHOLD) : withAvg;
  const keptW = kept.reduce((s, b) => s + b.w, 0);
  const keptWc = kept.reduce((s, b) => s + b.wc, 0);

  const suppress =
    bg &&
    keptW / Math.max(totalW, 1) > MIN_BG_SHARE &&
    totalWc > 0 &&
    keptWc / totalWc > MIN_CENTER_SHARE;

  // Garments live centre-frame: rank by centre-region weight first.
  const source = (suppress && kept.length > 0 ? kept : withAvg).sort(
    (a, b) => b.wc - a.wc || b.w - a.w,
  );

  const picked: Array<{ hex: string; rgb: RGB; weight: number }> = [];
  for (const bucket of source) {
    if (picked.some((p) => rgbDist(p.rgb, bucket.rgb) < 32)) continue;
    picked.push({ hex: rgbToHex(bucket.rgb), rgb: bucket.rgb, weight: bucket.w });
    if (picked.length >= 5) break;
  }

  const dominantHex = picked[0].hex;
  const dominantName = nearestColorName(dominantHex);

  // Analyze potential secondary / accent color
  let secondaryHex: string | undefined = undefined;
  let secondaryName: string | undefined = undefined;
  let pattern: GarmentPattern = "solid";
  let compositeColorName = dominantName;

  if (picked.length >= 2) {
    // Find candidate secondary that has a perceptually distinct name or large contrast
    const secondCandidate = picked.slice(1).find((p) => {
      const name = nearestColorName(p.hex);
      return name !== dominantName && rgbDist(p.rgb, picked[0].rgb) >= 38;
    }) || (rgbDist(picked[1].rgb, picked[0].rgb) >= 45 ? picked[1] : undefined);

    if (secondCandidate) {
      const primaryW = picked[0].weight;
      const secondW = secondCandidate.weight;
      const secondShare = secondW / Math.max(primaryW + secondW, 1);

      // Only consider secondary if it accounts for at least 8% of the core fabric
      if (secondShare >= 0.08) {
        secondaryHex = secondCandidate.hex;
        secondaryName = nearestColorName(secondaryHex);

        // Pattern Frequency Analysis across center scanlines
        let horizTransitions = 0;
        let vertTransitions = 0;
        const c0 = picked[0].rgb;
        const c1 = secondCandidate.rgb;

        const startX = Math.floor(width * 0.28);
        const endX = Math.floor(width * 0.72);
        const startY = Math.floor(height * 0.28);
        const endY = Math.floor(height * 0.72);

        // Horizontal scanlines
        const hSampleLines = [0.35, 0.45, 0.55, 0.65].map((p) => Math.floor(height * p));
        for (const y of hSampleLines) {
          let prevClass = -1;
          for (let x = startX; x < endX; x += 2) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] < alphaThreshold) continue;
            const pxRgb: RGB = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
            const d0 = rgbDist(pxRgb, c0);
            const d1 = rgbDist(pxRgb, c1);
            const currentClass = d0 <= d1 ? 0 : 1;
            if (prevClass !== -1 && prevClass !== currentClass) {
              horizTransitions++;
            }
            prevClass = currentClass;
          }
        }

        // Vertical scanlines
        const vSampleLines = [0.35, 0.45, 0.55, 0.65].map((p) => Math.floor(width * p));
        for (const x of vSampleLines) {
          let prevClass = -1;
          for (let y = startY; y < endY; y += 2) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] < alphaThreshold) continue;
            const pxRgb: RGB = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
            const d0 = rgbDist(pxRgb, c0);
            const d1 = rgbDist(pxRgb, c1);
            const currentClass = d0 <= d1 ? 0 : 1;
            if (prevClass !== -1 && prevClass !== currentClass) {
              vertTransitions++;
            }
            prevClass = currentClass;
          }
        }

        // Classify pattern style based on transitions and color share
        if (horizTransitions >= 8 && horizTransitions >= vertTransitions * 1.5) {
          pattern = "striped"; // vertical stripes
          compositeColorName = `${dominantName} with ${secondaryName} stripes`;
        } else if (vertTransitions >= 8 && vertTransitions >= horizTransitions * 1.5) {
          pattern = "striped"; // horizontal stripes
          compositeColorName = `${dominantName} with ${secondaryName} stripes`;
        } else if (horizTransitions >= 6 && vertTransitions >= 6) {
          pattern = "check";
          compositeColorName = `${dominantName} & ${secondaryName} check`;
        } else if (horizTransitions + vertTransitions >= 12) {
          pattern = "patterned";
          compositeColorName = `${dominantName} with ${secondaryName} pattern`;
        } else if (secondShare >= 0.22) {
          pattern = "multicolor";
          compositeColorName = `${dominantName} & ${secondaryName}`;
        } else {
          pattern = "solid";
          compositeColorName = `${dominantName} with ${secondaryName} accents`;
        }
      }
    }
  }

  return {
    dominant: dominantHex,
    colorName: dominantName,
    secondary: secondaryHex,
    secondaryColorName: secondaryName,
    palette: picked.map((p) => p.hex),
    pattern,
    compositeColorName,
  };
}
