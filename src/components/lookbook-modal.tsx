"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface LookbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfit: Outfit | null;
}

export function LookbookModal({ isOpen, onClose, outfit }: LookbookModalProps) {
  const [theme, setTheme] = useState<LookbookTheme>("noir");
  const [ratio, setRatio] = useState<LookbookRatio>("4:5");
  const [customTitle, setCustomTitle] = useState("");
  const [showGarments, setShowGarments] = useState(true);
  const [showHarmony, setShowHarmony] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, W - 48, H - 48, 36);
    ctx.stroke();

    // 2. Header Bar
    ctx.fillStyle = colors.textSecondary;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("FITCHECK STUDIO  •  EDITORIAL ARCHIVE", 60, 72);

    const dateStr = new Date(outfit.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
    ctx.textAlign = "right";
    ctx.fillText(dateStr, W - 60, 72);
    ctx.textAlign = "left";

    // Header dividing line
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 94);
    ctx.lineTo(W - 60, 94);
    ctx.stroke();

    // 3. Load and Draw Main Try-On Image
    try {
      const modelImg = await loadImage(outfit.resultImage);

      if (ratio === "4:5") {
        // 4:5 Layout: Side-by-side or stacked
        const imgX = 60;
        const imgY = 120;
        const imgW = 540;
        const imgH = 760;

        // Clip image with rounded corners
        ctx.save();
        roundRect(ctx, imgX, imgY, imgW, imgH, 28);
        ctx.clip();
        ctx.drawImage(modelImg, imgX, imgY, imgW, imgH);
        ctx.restore();

        // Border around image
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, imgX, imgY, imgW, imgH, 28);
        ctx.stroke();

        // High-res studio badge on image
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        roundRect(ctx, imgX + 20, imgY + imgH - 52, 160, 32, 16);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("✦ VIRTUAL TRY-ON", imgX + 36, imgY + imgH - 32);

        // Right Column: Title & Metadata
        const colX = 630;
        let curY = 140;

        // Vibe Pill
        if (pairAnalysis) {
          ctx.fillStyle = colors.accentBg;
          roundRect(ctx, colX, curY, 150, 28, 14);
          ctx.fill();
          ctx.fillStyle = colors.accent;
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.fillText(`★ ${pairAnalysis.relation.toUpperCase()}`, colX + 14, curY + 18);
          curY += 46;
        }

        // Title
        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 32px 'Playfair Display', Georgia, serif";
        const titleText = customTitle || outfit.name;
        // Basic multi-line text wrapping
        const words = titleText.split(" ");
        let line = "";
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > 380 && n > 0) {
            ctx.fillText(line, colX, curY);
            line = words[n] + " ";
            curY += 38;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, colX, curY);
        curY += 40;

        // Persona & Ensemble info
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(
          `${outfit.person?.name || "Elena Studio"}  •  ${garments.length} Styled Pieces`,
          colX,
          curY
        );
        curY += 36;

        // Garment Decomposition Swatches
        if (showGarments && garments.length > 0) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.fillText("WARDROBE PIECES", colX, curY);
          curY += 16;

          for (const g of garments.slice(0, 3)) {
            // Row card
            ctx.fillStyle = colors.cardBg;
            roundRect(ctx, colX, curY, 390, 72, 16);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Swatch thumb
            try {
              const gImg = await loadImage(g.image);
              ctx.save();
              roundRect(ctx, colX + 10, curY + 10, 52, 52, 10);
              ctx.clip();
              ctx.drawImage(gImg, colX + 10, curY + 10, 52, 52);
              ctx.restore();
            } catch {}

            // Garment title & category
            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 14px -apple-system, sans-serif";
            const truncName = g.name.length > 22 ? g.name.slice(0, 20) + "..." : g.name;
            ctx.fillText(truncName, colX + 74, curY + 32);

            ctx.fillStyle = colors.textSecondary;
            ctx.font = "11px -apple-system, sans-serif";
            ctx.fillText(g.category.toUpperCase(), colX + 74, curY + 52);

            // Dominant color circle
            const gHex = safeHex(g.colorHex, g.name);
            ctx.fillStyle = gHex;
            ctx.beginPath();
            ctx.arc(colX + 355, curY + 36, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.lineWidth = 1;
            ctx.stroke();

            curY += 82;
          }
        }

        // Bottom Banner Area (Stylist Note & Harmony Badge)
        const botY = 920;
        ctx.fillStyle = colors.cardBg;
        roundRect(ctx, 60, botY, W - 120, 270, 24);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Harmony score & palette
        if (showHarmony && pairAnalysis) {
          // Score block
          ctx.fillStyle = colors.accentBg;
          roundRect(ctx, 90, botY + 30, 110, 64, 16);
          ctx.fill();
          ctx.fillStyle = colors.accent;
          ctx.font = "bold 26px -apple-system, sans-serif";
          ctx.fillText(`${pairAnalysis.score}%`, 112, botY + 72);

          ctx.fillStyle = colors.textPrimary;
          ctx.font = "bold 16px -apple-system, sans-serif";
          ctx.fillText("Color & Style Harmony", 220, botY + 54);

          ctx.fillStyle = colors.textSecondary;
          ctx.font = "13px -apple-system, sans-serif";
          ctx.fillText(`Aesthetic Mode: ${pairAnalysis.relation}`, 220, botY + 78);

          // Palette circles
          let palX = W - 230;
          pairAnalysis.palette.forEach((hex) => {
            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.arc(palX, botY + 62, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 2;
            ctx.stroke();
            palX += 45;
          });

          // Stylist Quote
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(90, botY + 115);
          ctx.lineTo(W - 90, botY + 115);
          ctx.stroke();

          ctx.fillStyle = colors.textPrimary;
          ctx.font = "italic 15px 'Playfair Display', Georgia, serif";
          ctx.fillText(`“${pairAnalysis.stylistNote}”`, 90, botY + 160);

          ctx.fillStyle = colors.textSecondary;
          ctx.font = "12px -apple-system, sans-serif";
          ctx.fillText(
            `Curated with FitCheck Studio ~ Local AI Diffusion • Euler Sampling`,
            90,
            botY + 225
          );
        } else {
          // Single piece look note
          ctx.fillStyle = colors.textPrimary;
          ctx.font = "italic 16px 'Playfair Display', Georgia, serif";
          ctx.fillText(`“Styled with precision using your calibrated personal studio model.”`, 90, botY + 80);

          ctx.fillStyle = colors.textSecondary;
          ctx.font = "13px -apple-system, sans-serif";
          ctx.fillText(`FitCheck Studio • High Resolution 768x1024 Native Composite`, 90, botY + 140);
        }

        // Studio Watermark
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "bold 11px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FITCHECK  •  AUTONOMOUS DIGITAL WARDROBE", W / 2, H - 45);
        ctx.textAlign = "left";
      } else if (ratio === "9:16") {
        // Story 9:16 (1080 x 1920) Layout
        const imgX = 80;
        const imgY = 140;
        const imgW = W - 160;
        const imgH = 1100;

        ctx.save();
        roundRect(ctx, imgX, imgY, imgW, imgH, 36);
        ctx.clip();
        ctx.drawImage(modelImg, imgX, imgY, imgW, imgH);
        ctx.restore();

        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, imgX, imgY, imgW, imgH, 36);
        ctx.stroke();

        // Title and Content below
        let curY = imgY + imgH + 60;
        ctx.fillStyle = colors.accent;
        ctx.font = "bold 13px -apple-system, sans-serif";
        ctx.fillText(
          pairAnalysis ? `★ ${pairAnalysis.relation.toUpperCase()}` : "★ TAILORED LOOK",
          80,
          curY
        );
        curY += 40;

        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 38px 'Playfair Display', Georgia, serif";
        ctx.fillText(customTitle || outfit.name, 80, curY);
        curY += 45;

        ctx.fillStyle = colors.textSecondary;
        ctx.font = "16px -apple-system, sans-serif";
        ctx.fillText(
          `${outfit.person?.name || "Studio Persona"}  •  ${garments.length} Pieces  •  ${pairAnalysis ? pairAnalysis.score + "% Harmony" : "Curated Look"}`,
          80,
          curY
        );

        // Footer Brand
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "bold 12px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FITCHECK  •  EDITORIAL LOOKBOOK ARCHIVE", W / 2, H - 60);
        ctx.textAlign = "left";
      } else {
        // 1:1 Square (1080 x 1080) Layout
        const imgX = 60;
        const imgY = 120;
        const imgW = 540;
        const imgH = 720;

        ctx.save();
        roundRect(ctx, imgX, imgY, imgW, imgH, 24);
        ctx.clip();
        ctx.drawImage(modelImg, imgX, imgY, imgW, imgH);
        ctx.restore();

        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 2;
        roundRect(ctx, imgX, imgY, imgW, imgH, 24);
        ctx.stroke();

        // Right details
        const colX = 640;
        let curY = 160;

        ctx.fillStyle = colors.accent;
        ctx.font = "bold 12px -apple-system, sans-serif";
        ctx.fillText(
          pairAnalysis ? `★ ${pairAnalysis.relation.toUpperCase()}` : "EDITORIAL FIT",
          colX,
          curY
        );
        curY += 36;

        ctx.fillStyle = colors.textPrimary;
        ctx.font = "bold 30px 'Playfair Display', Georgia, serif";
        ctx.fillText(customTitle || outfit.name, colX, curY);
        curY += 45;

        ctx.fillStyle = colors.textSecondary;
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(`Model: ${outfit.person?.name || "Studio Persona"}`, colX, curY);
        curY += 45;

        // Swatches
        if (garments.length > 0) {
          ctx.fillStyle = colors.textSecondary;
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.fillText("GARMENTS STYLED", colX, curY);
          curY += 20;

          for (const g of garments.slice(0, 2)) {
            ctx.fillStyle = colors.cardBg;
            roundRect(ctx, colX, curY, 380, 64, 14);
            ctx.fill();
            ctx.strokeStyle = colors.border;
            ctx.stroke();

            try {
              const gImg = await loadImage(g.image);
              ctx.save();
              roundRect(ctx, colX + 8, curY + 8, 48, 48, 8);
              ctx.clip();
              ctx.drawImage(gImg, colX + 8, curY + 8, 48, 48);
              ctx.restore();
            } catch {}

            ctx.fillStyle = colors.textPrimary;
            ctx.font = "bold 13px -apple-system, sans-serif";
            ctx.fillText(g.name, colX + 66, curY + 28);

            ctx.fillStyle = colors.textSecondary;
            ctx.font = "11px -apple-system, sans-serif";
            ctx.fillText(g.category.toUpperCase(), colX + 66, curY + 46);

            curY += 76;
          }
        }

        // Bottom Brand
        ctx.fillStyle = colors.textSecondary;
        ctx.font = "bold 11px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FITCHECK  •  AUTONOMOUS DIGITAL WARDROBE", W / 2, H - 40);
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

  // Handle Download
  const handleDownload = () => {
    if (!canvasRef.current || !outfit) return;
    setIsExporting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeTitle = (customTitle || outfit.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.download = `lookbook-${safeTitle}-${ratio.replace(":", "-")}.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          // If direct clipboard write is restricted, notify user to use download
          alert("Image copied via download link or use Download button.");
        }
      });
    } catch (err) {
      console.warn("Clipboard copy unavailable:", err);
    }
  };

  if (!isOpen || !outfit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-2xl my-6 flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-flame/10 text-flame">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-ink">
                Social Fit Card & Lookbook Studio
              </h2>
              <p className="text-xs text-ink-soft">
                Export an editorial composite card with garment swatches, color harmony score, and aesthetic vibe tags.
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
                  <span>Show Garment Swatches</span>
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
                <p className="text-[11px] text-ink-soft leading-relaxed italic">
                  "{pairAnalysis.stylistNote}"
                </p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Canvas & Export Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 rounded-3xl border border-line bg-bone/50 min-h-[460px]">
            <div className="relative max-h-[500px] w-full flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-h-[480px] max-w-full rounded-2xl shadow-xl border border-line object-contain transition-all"
              />
            </div>
            <span className="text-[11px] text-ink-soft mt-3 font-mono">
              High Resolution Composite • {ratio === "4:5" ? "1080×1350" : ratio === "9:16" ? "1080×1920" : "1080×1080"} PNG
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
    </div>
  );
}

