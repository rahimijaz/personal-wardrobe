# Fitcheck — Intelligent Wardrobe & Local Virtual Try-On Studio

Photograph the clothes you own, let an automated colour-theory engine compose stylish outfits, and preview how they look on your own model or photo using a **fully local, GPU-accelerated AI virtual try-on engine**.

```
WARDROBE ──▶ SHARP COLOUR EXTRACTION ──▶ LOCAL JSON STORAGE (data/wardrobe.json)
                                                   │
                                                   ▼
                                          OUTFIT MATCHING ENGINE
                                                   │
                                                   ▼
                                         OUTFIT RECOMMENDATION
                                                   │
     PERSONA STUDIO (Calibrated framing) ──┐       │
     GARMENT CUTOUTS (RMBG-1.4) ───────────┼───────▶ LOCAL FASHN-VTON SERVICE (DirectML)
                                           │       │ (Multi-pass top + bottom chaining)
                                           │       ▼
                                           └───────▶ HIGH-RES 768x1024 TRY-ON RESULT
```

Everything runs **100% locally on your machine**:
- **No external API keys** or cloud subscription fees required.
- **Privacy-first**: your reference photos, wardrobe garments, and generated looks never leave your computer.
- **Hardware accelerated**: natively runs on **AMD Radeon RX 6600 XT** and other AMD/Intel/NVIDIA GPUs via **DirectML** on Windows.
- **Zero database setup**: runs directly with atomic disk storage (`data/wardrobe.json` + `public/uploads/`).

---

## Key Features

1. **Local-First Architecture & Clean Storage**:
   - Zero-dependency local JSON database (`data/wardrobe.json`).
   - Automatically saves all generated try-on imagery, garment photos, and persona portraits to `public/uploads/` as PNG files.

2. **Automated Garment Ingestion & Palette Extraction**:
   - Built-in background removal using **RMBG-1.4**.
   - Automatic dominant color and harmonious palette extraction using **Sharp** color quantization.

3. **Persona Studio with Calibration Framing**:
   - Upload your own full-body model photo or choose a preset persona.
   - Fine-tune camera distance, zoom ($0.8\times - 1.5\times$), horizontal pan, and vertical alignment.
   - Calibration transforms are applied directly to the image buffer before AI inference, ensuring try-on output matches your exact framing.

4. **FASHN-VTON Engine with DirectML Acceleration**:
   - Powered by **FASHN-VTON** (`model.safetensors` + `dwpose` ONNX keypoint estimation).
   - DirectML acceleration via `torch_directml`, enabling AMD GPUs (e.g., RX 6600 XT, 7000 series) and Intel Arc on Windows.
   - Fast Euler sampling with configurable timesteps (8–12 steps).

5. **Multi-Pass Outfit Chaining**:
   - Automatically sequences 2-piece outfits (Top + Bottom) in a continuous session: Pass 1 styles the upper garment, Pass 2 fits the bottom over the calibrated result.

6. **Interactive Euler Timestep HUD & Job Cancellation**:
   - Live streaming progress display with discrete Euler step tiles and ASCII tqdm stream with real-time ETA.
   - **Abort Controller / Cancellation**: click "Cancel" during generation to immediately abort the diffusion pass and release DirectML GPU VRAM.

---

## System Requirements

| Component | Minimum | Recommended |
| --- | --- | --- |
| **Operating System** | Windows 10/11 64-bit | Windows 11 64-bit |
| **GPU** | 8 GB VRAM (AMD Radeon RX 6600 XT / NVIDIA RTX 3060) | 8 GB+ VRAM with DirectML or CUDA |
| **CPU** | 4 cores, 3.0 GHz+ | 8 cores, 3.5 GHz+ |
| **RAM** | 16 GB | 32 GB |
| **Disk Space** | ~5 GB free space for model weights & storage | SSD / NVMe |
| **Node.js** | Node.js 20+ | Node.js 22 LTS |
| **Python** | Python 3.10 | Python 3.10 virtual environment (`.venv-fashn`) |

---

## 1-Click Quick Start (Windows)

The repository includes a ready-to-use launch suite (`start.bat`, `start.ps1`, and `stop.bat`):

1. **Double-click `start.bat`** (or run `.\start.bat` in Command Prompt / PowerShell).
2. The script will:
   - Verify Python `.venv-fashn` virtual environment.
   - Launch the **FASHN-VTON Python service** on port `8188`.
   - Wait for the healthcheck (`/health`) to confirm DirectML readiness.
   - Launch the **Next.js Web Studio** on port `3000`.
   - Open your browser to `http://localhost:3000`.
3. To stop all services cleanly, press `Ctrl+C` in the runner terminal or run `stop.bat`.

---

## Manual Setup & Development

### 1. Web Application (Next.js)

```bash
# Install Node dependencies
npm install

# Build or run development server
npm run dev
```

