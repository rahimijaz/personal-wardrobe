"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toPng, toBlob } from "html-to-image";
import {
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Palette,
  X,
  Layers,
  Sliders,
  TrendingUp,
  Shirt,
  Calendar,
  Compass,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";
import type { Outfit, Garment } from "@/lib/types";
import { scorePair, safeHex, type RecommendedFit } from "@/lib/recommendations";
import { nearestColorName } from "@/lib/colors";

export type LookbookTheme = "noir" | "alabaster" | "terracotta";
export type LookbookRatio = "4:5" | "9:16" | "1:1";

// Helper for generating fun aesthetic badges & style quotes
function getFunVibe(relation?: string, score?: number) {
  if (!relation) {
    return {
      badge: "🔥 10/10 FIT CHECK",
      tagline: "Effortless confidence & timeless everyday style.",
    };
  }
  const r = relation.toLowerCase();
  if (r.includes("monochrome") || r.includes("neutral")) {
    return {
      badge: "⚡ MINIMALIST MOOD",
      tagline: "Understated luxury. Clean tonal harmony & dialed proportions.",
    };
  }
  if (r.includes("analogous") || r.includes("harmonious")) {
    return {
      badge: "✨ SMOOTH PALETTE",
      tagline: "Effortless synergy. Colors flow naturally across the silhouette.",
    };
  }
  if (r.includes("complementary") || r.includes("contrast")) {
    return {
      badge: "💥 BOLD CONTRAST",
      tagline: "High-energy styling with striking, intentional balance.",
    };
  }
  if (score && score >= 90) {
    return {
      badge: "🔥 CERTIFIED DRIP",
      tagline: "Impeccable balance. Every piece hits the exact right frequency.",
    };
  }
  return {
    badge: "✨ TODAY'S FIT",
    tagline: "Curated ensemble with distinct personal character.",
  };
}

interface LookbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfit: Outfit | null;
}

