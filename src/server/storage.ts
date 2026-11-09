import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  Garment,
  Person,
  PersonaCalibration,
  Outfit,
  VtonJob,
  GarmentCategory,
  VtonCategory,
} from "@/lib/types";

interface WardrobeData {
  persons: Person[];
  garments: Garment[];
  outfits: Outfit[];
  jobs: VtonJob[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "wardrobe.json");

const DEFAULT_ELENA_CALIBRATION: PersonaCalibration = {
  heightCm: 175,
  bodySilhouette: "athletic",
  posture: "standing-frontal",
  framing: "full-body",
  lighting: "studio-neutral",
  zoom: 1.0,
  yOffset: 0,
  xOffset: 0,
  score: 98,
  calibratedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  notes: "Studio lighting, optimal DensePose alignment",
};

const DEFAULT_SOFIA_CALIBRATION: PersonaCalibration = {
  heightCm: 172,
  bodySilhouette: "regular",
  posture: "standing-quarter",
  framing: "three-quarters",
  lighting: "studio-neutral",
  zoom: 1.0,
  yOffset: 0,
  xOffset: 0,
  score: 95,
  calibratedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  notes: "Natural studio light, 3/4 turn pose",
};

const INITIAL_DATA: WardrobeData = {
  persons: [
    {
      id: "person-elena",
      name: "Elena (Studio Model)",
      image: "/samples/model.png",
      isDefault: true,
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      calibration: DEFAULT_ELENA_CALIBRATION,
    },
    {
      id: "person-sofia",
      name: "Sofia (Studio Model)",
      image: "/samples/model3.png",
      isDefault: false,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      calibration: DEFAULT_SOFIA_CALIBRATION,
    },
  ],
  garments: [
    {
      id: "garment-crewneck",
      name: "Ivory Relaxed Crewneck",
      image: "/samples/garment.webp",
      category: "tops",
      type: "Sweatshirt",
      color: "Ivory",
      colorHex: "#ECE8DD",
      photoType: "flat-lay",
      favorite: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: "garment-jeans",
      name: "Vintage Washed Denim Jeans",
      image: "/samples/baggy-jeans.jpg",
      category: "bottoms",
      type: "Wide Leg",
      color: "Faded Denim",
      colorHex: "#5E7287",
      photoType: "flat-lay",
      favorite: true,
      createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: "garment-cargo",
      name: "Onyx Technical Cargo Trousers",
      image: "/samples/black-cargo-pants.png",
      category: "bottoms",
      type: "Cargo Trousers",
      color: "Matte Black",
      colorHex: "#1C1C1E",
      photoType: "flat-lay",
      favorite: false,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "garment-shirt",
      name: "Crisp Linen Button-Down",
      image: "/samples/shirt.png",
      category: "tops",
      type: "Overshirt",
      color: "Warm White",
      colorHex: "#F7F6F2",
      photoType: "flat-lay",
      favorite: false,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "garment-dress",
      name: "Structured Silk Slip Dress",
      image: "/samples/silk-slip-dress.jpg",
      category: "one-pieces",
      type: "Slip Dress",
      color: "Midnight Noir",
      colorHex: "#121214",
      photoType: "flat-lay",
      favorite: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "garment-boots",
      name: "Monochrome Leather Chelsea Boots",
      image: "/samples/chelsea-boots.jpg",
      category: "shoes",
      type: "Chelsea Boots",
      color: "Polished Black",
      colorHex: "#18181A",
      photoType: "flat-lay",
      favorite: false,
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
  ],
  outfits: [
    {
      id: "outfit-initial-1",
      name: "Minimal Studio Look 01",
      personId: "person-elena",
      garmentIds: ["garment-crewneck", "garment-jeans"],
      resultImage: "/samples/result.png",
      category: "tops",
      favorite: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
  jobs: [],
};

function readData(): WardrobeData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), "utf-8");
      return INITIAL_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as WardrobeData;
    let mutated = false;
    for (const p of parsed.persons) {
      if (!p.calibration) {
        if (p.id === "person-elena") {
          p.calibration = DEFAULT_ELENA_CALIBRATION;
        } else if (p.id === "person-sofia") {
          p.calibration = DEFAULT_SOFIA_CALIBRATION;
        } else {
          p.calibration = {
            heightCm: 172,
            bodySilhouette: "regular",
            posture: "standing-frontal",
            framing: "full-body",
            lighting: "studio-neutral",
            zoom: 1.0,
            yOffset: 0,
            xOffset: 0,
            score: 92,
            calibratedAt: new Date().toISOString(),
          };
        }
        mutated = true;
      }
    }
    if (mutated) {
      try {
        writeData(parsed);
      } catch {}
    }
    return parsed;
  } catch (err) {
    console.error("Error reading wardrobe data, using fallback:", err);
    return INITIAL_DATA;
  }
}

function writeData(data: WardrobeData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error("Error writing wardrobe data:", err);
  }
}

// ---------------------------------------------------------------------------
// Garments
// ---------------------------------------------------------------------------