The web studio will be accessible at [http://localhost:3000](http://localhost:3000).

### 2. Python VTON Service (DirectML)

Ensure your Python 3.10 virtual environment is configured with `torch-directml`:

```powershell
# Create and activate virtual environment
python -m venv .venv-fashn
.\.venv-fashn\Scripts\Activate.ps1

# Install requirements
pip install -r vton-service/requirements.txt
pip install torch-directml

# Start the VTON server
python vton-service\server.py
```

Check service status in another terminal:
```bash
curl http://127.0.0.1:8188/health
```

The health response will indicate:
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

## Project Structure

```
├── .venv-fashn/                  # Python 3.10 DirectML virtual environment
├── FASHN-VTON/
│   └── weights/                  # Model weights (model.safetensors, dwpose ONNX)
├── data/
│   └── wardrobe.json             # Lightweight local JSON database
├── public/
│   └── uploads/                  # Generated try-on images & garment cutouts
│       ├── garments/
│       ├── persons/
│       └── tryon/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── garments/         # Ingestion, Sharp palette extraction, RMBG cutouts
│   │   │   ├── outfits/          # Outfit catalog & favorites
│   │   │   ├── persons/          # Persona Studio & calibration endpoints
│   │   │   └── try-on/jobs/      # Job submission, status polling & job cancellation
│   │   ├── profile/              # Persona Studio (framing, zoom & offset calibration)
│   │   ├── try-on/               # Virtual Try-On Studio (HUD, Euler streaming, cancellation)
│   │   └── wardrobe/             # Garment gallery, filtering & manual upload
│   ├── context/
│   │   └── wardrobe-context.tsx  # Central client state provider
│   ├── lib/
│   │   ├── matcher.ts            # Color-theory outfit pairing engine
│   │   └── types.ts              # Shared TypeScript definitions
│   └── server/
│       ├── images.ts             # Sharp image processing & calibration framing
│       ├── storage.ts            # Atomic JSON persistence & disk writes
│       └── vton-client.ts        # Next.js to Python VTON bridge
├── vton-service/
│   ├── server.py                 # Multi-threaded HTTP server with cancel support
│   └── fashn_runner.py           # FASHN-VTON pipeline execution with torch_directml
├── start.bat                     # Windows 1-click launch script
├── start.ps1                     # PowerShell launch and monitoring runner
└── stop.bat                      # Windows 1-click shutdown script
```

---

## Configuration (`.env`)

Configuration is managed via `.env` (see [`.env.example`](.env.example)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VTON_SERVICE_URL` | `http://127.0.0.1:8188` | Address of the local Python service |
| `VTON_ENABLED` | `true` | Toggle virtual try-on studio availability |
| `VTON_TIMEOUT_MS` | `1200000` | Polling timeout in milliseconds (20 min) |
| `FASHN_DEVICE` | `directml` | Acceleration device (`directml`, `cuda`, `cpu`) |
| `FASHN_TIMESTEPS` | `8` | Diffusion Euler timesteps (8–12 recommended) |
| `FASHN_GUIDANCE` | `2.0` | Classifier-Free Guidance scale |
| `FASHN_WEIGHTS_DIR`| `FASHN-VTON/weights` | Directory containing model weights |

---

## Step-by-Step Workflow

1. **Add Garments**:
   - Go to **Wardrobe** (`/wardrobe`).
   - Drag & drop or upload clothing photos. Background removal runs automatically, and dominant color hex values are computed with Sharp.
2. **Calibrate Persona**:
   - Go to **Persona Studio** (`/profile`).
   - Select or upload your reference model. Adjust the **Zoom** and **Framing (X/Y)** sliders until the silhouette matches the desired proportion.
3. **Run Virtual Try-On**:
   - Go to **Virtual Try-On** (`/try-on`).
   - Pick your calibrated persona and choose a Top, Bottom, or complete 2-piece ensemble.
   - Click **Generate Virtual Try-On**.
   - Monitor live progress in the Euler Timestep HUD.
4. **Cancel Anytime**:
   - If you want to change selections mid-generation, click **Cancel** in the HUD header. The service interrupts the diffusion pass immediately and frees your GPU.
5. **Save Outfit**:
   - Review your tailored look, download the high-resolution PNG, or click **Save Outfit** to keep it in your collection.

---

## Troubleshooting

- **PowerShell Execution Policy Error**:
  Run PowerShell as Administrator and execute:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- **DirectML Device Missing**:
  Verify your `.venv-fashn` contains `torch-directml`:
  ```powershell
  .\.venv-fashn\Scripts\python.exe -c "import torch_directml; print(torch_directml.device())"
  ```
  It should output `privateuseone:0`.
- **Port Conflict (8188 or 3000 in use)**:
  Run `stop.bat` to terminate any orphaned background processes, or specify alternative ports via `VTON_SERVICE_PORT`.

---

## License

Application source code is released under the MIT License.
FASHN-VTON and third-party dependencies are subject to their respective upstream licenses.
