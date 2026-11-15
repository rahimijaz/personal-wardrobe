# Personal Wardrobe & Virtual Try-On Studio

Digitize your closet, explore outfit combinations with color theory, and preview how clothes look on you using a **fully local, GPU-accelerated AI virtual try-on engine**. No cloud APIs, no subscriptions, no uploads.

```
UPLOAD ──▶ BACKGROUND REMOVAL (RMBG-1.4) ──▶ COLOR & PATTERN EXTRACTION
                                                      │
                                                      ▼
                                            LOCAL JSON STORAGE
                                          (data/wardrobe.json)
                                                      │
                          ┌───────────────────────────┴──────────────┐
                          ▼                                          ▼
                 COLOR HARMONY LAB                        OUTFIT MATCHING ENGINE
                                                                     │
  PERSONA STUDIO (calibrated framing) ──┐                            ▼
  GARMENT CUTOUTS ──────────────────────┼──────▶ LOCAL FASHN-VTON 1.5 SERVICE (DirectML / CUDA)
                                        │                            │
                                        └────────────────────────────▼
                                              TRY-ON RESULT (up to 1024x1536)
```

Everything runs **100% on your machine**:

- **No external API keys** or cloud fees.
- **Privacy-first**: your photos, wardrobe, and generated looks never leave your computer.
- **Hardware accelerated**: tested on an **AMD Radeon RX 6600 XT** via **DirectML** on Windows. Other AMD, Intel, and NVIDIA GPUs should work through DirectML or CUDA, but are untested.
- **Zero database setup**: plain disk storage (`data/wardrobe.json` + `public/uploads/`).

---

## Features

### Wardrobe Catalog (`/wardrobe`)
- Category tabs: All Pieces, Tops, Bottoms, One-Pieces, Shoes, Accessories.
- Full-text search across name, color names, hex values, and patterns.
- Sort by newest, oldest, name, or favorites.
- Grid and list views.
- One-click inline renaming (`Enter` to save, `Esc` to cancel).
- Pure white cards with `object-contain` framing, so long pants, coats, and dresses are never cropped.

### Batch Ingestion Studio
- Drag and drop multiple photos at once.
- Client-side downscaling of oversized camera photos (over 1920px) to avoid payload errors.
- **Studio white background detection**: photos that already have a clean white backdrop skip neural segmentation, preserving fine fabric detail.
- **Silhouette classifier**: uses aspect ratio and leg-split patterns to tell tops from pants, jeans, shorts, and gowns.
- Quick `[Top]` / `[Bottom]` toggle on each upload card.
- Automatic **background removal (RMBG-1.4)** with edge color decontamination and 3:4 white-canvas centering.
- **Palette and pattern extraction**: K-means dominant colors, composite color names (e.g. "Steel Blue", "Ivory"), and secondary/accent colors.

### Virtual Try-On Studio (`/try-on`)
- Try on a single top, a single bottom, or a full top + bottom outfit.
- **Resolution slider** from fast previews (672x444) up to ultra-high quality (1024x1536).
- Inference controls: timesteps (8-30), classifier-free guidance scale, CFG skip steps, and random or fixed seed.
- Non-blocking job queue with live progress polling, cancel button, and error recovery.
- Multi-pass chaining: pass 1 fits the top, pass 2 fits the bottom over the result.

### Color Harmony Lab (`/harmony`)
- 12-hue color wheel mapping your entire wardrobe.
- Filter by Monochromatic, Analogous, Complementary, Split-Complementary, Triadic, and Tetradic schemes.

### Smart Outfit Matching (`/match`)
- Pairing recommendations scored on contrast, temperature harmony, and saturation balance between tops and bottoms.

### Persona Studio (`/profile`)
- Upload your own full-body or three-quarter photo, or use the included studio models.
- Calibrate zoom, horizontal pan, and vertical offset to align your body with the model's target frame.
- Auto-framing onto a 2:3 (1024x1536) canvas with safe head and shoe margins.

### Lookbook (`/outfits`)
- Gallery of saved try-on results with piece metadata.
- High-resolution inspection, download, copy to clipboard, and favorites.

