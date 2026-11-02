#!/usr/bin/env python3
"""Basic inference example."""

import argparse
import sys
from pathlib import Path

from PIL import Image

from fashn_vton import TryOnPipeline


def main():
    parser = argparse.ArgumentParser(
        description="FASHN VTON v1.5",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example:
    python examples/basic_inference.py \\
        --weights-dir ./weights \\
        --person-image examples/data/model.webp \\
        --garment-image examples/data/garment.webp \\
        --category tops
        """,
    )
    parser.add_argument("--weights-dir", type=str, default="./weights", help="Directory containing model weights (default: ./weights)")
    parser.add_argument("--person-image", type=str, default="./examples/data/model.png", help="Path to person image (default: ./examples/data/model.png)")
    parser.add_argument("--garment-image", type=str, default="./examples/data/garment.webp", help="Path to garment image (default: ./examples/data/garment.webp)")
    parser.add_argument(
        "--category",
        type=str,
        choices=["tops", "bottoms", "one-pieces"],
        default="tops",
        help="Garment category to try on (default: tops)",
    )
    parser.add_argument(
        "--garment-photo-type",
        type=str,
        choices=["model", "flat-lay"],
        default="flat-lay",
        help="'model' if worn by person, 'flat-lay' for product shots (default: flat-lay)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./outputs",
        help="Output directory (default: ./outputs)",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=1,
        help="Number of output images to generate (1-4, default: 1)",
    )
    parser.add_argument(
        "--num-timesteps",
        type=int,
        default=8,
        help="Diffusion steps (default: 8)",
    )
    parser.add_argument(
        "--skip-cfg-last-n-steps",
        type=int,
        default=5,
        help="Skip CFG for the final N diffusion steps (default: 5)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility (default: 42)")
    parser.add_argument("--guidance-scale", type=float, default=2.0, help="Classifier-free guidance strength (default: 2.0)")
    parser.add_argument(
        "--no-segmentation-free",
        action="store_false",
        dest="segmentation_free",
        default=True,
        help="Disable segmentation-free mode. Default (enabled) preserves body features and allows unconstrained garment volume",
    )
    parser.add_argument("--device", type=str, default="directml", help="Device to use (directml/cuda/cpu, default: directml)")
    args = parser.parse_args()

    # Validate inputs exist
    person_path = Path(args.person_image)
    garment_path = Path(args.garment_image)
    weights_path = Path(args.weights_dir)

    if not person_path.exists():
        print(f"Error: Person image not found: {person_path}")
        sys.exit(1)
    if not garment_path.exists():
        print(f"Error: Garment image not found: {garment_path}")
        sys.exit(1)
    if not weights_path.exists():
        print(f"Error: Weights directory not found: {weights_path}")
        print(f"Run: python scripts/download_weights.py --weights-dir {args.weights_dir}")
        sys.exit(1)

    # Load images
    print("Loading images...")
    person_image = Image.open(args.person_image).convert("RGB")
    garment_image = Image.open(args.garment_image).convert("RGB")

    # Create pipeline (loads all models internally)
    print(f"Loading pipeline from {args.weights_dir}...")
    pipeline = TryOnPipeline(weights_dir=args.weights_dir, device=args.device)

    # Run inference
    result = pipeline(
        person_image=person_image,
        garment_image=garment_image,
        category=args.category,
        garment_photo_type=args.garment_photo_type,
        num_samples=args.num_samples,
        num_timesteps=args.num_timesteps,
        guidance_scale=args.guidance_scale,
        seed=args.seed,
        segmentation_free=args.segmentation_free,
        skip_cfg_last_n_steps=args.skip_cfg_last_n_steps,
    )

    # Save outputs
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for i, output_image in enumerate(result.images):
        output_path = output_dir / f"output_{i:02d}.png"
        output_image.save(output_path)
        print(f"Saved: {output_path}")

    print(f"\nDone! Generated {len(result.images)} images.")


if __name__ == "__main__":
    main()
