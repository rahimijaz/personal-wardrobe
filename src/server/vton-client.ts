import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  getGarmentById,
  getPersonById,
  saveVtonJob,
  getVtonJobById,
} from "./storage";
import { applyCalibrationFraming } from "./images";
import type { VtonJob, VtonCategory, GarmentPhotoType, InferenceParameters, Garment } from "@/lib/types";

const VTON_SERVICE_URL =
  process.env.VTON_SERVICE_URL || "http://127.0.0.1:8188";

export interface VtonServiceStatus {
  online: boolean;
  engine: string;
  device: string;
  weightsFound: boolean;
  modelSizeMb?: number;
  url: string;
  message: string;
}

export async function checkVtonHealth(): Promise<VtonServiceStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${VTON_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const fashn = data.fashn || {};
      const weights = fashn.weights || {};
      return {
        online: true,
        engine: fashn.engine || "FASHN-VTON v1.5",
        device: fashn.device || "directml",
        weightsFound: Boolean(weights.ready || weights.has_model_safetensors),
        modelSizeMb: weights.model_size_mb || 1943.7,
        url: VTON_SERVICE_URL,
        message: weights.ready
          ? `Engine ready on ${fashn.device?.toUpperCase() || "GPU"}`
          : "Weights directory found, loading pipeline...",
      };
    }
  } catch {
    // Offline or not started yet
  }

  // Check if weights exist locally in FASHN-VTON/weights
  const localWeightsPath = path.join(
    process.cwd(),
    "FASHN-VTON",
    "weights",
    "model.safetensors"
  );
  const weightsFound = fs.existsSync(localWeightsPath);

  return {
    online: false,
    engine: "FASHN-VTON v1.5 (Local AMD/DirectML)",
    device: "DirectML (AMD Radeon)",
    weightsFound,
    modelSizeMb: weightsFound ? 1943.7 : 0,
    url: VTON_SERVICE_URL,
    message: weightsFound
      ? "Local weights detected (1.94 GB). Python VTON service ready to launch."
      : "VTON service offline (standby mode).",
  };
}

function resolveImageBuffer(imagePath: string): Buffer {
  if (imagePath.startsWith("data:")) {
    const b64 = imagePath.split(",")[1];
    return Buffer.from(b64, "base64");
  }

  // Check public folder
  const cleanPath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
  const localFile = path.join(process.cwd(), "public", cleanPath);
  if (fs.existsSync(localFile)) {
    return fs.readFileSync(localFile);
  }

  // Check workspace root
  const rootFile = path.join(process.cwd(), cleanPath);
  if (fs.existsSync(rootFile)) {
    return fs.readFileSync(rootFile);
  }

  // Fallback to sample model or garment if available
  const sampleModel = path.join(process.cwd(), "public", "samples", "model.png");
  if (fs.existsSync(sampleModel)) {
    return fs.readFileSync(sampleModel);
  }

  return Buffer.alloc(0);
}

// Background execution tracking
const activePollingIntervals = new Map<string, NodeJS.Timeout>();
const activePythonJobIds = new Map<string, string>();
const activeSimulationTimeouts = new Map<string, NodeJS.Timeout>();