export function getGarments(filter?: {
  category?: string;
  q?: string;
  sort?: string;
}): Garment[] {
  const data = readData();
  let list = [...data.garments];

  if (filter?.category && filter.category !== "all") {
    list = list.filter((g) => g.category === filter.category);
  }

  if (filter?.q && filter.q.trim()) {
    const term = filter.q.trim().toLowerCase();
    list = list.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.type && g.type.toLowerCase().includes(term)) ||
        (g.color && g.color.toLowerCase().includes(term)) ||
        (g.secondaryColor && g.secondaryColor.toLowerCase().includes(term)) ||
        (g.pattern && g.pattern.toLowerCase().includes(term)) ||
        g.category.toLowerCase().includes(term)
    );
  }

  if (filter?.sort === "oldest") {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (filter?.sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (filter?.sort === "favorite") {
    list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  } else {
    // Default newest
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return list;
}

export function getGarmentById(id: string): Garment | null {
  const data = readData();
  return data.garments.find((g) => g.id === id) || null;
}

export function createGarment(
  item: Omit<Garment, "id" | "createdAt" | "favorite"> & { favorite?: boolean }
): Garment {
  const data = readData();
  const id = `garment-${crypto.randomUUID()}`;
  let image = item.image;

  if (image && image.startsWith("data:")) {
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      const imgPath = path.join(uploadsDir, `${id}.png`);
      fs.writeFileSync(imgPath, imgBuffer);
      image = `/uploads/${id}.png`;
    } catch (e) {
      console.warn("Could not write garment data URI to disk:", e);
    }
  }

  const newGarment: Garment = {
    id,
    name: item.name.trim(),
    image,
    category: item.category as GarmentCategory,
    type: item.type?.trim() || undefined,
    color: item.color?.trim() || undefined,
    colorHex: item.colorHex || undefined,
    secondaryColor: item.secondaryColor?.trim() || undefined,
    secondaryColorHex: item.secondaryColorHex || undefined,
    accentColors: item.accentColors || undefined,
    pattern: item.pattern || "solid",
    photoType: item.photoType || "flat-lay",
    favorite: Boolean(item.favorite),
    createdAt: new Date().toISOString(),
  };
  data.garments.unshift(newGarment);
  writeData(data);
  return newGarment;
}

export function updateGarment(id: string, updates: Partial<Garment>): Garment | null {
  const data = readData();
  const index = data.garments.findIndex((g) => g.id === id);
  if (index === -1) return null;
  data.garments[index] = { ...data.garments[index], ...updates };
  writeData(data);
  return data.garments[index];
}

export function toggleFavoriteGarment(id: string): Garment | null {
  const data = readData();
  const index = data.garments.findIndex((g) => g.id === id);
  if (index === -1) return null;
  data.garments[index].favorite = !data.garments[index].favorite;
  writeData(data);
  return data.garments[index];
}

export function deleteGarment(id: string): boolean {
  const data = readData();
  const beforeLen = data.garments.length;
  data.garments = data.garments.filter((g) => g.id !== id);
  if (data.garments.length !== beforeLen) {
    writeData(data);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Person Profiles
// ---------------------------------------------------------------------------

export function getPersons(): Person[] {
  const data = readData();
  return data.persons;
}

export function getPersonById(id: string): Person | null {
  const data = readData();
  return data.persons.find((p) => p.id === id) || null;
}

export function getDefaultPerson(): Person {
  const data = readData();
  const def = data.persons.find((p) => p.isDefault);
  return def || data.persons[0];
}

export function createPerson(
  name: string,
  rawImage: string,
  isDefault = false,
  calibration?: PersonaCalibration
): Person {
  const data = readData();
  const id = `person-${crypto.randomUUID()}`;
  let image = rawImage;

  if (image && image.startsWith("data:")) {
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      const imgPath = path.join(uploadsDir, `${id}.png`);
      fs.writeFileSync(imgPath, imgBuffer);
      image = `/uploads/${id}.png`;
    } catch (e) {
      console.warn("Could not write person data URI to disk:", e);
    }
  }

  if (isDefault) {
    for (const p of data.persons) p.isDefault = false;
  }
  const defaultCal: PersonaCalibration = {
    heightCm: 172,
    bodySilhouette: "regular",
    posture: "standing-frontal",
    framing: "full-body",
    lighting: "studio-neutral",
    zoom: 1.0,
    yOffset: 0,
    xOffset: 0,
    score: 94,
    calibratedAt: new Date().toISOString(),
  };

  const person: Person = {
    id,
    name: name.trim(),
    image,
    isDefault,
    createdAt: new Date().toISOString(),
    calibration: calibration ? { ...defaultCal, ...calibration } : defaultCal,
  };
  data.persons.unshift(person);
  writeData(data);
  return person;
}

export function setDefaultPerson(id: string): Person | null {
  const data = readData();
  let found: Person | null = null;
  for (const p of data.persons) {
    if (p.id === id) {
      p.isDefault = true;
      found = p;
    } else {
      p.isDefault = false;
    }
  }
  if (found) {
    writeData(data);
  }
  return found;
}

export function updatePerson(id: string, updates: Partial<Person>): Person | null {
  const data = readData();
  const index = data.persons.findIndex((p) => p.id === id);
  if (index === -1) return null;
  
  const existing = data.persons[index];
  const mergedCalibration = updates.calibration
    ? { ...existing.calibration, ...updates.calibration, calibratedAt: new Date().toISOString() }
    : existing.calibration;

  data.persons[index] = {
    ...existing,
    ...updates,
    calibration: mergedCalibration,
  };
  writeData(data);
  return data.persons[index];
}

export function deletePerson(id: string): boolean {
  const data = readData();
  if (data.persons.length <= 1) {
    return false; // keep at least one profile
  }
  const wasDefault = data.persons.find((p) => p.id === id)?.isDefault;
  data.persons = data.persons.filter((p) => p.id !== id);
  if (wasDefault && data.persons.length > 0) {
    data.persons[0].isDefault = true;
  }
  writeData(data);
  return true;
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------

export function getOutfits(): Outfit[] {
  const data = readData();
  const garmentMap = new Map(data.garments.map((g) => [g.id, g]));
  const personMap = new Map(data.persons.map((p) => [p.id, p]));

  return data.outfits
    .map((o) => ({
      ...o,
      person: personMap.get(o.personId),
      garments: o.garmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as Garment[],
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOutfitById(id: string): Outfit | null {
  const outfits = getOutfits();
  return outfits.find((o) => o.id === id) || null;
}

export function createOutfit(outfit: {
  name?: string;
  personId: string;
  garmentIds: string[];
  resultImage: string;
  category?: string;
  favorite?: boolean;
}): Outfit {
  const data = readData();
  // If resultImage is a data URI, write it to a file and store the path
  let resultImage = outfit.resultImage;
  if (resultImage.startsWith("data:")) {
    const outfitId = `outfit-${crypto.randomUUID()}`;
    const tryonDir = path.join(process.cwd(), "public", "uploads", "tryon");
    fs.mkdirSync(tryonDir, { recursive: true });
    const base64Data = resultImage.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");
    const imgPath = path.join(tryonDir, `${outfitId}.png`);
    fs.writeFileSync(imgPath, imgBuffer);
    resultImage = `/uploads/tryon/${outfitId}.png`;
  }

  const newOutfit: Outfit = {
    id: `outfit-${crypto.randomUUID()}`,
    name: outfit.name?.trim() || `Look ${new Date().toLocaleDateString()}`,
    personId: outfit.personId,
    garmentIds: outfit.garmentIds,
    resultImage,
    category: outfit.category || "tops",
    favorite: Boolean(outfit.favorite),
    createdAt: new Date().toISOString(),
  };
  data.outfits.unshift(newOutfit);
  writeData(data);

  const garmentMap = new Map(data.garments.map((g) => [g.id, g]));
  const personMap = new Map(data.persons.map((p) => [p.id, p]));
  return {
    ...newOutfit,
    person: personMap.get(newOutfit.personId),
    garments: newOutfit.garmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as Garment[],
  };
}

export function toggleFavoriteOutfit(id: string): Outfit | null {
  const data = readData();
  const index = data.outfits.findIndex((o) => o.id === id);
  if (index === -1) return null;
  data.outfits[index].favorite = !data.outfits[index].favorite;
  writeData(data);
  return getOutfitById(id);
}

export function deleteOutfit(id: string): boolean {
  const data = readData();
  const beforeLen = data.outfits.length;
  data.outfits = data.outfits.filter((o) => o.id !== id);
  if (data.outfits.length !== beforeLen) {
    writeData(data);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// VTON Jobs
// ---------------------------------------------------------------------------

export function getVtonJobs(): VtonJob[] {
  const data = readData();
  const garmentMap = new Map(data.garments.map((g) => [g.id, g]));
  const personMap = new Map(data.persons.map((p) => [p.id, p]));

  return data.jobs
    .map((j) => ({
      ...j,
      person: personMap.get(j.personId),
      garments: j.garmentIds.map((id) => garmentMap.get(id)).filter(Boolean) as Garment[],
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getVtonJobById(id: string): VtonJob | null {
  const jobs = getVtonJobs();
  return jobs.find((j) => j.id === id) || null;
}

export function saveVtonJob(job: VtonJob): VtonJob {
  const data = readData();

  // If result is a base64 data URI, write it to public/uploads/tryon/ and store the path
  if (job.result && job.result.startsWith("data:")) {
    try {
      const tryonDir = path.join(process.cwd(), "public", "uploads", "tryon");
      fs.mkdirSync(tryonDir, { recursive: true });
      const base64Data = job.result.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      const imgPath = path.join(tryonDir, `${job.id}.png`);
      fs.writeFileSync(imgPath, imgBuffer);
      job.result = `/uploads/tryon/${job.id}.png`;
    } catch (e) {
      console.warn("Could not write job result data URI to disk:", e);
    }
  }

  const index = data.jobs.findIndex((j) => j.id === job.id);
  if (index >= 0) {
    data.jobs[index] = job;
  } else {
    data.jobs.unshift(job);
  }
  writeData(data);
  return job;
}
