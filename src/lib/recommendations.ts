import type { Garment } from "./types";
import {
  harmonyScore,
  relationName,
  hslOfHex,
  isNeutralHex,
  nearestColorName,
} from "./colors";

export type OutfitVibe =
  | "all"
  | "casual"
  | "streetwear"
  | "smart-casual"
  | "minimal"
  | "high-contrast"
  | "monochrome";

export interface RecommendedFit {
  id: string;
  top: Garment;
  bottom: Garment;
  score: number; // 0 - 100
  harmonyScore: number;
  contrastScore: number;
  styleScore: number;
  relation: string; // e.g. "High Contrast", "Tonal Harmony", "Neutral Anchor"
  vibe: OutfitVibe[];
  stylistNote: string;
  palette: string[]; // [topHex, bottomHex]
}

/**
 * Normalizes hex string, providing a fallback if undefined or invalid
 */
export function safeHex(colorHex?: string, name?: string): string {
  if (colorHex && /^#[0-9a-fA-F]{6}$/i.test(colorHex)) {
    return colorHex;
  }
  if (colorHex && /^#[0-9a-fA-F]{3}$/i.test(colorHex)) {
    const r = colorHex[1];
    const g = colorHex[2];
    const b = colorHex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const lower = (name || "").toLowerCase();
  if (lower.includes("white") || lower.includes("ivory") || lower.includes("cream")) return "#fafaf8";
  if (lower.includes("black") || lower.includes("onyx") || lower.includes("dark")) return "#17140e";
  if (lower.includes("denim") || lower.includes("blue")) return "#4a6d8c";
  if (lower.includes("grey") || lower.includes("gray") || lower.includes("charcoal")) return "#55524c";
  if (lower.includes("beige") || lower.includes("khaki") || lower.includes("tan")) return "#c7b299";
  if (lower.includes("green") || lower.includes("olive")) return "#5c6b4b";
  if (lower.includes("brown") || lower.includes("camel")) return "#8c5e39";

  return "#2d2926";
}

/**
 * Accurately detects and classifies aesthetic vibes for a top + bottom pair.
 * Uses garment names, garment types, colors, and contrast metrics.
 */
export function inferVibes(top: Garment, bottom: Garment): OutfitVibe[] {
  const vibes: Set<OutfitVibe> = new Set(["all"]);

  const topText = `${top.name} ${top.type || ""}`.toLowerCase();
  const bottomText = `${bottom.name} ${bottom.type || ""}`.toLowerCase();
  const combined = `${topText} ${bottomText}`;

  const topHex = safeHex(top.colorHex, top.name);
  const bottomHex = safeHex(bottom.colorHex, bottom.name);
  const hslA = hslOfHex(topHex);
  const hslB = hslOfHex(bottomHex);
  const lightnessDiff = Math.abs(hslA.l - hslB.l);

  // 1. High Contrast Check: Distinct difference in lightness (e.g. Ivory top + Onyx bottoms)
  if (lightnessDiff >= 0.38) {
    vibes.add("high-contrast");
  }

  // 2. Monochrome / Tonal Check: Both dark/black, both light/cream, or very close hue and low lightness diff
  const hueDiff = Math.abs(hslA.h - hslB.h) % 360;
  const isCloseHue = Math.min(hueDiff, 360 - hueDiff) < 30;
  const bothNeutrals = isNeutralHex(topHex) && isNeutralHex(bottomHex);

  if (
    (bothNeutrals && lightnessDiff < 0.28) ||
    (isCloseHue && hslA.s > 0.12 && hslB.s > 0.12 && lightnessDiff < 0.28) ||
    (hslA.l < 0.25 && hslB.l < 0.25) || // all-dark/black fit
    (hslA.l > 0.78 && hslB.l > 0.78)    // all-light/white fit
  ) {
    vibes.add("monochrome");
  }

  // 3. Streetwear Detection:
  // Requires relaxed/oversized tops (hoodie, sweatshirt, boxy tee) OR utility/baggy bottoms (cargos, wide leg denim, baggy pants)
  // Must NOT be paired with formal/tailored button-down linen shirts
  const hasStreetBottom =
    bottomText.includes("cargo") ||
    bottomText.includes("baggy") ||
    bottomText.includes("wide leg") ||
    bottomText.includes("technical") ||
    bottomText.includes("paratrooper");

  const hasStreetTop =
    topText.includes("hoodie") ||
    topText.includes("sweatshirt") ||
    topText.includes("crewneck") ||
    topText.includes("oversized") ||
    topText.includes("boxy");

  const isFormalTop = topText.includes("linen") || topText.includes("button-down") || topText.includes("dress shirt");

  if ((hasStreetBottom || hasStreetTop) && !isFormalTop) {
    vibes.add("streetwear");
  }

  // 4. Smart Casual Detection:
  // Requires refined tops (linen shirt, button-down, knit polo, overshirt) OR tailored bottoms (trousers, chinos, clean dark denim)
  // Excludes utility combat cargos + hoodies
  const hasSmartTop =
    topText.includes("linen") ||
    topText.includes("button-down") ||
    topText.includes("shirt") ||
    topText.includes("overshirt") ||
    topText.includes("polo") ||
    topText.includes("tailored");

  const hasSmartBottom =
    bottomText.includes("trouser") ||
    bottomText.includes("chino") ||
    bottomText.includes("tailored") ||
    bottomText.includes("pleat") ||
    bottomText.includes("denim");

  const isRuggedCargo = bottomText.includes("cargo") || bottomText.includes("technical");

  if ((hasSmartTop || hasSmartBottom) && !isRuggedCargo) {
    vibes.add("smart-casual");
  }

  // 5. Minimalist Detection:
  // Clean, uncluttered silhouettes (crewnecks, clean tees, straight denim, matte black trousers)
  const isMinimalTop = topText.includes("crewneck") || topText.includes("tee") || topText.includes("minimal") || topText.includes("clean");
  const isMinimalBottom = !bottomText.includes("cargo") && !bottomText.includes("distressed");

  if ((isMinimalTop && isMinimalBottom) || bothNeutrals) {
    vibes.add("minimal");
  }

  // 6. Casual: Everyday effortless outfits (denim + crewneck/tee, overshirt + jeans)
  if (bottomText.includes("denim") || bottomText.includes("jean") || topText.includes("crewneck") || vibes.size <= 2) {
    vibes.add("casual");
  }

  return Array.from(vibes);
}

/**
 * Generates an editorial stylist note explaining why the top & bottom work well together
 */
function createStylistNote(
  top: Garment,
  bottom: Garment,
  score: number,
  rel: string,
  contrast: number,
  vibes: OutfitVibe[]
): string {
  const topColor = top.color || nearestColorName(safeHex(top.colorHex, top.name));
  const bottomColor = bottom.color || nearestColorName(safeHex(bottom.colorHex, bottom.name));

  if (vibes.includes("streetwear")) {
    return `Contemporary street silhouette: ${top.name} pairs with ${bottom.name} for an effortless, modern street-ready aesthetic.`;
  }
  if (vibes.includes("smart-casual")) {
    return `Smart-casual elevation: The tailored lines of ${top.name} blend seamlessly with ${bottom.name} for an elevated everyday look.`;
  }
  if (contrast > 0.45) {
    return `High-contrast balance: Light ${topColor.toLowerCase()} top is grounded by dark ${bottomColor.toLowerCase()} bottoms for a crisp, defined silhouette.`;
  }
  if (vibes.includes("monochrome")) {
    return `Tonal monochrome cohesion: Matching ${topColor.toLowerCase()} shades elongate the frame with minimalist sophistication.`;
  }
  if (rel === "Neutral ground" || rel === "Anchored neutral") {
    return `Effortless neutral pairing: ${topColor} and ${bottomColor} create an understated, versatile wardrobe foundation.`;
  }

  return `Balanced pairing: ${top.name} and ${bottom.name} create a harmonious everyday outfit.`;
}

/**
 * Scores a candidate pair of Top + Bottom
 */
export function scorePair(top: Garment, bottom: Garment, targetVibe: OutfitVibe = "all"): RecommendedFit {
  const topHex = safeHex(top.colorHex, top.name);
  const bottomHex = safeHex(bottom.colorHex, bottom.name);

  const rawHarmony = harmonyScore(topHex, bottomHex);
  const hslA = hslOfHex(topHex);
  const hslB = hslOfHex(bottomHex);
  const lightnessDiff = Math.abs(hslA.l - hslB.l);

  // Contrast score
  const contrastScore = Math.round(Math.min(100, Math.max(30, 45 + lightnessDiff * 55)));

  // Style score based on vibe / tag compatibility
  let styleScore = 70;
  const vibes = inferVibes(top, bottom);

  // Vibe affinity boosts
  if (targetVibe === "high-contrast") {
    styleScore = Math.round(lightnessDiff * 100);
  } else if (targetVibe === "monochrome") {
    styleScore = Math.round(Math.max(50, 100 - lightnessDiff * 80));
  } else if (targetVibe === "streetwear" && vibes.includes("streetwear")) {
    styleScore = 92;
  } else if (targetVibe === "smart-casual" && vibes.includes("smart-casual")) {
    styleScore = 94;
  } else if (targetVibe === "minimal" && vibes.includes("minimal")) {
    styleScore = 90;
  }

  if (top.favorite || bottom.favorite) styleScore = Math.min(100, styleScore + 5);

  // Composite score calculation tailored to active vibe
  let finalScore: number;
  if (targetVibe === "high-contrast") {
    finalScore = Math.round(contrastScore * 0.7 + rawHarmony * 0.3);
  } else if (targetVibe === "monochrome") {
    finalScore = Math.round((100 - lightnessDiff * 70) * 0.6 + rawHarmony * 0.4);
  } else {
    finalScore = Math.round(rawHarmony * 0.5 + contrastScore * 0.25 + styleScore * 0.25);
  }

  finalScore = Math.min(99, Math.max(60, finalScore));

  const rel = relationName(topHex, bottomHex);
  const stylistNote = createStylistNote(top, bottom, finalScore, rel, lightnessDiff, vibes);

  return {
    id: `rec-${top.id.slice(0, 8)}-${bottom.id.slice(0, 8)}`,
    top,
    bottom,
    score: finalScore,
    harmonyScore: rawHarmony,
    contrastScore,
    styleScore: Math.min(100, styleScore),
    relation: rel,
    vibe: vibes,
    stylistNote,
    palette: [topHex, bottomHex],
  };
}

/**
 * Returns all ranked outfit combinations from a given wardrobe,
 * strictly filtered AND sorted by the requested vibe.
 */
export function getRecommendedFits(
  garments: Garment[],
  vibe: OutfitVibe = "all",
  sortBy: "score" | "contrast" | "harmony" = "score"
): RecommendedFit[] {
  const tops = garments.filter((g) => g.category === "tops");
  const bottoms = garments.filter((g) => g.category === "bottoms");

  if (tops.length === 0 || bottoms.length === 0) {
    return [];
  }

  const allPairs: RecommendedFit[] = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      allPairs.push(scorePair(top, bottom, vibe));
    }
  }

  // Filter pairs that match the selected vibe
  let filtered = vibe === "all" ? allPairs : allPairs.filter((fit) => fit.vibe.includes(vibe));

  // If a strict filter has 0 matches in small wardrobes, fallback to all pairs re-scored
  if (filtered.length === 0) {
    filtered = allPairs;
  }

  // Sort according to requested sort criterion or active vibe
  filtered.sort((a, b) => {
    if (sortBy === "contrast" || vibe === "high-contrast") {
      return b.contrastScore - a.contrastScore;
    }
    if (sortBy === "harmony" || vibe === "monochrome") {
      return b.harmonyScore - a.harmonyScore;
    }
    return b.score - a.score;
  });

  return filtered;
}