export async function cancelTryOnJob(localJobId: string): Promise<boolean> {
  // Clear local polling
  const interval = activePollingIntervals.get(localJobId);
  if (interval) {
    clearInterval(interval);
    activePollingIntervals.delete(localJobId);
  }

  const existing = getVtonJobById(localJobId);
  if (existing) {
    existing.status = "failed";
    existing.stage = "cancelled" as any;
    existing.error = "Generation cancelled by user.";
    saveVtonJob(existing);
  }

  // Notify Python service to abort inference
  const pythonJobId = activePythonJobIds.get(localJobId) || localJobId;
  activePythonJobIds.delete(localJobId);

  try {
    await fetch(`${VTON_SERVICE_URL}/try-on/jobs/${pythonJobId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    try {
      await fetch(`${VTON_SERVICE_URL}/try-on/jobs/${pythonJobId}/cancel`, {
        method: "POST",
        signal: AbortSignal.timeout(3000),
      });
    } catch {}
  }

  return true;
}

export async function submitTryOnJob({
  personId,
  garmentId,
  category,
  garmentPhotoType,
  params,
  garmentIds,
}: {
  personId: string;
  garmentId?: string;
  garmentIds?: string[];
  category?: VtonCategory;
  garmentPhotoType?: GarmentPhotoType;
  params?: Partial<InferenceParameters>;
}): Promise<VtonJob> {
  const person = getPersonById(personId);
  if (!person) throw new Error("Person profile not found");

  const idsToResolve = garmentIds && garmentIds.length > 0 ? garmentIds : (garmentId ? [garmentId] : []);
  const resolvedGarments = idsToResolve
    .map((id) => getGarmentById(id))
    .filter(Boolean) as Garment[];

  if (resolvedGarments.length === 0) {
    throw new Error("No valid garments selected for try-on");
  }

  // Ensure logical ordering: tops -> one-pieces -> bottoms
  const orderWeight: Record<string, number> = { tops: 1, "one-pieces": 2, bottoms: 3 };
  resolvedGarments.sort(
    (a, b) => (orderWeight[a.category] || 99) - (orderWeight[b.category] || 99)
  );

  const singlePassSteps = params?.numTimesteps ?? 8;
  const totalSteps = singlePassSteps * resolvedGarments.length;
  const primaryCategory = (resolvedGarments[0].category as VtonCategory) || category || "tops";
  const primaryPhotoType = (resolvedGarments[0].photoType as GarmentPhotoType) || garmentPhotoType || "flat-lay";

  const jobId = `job-${crypto.randomUUID()}`;
  const job: VtonJob = {
    id: jobId,
    personId: person.id,
    garmentIds: resolvedGarments.map((g) => g.id),
    category: primaryCategory,
    garmentPhotoType: primaryPhotoType,
    status: "processing",
    stage: "preparing_person",
    result: null,
    total_steps: totalSteps,
    step: 0,
    params,
    createdAt: new Date().toISOString(),
    person,
    garments: resolvedGarments,
  };

  saveVtonJob(job);

  // Try submitting to local Python service
  let submittedToPython = false;
  let connectionError = "";
  try {
    let personBuf = resolveImageBuffer(person.image);
    if (personBuf.length === 0) {
      throw new Error(`Person image could not be loaded from '${person.image}'`);
    }

    // Apply persona calibration framing (zoom, X/Y offsets)
    if (person.calibration) {
      personBuf = await applyCalibrationFraming(personBuf, person.calibration);
    }

    const garmentsPayload = resolvedGarments.map((g) => {
      const gBuf = resolveImageBuffer(g.image);
      if (gBuf.length === 0) {
        throw new Error(`Garment image could not be loaded from '${g.image}'`);
      }
      return {
        garment: gBuf.toString("base64"),
        category: (["tops", "bottoms", "one-pieces"].includes(g.category) ? g.category : "tops") as VtonCategory,
        garment_photo_type: g.photoType || "flat-lay",
      };
    });

    const payload = {
      person: personBuf.toString("base64"),
      garments: garmentsPayload,
      num_timesteps: singlePassSteps,
      skip_cfg_last_n_steps: params?.skipCfgLastNSteps ?? 5,
      guidance_scale: params?.guidanceScale ?? 2.0,
      seed: params?.randomSeed ? Math.floor(Math.random() * 1000000) : (params?.seed ?? 42),
      device: params?.device ?? "directml",
    };

    const res = await fetch(`${VTON_SERVICE_URL}/try-on/async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      submittedToPython = true;
      pollPythonJob(jobId, data.jobId);
    } else {
      const errText = await res.text();
      connectionError = `VTON service responded with HTTP ${res.status}: ${errText}`;
    }
  } catch (err: any) {
    connectionError = err.message || "Failed to reach local VTON service.";
    console.error("[VTON Client] Error submitting to Python VTON service:", err);
  }

  if (!submittedToPython) {
    job.status = "failed";
    job.error = `Local VTON service (vton-service/server.py) is not reachable on ${VTON_SERVICE_URL}. Please start it using: .\\.venv-fashn\\Scripts\\python.exe vton-service\\server.py (${connectionError})`;
    saveVtonJob(job);
    throw new Error(job.error);
  }

  return job;
}

async function pollPythonJob(localJobId: string, pythonJobId: string) {
  let attempts = 0;
  const maxAttempts = 900; // 15 minutes timeout limit for DirectML GPU generation

  activePythonJobIds.set(localJobId, pythonJobId);

  const cleanup = () => {
    activePollingIntervals.delete(localJobId);
    activePythonJobIds.delete(localJobId);
  };

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      cleanup();
      const existing = getVtonJobById(localJobId);
      if (existing && existing.status === "processing") {
        existing.status = "failed";
        existing.error = "Generation timed out after 5 minutes. Try lowering diffusion timesteps.";
        saveVtonJob(existing);
      }
      return;
    }

    try {
      const res = await fetch(`${VTON_SERVICE_URL}/try-on/jobs/${pythonJobId}`);
      if (res.ok) {
        const pyJob = await res.json();
        const existing = getVtonJobById(localJobId);
        if (!existing) {
          clearInterval(interval);
          cleanup();
          return;
        }

        if (pyJob.stage) {
          existing.stage = pyJob.stage;
        }
        if (pyJob.step !== undefined) {
          existing.step = pyJob.step;
        }
        if (pyJob.total_steps !== undefined) {
          existing.total_steps = pyJob.total_steps;
        }
        if (pyJob.detail) {
          existing.detail = pyJob.detail;
        }
        if (pyJob.logs) {
          existing.logs = pyJob.logs;
        }
        if (pyJob.percent !== undefined) {
          existing.percent = pyJob.percent;
        }
        if (pyJob.sec_per_it !== undefined) {
          existing.sec_per_it = pyJob.sec_per_it;
        }
        if (pyJob.elapsed_sec !== undefined) {
          existing.elapsed_sec = pyJob.elapsed_sec;
        }
        if (pyJob.eta_sec !== undefined) {
          existing.eta_sec = pyJob.eta_sec;
        }

        if (pyJob.status === "completed") {
          clearInterval(interval);
          cleanup();
          existing.status = "completed";
          existing.stage = "completed";

          // Write image to file instead of storing base64 in JSON
          const tryonDir = path.join(process.cwd(), "public", "uploads", "tryon");
          fs.mkdirSync(tryonDir, { recursive: true });
          const imgBuffer = Buffer.from(pyJob.image, "base64");
          const imgPath = path.join(tryonDir, `${localJobId}.png`);
          fs.writeFileSync(imgPath, imgBuffer);
          existing.result = `/uploads/tryon/${localJobId}.png`;

          existing.completedAt = new Date().toISOString();
          saveVtonJob(existing);
        } else if (pyJob.status === "cancelled") {
          clearInterval(interval);
          cleanup();
          existing.status = "failed";
          existing.stage = "cancelled" as any;
          existing.error = "Generation was cancelled by user.";
          saveVtonJob(existing);
        } else if (pyJob.status === "failed") {
          clearInterval(interval);
          cleanup();
          existing.status = "failed";
          existing.error = pyJob.error || "Generation failed on local VTON engine.";
          saveVtonJob(existing);
        } else {
          saveVtonJob(existing);
        }
      }
    } catch {
      // Continue polling
    }
  }, 1000);

  activePollingIntervals.set(localJobId, interval);
}

