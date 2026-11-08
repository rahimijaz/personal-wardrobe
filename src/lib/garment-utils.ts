import type { GarmentCategory, GarmentPhotoType } from "@/lib/types";

export interface InferredGarmentMeta {
  name: string;
  category: GarmentCategory;
  photoType: GarmentPhotoType;
  hasExplicitCategory: boolean;
}

/**
 * Derives a clean human-friendly name, garment category, and photo type
 * from an uploaded file's name using keyword heuristics.
 */
export function inferGarmentMetaFromFilename(filename: string): InferredGarmentMeta {
  // Remove file extension
  const withoutExt = filename.replace(/\.[a-zA-Z0-9]+$/i, "");

  // Clean separators and normalize whitespace
  const cleaned = withoutExt
    .replace(/[-_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Convert to Title Case
  const name = cleaned
    ? cleaned
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
    : "Wardrobe Piece";

  const lower = cleaned.toLowerCase();

  // Infer Category
  let category: GarmentCategory = "tops"; // sensible default
  let hasExplicitCategory = false;

  if (
    lower.includes("jean") ||
    lower.includes("pant") ||
    lower.includes("trouser") ||
    lower.includes("short") ||
    lower.includes("skirt") ||
    lower.includes("jogger") ||
    lower.includes("sweatpant") ||
    lower.includes("cargo") ||
    lower.includes("chino") ||
    lower.includes("legging") ||
    lower.includes("slack")
  ) {
    category = "bottoms";
    hasExplicitCategory = true;
  } else if (
    lower.includes("jacket") ||
    lower.includes("coat") ||
    lower.includes("blazer") ||
    lower.includes("parka") ||
    lower.includes("trench") ||
    lower.includes("cardigan") ||
    lower.includes("hoodie") ||
    lower.includes("sweater") ||
    lower.includes("fleece") ||
    lower.includes("vest") ||
    lower.includes("windbreaker") ||
    lower.includes("bomber") ||
    lower.includes("puffer") ||
    lower.includes("anorak") ||
    lower.includes("outerwear")
  ) {
    category = "outerwear";
    hasExplicitCategory = true;
  } else if (
    lower.includes("dress") ||
    lower.includes("gown") ||
    lower.includes("frock") ||
    lower.includes("sundress")
  ) {
    category = "dresses";
    hasExplicitCategory = true;
  } else if (
    lower.includes("jumpsuit") ||
    lower.includes("romper") ||
    lower.includes("overall") ||
    lower.includes("bodysuit") ||
    lower.includes("dungaree") ||
    lower.includes("one piece") ||
    lower.includes("onepiece")
  ) {
    category = "one-pieces";
    hasExplicitCategory = true;
  } else if (
    lower.includes("shoe") ||
    lower.includes("boot") ||
    lower.includes("sneaker") ||
    lower.includes("loafer") ||
    lower.includes("heel") ||
    lower.includes("sandal") ||
    lower.includes("slide") ||
    lower.includes("kick") ||
    lower.includes("trainer") ||
    lower.includes("chelsea") ||
    lower.includes("oxford") ||
    lower.includes("pump")
  ) {
    category = "shoes";
    hasExplicitCategory = true;
  } else if (
    lower.includes("hat") ||
    lower.includes("cap") ||
    lower.includes("beanie") ||
    lower.includes("scarf") ||
    lower.includes("belt") ||
    lower.includes("bag") ||
    lower.includes("sunglass") ||
    lower.includes("shade") ||
    lower.includes("tie") ||
    lower.includes("watch") ||
    lower.includes("jewelry") ||
    lower.includes("glove") ||
    lower.includes("necklace") ||
    lower.includes("purse") ||
    lower.includes("tote") ||
    lower.includes("backpack")
  ) {
    category = "accessories";
    hasExplicitCategory = true;
  } else if (
    lower.includes("shirt") ||
    lower.includes("tee") ||
    lower.includes("tshirt") ||
    lower.includes("top") ||
    lower.includes("blouse") ||
    lower.includes("polo") ||
    lower.includes("tank") ||
    lower.includes("crop") ||
    lower.includes("henley") ||
    lower.includes("flannel") ||
    lower.includes("jersey") ||
    lower.includes("crewneck") ||
    lower.includes("turtleneck")
  ) {
    category = "tops";
    hasExplicitCategory = true;
  }

  // Infer Photo Type
  let photoType: GarmentPhotoType = "flat-lay";
  if (
    lower.includes("model") ||
    lower.includes("worn") ||
    lower.includes("on model") ||
    lower.includes("person") ||
    lower.includes("mannequin")
  ) {
    photoType = "model";
  }

  return { name, category, photoType, hasExplicitCategory };
}

/**
 * Fast, pure silhouette classifier that examines garment bounding box,
 * aspect ratio, and leg-split void patterns to accurately identify
 * bottoms (trousers, jeans, pants, shorts) vs tops (tees, shirts, sweaters, jackets).
 */
export function detectCategoryFromPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): GarmentCategory {
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a < minAlpha) minAlpha = a;
    if (a > maxAlpha) maxAlpha = a;
  }

  const isCutout = maxAlpha - minAlpha > 20;
  const alphaThresh = isCutout ? minAlpha + (maxAlpha - minAlpha) * 0.45 : 128;

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
    if (isCutout) {
      return data[idx + 3] >= alphaThresh;
    }
    const dr = data[idx] - bgR;
    const dg = data[idx + 1] - bgG;
    const db = data[idx + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) > 28;
  }

  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  let totalFg = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isFg(x, y)) {
        totalFg++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (totalFg < 30) return "tops";

  const bbW = maxX - minX + 1;
  const bbH = maxY - minY + 1;
  const aspectRatio = bbH / Math.max(1, bbW);

  if (aspectRatio <= 0.6) return "shoes";

  const topYEnd = minY + Math.floor(bbH * 0.33);
  const midYEnd = minY + Math.floor(bbH * 0.62);

  let topWidthSum = 0,
    topSlices = 0;
  let bottomWidthSum = 0,
    bottomSlices = 0;
  let bottomCenterEmptyRows = 0;
  let bottomRows = 0;

  for (let y = minY; y <= maxY; y++) {
    let rowMinX = width,
      rowMaxX = -1;
    let rowFg = 0;
    for (let x = minX; x <= maxX; x++) {
      if (isFg(x, y)) {
        rowFg++;
        if (x < rowMinX) rowMinX = x;
        if (x > rowMaxX) rowMaxX = x;
      }
    }
    const rowSpan = rowMaxX >= rowMinX ? rowMaxX - rowMinX + 1 : 0;
    if (y < topYEnd) {
      topWidthSum += rowSpan;
      topSlices++;
    } else if (y >= midYEnd) {
      bottomWidthSum += rowSpan;
      bottomSlices++;
      bottomRows++;

      const midX = Math.floor((minX + maxX) / 2);
      const halfSpread = Math.max(2, Math.floor(bbW * 0.08));
      let centerFg = 0;
      for (let cx = midX - halfSpread; cx <= midX + halfSpread; cx++) {
        if (isFg(cx, y)) centerFg++;
      }
      if (centerFg <= 1 && rowFg > 6) {
        bottomCenterEmptyRows++;
      }
    }
  }

  const avgTopWidth = topSlices ? topWidthSum / topSlices : 0;
  const avgBottomWidth = bottomSlices ? bottomWidthSum / bottomSlices : 0;
  const topToBottomRatio = avgTopWidth / Math.max(1, avgBottomWidth);
  const legSplitRatio = bottomRows ? bottomCenterEmptyRows / bottomRows : 0;

  // Bottoms: clear leg split OR tall silhouette not flared at shoulders
  if (legSplitRatio > 0.18 || (aspectRatio >= 1.3 && topToBottomRatio < 1.15)) {
    return "bottoms";
  }

  // Dresses: very elongated without leg split
  if (aspectRatio >= 1.7 && legSplitRatio <= 0.08) {
    return "one-pieces";
  }

  // Tops: standard upper garment
  return "tops";
}

/**
 * Client-safe image category detection using an off-screen HTML canvas.
 */
export function detectCategoryFromImageSrc(imageSrc: string): Promise<GarmentCategory> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") {
      resolve("tops");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 96;
        const h = 96;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("tops");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const cat = detectCategoryFromPixels(imgData.data, w, h);
        resolve(cat);
      } catch (e) {
        resolve("tops");
      }
    };
    img.onerror = () => resolve("tops");
    img.src = imageSrc;
  });
}

