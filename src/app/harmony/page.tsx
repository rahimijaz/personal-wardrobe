"use client";

import Link from "next/link";
import { Palette, Sparkles, Compass, Shirt } from "lucide-react";
import { ColorWheelExplorer } from "@/components/color-wheel-explorer";

export default function HarmonyPage() {
  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-7xl mx-auto w-full page-enter space-y-6">
      {/* Breadcrumb Navigation & Intro */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-ink-soft uppercase tracking-wider mb-1">
          <Link href="/" className="hover:text-ink transition-colors">
            Studio
          </Link>
          <span>/</span>
          <span className="text-ink font-semibold">Color Harmony Studio</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Color Harmony &amp; Styling Studio
        </h1>
        <p className="text-sm text-ink-soft mt-1 max-w-2xl">
          Pick a piece you want to wear, choose a styling mood, and let color theory instantly find your most flattering outfit combinations.
        </p>
      </div>

      {/* Main Interactive Studio Canvas */}
      <ColorWheelExplorer />
    </div>
  );
}