export function LookbookModal({ isOpen, onClose, outfit }: LookbookModalProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<LookbookTheme>("noir");
  const [ratio, setRatio] = useState<LookbookRatio>("4:5");
  const [customTitle, setCustomTitle] = useState("");
  const [showGarments, setShowGarments] = useState(true);
  const [showHarmony, setShowHarmony] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mount guard for React Portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent background page from scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Initialize custom title whenever outfit changes
  useEffect(() => {
    if (outfit) {
      setCustomTitle(outfit.name);
    }
  }, [outfit]);

  // Derive top, bottom, and pair recommendation metrics
  const garments = outfit?.garments || [];
  const topGarment = garments.find((g) => g.category === "tops" || g.category === "one-pieces");
  const bottomGarment = garments.find((g) => g.category === "bottoms");

  const pairAnalysis: RecommendedFit | null =
    topGarment && bottomGarment
      ? scorePair(topGarment, bottomGarment)
      : null;

  // Extract color swatches
  const colorSwatches = garments.map((g) => ({
    name: g.name,
    category: g.category,
    colorName: g.color || nearestColorName(safeHex(g.colorHex, g.name)),
    hex: safeHex(g.colorHex, g.name),
    image: g.image,
  }));

  const scoreVal = pairAnalysis ? pairAnalysis.score : 95;
  const displayGarments = garments.slice(0, 2);
  const dateStr = outfit
    ? new Date(outfit.createdAt)
        .toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    : "";

  const paletteColors =
    pairAnalysis?.palette && pairAnalysis.palette.length > 0
      ? pairAnalysis.palette
      : colorSwatches.map((c) => c.hex);
  const uniqueColors = Array.from(new Set(paletteColors)).slice(0, 4);

  // Helper to load HTML Image
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback or retry without crossOrigin if local
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = reject;
        fallbackImg.src = src;
      };
      img.src = src;
    });
  };

  // Helper for drawing rounded rectangle on canvas
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Canvas drawing routine
  const renderCanvas = useCallback(async () => {
    if (!outfit || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Dimensions based on ratio
    let W = 1080;
    let H = 1350; // default 4:5
    if (ratio === "9:16") {
      H = 1920;
    } else if (ratio === "1:1") {
      H = 1080;
    }

    canvas.width = W;
    canvas.height = H;

    // Theme Color Palettes
    const colors =
      theme === "noir"
        ? {
            bg: "#0c0b09",
            bgAlt: "#151310",
            cardBg: "#1a1815",
            border: "#2b2722",
            textPrimary: "#f5f2eb",
            textSecondary: "#a8a296",
            accent: "#ff5b36",
            accentBg: "rgba(255, 91, 54, 0.15)",
            badgeBg: "#23201c",
            pillBorder: "rgba(255, 255, 255, 0.1)",
          }
        : theme === "alabaster"
        ? {
            bg: "#faf8f5",
            bgAlt: "#f2eee7",
            cardBg: "#ffffff",
            border: "#e5ded4",
            textPrimary: "#17140e",
            textSecondary: "#6e675c",
            accent: "#d44524",
            accentBg: "rgba(212, 69, 36, 0.12)",
            badgeBg: "#eee9e0",
            pillBorder: "rgba(0, 0, 0, 0.1)",
          }
        : {
            bg: "#181210",
            bgAlt: "#221915",
            cardBg: "#2a1e19",
            border: "#422e25",
            textPrimary: "#fceee9",
            textSecondary: "#c4a89e",
            accent: "#ff6a42",
            accentBg: "rgba(255, 106, 66, 0.2)",
            badgeBg: "#33241e",
            pillBorder: "rgba(255, 106, 66, 0.2)",
          };

    // 1. Draw Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, colors.bg);
    bgGrad.addColorStop(1, colors.bgAlt);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative outer stroke
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 24, 24, W - 48, H - 48, 28);
    ctx.stroke();

    // 2. Header Bar: Minimal Luxury Typography
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.textPrimary;
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("WARDROBE STUDIO", 60, 56);

    const dateStr = new Date(outfit.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
    ctx.textAlign = "right";
    ctx.fillStyle = colors.textSecondary;
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(dateStr, W - 60, 58);
    ctx.textAlign = "left";

    // Header dividing line
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 92);
    ctx.lineTo(W - 60, 92);
    ctx.stroke();

    // Helper: Safely draw line-wrapped text top-down without ascender/descender overlap
    const drawTextLines = (
      text: string,
      x: number,
      startY: number,
      maxW: number,
      lineH: number,
      maxLines = 2
    ): number => {
      ctx.textBaseline = "top";
      const words = text.split(" ");
      let line = "";
      let curY = startY;
      let count = 0;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxW && n > 0) {
          if (count === maxLines - 1) {
            ctx.fillText(line.trim() + "...", x, curY);
            return curY + lineH;
          }
          ctx.fillText(line.trim(), x, curY);
          line = words[n] + " ";
          curY += lineH;
          count++;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), x, curY);
      return curY + lineH;
    };

    // Helper: Draw image contained within a box preserving exact aspect ratio (no vertical squashing!)
    const drawContainedImage = (
      img: HTMLImageElement,
      boxX: number,
      boxY: number,
      boxW: number,
      boxH: number,
      radius = 20
    ) => {
      const naturalW = img.naturalWidth || img.width || 1;
      const naturalH = img.naturalHeight || img.height || 1;
      const imgAspect = naturalW / naturalH;
      const boxAspect = boxW / boxH;

      let drawW = boxW;
      let drawH = boxH;
      let drawX = boxX;
      let drawY = boxY;

      if (imgAspect < boxAspect) {
        drawH = boxH;
        drawW = boxH * imgAspect;
        drawX = boxX + (boxW - drawW) / 2;
        drawY = boxY;
      } else {
        drawW = boxW;
        drawH = boxW / imgAspect;
        drawX = boxX;
        drawY = boxY + (boxH - drawH) / 2;
      }

      ctx.save();
      roundRect(ctx, boxX, boxY, boxW, boxH, radius);
      ctx.clip();
      ctx.fillStyle = colors.cardBg;
      ctx.fill();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      roundRect(ctx, boxX, boxY, boxW, boxH, radius);
      ctx.stroke();
    };

    const displayGarments = garments.slice(0, 2);

    // 3. Load and Draw Main Try-On Image
    try {
      const modelImg = await loadImage(outfit.resultImage);

      if (ratio === "4:5") {
        // ==========================================
        // 4:5 PORTRAIT LAYOUT (1080 x 1350)
        // ==========================================
        const imgX = 60;
        const imgY = 120;
        const imgW = 520;
        const imgH = 790;

        drawContainedImage(modelImg, imgX, imgY, imgW, imgH, 20);

        // Right Column: Details & Garments
        const colX = 615;
        const colW = 405;
        let curY = 125;

        // Editorial Tag
        ctx.fillStyle = colors.accent;
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("CURATED OOTD", colX, curY);
        curY += 28;

        // Headline / Title
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 40px 'Playfair Display', Georgia, serif";
        curY = drawTextLines(customTitle || outfit.name, colX, curY, colW, 48, 2) + 8;

        // Model Subtitle
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "19px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`Styled on ${outfit.person?.name || "Studio Model"}`, colX, curY);
        curY += 34;

        // Hairline Divider
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX, curY);
        ctx.lineTo(colX + colW, curY);
        ctx.stroke();
        curY += 24;

        // Max 2 Clothes Items
        if (showGarments && displayGarments.length > 0) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText("PIECES", colX, curY);
          curY += 22;

          for (const g of displayGarments) {
            ctx.fillStyle = colors.cardBg;
            roundRect(ctx, colX, curY, colW, 88, 16);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Thumbnail
            try {
              const gImg = await loadImage(g.image);
              ctx.save();
              roundRect(ctx, colX + 10, curY + 10, 68, 68, 10);
              ctx.clip();
              ctx.fillStyle = colors.badgeBg;
              ctx.fill();
              ctx.drawImage(gImg, colX + 10, curY + 10, 68, 68);
              ctx.restore();
              ctx.strokeStyle = colors.border;
              ctx.lineWidth = 1;
              roundRect(ctx, colX + 10, curY + 10, 68, 68, 10);
              ctx.stroke();
            } catch {}

            // Garment name
            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
            const truncName = g.name.length > 18 ? g.name.slice(0, 16) + "..." : g.name;
            ctx.fillText(truncName, colX + 90, curY + 22);

            // Category tag
            ctx.fillStyle = colors.textSecondary;
            ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillText(g.category.toUpperCase(), colX + 90, curY + 48);

            // Dominant color swatch
            const gHex = safeHex(g.colorHex, g.name);
            ctx.fillStyle = gHex;
            ctx.beginPath();
            ctx.arc(colX + colW - 30, curY + 44, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            curY += 100;
          }
        }

        // Bottom Row (Y = 940 to 1220) - Perfectly Balanced Symmetry
        // Left Card: Color Palette Profile (520 x 280)
        const palCardX = 60;
        const palCardY = 940;
        const palCardW = 520;
        const palCardH = 280;

        ctx.fillStyle = colors.cardBg;
        roundRect(ctx, palCardX, palCardY, palCardW, palCardH, 18);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = colors.textSecondary;
        ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("COLOR PALETTE PROFILE", palCardX + 24, palCardY + 24);

        if (showHarmony) {
          const paletteColors =
            pairAnalysis?.palette && pairAnalysis.palette.length > 0
              ? pairAnalysis.palette
              : colorSwatches.map((c) => c.hex);
          const uniqueColors = Array.from(new Set(paletteColors)).slice(0, 4);
          const colStep = (palCardW - 48) / Math.max(1, uniqueColors.length);

          uniqueColors.forEach((hex, idx) => {
            const cx = palCardX + 24 + idx * colStep + 28;
            const cy = palCardY + 110;

            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.arc(cx, cy, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 2;
            ctx.stroke();

            const cName = nearestColorName(hex);
            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(cName, cx, cy + 34);

            ctx.fillStyle = colors.textSecondary;
            ctx.font = "12px monospace";
            ctx.fillText(hex.toUpperCase(), cx, cy + 54);
            ctx.textAlign = "left";
          });
        }

        // Right Card: Clean Style Harmony (405 x 280)
        const harmCardX = 615;
        const harmCardY = 940;
        const harmCardW = 405;
        const harmCardH = 280;

        ctx.fillStyle = colors.cardBg;
        roundRect(ctx, harmCardX, harmCardY, harmCardW, harmCardH, 18);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = colors.textSecondary;
        ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("STYLE HARMONY", harmCardX + 24, harmCardY + 24);

        const scoreVal = pairAnalysis ? pairAnalysis.score : 95;
        ctx.fillStyle = colors.accent;
        ctx.font = "bold 54px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`${scoreVal}%`, harmCardX + 24, harmCardY + 68);

        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(pairAnalysis?.relation || "Complementary Match", harmCardX + 24, harmCardY + 150);

        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("Verified Wardrobe Palette", harmCardX + 24, harmCardY + 180);

        // Footer
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WARDROBE STUDIO  •  OOTD ARCHIVE", W / 2, 1295);
        ctx.textAlign = "left";
      } else if (ratio === "9:16") {
        // ==========================================
        // 9:16 STORY LAYOUT (1080 x 1920) - Ultra Minimalist
        // ==========================================
        const imgX = 70;
        const imgY = 120;
        const imgW = 940;
        const imgH = 1380;

        drawContainedImage(modelImg, imgX, imgY, imgW, imgH, 24);

        // Content Below Photo
        let curY = 1530;

        // Headline / Title
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 44px 'Playfair Display', Georgia, serif";
        curY = drawTextLines(customTitle || outfit.name, 70, curY, 940, 50, 1) + 6;

        // Subtitle + Palette Row
        const scoreVal = pairAnalysis ? pairAnalysis.score : 95;
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "19px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(
          `Styled on ${outfit.person?.name || "Studio Model"}  •  ${scoreVal}% Harmony`,
          70,
          curY
        );

        // 4 Clean Circular Color Swatches Aligned to the Right
        if (showHarmony) {
          const paletteColors =
            pairAnalysis?.palette && pairAnalysis.palette.length > 0
              ? pairAnalysis.palette
              : colorSwatches.map((c) => c.hex);
          const uniqueColors = Array.from(new Set(paletteColors)).slice(0, 4);

          let palX = 1010 - uniqueColors.length * 36;
          uniqueColors.forEach((hex) => {
            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.arc(palX + 12, curY + 10, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            palX += 36;
          });
        }
        curY += 38;

        // Hairline Divider
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(70, curY);
        ctx.lineTo(1010, curY);
        ctx.stroke();
        curY += 28;

        // Garments (Max 2 pieces side-by-side)
        if (showGarments && displayGarments.length > 0) {
          const cardW = displayGarments.length === 1 ? 940 : 455;
          const cardH = 88;

          for (let i = 0; i < displayGarments.length; i++) {
            const g = displayGarments[i];
            const gx = 70 + i * (cardW + 30);

            ctx.fillStyle = colors.cardBg;
            roundRect(ctx, gx, curY, cardW, cardH, 16);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            try {
              const gImg = await loadImage(g.image);
              ctx.save();
              roundRect(ctx, gx + 10, curY + 10, 68, 68, 10);
              ctx.clip();
              ctx.fillStyle = colors.badgeBg;
              ctx.fill();
              ctx.drawImage(gImg, gx + 10, curY + 10, 68, 68);
              ctx.restore();
              ctx.strokeStyle = colors.border;
              ctx.lineWidth = 1;
              roundRect(ctx, gx + 10, curY + 10, 68, 68, 10);
              ctx.stroke();
            } catch {}

            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
            const truncName = g.name.length > 18 ? g.name.slice(0, 16) + "..." : g.name;
            ctx.fillText(truncName, gx + 90, curY + 22);

            ctx.fillStyle = colors.textSecondary;
            ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillText(g.category.toUpperCase(), gx + 90, curY + 48);

            const gHex = safeHex(g.colorHex, g.name);
            ctx.fillStyle = gHex;
            ctx.beginPath();
            ctx.arc(gx + cardW - 30, curY + 44, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Footer
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WARDROBE STUDIO  •  STORY ARCHIVE", W / 2, 1870);
        ctx.textAlign = "left";
      } else {
        // ==========================================
        // 1:1 SQUARE LAYOUT (1080 x 1080)
        // ==========================================
        const imgX = 60;
        const imgY = 120;
        const imgW = 510;
        const imgH = 840;

        drawContainedImage(modelImg, imgX, imgY, imgW, imgH, 20);

        // Right Column: Details & Garments
        const colX = 610;
        const colW = 410;
        let curY = 135;

        // Editorial Tag
        ctx.fillStyle = colors.accent;
        ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("CURATED OOTD", colX, curY);
        curY += 28;

        // Headline / Title
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 38px 'Playfair Display', Georgia, serif";
        curY = drawTextLines(customTitle || outfit.name, colX, curY, colW, 46, 2) + 8;

        // Model Subtitle
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "19px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(`Styled on ${outfit.person?.name || "Studio Model"}`, colX, curY);
        curY += 34;

        // Hairline Divider
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX, curY);
        ctx.lineTo(colX + colW, curY);
        ctx.stroke();
        curY += 26;

        // Garments (Max 2 pieces)
        if (showGarments && displayGarments.length > 0) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText("PIECES", colX, curY);
          curY += 22;

          for (const g of displayGarments) {
            ctx.fillStyle = colors.cardBg;
            roundRect(ctx, colX, curY, colW, 84, 16);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            try {
              const gImg = await loadImage(g.image);
              ctx.save();
              roundRect(ctx, colX + 10, curY + 10, 64, 64, 10);
              ctx.clip();
              ctx.fillStyle = colors.badgeBg;
              ctx.fill();
              ctx.drawImage(gImg, colX + 10, curY + 10, 64, 64);
              ctx.restore();
              ctx.strokeStyle = colors.border;
              ctx.lineWidth = 1;
              roundRect(ctx, colX + 10, curY + 10, 64, 64, 10);
              ctx.stroke();
            } catch {}

            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, sans-serif";
            const truncName = g.name.length > 18 ? g.name.slice(0, 16) + "..." : g.name;
            ctx.fillText(truncName, colX + 88, curY + 20);

            ctx.fillStyle = colors.textSecondary;
            ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
            ctx.fillText(g.category.toUpperCase(), colX + 88, curY + 46);

            const gHex = safeHex(g.colorHex, g.name);
            ctx.fillStyle = gHex;
            ctx.beginPath();
            ctx.arc(colX + colW - 30, curY + 42, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            curY += 96;
          }
          curY += 8;
        }

        // Minimalist Harmony Card
        if (showHarmony) {
          const scoreVal = pairAnalysis ? pairAnalysis.score : 95;
          ctx.fillStyle = colors.cardBg;
          roundRect(ctx, colX, curY, colW, 90, 16);
          ctx.fill();
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = colors.accent;
          ctx.font = "bold 38px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`${scoreVal}%`, colX + 20, curY + 24);

          ctx.fillStyle = colors.textPrimary;
          ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText("Style Harmony Match", colX + 115, curY + 22);

          ctx.fillStyle = colors.textSecondary;
          ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(pairAnalysis?.relation || "Complementary Match", colX + 115, curY + 48);
        }

        // Footer
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("WARDROBE STUDIO  •  MINIMAL ARCHIVE", W / 2, 1030);
        ctx.textAlign = "left";
      }
    } catch (err) {
      console.error("Error drawing lookbook canvas:", err);
    }
  }, [outfit, theme, ratio, customTitle, showGarments, showHarmony, pairAnalysis, garments]);

  // Re-render canvas when options change
  useEffect(() => {
    if (isOpen) {
      renderCanvas();
    }
  }, [isOpen, renderCanvas]);

  // Handle Download (High-Resolution DOM vector export with canvas fallback)
  const handleDownload = async () => {
    if (!outfit) return;
    setIsExporting(true);
    const safeTitle = (customTitle || outfit.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `lookbook-${safeTitle}-${ratio.replace(":", "-")}.png`;

    try {
      if (cardRef.current) {
        try {
          const dataUrl = await toPng(cardRef.current, {
            pixelRatio: 3, // 3x Ultra-High Resolution (Razor sharp, zero pixelation)
            cacheBust: true,
          });
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = filename;
          a.click();
          return;
        } catch (domErr) {
          console.warn("DOM to PNG export fallback to canvas:", domErr);
        }
      }

      // Canvas fallback
      if (canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = filename;
        a.click();
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    try {
      if (cardRef.current) {
        try {
          const blob = await toBlob(cardRef.current, {
            pixelRatio: 3,
            cacheBust: true,
          });
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 3000);
            return;
          }
        } catch (domErr) {
          console.warn("DOM to Blob fallback to canvas:", domErr);
        }
      }

      if (canvasRef.current) {
        canvasRef.current.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 3000);
          } catch {
            alert("Image copied via download link or use Download button.");
          }
        });
      }
    } catch (err) {
      console.warn("Clipboard copy unavailable:", err);
      alert("Image copied via download link or use Download button.");
    }
  };

  if (!isOpen || !outfit || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-6xl rounded-3xl border border-line bg-paper p-5 sm:p-7 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-line mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame/10 text-flame">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                Social Fit Card Studio
              </h2>
              <p className="text-xs text-ink-soft">
                Export high-resolution OOTD lookbook cards with your styled model, pieces, and aesthetic vibe.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-ink-soft hover:bg-bone-deep hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content: Left Controls & Right Live Canvas Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-y-auto pr-1">
          {/* LEFT COLUMN: Customizer Controls */}
          <div className="lg:col-span-5 space-y-5">
            {/* Aspect Ratio Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
                1. Canvas Format / Social Aspect Ratio
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "4:5", label: "4:5 Portrait", sub: "Instagram Post" },
                  { id: "9:16", label: "9:16 Story", sub: "Reels / TikTok" },
                  { id: "1:1", label: "1:1 Square", sub: "Classic Card" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRatio(item.id as LookbookRatio)}
                    className={clsx(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer",
                      ratio === item.id
                        ? "border-flame bg-flame/10 text-flame ring-1 ring-flame/40"
                        : "border-line bg-bone text-ink hover:bg-bone-deep"
                    )}
                  >
                    <span className="text-xs font-bold font-mono">{item.label}</span>
                    <span className="text-[10px] text-ink-soft">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aesthetic Theme */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
                2. Editorial Aesthetic Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "noir", label: "Obsidian Noir", preview: "bg-[#0c0b09] text-white" },
                  { id: "alabaster", label: "Alabaster Gallery", preview: "bg-[#faf8f5] text-[#17140e] border" },
                  { id: "terracotta", label: "Terracotta Studio", preview: "bg-[#181210] text-[#ff6a42]" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id as LookbookTheme)}
                    className={clsx(
                      "flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                      theme === item.id
                        ? "border-flame ring-1 ring-flame/40"
                        : "border-line bg-paper hover:bg-bone"
                    )}
                  >
                    <span className={clsx("h-4 w-4 rounded-full border border-line shrink-0", item.preview)} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink uppercase tracking-wider block">
                3. Lookbook Headline
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Editorial Title"
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2 text-xs font-semibold text-ink focus:outline-none focus:border-flame"
              />
            </div>

            {/* Toggles */}
            <div className="space-y-2.5 p-3.5 rounded-2xl border border-line bg-bone">
              <label className="flex items-center justify-between text-xs font-medium text-ink cursor-pointer">
                <span className="flex items-center gap-2">
                  <Shirt className="h-4 w-4 text-flame" />
                  <span>Show Garment Pieces (Max 2)</span>
                </span>
                <input
                  type="checkbox"
                  checked={showGarments}
                  onChange={(e) => setShowGarments(e.target.checked)}
                  className="h-4 w-4 rounded text-flame accent-[#ff5b36] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-medium text-ink cursor-pointer">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-flame" />
                  <span>Show Color Harmony & Palette</span>
                </span>
                <input
                  type="checkbox"
                  checked={showHarmony}
                  onChange={(e) => setShowHarmony(e.target.checked)}
                  className="h-4 w-4 rounded text-flame accent-[#ff5b36] cursor-pointer"
                />
              </label>
            </div>

            {/* Harmony Summary Callout if available */}
            {pairAnalysis && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" />
                    <span>{pairAnalysis.score}% Color Harmony Match</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    {pairAnalysis.relation}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Vector DOM Card Preview (Crystal clear vector typography & layout) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-3 sm:p-5 rounded-3xl border border-line bg-bone/40 min-h-[520px] lg:min-h-[640px]">
            <div className="relative w-full flex items-center justify-center overflow-hidden py-1">
              {/* LIVE VECTOR DOM CARD */}
              <div
                ref={cardRef}
                className={clsx(
                  "relative select-none shadow-2xl transition-all duration-300 overflow-hidden",
                  // Aspect ratio containers
                  ratio === "9:16" && "w-full max-w-[330px] aspect-[9/16] rounded-3xl",
                  ratio === "4:5" && "w-full max-w-[420px] aspect-[4/5] rounded-3xl",
                  ratio === "1:1" && "w-full max-w-[440px] aspect-square rounded-3xl",
                  // Themes
                  theme === "noir" && "bg-[#0c0b09] text-[#f5f2eb] border border-[#2b2722]",
                  theme === "alabaster" && "bg-[#faf8f5] text-[#17140e] border border-[#e5ded4]",
                  theme === "terracotta" && "bg-[#17110e] text-[#fcefe9] border border-[#422e25]"
                )}
              >
                {/* 9:16 Ultra-Minimalist Story */}
                {ratio === "9:16" && (
                  <div className="flex flex-col h-full p-4 sm:p-4.5 justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-current/10 shrink-0">
                      <span className="text-[10px] font-bold tracking-[0.22em] uppercase opacity-90">
                        Wardrobe Studio
                      </span>
                      <span className="text-[10px] tracking-wider uppercase opacity-50 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    {/* Hero Photo - commanding centerpiece */}
                    <div className="relative flex-1 my-2.5 overflow-hidden rounded-2xl border border-current/10 bg-black/10 flex items-center justify-center">
                      <img
                        src={outfit.resultImage}
                        alt={customTitle || outfit.name}
                        className="h-full w-full object-contain"
                        crossOrigin="anonymous"
                      />
                    </div>

                    {/* Bottom Editorial Caption */}
                    <div className="shrink-0 space-y-2 pt-0.5">
                      {/* Title & Subtitle + Palette Row */}
                      <div>
                        <h3 className="font-display text-base sm:text-lg font-bold leading-tight tracking-tight line-clamp-1">
                          {customTitle || outfit.name}
                        </h3>
                        <div className="flex items-center justify-between mt-1 text-[11px] opacity-70">
                          <span>
                            Styled on {outfit.person?.name || "Studio Model"} • {scoreVal}% Harmony
                          </span>
                          {showHarmony && uniqueColors.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              {uniqueColors.map((hex, i) => (
                                <span
                                  key={i}
                                  className="h-3 w-3 rounded-full border border-black/20 shadow-sm shrink-0"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Hairline Divider */}
                      <div className="border-t border-current/10" />

                      {/* Garments (Max 2 pieces side-by-side) */}
                      {showGarments && displayGarments.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {displayGarments.map((g) => (
                            <div
                              key={g.id}
                              className={clsx(
                                "flex items-center gap-2 p-1.5 rounded-xl border border-current/10",
                                theme === "noir" ? "bg-[#181512]" : theme === "alabaster" ? "bg-[#ffffff]" : "bg-[#241a15]"
                              )}
                            >
                              <img
                                src={g.image}
                                alt={g.name}
                                className="h-9 w-9 rounded-lg object-cover border border-current/10 shrink-0 bg-black/10"
                                crossOrigin="anonymous"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold truncate leading-tight">
                                  {g.name}
                                </p>
                                <p className="text-[9px] uppercase tracking-wider opacity-60 truncate">
                                  {g.category}
                                </p>
                              </div>
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0 mr-1"
                                style={{ backgroundColor: safeHex(g.colorHex, g.name) }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Watermark */}
                      <div className="text-center pt-1 border-t border-current/10">
                        <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40">
                          Wardrobe Studio • Story Archive
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4:5 Portrait Layout */}
                {ratio === "4:5" && (
                  <div className="flex flex-col h-full p-4 justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-current/10 shrink-0">
                      <span className="text-[10px] font-bold tracking-[0.22em] uppercase opacity-90">
                        Wardrobe Studio
                      </span>
                      <span className="text-[10px] tracking-wider uppercase opacity-50 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    {/* Middle Grid */}
                    <div className="grid grid-cols-12 gap-3 flex-1 my-2 min-h-0">
                      {/* Left: Photo */}
                      <div className="col-span-7 rounded-2xl border border-current/10 bg-black/10 h-full overflow-hidden flex items-center justify-center">
                        <img
                          src={outfit.resultImage}
                          alt={customTitle || outfit.name}
                          className="h-full w-full object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>

                      {/* Right: Details */}
                      <div className="col-span-5 flex flex-col justify-between py-0.5">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold tracking-wider uppercase text-flame block">
                            Curated OOTD
                          </span>
                          <h3 className="font-display text-base font-bold leading-snug line-clamp-2">
                            {customTitle || outfit.name}
                          </h3>
                          <p className="text-[11px] opacity-70">
                            Styled on {outfit.person?.name || "Studio Model"}
                          </p>
                        </div>

                        <div className="border-t border-current/10 my-1" />

                        {/* Garments */}
                        {showGarments && displayGarments.length > 0 && (
                          <div className="space-y-1.5 flex-1 my-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 block">
                              Pieces
                            </span>
                            {displayGarments.map((g) => (
                              <div
                                key={g.id}
                                className={clsx(
                                  "flex items-center gap-2 p-1.5 rounded-xl border border-current/10",
                                  theme === "noir" ? "bg-[#181512]" : theme === "alabaster" ? "bg-[#ffffff]" : "bg-[#241a15]"
                                )}
                              >
                                <img
                                  src={g.image}
                                  alt={g.name}
                                  className="h-8 w-8 rounded-lg object-cover border border-current/10 shrink-0 bg-black/10"
                                  crossOrigin="anonymous"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold truncate leading-tight">
                                    {g.name}
                                  </p>
                                  <p className="text-[8px] uppercase tracking-wider opacity-60 truncate">
                                    {g.category}
                                  </p>
                                </div>
                                <span
                                  className="h-2 w-2 rounded-full border border-black/20 shrink-0 mr-1"
                                  style={{ backgroundColor: safeHex(g.colorHex, g.name) }}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Harmony Card */}
                        {showHarmony && (
                          <div
                            className={clsx(
                              "p-2 rounded-xl border border-current/10 mt-1",
                              theme === "noir" ? "bg-[#181512]" : theme === "alabaster" ? "bg-[#ffffff]" : "bg-[#241a15]"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold text-flame">
                                {scoreVal}%
                              </span>
                              <div className="flex items-center gap-1">
                                {uniqueColors.map((hex, i) => (
                                  <span
                                    key={i}
                                    className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-[9px] opacity-70 truncate mt-0.5">
                              {pairAnalysis?.relation || "Complementary Match"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Watermark */}
                    <div className="text-center pt-1 border-t border-current/10">
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40">
                        Wardrobe Studio • OOTD Archive
                      </span>
                    </div>
                  </div>
                )}

                {/* 1:1 Square Layout */}
                {ratio === "1:1" && (
                  <div className="flex flex-col h-full p-4 justify-between">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-current/10 shrink-0">
                      <span className="text-[10px] font-bold tracking-[0.22em] uppercase opacity-90">
                        Wardrobe Studio
                      </span>
                      <span className="text-[10px] tracking-wider uppercase opacity-50 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    {/* Middle Grid */}
                    <div className="grid grid-cols-12 gap-3 flex-1 my-2 min-h-0">
                      {/* Left: Photo */}
                      <div className="col-span-6 rounded-2xl border border-current/10 bg-black/10 h-full overflow-hidden flex items-center justify-center">
                        <img
                          src={outfit.resultImage}
                          alt={customTitle || outfit.name}
                          className="h-full w-full object-contain"
                          crossOrigin="anonymous"
                        />
                      </div>

                      {/* Right: Details */}
                      <div className="col-span-6 flex flex-col justify-between py-0.5">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold tracking-wider uppercase text-flame block">
                            Curated OOTD
                          </span>
                          <h3 className="font-display text-base font-bold leading-snug line-clamp-2">
                            {customTitle || outfit.name}
                          </h3>
                          <p className="text-[11px] opacity-70">
                            Styled on {outfit.person?.name || "Studio Model"}
                          </p>
                        </div>

                        <div className="border-t border-current/10 my-1" />

                        {/* Garments */}
                        {showGarments && displayGarments.length > 0 && (
                          <div className="space-y-1.5 flex-1 my-1">
                            {displayGarments.map((g) => (
                              <div
                                key={g.id}
                                className={clsx(
                                  "flex items-center gap-2 p-1.5 rounded-xl border border-current/10",
                                  theme === "noir" ? "bg-[#181512]" : theme === "alabaster" ? "bg-[#ffffff]" : "bg-[#241a15]"
                                )}
                              >
                                <img
                                  src={g.image}
                                  alt={g.name}
                                  className="h-8 w-8 rounded-lg object-cover border border-current/10 shrink-0 bg-black/10"
                                  crossOrigin="anonymous"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold truncate leading-tight">
                                    {g.name}
                                  </p>
                                  <p className="text-[8px] uppercase tracking-wider opacity-60 truncate">
                                    {g.category}
                                  </p>
                                </div>
                                <span
                                  className="h-2 w-2 rounded-full border border-black/20 shrink-0 mr-1"
                                  style={{ backgroundColor: safeHex(g.colorHex, g.name) }}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Harmony row */}
                        {showHarmony && (
                          <div
                            className={clsx(
                              "p-1.5 rounded-xl border border-current/10 mt-1 flex items-center justify-between",
                              theme === "noir" ? "bg-[#181512]" : theme === "alabaster" ? "bg-[#ffffff]" : "bg-[#241a15]"
                            )}
                          >
                            <span className="text-xs font-bold text-flame">
                              {scoreVal}% Match
                            </span>
                            <div className="flex items-center gap-1">
                              {uniqueColors.map((hex, i) => (
                                <span
                                  key={i}
                                  className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Watermark */}
                    <div className="text-center pt-1 border-t border-current/10">
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-40">
                        Wardrobe Studio • Minimal Archive
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Background Canvas for fallback export */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <span className="text-xs text-ink-soft mt-3 font-mono">
              Vector High-DPI Composite • {ratio === "4:5" ? "4:5 Portrait" : ratio === "9:16" ? "9:16 Story" : "1:1 Square"}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-line mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-ink-soft">
            Ready to export as full-resolution fashion lookbook card
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-bone px-4 py-2.5 text-xs font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
            >
              {copySuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Image</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-bold text-bone hover:bg-flame transition-all cursor-pointer shadow-md hover:scale-[1.02]"
            >
              <Download className="h-4 w-4" />
              <span>Download Fit Card (.PNG)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

