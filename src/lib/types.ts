export const CATEGORIES = [
  "tops",
  "bottoms",
  "one-pieces",
  "outerwear",
  "dresses",
  "shoes",
  "accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type GarmentCategory = Category;
export type VtonCategory = "tops" | "bottoms" | "one-pieces";

export const VTON_CATEGORIES: VtonCategory[] = ["tops", "bottoms", "one-pieces"];

export const CATEGORY_LABEL: Record<Category, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  "one-pieces": "One-Pieces",
  outerwear: "Layers",
  dresses: "Dresses",
  shoes: "Shoes",
  accessories: "Accessories",
};

export const CATEGORY_SINGLE: Record<Category, string> = {
  tops: "Top",
  bottoms: "Bottom",
  "one-pieces": "One-Piece",
  outerwear: "Layer",
  dresses: "Dress",
  shoes: "Shoes",
  accessories: "Accessory",
};

export type GarmentPhotoType = "flat-lay" | "model";
export type GarmentPattern = "solid" | "striped" | "patterned" | "check" | "graphic" | "multicolor";

export interface Garment {
  id: string;
  name: string;
  image: string;
  category: GarmentCategory;
  type?: string;
  color?: string;
  colorHex?: string;
  secondaryColor?: string;
  secondaryColorHex?: string;
  accentColors?: string[];
  pattern?: GarmentPattern;
  photoType: GarmentPhotoType;
  favorite: boolean;
  createdAt: string;
}

export type BodySilhouette = "slim" | "athletic" | "regular" | "curvy" | "relaxed";
export type PersonaPosture = "standing-frontal" | "standing-quarter" | "seated";
export type PersonaFraming = "full-body" | "three-quarters" | "upper-body";
export type PersonaLighting = "studio-neutral" | "warm-sunlight" | "cool-ambient";

export interface PersonaCalibration {
  heightCm?: number;
  bodySilhouette?: BodySilhouette;
  posture?: PersonaPosture;
  framing?: PersonaFraming;
  lighting?: PersonaLighting;
  zoom?: number;       // scale: 0.8 - 1.5, default 1.0
  yOffset?: number;    // vertical offset %, default 0 (-30% to +30%)
  xOffset?: number;    // horizontal offset %, default 0 (-20% to +20%)
  showGuidelines?: boolean;
  score?: number;      // 0 - 100
  calibratedAt?: string;
  notes?: string;
}

export interface Person {
  id: string;
  name: string;
  image: string;
  isDefault?: boolean;
  createdAt: string;
  calibration?: PersonaCalibration;
}

export interface Outfit {
  id: string;
  name: string;
  personId: string;
  garmentIds: string[];
  resultImage: string;
  favorite: boolean;
  category?: VtonCategory | string;
  createdAt: string;
  person?: Person;
  garments?: Garment[];
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type JobStage =
  | "queued"
  | "preparing_person"
  | "preparing_garment"
  | "generating"
  | "finalizing"
  | "completed";

export interface VtonJob {
  id: string;
  personId: string;
  garmentIds: string[];
  category: VtonCategory;
  garmentPhotoType: GarmentPhotoType;
  status: JobStatus;
  stage: JobStage;
  result: string | null;
  step?: number;
  total_steps?: number;
  detail?: string;
  sec_per_it?: number;
  elapsed_sec?: number;
  eta_sec?: number;
  percent?: number;
  logs?: string[];
  error?: string | null;
  params?: Partial<InferenceParameters>;
  createdAt: string;
  completedAt?: string;
  person?: Person;
  garments?: Garment[];
}

export type VtonResolution = "672x444" | "756x504" | "864x576" | "1008x672";

export interface VtonResolutionOption {
  id: VtonResolution;
  label: string;
  shortLabel: string;
  height: number;
  width: number;
  description: string;
  vramTier: string;
  badge?: string;
  sharpness: string;
}

export const VTON_RESOLUTION_OPTIONS: VtonResolutionOption[] = [
  {
    id: "672x444",
    label: "Standard",
    shortLabel: "672 × 444",
    height: 672,
    width: 444,
    description: "Fastest generation • Low VRAM requirement",
    vramTier: "4 GB",
    sharpness: "Baseline",
  },
  {
    id: "756x504",
    label: "High Quality",
    shortLabel: "756 × 504",
    height: 756,
    width: 504,
    description: "Crisper fabric weave & seams • Recommended default",
    vramTier: "6 GB",
    badge: "Default",
    sharpness: "+28% Detail",
  },
  {
    id: "864x576",
    label: "Ultra Detail",
    shortLabel: "864 × 576",
    height: 864,
    width: 576,
    description: "Deep texture definition & sharp logos • Slower render",
    vramTier: "8 GB",
    badge: "Ultra",
    sharpness: "+66% Detail",
  },
  {
    id: "1008x672",
    label: "Studio Cinema",
    shortLabel: "1008 × 672",
    height: 1008,
    width: 672,
    description: "Maximum density • Requires high-end dedicated VRAM",
    vramTier: "12+ GB",
    badge: "Cinema",
    sharpness: "+125% Detail",
  },
];

export interface InferenceParameters {
  numTimesteps: number;
  skipCfgLastNSteps: number;
  guidanceScale: number;
  seed: number;
  randomSeed: boolean;
  garmentPhotoType: GarmentPhotoType;
  resolution: VtonResolution;
  device: string;
}

export const DEFAULT_INFERENCE_PARAMETERS: InferenceParameters = {
  numTimesteps: 8,
  skipCfgLastNSteps: 5,
  guidanceScale: 2.0,
  seed: 42,
  randomSeed: false,
  garmentPhotoType: "flat-lay",
  resolution: "756x504",
  device: "directml",
};

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  colorName: string;
  colorHex: string;
  palette: string[];
  imagePath: string;
  tags: string[];
  brand: string | null;
  favorite: boolean;
  createdAt: string;
}

export interface FitSlot {
  slot: Category;
  required: boolean;
  item: WardrobeItem | null;
  harmony: number | null;
}

export interface OutfitPick {
  id: string;
  slots: FitSlot[];
  score: number;
  breakdown: { color: number; style: number; balance: number };
  headline: string;
  notes: string[];
}

export interface MatchResponse {
  anchor: WardrobeItem;
  outfits: OutfitPick[];
  missing: Category[];
}

export interface SavedOutfit {
  id: string;
  name: string;
  occasion: string | null;
  anchorId: string | null;
  itemIds: string[];
  score: number;
  headline: string | null;
  tryOnResultId: string | null;
  tryOnImageUrl: string | null;
  createdAt: string;
}

export const OCCASIONS = [
  { id: "everyday", label: "Everyday", tags: ["casual", "minimal"] },
  { id: "office", label: "Office", tags: ["business", "formal", "minimal"] },
  { id: "date", label: "Date night", tags: ["edgy", "minimal", "vintage"] },
  { id: "party", label: "Party", tags: ["streetwear", "edgy", "y2k"] },
  { id: "active", label: "Active", tags: ["sporty", "casual"] },
  { id: "formal", label: "Formal", tags: ["formal", "business"] },
] as const;

export type OccasionId = (typeof OCCASIONS)[number]["id"];

export const STYLE_TAGS = [
  "casual",
  "minimal",
  "streetwear",
  "formal",
  "business",
  "sporty",
  "cozy",
  "vintage",
  "edgy",
  "preppy",
] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

export function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}
