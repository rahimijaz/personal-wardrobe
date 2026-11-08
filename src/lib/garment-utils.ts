import type { GarmentCategory, GarmentPhotoType } from "@/lib/types";

export interface InferredGarmentMeta {
  name: string;
  category: GarmentCategory;
  photoType: GarmentPhotoType;
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
  } else if (
    lower.includes("dress") ||
    lower.includes("gown") ||
    lower.includes("frock") ||
    lower.includes("sundress")
  ) {
    category = "dresses";
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

  return { name, category, photoType };
}

