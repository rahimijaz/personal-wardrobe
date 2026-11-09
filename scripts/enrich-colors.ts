import fs from "node:fs";
import path from "node:path";
import { paletteFromFile } from "../src/server/images";

async function main() {
  const filePath = path.join(process.cwd(), "data", "wardrobe.json");
  if (!fs.existsSync(filePath)) {
    console.error("wardrobe.json not found");
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  let updatedCount = 0;

  for (const g of data.garments) {
    const absPath = path.join(process.cwd(), "public", g.image.replace(/^\//, ""));
    if (!fs.existsSync(absPath)) continue;
    try {
      const extracted = await paletteFromFile(absPath);
      g.colorHex = extracted.dominant;
      g.color = extracted.compositeColorName || extracted.colorName;
      if (extracted.secondary) {
        g.secondaryColorHex = extracted.secondary;
        g.secondaryColor = extracted.secondaryColorName;
      }
      g.pattern = extracted.pattern || "solid";
      g.accentColors = extracted.palette;
      updatedCount++;
      console.log(`[OK] ${g.name}: ${g.color} | Pattern: ${g.pattern} | Secondary: ${g.secondaryColor || "none"}`);
    } catch (err) {
      console.error(`[ERR] ${g.name}:`, err);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`\nSuccessfully updated ${updatedCount} garments in data/wardrobe.json!`);
}

main().catch(console.error);