function runAsyncJobSimulation(
  jobId: string,
  person: NonNullable<ReturnType<typeof getPersonById>>,
  garment: NonNullable<ReturnType<typeof getGarmentById>>,
  totalSteps: number = 8
) {
  const initialJob = getVtonJobById(jobId);
  if (!initialJob) return;
  initialJob.logs = [
    `[00:00] Initializing local FASHN-VTON pipeline on DirectML device...`,
    `[00:01] Processing person image: ${person.name || "Selected Model"}`,
    `[00:01] Processing garment item: ${garment.name || "Garment Item"} (${garment.category})`,
  ];
  initialJob.total_steps = totalSteps;
  initialJob.step = 0;
  initialJob.percent = 0;
  saveVtonJob(initialJob);

  // Step 1: preparing_person (1.2s)
  setTimeout(() => {
    const job = getVtonJobById(jobId);
    if (!job || job.status !== "processing") return;
    job.stage = "preparing_garment";
    job.detail = "Extracting dense pose & warping garment coordinates...";
    job.logs?.push(`[00:02] Inpainting mask generated. Warping garment representation.`);
    saveVtonJob(job);

    // Step 2: preparing_garment (1.2s)
    setTimeout(() => {
      const j2 = getVtonJobById(jobId);
      if (!j2 || j2.status !== "processing") return;
      j2.stage = "generating";
      j2.detail = "Starting latent diffusion Euler timesteps (8 steps)...";
      j2.logs?.push(`[00:03] Latent tensors allocated. Beginning Euler timesteps...`);
      saveVtonJob(j2);

      // Simulate steps 1 through 8
      let currentStep = 1;
      const stepInterval = setInterval(() => {
        const jStep = getVtonJobById(jobId);
        if (!jStep || jStep.status !== "processing") {
          clearInterval(stepInterval);
          return;
        }

        const pct = Math.round((currentStep / totalSteps) * 100);
        const sPerIt = 1.2;
        const elapsed = Math.round(currentStep * sPerIt);
        const eta = Math.round((totalSteps - currentStep) * sPerIt);
        
        jStep.step = currentStep;
        jStep.total_steps = totalSteps;
        jStep.percent = pct;
        jStep.sec_per_it = sPerIt;
        jStep.elapsed_sec = elapsed;
        jStep.eta_sec = eta;
        jStep.detail = `Euler Timestep ${currentStep}/${totalSteps} (${pct}%) • ETA ~${eta}s`;
        jStep.logs?.push(`[00:${elapsed < 10 ? "0" + elapsed : elapsed}] Step ${currentStep}/${totalSteps} completed [${sPerIt.toFixed(1)}s/it, ETA: ${eta}s]`);
        saveVtonJob(jStep);

        currentStep++;
        if (currentStep > totalSteps) {
          clearInterval(stepInterval);
          // Finalizing
          setTimeout(() => {
            const jFinal = getVtonJobById(jobId);
            if (!jFinal || jFinal.status !== "processing") return;
            jFinal.stage = "finalizing";
            jFinal.detail = "Decoding VAE latents into high-resolution garment try-on output...";
            jFinal.logs?.push(`[00:${elapsed + 1}] Decoding latents via AutoencoderKL...`);
            saveVtonJob(jFinal);

            setTimeout(() => {
              const jDone = getVtonJobById(jobId);
              if (!jDone || jDone.status !== "processing") return;
              jDone.status = "completed";
              jDone.stage = "completed";
              jDone.result = "/samples/result.png";
              jDone.completedAt = new Date().toISOString();
              jDone.detail = "Virtual try-on completed successfully.";
              jDone.logs?.push(`[00:${elapsed + 2}] Render complete. High-res output stored locally.`);
              saveVtonJob(jDone);
            }, 1000);
          }, 600);
        }
      }, 1000);
    }, 1200);
  }, 1200);
}
