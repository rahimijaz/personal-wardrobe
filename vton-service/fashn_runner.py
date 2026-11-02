"""
FASHN-VTON runner — clean, isolated wrapper around the local FASHN-VTON model.

Accepts:
  - person image (PIL or path)
  - garment image (PIL or path)
  - category: tops / bottoms / one-pieces
  - garment_photo_type: flat-lay / model
"""

from __future__ import annotations

import os
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional
from PIL import Image

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_SCRIPT_DIR, ".."))
_FASHN_DIR = os.path.join(_PROJECT_ROOT, "FASHN-VTON")
_FASHN_SRC = os.path.join(_FASHN_DIR, "src")

# Add FASHN-VTON to path if present
if os.path.isdir(_FASHN_SRC) and _FASHN_SRC not in sys.path:
    sys.path.insert(0, _FASHN_SRC)

DEFAULT_WEIGHTS_DIR = os.path.join(_FASHN_DIR, "weights")


@dataclass
class FashnConfig:
    weights_dir: str = os.environ.get("FASHN_WEIGHTS_DIR", DEFAULT_WEIGHTS_DIR)
    device: Optional[str] = os.environ.get("FASHN_DEVICE", "directml")  # directml, cuda, cpu, or auto
    num_timesteps: int = int(os.environ.get("FASHN_TIMESTEPS", "8"))
    guidance_scale: float = float(os.environ.get("FASHN_GUIDANCE", "2.0"))
    skip_cfg_last_n_steps: int = int(os.environ.get("FASHN_SKIP_CFG", "5"))
    seed: int = int(os.environ.get("FASHN_SEED", "42"))
    segmentation_free: bool = True


class FashnRunner:
    def __init__(self, config: Optional[FashnConfig] = None):
        self.config = config or FashnConfig()
        self._lock = threading.Lock()
        self._pipeline = None
        self._load_error: Optional[str] = None
        self._is_loading = False

    def check_weights(self) -> Dict[str, Any]:
        """Verify weights exist on disk."""
        weights_dir = os.path.abspath(self.config.weights_dir)
        model_file = os.path.join(weights_dir, "model.safetensors")
        dwpose_dir = os.path.join(weights_dir, "dwpose")
        
        has_model = os.path.isfile(model_file)
        has_dwpose = os.path.isdir(dwpose_dir)
        
        size_mb = 0
        if has_model:
            size_mb = round(os.path.getsize(model_file) / (1024 * 1024), 1)

        return {
            "weights_dir": weights_dir,
            "has_model_safetensors": has_model,
            "model_size_mb": size_mb,
            "has_dwpose": has_dwpose,
            "ready": has_model and has_dwpose,
        }

    def detect_device(self) -> str:
        """Identify available hardware acceleration (DirectML / CUDA / CPU)."""
        if self.config.device:
            return self.config.device

        # Check torch_directml
        try:
            import torch_directml
            if torch_directml.is_available():
                return "directml"
        except Exception:
            pass

        # Check CUDA
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except Exception:
            pass

        return "cpu"

    def status(self) -> Dict[str, Any]:
        weights_info = self.check_weights()
        device = self.detect_device()
        return {
            "engine": "fashn-vton-1.5",
            "device": device,
            "is_loaded": self._pipeline is not None,
            "is_loading": self._is_loading,
            "load_error": self._load_error,
            "weights": weights_info,
            "supported_categories": ["tops", "bottoms", "one-pieces"],
            "supported_photo_types": ["flat-lay", "model"],
        }

    def load_pipeline(self):
        """Loads TryOnPipeline into memory."""
        with self._lock:
            if self._pipeline is not None:
                return self._pipeline

            self._is_loading = True
            self._load_error = None
            try:
                from fashn_vton import TryOnPipeline
                device = self.detect_device()
                self._pipeline = TryOnPipeline(
                    weights_dir=self.config.weights_dir,
                    device=device,
                )
                return self._pipeline
            except Exception as e:
                self._load_error = str(e)
                raise
            finally:
                self._is_loading = False

    def run_tryon(
        self,
        person_image: Image.Image,
        garment_image: Image.Image,
        category: str = "tops",
        garment_photo_type: str = "flat-lay",
        num_timesteps: Optional[int] = None,
        skip_cfg_last_n_steps: Optional[int] = None,
        guidance_scale: Optional[float] = None,
        seed: Optional[int] = None,
        on_stage_change: Optional[Callable[..., None]] = None,
    ) -> Image.Image:
        """
        Executes virtual try-on inference with fine-grained progress updates.
        Category must be one of: "tops", "bottoms", "one-pieces".
        """
        if category not in ("tops", "bottoms", "one-pieces"):
            raise ValueError(f"Category '{category}' unsupported. Must be tops, bottoms, or one-pieces.")
        if garment_photo_type not in ("flat-lay", "model"):
            garment_photo_type = "flat-lay"

        steps = int(num_timesteps) if num_timesteps is not None else self.config.num_timesteps
        skip_cfg = int(skip_cfg_last_n_steps) if skip_cfg_last_n_steps is not None else self.config.skip_cfg_last_n_steps
        guidance = float(guidance_scale) if guidance_scale is not None else self.config.guidance_scale
        s = int(seed) if seed is not None else self.config.seed

        def _notify(stage: str, step: int = 0, total_steps: int = 8, detail: str = "", **kwargs):
            if on_stage_change:
                try:
                    on_stage_change(stage=stage, step=step, total_steps=total_steps, detail=detail, **kwargs)
                except TypeError:
                    try:
                        on_stage_change(stage, step, total_steps, detail)
                    except TypeError:
                        on_stage_change(stage)

        _notify("preparing_person", 0, steps, "Detecting body pose & keypoints...")

        # Ensure pipeline is loaded
        pipeline = self.load_pipeline()

        _notify("preparing_garment", 0, steps, "Segmenting clothing boundaries...")

        def _pipeline_callback(**kwargs):
            _notify(**kwargs)

        result = pipeline(
            person_image=person_image,
            garment_image=garment_image,
            category=category,
            garment_photo_type=garment_photo_type,
            num_samples=1,
            num_timesteps=steps,
            guidance_scale=guidance,
            skip_cfg_last_n_steps=skip_cfg,
            seed=s,
            segmentation_free=self.config.segmentation_free,
            callback=_pipeline_callback,
        )

        _notify("finalizing", steps, steps, "Finalizing high-res image...")

        if not result.images:
            raise RuntimeError("FASHN-VTON produced no images.")

        return result.images[0]


GLOBAL_RUNNER = FashnRunner()