/**
 * Given a single anchor garment, finds and ranks all matching opposite pieces,
 * optionally filtered and sorted by vibe.
 */
export function getMatchesForGarment(
  anchor: Garment,
  garments: Garment[],
  vibe: OutfitVibe = "all",
  limit = 12
): RecommendedFit[] {
  if (anchor.category !== "tops" && anchor.category !== "bottoms") {
    return [];
  }

  const targetCategory = anchor.category === "tops" ? "bottoms" : "tops";
  const candidates = garments.filter((g) => g.category === targetCategory);

  const scored: RecommendedFit[] = candidates.map((cand) => {
    const top = anchor.category === "tops" ? anchor : cand;
    const bottom = anchor.category === "bottoms" ? anchor : cand;
    return scorePair(top, bottom, vibe);
  });

  // Filter by vibe if requested
  let filtered = vibe === "all" ? scored : scored.filter((fit) => fit.vibe.includes(vibe));
  if (filtered.length === 0) {
    filtered = scored; // fallback to best available
  }

  // Sort descending by score
  filtered.sort((a, b) => {
    if (vibe === "high-contrast") return b.contrastScore - a.contrastScore;
    if (vibe === "monochrome") return b.harmonyScore - a.harmonyScore;
    return b.score - a.score;
  });

  return filtered.slice(0, limit);
}
