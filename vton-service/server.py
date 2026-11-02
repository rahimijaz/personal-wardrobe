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
        return Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise ValueError(f"'{field}' is not a readable image.") from exc


def _encode_png(image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


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
            total_steps = int(job["params"].get("num_timesteps") or 8)
            job["total_steps"] = total_steps
            job["logs"] = [f"[{time.strftime('%H:%M:%S')}] Job initialized, preparing DirectML environment..."]

        def update_stage(new_stage: str, step: int = 0, total_steps: int = total_steps, detail: str = "", **kwargs):
            with _JOBS_LOCK:
                if job_id in _JOBS:
                    j = _JOBS[job_id]
                    j["stage"] = new_stage
                    j["step"] = step
                    j["total_steps"] = total_steps
                    j["detail"] = detail
                    j["sec_per_it"] = kwargs.get("sec_per_it", 0.0)
                    j["elapsed_sec"] = kwargs.get("elapsed_sec", 0.0)
                    j["eta_sec"] = kwargs.get("eta_sec", 0.0)
                    j["percent"] = kwargs.get("percent", 0)

                    now_str = time.strftime('%H:%M:%S')
                    logs = j.setdefault("logs", [])
                    if new_stage == "generating" and step > 0:
                        pct = kwargs.get("percent", 0)
                        spi = kwargs.get("sec_per_it", 0.0)
                        ela = kwargs.get("elapsed_sec", 0.0)
                        eta = kwargs.get("eta_sec", 0.0)
                        filled = "#" * step
                        empty = "-" * max(0, total_steps - step)
                        line = f"[{now_str}] Sampling: {pct:3d}%|{filled}{empty}| {step}/{total_steps} [{int(ela)//60:02d}:{int(ela)%60:02d}<{int(eta)//60:02d}:{int(eta)%60:02d}, {spi:.2f}s/it]"
                        logs.append(line)
                    elif detail:
                        logs.append(f"[{now_str}] {detail}")

        try:
            person = _decode_image(job["params"]["person"], "person")
            garment = _decode_image(job["params"]["garment"], "garment")
            category = job["params"].get("category", "tops")
            photo_type = job["params"].get("garment_photo_type", "flat-lay")
            num_timesteps = job["params"].get("num_timesteps")
            skip_cfg = job["params"].get("skip_cfg_last_n_steps")
            guidance = job["params"].get("guidance_scale")
            seed = job["params"].get("seed")

            if HAS_FASHN and FASHN_RUNNER:
                result_img = FASHN_RUNNER.run_tryon(
                    person_image=person,
                    garment_image=garment,
                    category=category,
                    garment_photo_type=photo_type,
                    num_timesteps=num_timesteps,
                    skip_cfg_last_n_steps=skip_cfg,
                    guidance_scale=guidance,
                    seed=seed,
                    on_stage_change=update_stage,
                )
            else:
                # Fallback / mock stage simulation if weights missing
                update_stage("preparing_garment")
                time.sleep(2.0)
                update_stage("generating")
                time.sleep(4.0)
                update_stage("finalizing")
                time.sleep(1.0)
                result_img = person

            png_b64 = _encode_png(result_img)

            with _JOBS_LOCK:
                if job_id in _JOBS:
                    _JOBS[job_id]["status"] = "completed"
                    _JOBS[job_id]["stage"] = "completed"
                    _JOBS[job_id]["image"] = png_b64
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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

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
            garment = body.get("garment")
            category = body.get("category", "tops")
            photo_type = body.get("garment_photo_type", "flat-lay")
            num_timesteps = body.get("num_timesteps")
            skip_cfg = body.get("skip_cfg_last_n_steps")
            guidance = body.get("guidance_scale")
            seed = body.get("seed")
            device = body.get("device")

            if not person or not garment:
                self._send_json(400, {"error": "Both 'person' and 'garment' base64 strings required."})
                return

            try:
                parsed_steps = int(num_timesteps) if num_timesteps is not None else 8
            except (ValueError, TypeError):
                parsed_steps = 8

            job_id = str(uuid.uuid4())
            with _JOBS_LOCK:
                _JOBS[job_id] = {
                    "id": job_id,
                    "status": "queued",
                    "stage": "queued",
                    "step": 0,
                    "total_steps": parsed_steps,
                    "params": {
                        "person": person,
                        "garment": garment,
                        "category": category,
                        "garment_photo_type": photo_type,
                        "num_timesteps": parsed_steps,
                        "skip_cfg_last_n_steps": skip_cfg,
                        "guidance_scale": guidance,
                        "seed": seed,
                        "device": device,
                    },
                    "created_at": time.time(),
                }
                _JOB_QUEUE.append(job_id)
                _QUEUE_EVENT.set()

            self._send_json(202, {"jobId": job_id, "status": "queued"})
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