### Settings & Diagnostics (`/settings`)
- Live hardware telemetry: device (DirectML / CUDA), PyTorch version, and weight verification.
- Global default resolution preference.
- Memory and execution status for local inference.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Web app | Next.js 15 (App Router), React 19, TypeScript |
| Styling & motion | Tailwind CSS v4, Framer Motion, Lucide React |
| Image processing | Sharp (Node.js), Pillow / OpenCV (Python) |
| Virtual try-on | FASHN-VTON 1.5 (diffusion transformer), PyTorch, DirectML |
| Background removal | BriaAI RMBG-1.4 |
| Storage | Local JSON + filesystem |

---

## System Requirements

| Component | Minimum | Recommended |
| :--- | :--- | :--- |
| **OS** | Windows 10/11 64-bit | Windows 11 64-bit |
| **GPU** | 8 GB VRAM (AMD RX 6600 XT / NVIDIA RTX 3060) | 8 GB+ VRAM with DirectML or CUDA |
| **CPU** | 4 cores, 3.0 GHz+ | 8 cores, 3.5 GHz+ |
| **RAM** | 16 GB | 32 GB |
| **Disk** | ~5 GB free for model weights and storage | SSD / NVMe |
| **Node.js** | 20+ | 22 LTS |
| **Python** | 3.10 | 3.10 virtual environment (`.venv-fashn`) |

> **Platform note:** Developed and tested on Windows with an AMD RX 6600 XT. Linux and macOS are not tested. `FASHN_DEVICE=cuda` is available for NVIDIA GPUs but has not been verified.

**Performance (RX 6600 XT, 8 GB):**

<!-- TODO: fill in your measured numbers -->

| Resolution | Timesteps | Time per image |
| :--- | :--- | :--- |
| 672x444 | 8 | _TBD_ |
| 768x1024 | 8 | _TBD_ |
| 1024x1536 | 8 | _TBD_ |

---

## Quick Start (Windows)

### 1. Clone and configure

```bash
git clone https://github.com/rahimijaz/personal-wardrobe.git
cd personal-wardrobe
copy .env.example .env
```

### 2. Download model weights

<!-- TODO: confirm exact download sources and folder layout -->

Place the FASHN-VTON 1.5 weights (`model.safetensors`) and the DWPose ONNX keypoint models in `FASHN-VTON/weights/`. RMBG-1.4 is loaded from Hugging Face (`briaai/RMBG-1.4`) and is cached on first use.

Total download is roughly 2-5 GB.

### 3. Set up Python

```powershell
python -m venv .venv-fashn
.\.venv-fashn\Scripts\Activate.ps1
pip install -r vton-service/requirements.txt
pip install torch-directml
```

### 4. Install web dependencies

```bash
npm install
```

### 5. Launch

Double-click **`start.bat`** (or run `.\start.bat`). The script will:

1. Verify the `.venv-fashn` environment.
2. Start the **FASHN-VTON Python service** on port `8188`.
3. Wait for the `/health` check to confirm the GPU is ready.
4. Start the **Next.js web studio** on port `3000`.
5. Open `http://localhost:3000` in your browser.

To stop everything, press `Ctrl+C` in the runner terminal or run `stop.bat`.

---

## Manual Setup

Run the two services separately if you prefer.

**Web app:**

```bash
npm run dev
```

**Python service:**

```powershell
.\.venv-fashn\Scripts\Activate.ps1
python vton-service\server.py
```

**Check service status:**

```bash
curl http://127.0.0.1:8188/health
```

Expected response:

```json
{
  "status": "ready",
  "engine": "fashn-vton",
  "device": "directml",
  "weights_found": true,
  "model_size_mb": 1940
}
```

---

## Usage

1. **Add garments** (`/wardrobe`): drag and drop photos. Background removal, classification, and palette extraction run automatically. Fix any wrong category with the `[Top]` / `[Bottom]` toggle.
2. **Calibrate your persona** (`/profile`): select or upload a model photo and adjust zoom and framing until the silhouette is well aligned.
3. **Explore combinations** (`/harmony`, `/match`): browse color schemes and ranked top + bottom pairings.
4. **Run a try-on** (`/try-on`): pick a persona, choose a top, bottom, or both, set the resolution and steps, then click **Generate Virtual Try-On**. Watch live progress, and cancel anytime to free the GPU.
5. **Save and revisit** (`/outfits`): keep results in your lookbook, download them, or mark favorites.

**Tips for better results:**
- Use a full-body, front-facing persona photo with clear head and shoe margins.
- Start with low resolution and few steps for quick previews, then raise quality for final renders.
- Use a fixed seed to reproduce or compare results.

---

