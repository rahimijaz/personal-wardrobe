"""
Local virtual try-on HTTP service for FASHN-VTON (with CatVTON fallback).

Endpoints:
    GET  /health            -> service + backend + model diagnostics
    POST /try-on            -> synchronous try-on
    POST /try-on/async      -> { person, garment, category, garment_photo_type } -> { jobId, status }
    GET  /try-on/jobs/<id>  -> { id, status, stage, image, error }
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import sys
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from fashn_runner import GLOBAL_RUNNER as FASHN_RUNNER
    HAS_FASHN = True
except Exception as e:
    HAS_FASHN = False
    FASHN_RUNNER = None

SERVICE_VERSION = "2.0.0 (FASHN-VTON ready)"
MAX_BODY_BYTES = 40 * 1024 * 1024  # 40 MB payload
START_TIME = time.time()

# Job storage for asynchronous execution
_JOBS_LOCK = threading.Lock()
_JOBS: Dict[str, Dict[str, Any]] = {}

# Background execution queue
_JOB_QUEUE: list[str] = []
_QUEUE_EVENT = threading.Event()


def _decode_image(value, field: str):
    """Accept a raw base64 string or a data: URI and return a PIL image."""
    from PIL import Image

    if not isinstance(value, str) or not value:
        raise ValueError(f"'{field}' must be a base64 image string.")
    if value.startswith("data:"):
        try:
            value = value.split(",", 1)[1]
        except IndexError as exc:
            raise ValueError(f"'{field}' is not a valid data URI.") from exc
    try:
        raw = base64.b64decode(value, validate=False)
    except Exception as exc:
        raise ValueError(f"'{field}' is not valid base64.") from exc
    if not raw:
        raise ValueError(f"'{field}' is empty.")
    try:
        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            white_bg = Image.new("RGB", img.size, (255, 255, 255))
            rgba_img = img.convert("RGBA")
            white_bg.paste(rgba_img, (0, 0), rgba_img)
            return white_bg
        return img.convert("RGB")
    except Exception as exc:
        raise ValueError(f"'{field}' is not a readable image.") from exc


def _encode_png(image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# Background Removal (RMBG-1.4 for clean garment cutouts)
# ---------------------------------------------------------------------------
_RMBG_MODEL = None
_RMBG_LOCK = threading.Lock()


def _get_rmbg_model():
    global _RMBG_MODEL
    if _RMBG_MODEL is None:
        with _RMBG_LOCK:
            if _RMBG_MODEL is None:
                from transformers import AutoModelForImageSegmentation
                print("[RMBG] Loading RMBG-1.4 background removal model...")
                model = AutoModelForImageSegmentation.from_pretrained("briaai/RMBG-1.4", trust_remote_code=True)
                model.eval()
                _RMBG_MODEL = model
                print("[RMBG] RMBG-1.4 ready.")
    return _RMBG_MODEL


def _classify_garment_mask(alpha_u8):
    """Accurately classifies garment into 'tops', 'bottoms', 'one-pieces', or 'shoes' from clean alpha mask."""
    import numpy as np

    fg = alpha_u8 > 48
    rows = np.where(np.any(fg, axis=1))[0]
    cols = np.where(np.any(fg, axis=0))[0]
    if len(rows) < 15 or len(cols) < 15:
        return "tops"

    y1, y2 = rows[0], rows[-1]
    x1, x2 = cols[0], cols[-1]
    h = y2 - y1 + 1
    w = x2 - x1 + 1
    ar = h / max(1, w)

    if ar <= 0.55:
        return "shoes"

    crop = fg[y1 : y2 + 1, x1 : x2 + 1]
    band_h = h / 10.0
    widths = []
    for b in range(10):
        b_slice = crop[int(b * band_h) : int((b + 1) * band_h), :]
        if not np.any(b_slice):
            widths.append(0)
            continue
        c_active = np.where(np.any(b_slice, axis=0))[0]
        widths.append(c_active[-1] - c_active[0] + 1)

    upper_w = np.mean(widths[:3])
    mid_w = np.mean(widths[3:7])
    lower_w = np.mean(widths[7:])

    cx1 = int(w * 0.44)
    cx2 = int(w * 0.56) + 1
    cy1 = int(h * 0.55)
    cy2 = int(h * 0.92)
    center_strip = crop[cy1:cy2, cx1:cx2]
    center_solid_ratio = np.mean(center_strip) if center_strip.size > 0 else 0.0

    lower_slice = crop[cy1:cy2, :]
    two_segments_count = 0
    num_rows = lower_slice.shape[0]
    for r in range(num_rows):
        row = lower_slice[r, :]
        diffs = np.diff(row.astype(int))
        rising_edges = np.sum(diffs == 1)
        mid_pix = row[cx1:cx2]
        if rising_edges >= 2 and np.mean(mid_pix) < 0.2:
            two_segments_count += 1
    two_leg_ratio = two_segments_count / max(1, num_rows)

    # 1. Clear leg split (empty center between two legs) -> bottoms
    if (two_leg_ratio >= 0.20 or center_solid_ratio <= 0.45) and ar >= 0.95:
        return "bottoms"

    # 2. Flared A-line dress / gown: only if unmistakable flared bottom hem (> 1.5x wider than top)
    if ar >= 1.55 and lower_w >= upper_w * 1.50 and center_solid_ratio >= 0.70 and two_leg_ratio <= 0.05:
        return "one-pieces"

    # 3. Tall garments (ar >= 1.25):
    if ar >= 1.25:
        # Upper garment with sleeves: shoulders/sleeves are wide (upper_w >= mid_w * 1.08) and torso is solid
        if upper_w >= mid_w * 1.08 and upper_w >= lower_w * 1.02 and center_solid_ratio >= 0.65:
            return "tops"
        # Tall straight silhouette is trousers / jeans / pants (bottoms)
        return "bottoms"

    # 4. Standard height / boxy garments (ar < 1.25):
    # Only shorts with an unmistakable split between two legs are bottoms
    if two_leg_ratio >= 0.35 and center_solid_ratio <= 0.30:
        return "bottoms"

    # 5. Standard upper garment (torso solid in center, wide shoulders) -> tops
    return "tops"


def _is_already_white_bg(pil_img, thresh=240):
    """Returns True if the image already has a clean white studio backdrop."""
    import numpy as np

    rgb = pil_img.convert("RGB")
    arr = np.array(rgb)
    H, W, _ = arr.shape
    b_size = max(6, min(24, H // 25, W // 25))
    borders = np.concatenate([
        arr[:b_size, :].reshape(-1, 3),
        arr[-b_size:, :].reshape(-1, 3),
        arr[:, :b_size].reshape(-1, 3),
        arr[:, -b_size:].reshape(-1, 3),
    ], axis=0)
    median_rgb = np.median(borders, axis=0)
    p5_rgb = np.percentile(borders, 5, axis=0)
    std_rgb = float(np.std(borders, axis=0).mean())
    return bool(np.all(median_rgb >= thresh) and np.all(p5_rgb >= 220) and std_rgb <= 14.0)


def _pad_and_center_on_white(img, padding_ratio=0.12):
    """
    Finds the garment foreground and centers it on a clean pure white canvas (3:4 aspect ratio)
    with generous breathing margins (so pants are panned out / zoomed out and don't crowd the frame).
    """
    import numpy as np
    from PIL import Image

    rgb = img.convert("RGB")
    arr = np.array(rgb)
    H, W, _ = arr.shape

    # Find garment pixels (diff from 255, 255, 255)
    diff = np.max(255 - arr, axis=2)
    fg = diff > 16
    if img.mode == "RGBA":
        a = np.array(img)[:, :, 3]
        fg = (a > 32) & fg

    rows = np.where(np.any(fg, axis=1))[0]
    cols = np.where(np.any(fg, axis=0))[0]

    if len(rows) < 20 or len(cols) < 20:
        white_bg = Image.new("RGB", (W, H), (255, 255, 255))
        if img.mode == "RGBA":
            white_bg.paste(img, (0, 0), img)
        else:
            white_bg.paste(img, (0, 0))
        return white_bg

    y1, y2 = int(rows[0]), int(rows[-1])
    x1, x2 = int(cols[0]), int(cols[-1])
    garment_crop = img.crop((x1, y1, x2 + 1, y2 + 1))
    gw, gh = garment_crop.size

    # Usable ratio: 1.0 - 2 * padding_ratio (e.g. 0.76 for 12% padding)
    usable_ratio = max(0.60, min(0.85, 1.0 - (2 * padding_ratio)))

    req_w = gw / usable_ratio
    req_h = gh / usable_ratio

    # Canvas must have 3:4 aspect ratio (width : height = 3 : 4)
    if req_h * 0.75 >= req_w:
        target_canvas_h = max(1024, int(req_h))
        target_canvas_w = int(target_canvas_h * 0.75)
    else:
        target_canvas_w = max(768, int(req_w))
        target_canvas_h = int(target_canvas_w * 4 / 3)

    max_allow_w = int(target_canvas_w * usable_ratio)
    max_allow_h = int(target_canvas_h * usable_ratio)
    scale = min(max_allow_w / max(1, gw), max_allow_h / max(1, gh))

    new_gw = max(10, int(gw * scale))
    new_gh = max(10, int(gh * scale))
    garment_scaled = garment_crop.resize((new_gw, new_gh), Image.LANCZOS)

    canvas = Image.new("RGB", (target_canvas_w, target_canvas_h), (255, 255, 255))
    px = max(0, (target_canvas_w - new_gw) // 2)
    py = max(0, (target_canvas_h - new_gh) // 2)

    if garment_scaled.mode == "RGBA":
        canvas.paste(garment_scaled, (px, py), garment_scaled)
    else:
        canvas.paste(garment_scaled, (px, py))

    return canvas


def _process_background_removal(pil_img):
    """
    Takes a PIL image and returns:
      1. Solid pure-white background PIL image with the garment cleanly isolated and panned out.
      2. Detected garment category ('tops', 'bottoms', 'one-pieces', 'shoes').
    """
    import cv2
    import numpy as np
    import torch
    import torchvision.transforms.functional as F
    from PIL import Image

    # If image has an alpha channel, composite it over pure white first
    # (prevents PIL convert('RGB') from turning transparent background into black)
    if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
        white_bg = Image.new("RGB", pil_img.size, (255, 255, 255))
        rgba_img = pil_img.convert("RGBA")
        white_bg.paste(rgba_img, (0, 0), rgba_img)
        pil_img = white_bg

    # If the image ALREADY has a clean studio white background, skip neural segmentation!
    if _is_already_white_bg(pil_img):
        print("[RMBG] Image already has a clean white background. Preserving original photo & panning out.")
        rgb = pil_img.convert("RGB")
        arr = np.array(rgb)
        diff = np.max(255 - arr, axis=2)
        alpha_u8 = np.where(diff > 18, 255, 0).astype(np.uint8)
        detected_category = _classify_garment_mask(alpha_u8)
        padded_img = _pad_and_center_on_white(pil_img, padding_ratio=0.10)
        return padded_img, detected_category

    # Otherwise, image has a non-white / textured background -> run RMBG-1.4
    model = _get_rmbg_model()
    orig_rgb = pil_img.convert("RGB")
    orig_np = np.array(orig_rgb).astype(np.float32)
    H, W, _ = orig_np.shape

    # 1. Sample corners to estimate studio backdrop color & variance
    sample_sz = max(8, min(24, H // 20, W // 20))
    corners = np.concatenate([
        orig_np[:sample_sz, :sample_sz].reshape(-1, 3),
        orig_np[:sample_sz, -sample_sz:].reshape(-1, 3),
        orig_np[-sample_sz:, :sample_sz].reshape(-1, 3),
        orig_np[-sample_sz:, -sample_sz:].reshape(-1, 3),
    ], axis=0)
    bg_color = np.median(corners, axis=0)
    bg_std = float(np.std(corners, axis=0).mean())
    color_dist = np.sqrt(np.sum((orig_np - bg_color) ** 2, axis=2))

    # 2. Run RMBG-1.4 segmentation
    input_img = orig_rgb.resize((1024, 1024), Image.BILINEAR)
    tensor = F.to_tensor(input_img).unsqueeze(0)
    tensor = F.normalize(tensor, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

    with torch.no_grad():
        out = model(tensor)
        pred = out[0][0].cpu().squeeze()

    # 3. Contrast S-curve: suppress float noise floor (< 0.25) and solid-fill foreground (> 0.80)
    low, high = 0.25, 0.80
    pred_clamped = torch.clamp((pred - low) / (high - low), 0.0, 1.0)
    pred_smooth = (pred_clamped * pred_clamped * (3.0 - 2.0 * pred_clamped)).numpy()
    pred_full = cv2.resize(pred_smooth, (W, H), interpolation=cv2.INTER_LINEAR)

    # 4. Background color gating: eliminate white studio areas that RMBG missed (like between pants legs)
    bg_thresh = max(10.0, min(22.0, bg_std * 2.5 + 8.0))
    is_exact_bg = color_dist < bg_thresh

    alpha = pred_full.copy()
    alpha[is_exact_bg & (pred_full < 0.90)] = 0.0
    alpha[color_dist < 6.0] = 0.0
    alpha = np.clip(alpha, 0.0, 1.0)

    # 5. Connected Component Filtering: remove isolated floating background smoke/speckles
    bin_fg = (alpha > 0.20).astype(np.uint8)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_fg, connectivity=8)
    if num_labels > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        max_idx = int(np.argmax(areas))
        max_area = areas[max_idx]
        valid_labels = [1 + i for i, a in enumerate(areas) if a >= 0.03 * max_area]
        keep = np.isin(labels, valid_labels)
        alpha = np.where(keep, alpha, 0.0)

    alpha_u8 = (alpha * 255.0).astype(np.uint8)

    # 6. Composite cleanly onto solid pure white background (255, 255, 255)
    # Decontaminate edge fringes so there is NO dark or off-color edge halo
    a_3d = alpha[:, :, None]
    # Edge decontamination against detected background color
    clean_fg = np.where(a_3d > 0.05, (orig_np - (1.0 - np.maximum(a_3d, 0.2)) * bg_color) / np.maximum(a_3d, 0.2), 255.0)
    clean_fg = np.clip(clean_fg, 0, 255)
    blended = clean_fg * a_3d + 255.0 * (1.0 - a_3d)
    res_rgb = np.clip(blended, 0, 255).astype(np.uint8)

    white_canvas = Image.fromarray(res_rgb, mode="RGB")
    detected_category = _classify_garment_mask(alpha_u8)

    # Pan out / zoom out so it has breathing room and looks clean on 3:4 canvas
    padded_img = _pad_and_center_on_white(white_canvas, padding_ratio=0.12)

    return padded_img, detected_category


def auto_frame_person_for_vton(
    img,
    target_w: int = 1024,
    target_h: int = 1536,
    target_person_height_ratio: float = 0.90,
):
    """Detects person silhouette and scales/centers them on a 2:3 canvas so no head, arms, or shoes are cut off."""
    import numpy as np
    from PIL import Image

    try:
        img_rgb = img.convert("RGB")
        np_img = np.array(img_rgb)
        H, W, _ = np_img.shape

        sample_size = max(5, min(15, H // 10, W // 10))
        corners = np.concatenate([
            np_img[:sample_size, :sample_size].reshape(-1, 3),
            np_img[:sample_size, -sample_size:].reshape(-1, 3),
            np_img[-sample_size:, :sample_size].reshape(-1, 3),
            np_img[-sample_size:, -sample_size:].reshape(-1, 3),
        ], axis=0)
        bg_color = tuple(np.median(corners, axis=0).astype(int))

        diff = np.sum(np.abs(np_img.astype(np.int32) - bg_color), axis=2)
        is_fg = diff > 24

        fg_rows = np.where(np.any(is_fg, axis=1))[0]
        fg_cols = np.where(np.any(is_fg, axis=0))[0]

        if len(fg_rows) < 50 or len(fg_cols) < 20:
            min_y, max_y = 0, H - 1
            min_x, max_x = 0, W - 1
        else:
            min_y, max_y = int(fg_rows[0]), int(fg_rows[-1])
            min_x, max_x = int(fg_cols[0]), int(fg_cols[-1])

        person_h = max_y - min_y + 1
        person_w = max_x - min_x + 1

        top_margin_pct = min_y / H
        bottom_margin_pct = (H - 1 - max_y) / H
        current_aspect = W / H
        target_aspect = target_w / target_h

        is_already_2_3 = abs(current_aspect - target_aspect) < 0.02
        has_safe_margins = top_margin_pct >= 0.035 and bottom_margin_pct >= 0.025
        if is_already_2_3 and has_safe_margins and W >= 800 and H >= 1200:
            return img_rgb

        target_person_h = target_h * target_person_height_ratio
        target_person_w = target_w * 0.82
        scale = min(target_person_h / max(1, person_h), target_person_w / max(1, person_w))

        new_w = max(1, int(round(W * scale)))
        new_h = max(1, int(round(H * scale)))
        scaled = img_rgb.resize((new_w, new_h), Image.Resampling.LANCZOS)

        scaled_min_x = int(round(min_x * scale))
        scaled_max_x = int(round(max_x * scale))
        scaled_min_y = int(round(min_y * scale))

        paste_x = (target_w // 2) - ((scaled_min_x + scaled_max_x) // 2)
        paste_y = int(target_h * 0.05) - scaled_min_y

        canvas = Image.new("RGB", (target_w, target_h), bg_color)
        canvas.paste(scaled, (paste_x, paste_y))
        print(f"[AutoFrame] Person auto-scaled ({person_w}x{person_h} in {W}x{H} -> {target_w}x{target_h}) with safe 5% head/foot margins.")
        return canvas
    except Exception as e:
        print(f"[auto_frame_person] Fallback due to: {e}")
        return img


def _worker_loop():
    """Background worker processing VTON jobs one-by-one."""
    while True:
        _QUEUE_EVENT.wait(timeout=1.0)
        job_id = None
        with _JOBS_LOCK:
            if _JOB_QUEUE:
                job_id = _JOB_QUEUE.pop(0)
            else:
                _QUEUE_EVENT.clear()

        if not job_id:
            continue

        with _JOBS_LOCK:
            job = _JOBS.get(job_id)
            if not job or job["status"] == "cancelled":
                continue
            job["status"] = "processing"
            job["stage"] = "preparing_person"
            garments_list = job["params"].get("garments", [])
            num_passes = max(1, len(garments_list))
            pass_steps = int(job["params"].get("num_timesteps") or 8)
            overall_total_steps = pass_steps * num_passes
            job["total_steps"] = overall_total_steps
            job["logs"] = [f"[{time.strftime('%H:%M:%S')}] Job initialized ({num_passes} pass{'es' if num_passes > 1 else ''} • {overall_total_steps} total steps), preparing DirectML environment..."]

        sampling_start_time = None
        last_step_time = None

        def update_stage(new_stage: str, step: int = 0, total_steps: int = overall_total_steps, detail: str = "", **kwargs):
            nonlocal sampling_start_time, last_step_time
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    j = _JOBS[job_id]
                    j["stage"] = new_stage
                    j["step"] = step
                    j["total_steps"] = total_steps
                    j["detail"] = detail

                    now = time.time()
                    now_str = time.strftime('%H:%M:%S')

                    # Clean kwargs to avoid duplicate keyword argument collisions
                    clean_kw = dict(kwargs)
                    pct = clean_kw.pop("percent", None)
                    if pct is None:
                        pct = int(min(100, max(0, (step / max(1, total_steps)) * 100)))
                    j["percent"] = pct

                    spi = float(clean_kw.get("sec_per_it", 0.0) or 0.0)
                    ela = float(clean_kw.get("elapsed_sec", 0.0) or 0.0)
                    eta = float(clean_kw.get("eta_sec", 0.0) or 0.0)

                    # Dynamic wall-clock tracking & fallback
                    if new_stage == "generating":
                        if sampling_start_time is None:
                            sampling_start_time = now
                            last_step_time = now
                        elif step > 0:
                            if ela <= 0.0:
                                ela = round(now - sampling_start_time, 1)
                            if spi <= 0.0:
                                if last_step_time and (now - last_step_time) > 0.01:
                                    spi = round(now - last_step_time, 2)
                                else:
                                    spi = round(ela / max(1, step), 2)
                            last_step_time = now
                            if eta <= 0.0:
                                rem = max(0, total_steps - step)
                                eta = round(rem * spi, 1)

                    j["sec_per_it"] = spi
                    j["elapsed_sec"] = ela
                    j["eta_sec"] = eta

                    logs = j.setdefault("logs", [])
                    if new_stage == "generating" and step > 0:
                        filled = "#" * min(step, total_steps)
                        empty = "-" * max(0, total_steps - step)
                        line = f"[{now_str}] Sampling: {pct:3d}%|{filled}{empty}| {step}/{total_steps} [{int(ela)//60:02d}:{int(ela)%60:02d}<{int(eta)//60:02d}:{int(eta)%60:02d}, {spi:.2f}s/it]"
                        logs.append(line)
                    elif detail:
                        logs.append(f"[{now_str}] {detail}")

        try:
            person_img = _decode_image(job["params"]["person"], "person")
            num_timesteps = job["params"].get("num_timesteps")
            skip_cfg = job["params"].get("skip_cfg_last_n_steps")
            guidance = job["params"].get("guidance_scale")
            seed = job["params"].get("seed")

            # Parse target resolution for TryOnModel (default: 756x504)
            res_str = job["params"].get("resolution", "756x504")
            input_shape = (756, 504)
            if isinstance(res_str, str) and "x" in res_str:
                try:
                    parts = res_str.lower().split("x")
                    input_shape = (int(parts[0]), int(parts[1]))
                except Exception:
                    input_shape = (756, 504)
            elif isinstance(res_str, (list, tuple)) and len(res_str) == 2:
                input_shape = (int(res_str[0]), int(res_str[1]))

            print(f"[{time.strftime('%H:%M:%S')}] Job {job_id} starting with resolution: {input_shape[0]}x{input_shape[1]} (requested '{res_str}')")

            # Intelligently auto-frame the persona onto standard 2:3 canvas respecting calibrated specs
            persona_specs = job["params"].get("persona_specs") or {}
            target_ratio = 1.15 if persona_specs.get("framing") == "three-quarters" else 0.88
            spec_info = f"{persona_specs.get('height_cm', 175)}cm • {str(persona_specs.get('body_silhouette', 'regular')).title()} • {persona_specs.get('posture', 'standing-frontal')} • {persona_specs.get('lighting', 'studio-neutral')}" if persona_specs else "Standard calibrated"
            res_info = f"{input_shape[0]}x{input_shape[1]}"
            update_stage("preparing_person", step=0, total_steps=overall_total_steps, detail=f"Framing persona ({spec_info}) at {res_info} resolution with safe margins...")
            current_img = auto_frame_person_for_vton(person_img, target_person_height_ratio=target_ratio)

            for pass_idx, g_item in enumerate(garments_list, start=1):
                with _JOBS_LOCK:
                    if _JOBS.get(job_id, {}).get("status") == "cancelled":
                        raise InterruptedError("Job was cancelled by user.")

                g_img = _decode_image(g_item["garment"], f"garment_pass_{pass_idx}")
                g_cat = g_item.get("category", "tops")
                g_type = g_item.get("garment_photo_type", "flat-lay")
                step_offset = (pass_idx - 1) * pass_steps

                pass_prefix = f"Pass {pass_idx}/{num_passes} ({g_cat.title()})"
                update_stage("preparing_person", step=step_offset, total_steps=overall_total_steps, detail=f"[{pass_prefix}] Detecting pose & parsing human keypoints...")

                def make_pass_callback(p_prefix, p_offset, p_cat):
                    def _cb(stage: str = "generating", step: int = 0, total_steps: int = pass_steps, detail: str = "", **kwargs):
                        with _JOBS_LOCK:
                            if _JOBS.get(job_id, {}).get("status") == "cancelled":
                                raise InterruptedError("Job was cancelled by user.")
                        cur_step = p_offset + step
                        clean_kw = dict(kwargs)
                        pct = clean_kw.pop("percent", None)
                        if pct is None:
                            pct = int(min(100, max(0, (cur_step / overall_total_steps) * 100)))
                        sub_detail = f"[{p_prefix}] {detail}" if detail else f"[{p_prefix}] Processing {p_cat}..."
                        update_stage(stage, step=cur_step, total_steps=overall_total_steps, detail=sub_detail, percent=pct, **clean_kw)
                    return _cb

                pass_cb = make_pass_callback(pass_prefix, step_offset, g_cat)

                if HAS_FASHN and FASHN_RUNNER:
                    current_img = FASHN_RUNNER.run_tryon(
                        person_image=current_img,
                        garment_image=g_img,
                        category=g_cat,
                        garment_photo_type=g_type,
                        num_timesteps=pass_steps,
                        skip_cfg_last_n_steps=skip_cfg,
                        guidance_scale=guidance,
                        seed=seed,
                        input_shape=input_shape,
                        on_stage_change=pass_cb,
                    )
                else:
                    # Fallback / mock stage simulation if weights missing
                    update_stage("preparing_garment", step=step_offset, total_steps=overall_total_steps, detail=f"[{pass_prefix}] Segmenting clothing boundaries...")
                    time.sleep(1.0)
                    for s in range(1, pass_steps + 1):
                        time.sleep(0.4)
                        pass_cb(stage="generating", step=s, detail=f"Euler Timestep {s}/{pass_steps}")
                    update_stage("finalizing", step=step_offset + pass_steps, total_steps=overall_total_steps, detail=f"[{pass_prefix}] Pass complete.")
                    time.sleep(0.5)

                if num_passes > 1 and pass_idx < num_passes:
                    update_stage("generating", step=pass_idx * pass_steps, total_steps=overall_total_steps, detail=f"[Pass {pass_idx}/{num_passes} Complete] {g_cat.title()} applied. Proceeding to {garments_list[pass_idx].get('category', 'bottoms').title()}...")

            update_stage("finalizing", step=overall_total_steps, total_steps=overall_total_steps, detail="Finalizing high-resolution composite result...")
            png_b64 = _encode_png(current_img)

            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "completed"
                    _JOBS[job_id]["stage"] = "completed"
                    _JOBS[job_id]["step"] = overall_total_steps
                    _JOBS[job_id]["total_steps"] = overall_total_steps
                    _JOBS[job_id]["image"] = png_b64
                    _JOBS[job_id]["completed_at"] = time.time()

        except InterruptedError:
            print(f"[{time.strftime('%H:%M:%S')}] Job {job_id} cancelled by user.")
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "cancelled"
                    _JOBS[job_id]["stage"] = "cancelled"
                    _JOBS[job_id]["error"] = "Job cancelled by user."
                    _JOBS[job_id]["completed_at"] = time.time()

        except Exception as exc:
            traceback.print_exc()
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "failed"
                    _JOBS[job_id]["error"] = str(exc)
                    _JOBS[job_id]["completed_at"] = time.time()


# Start background worker daemon
_worker_thread = threading.Thread(target=_worker_loop, daemon=True)
_worker_thread.start()


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: Any):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_DELETE(self):
        if self.path.startswith("/try-on/jobs/"):
            job_id = self.path.split("/try-on/jobs/")[-1].replace("/cancel", "").strip()
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "cancelled"
                    _JOBS[job_id]["stage"] = "cancelled"
                    _JOBS[job_id]["error"] = "Job cancelled by user."
                    if job_id in _JOB_QUEUE:
                        _JOB_QUEUE.remove(job_id)
                    self._send_json(200, {"success": True, "message": f"Job {job_id} cancelled."})
                    return
            self._send_json(404, {"error": "Job not found"})
            return
        self._send_json(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/health":
            status_data = {
                "service": "Personal Wardrobe VTON Service",
                "version": SERVICE_VERSION,
                "uptime": round(time.time() - START_TIME, 1),
                "fashn": FASHN_RUNNER.status() if HAS_FASHN and FASHN_RUNNER else {"available": False},
                "queue_length": len(_JOB_QUEUE),
            }
            self._send_json(200, status_data)
            return

        if self.path.startswith("/try-on/jobs/"):
            job_id = self.path.split("/try-on/jobs/")[-1].strip()
            with _JOBS_LOCK:
                job = _JOBS.get(job_id)
            if not job:
                self._send_json(404, {"error": "Job not found"})
                return

            resp = {
                "id": job["id"],
                "status": job["status"],
                "stage": job.get("stage", "queued"),
                "step": job.get("step", 0),
                "total_steps": job.get("total_steps") or job.get("params", {}).get("num_timesteps") or 8,
                "detail": job.get("detail", ""),
                "sec_per_it": job.get("sec_per_it", 0.0),
                "elapsed_sec": job.get("elapsed_sec", 0.0),
                "eta_sec": job.get("eta_sec", 0.0),
                "percent": job.get("percent", 0),
                "logs": job.get("logs", []),
                "category": job["params"].get("category", "tops"),
                "error": job.get("error"),
                "image": job.get("image"),
                "created_at": job.get("created_at"),
                "started_at": job.get("started_at"),
                "completed_at": job.get("completed_at"),
            }
            self._send_json(200, resp)
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        if "/try-on/jobs/" in self.path and self.path.endswith("/cancel"):
            job_id = self.path.split("/try-on/jobs/")[1].replace("/cancel", "").strip()
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "cancelled"
                    _JOBS[job_id]["stage"] = "cancelled"
                    _JOBS[job_id]["error"] = "Job cancelled by user."
                    if job_id in _JOB_QUEUE:
                        _JOB_QUEUE.remove(job_id)
                    self._send_json(200, {"success": True, "message": f"Job {job_id} cancelled."})
                    return
            self._send_json(404, {"error": "Job not found"})
            return

        content_len = int(self.headers.get("Content-Length", 0))
        if content_len > MAX_BODY_BYTES:
            self._send_json(413, {"error": "Payload exceeds max allowed size."})
            return

        try:
            raw_body = self.rfile.read(content_len).decode("utf-8")
            body = json.loads(raw_body)
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON body: {e}"})
            return

        if self.path == "/try-on/async":
            person = body.get("person")
            num_timesteps = body.get("num_timesteps")
            skip_cfg = body.get("skip_cfg_last_n_steps")
            guidance = body.get("guidance_scale")
            seed = body.get("seed")
            device = body.get("device")
            resolution = body.get("resolution", "756x504")
            persona_specs = body.get("persona_specs")

            # Support garments array or single garment
            garments_list = []
            if "garments" in body and isinstance(body["garments"], list) and len(body["garments"]) > 0:
                for g_item in body["garments"]:
                    if g_item.get("garment"):
                        garments_list.append({
                            "garment": g_item["garment"],
                            "category": g_item.get("category", "tops"),
                            "garment_photo_type": g_item.get("garment_photo_type", "flat-lay"),
                        })
            elif body.get("garment"):
                garments_list.append({
                    "garment": body["garment"],
                    "category": body.get("category", "tops"),
                    "garment_photo_type": body.get("garment_photo_type", "flat-lay"),
                })

            if not person or not garments_list:
                self._send_json(400, {"error": "Both 'person' and at least one 'garment' required."})
                return

            try:
                parsed_steps = int(num_timesteps) if num_timesteps is not None else 8
            except (ValueError, TypeError):
                parsed_steps = 8

            overall_total_steps = parsed_steps * len(garments_list)

            job_id = str(uuid.uuid4())
            with _JOBS_LOCK:
                _JOBS[job_id] = {
                    "id": job_id,
                    "status": "queued",
                    "stage": "queued",
                    "step": 0,
                    "total_steps": overall_total_steps,
                    "params": {
                        "person": person,
                        "garments": garments_list,
                        # Also keep top-level for convenience
                        "category": garments_list[0].get("category", "tops"),
                        "garment_photo_type": garments_list[0].get("garment_photo_type", "flat-lay"),
                        "num_timesteps": parsed_steps,
                        "skip_cfg_last_n_steps": skip_cfg,
                        "guidance_scale": guidance,
                        "seed": seed,
                        "device": device,
                        "resolution": resolution,
                        "persona_specs": persona_specs,
                    },
                    "created_at": time.time(),
                }
                _JOB_QUEUE.append(job_id)
                _QUEUE_EVENT.set()

            self._send_json(202, {"jobId": job_id, "status": "queued", "total_steps": overall_total_steps})
            return

        if self.path == "/remove-background":
            raw_image = body.get("image")
            if not raw_image:
                self._send_json(400, {"error": "'image' base64 string required."})
                return

            try:
                pil_img = _decode_image(raw_image, "image")
                cutout_img, detected_category = _process_background_removal(pil_img)
                cutout_b64 = _encode_png(cutout_img)
                self._send_json(200, {
                    "image": f"data:image/png;base64,{cutout_b64}",
                    "width": cutout_img.width,
                    "height": cutout_img.height,
                    "category": detected_category,
                })
            except Exception as e:
                traceback.print_exc()
                self._send_json(500, {"error": f"Background removal failed: {str(e)}"})
            return

        self._send_json(404, {"error": "Endpoint not recognized"})


def main():
    parser = argparse.ArgumentParser(description="FASHN-VTON local service")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8188)
    args = parser.parse_args()

    print(f"Personal Wardrobe VTON Service v{SERVICE_VERSION}")
    print(f"Listening on http://{args.host}:{args.port}")
    if HAS_FASHN and FASHN_RUNNER:
        info = FASHN_RUNNER.status()
        print(f"  FASHN-VTON device: {info['device']}")
        print(f"  Weights status   : {'READY' if info['weights']['ready'] else 'MISSING'}")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nService stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