## Configuration (`.env`)

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VTON_SERVICE_URL` | `http://127.0.0.1:8188` | Address of the local Python service |
| `VTON_ENABLED` | `true` | Toggle the try-on studio |
| `VTON_TIMEOUT_MS` | `1200000` | Polling timeout in ms (20 min) |
| `FASHN_DEVICE` | `directml` | Device: `directml`, `cuda`, or `cpu` |
| `FASHN_TIMESTEPS` | `8` | Default diffusion timesteps |
| `FASHN_GUIDANCE` | `2.0` | Classifier-free guidance scale |
| `FASHN_WEIGHTS_DIR` | `FASHN-VTON/weights` | Directory containing model weights |

Resolution, timesteps, guidance, and seed can also be changed from the UI at runtime.

---

## Project Structure

```
├── FASHN-VTON/
│   └── weights/                  # Model weights (model.safetensors, DWPose ONNX)
├── data/
│   └── wardrobe.json             # Local JSON database
├── public/
│   ├── samples/                  # Studio models and preset pieces
│   └── uploads/                  # Garment cutouts, persona portraits, try-on results
├── src/
│   ├── app/
│   │   ├── api/                  # garments, persons, outfits, try-on jobs, engine
│   │   ├── wardrobe/             # Catalog, filters, search, inline renaming
│   │   ├── try-on/               # Virtual try-on studio and resolution controls
│   │   ├── harmony/              # Color harmony wheel explorer
│   │   ├── match/                # Outfit pairing recommendations
│   │   ├── outfits/              # Lookbook
│   │   ├── profile/              # Persona calibration and auto-framing
│   │   └── settings/             # Engine telemetry and preferences
│   ├── components/
│   │   ├── batch-upload-modal.tsx    # Batch ingestion, auto-cutout, classifier
│   │   ├── app-nav.tsx               # Top navigation
│   │   └── color-wheel-explorer.tsx  # 12-hue color wheel
│   ├── context/
│   │   └── wardrobe-context.tsx  # Global client state
│   ├── lib/
│   │   ├── garment-utils.ts      # Silhouette classifier and color utilities
│   │   ├── palette.ts            # Dominant color and pattern extraction
│   │   ├── matcher.ts            # Color-theory pairing engine
│   │   └── types.ts              # Shared TypeScript types
│   └── server/
│       ├── storage.ts            # JSON persistence layer
│       ├── images.ts             # Sharp processing and auto-framing
│       └── vton-client.ts        # Next.js to Python service bridge
├── vton-service/
│   ├── server.py                 # Threaded HTTP service (RMBG-1.4, FASHN-VTON, classify)
│   └── fashn_runner.py           # FASHN-VTON inference runner and device manager
├── scripts/
├── start.bat / start.ps1         # Windows launch scripts
└── stop.bat                      # Windows shutdown script
```

---

## Troubleshooting

- **PowerShell execution policy error**: run PowerShell as Administrator and execute:

  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **DirectML device missing**: verify `torch-directml` is installed in `.venv-fashn`:

  ```powershell
  .\.venv-fashn\Scripts\python.exe -c "import torch_directml; print(torch_directml.device())"
  ```

  It should print `privateuseone:0`.

- **Port conflict (8188 or 3000)**: run `stop.bat` to end orphaned processes, or set an alternative port with `VTON_SERVICE_PORT`.

- **Out of memory during generation**: lower the resolution in the try-on studio or settings, close other GPU-heavy apps, and keep timesteps low.

- **Upload fails with a 413 error**: the client downsizes large photos automatically and the server accepts up to 50 MB. If it still fails, check `next.config.ts` for the body size limit.

---

## Privacy

Your wardrobe photos, persona images, and generated try-ons are stored only in `data/` and `public/uploads/` on your machine. Both are git-ignored. No data is sent to any external service, apart from the one-time download of model weights.

---

## Credits

- [**FASHN-VTON**](https://fashn.ai) by FASHN AI: virtual try-on model
- [**RMBG-1.4**](https://huggingface.co/briaai/RMBG-1.4) by BriaAI: background removal
- Built with Next.js, React, Tailwind CSS, Sharp, PyTorch, and torch-directml

---

## License

Application source code is released under the MIT License (see [`LICENSE`](LICENSE)).

FASHN-VTON, RMBG-1.4, and other third-party models and dependencies are subject to their own upstream licenses. Review them before any commercial use.
