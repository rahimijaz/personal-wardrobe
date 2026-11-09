"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Upload,
  ShieldCheck,
  Check,
  Trash2,
  Sparkles,
  Camera,
  Info,
  Plus,
  Sliders,
  Maximize2,
  Minimize2,
  RotateCcw,
  Eye,
  EyeOff,
  Ruler,
  Crosshair,
  Activity,
  CheckCircle2,
  AlertCircle,
  Save,
  ArrowRight,
  Sun,
  Flame,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  Person,
  PersonaCalibration,
  BodySilhouette,
  PersonaPosture,
  PersonaFraming,
  PersonaLighting,
} from "@/lib/types";
import {
  detectBodySilhouetteFromImageSrc,
  detectAutoFitFramingFromImageSrc,
} from "@/lib/persona-utils";
import { Wand2 } from "lucide-react";

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const urlPersonaId = searchParams.get("personaId") || searchParams.get("calibrate");

  const {
    persons,
    activePerson,
    refreshPersons,
    setActivePersonById,
    updatePersonProfile,
  } = useWardrobe();

  // Mode: "calibrate" (fine-tune active/selected persona) or "add" (upload new persona)
  const [activeTab, setActiveTab] = useState<"calibrate" | "add">("calibrate");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Calibration interactive canvas state
  const [zoom, setZoom] = useState<number>(1.0);
  const [xOffset, setXOffset] = useState<number>(0);
  const [yOffset, setYOffset] = useState<number>(0);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");
  const [isSilhouetteAutoDetected, setIsSilhouetteAutoDetected] = useState<boolean>(false);

  // Calibration physical parameters
  const [heightCm, setHeightCm] = useState<number>(175);
  const [bodySilhouette, setBodySilhouette] = useState<BodySilhouette>("athletic");
  const [posture, setPosture] = useState<PersonaPosture>("standing-frontal");
  const [framing, setFraming] = useState<PersonaFraming>("full-body");
  const [lighting, setLighting] = useState<PersonaLighting>("studio-neutral");
  const [notes, setNotes] = useState<string>("");

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Upload new persona state
  const [nameInput, setNameInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selected persona when persons or URL changes
  useEffect(() => {
    if (urlPersonaId && persons.some((p) => p.id === urlPersonaId)) {
      setSelectedPersonaId(urlPersonaId);
      return;
    }
    if (!selectedPersonaId && activePerson) {
      setSelectedPersonaId(activePerson.id);
    } else if (!selectedPersonaId && persons.length > 0) {
      setSelectedPersonaId(persons[0].id);
    }
  }, [urlPersonaId, activePerson, persons, selectedPersonaId]);

  // The currently focused persona for calibration
  const targetedPerson = useMemo(() => {
    return persons.find((p) => p.id === selectedPersonaId) || activePerson || persons[0] || null;
  }, [persons, selectedPersonaId, activePerson]);

  // Load calibration values into local state when targeted persona changes
  useEffect(() => {
    if (targetedPerson?.calibration) {
      const c = targetedPerson.calibration;
      setZoom(c.zoom ?? 1.0);
      setXOffset(c.xOffset ?? 0);
      setYOffset(c.yOffset ?? 0);
      setHeightCm(c.heightCm ?? 175);
      setBodySilhouette(c.bodySilhouette ?? "athletic");
      setPosture(c.posture ?? "standing-frontal");
      setFraming(c.framing ?? "full-body");
      setLighting(c.lighting ?? "studio-neutral");
      setNotes(c.notes ?? "");
    } else {
      setZoom(1.0);
      setXOffset(0);
      setYOffset(0);
      setHeightCm(175);
      setBodySilhouette("regular");
      setPosture("standing-frontal");
      setFraming("full-body");
      setLighting("studio-neutral");
      setNotes("");
    }
  }, [targetedPerson?.id]);

  // Convert cm to feet and inches for friendly display
  const heightImperial = useMemo(() => {
    const totalInches = Math.round(heightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}' ${inches}"`;
  }, [heightCm]);

  // Compute calibration readiness score (0-100)
  const computedScore = useMemo(() => {
    let score = 70;
    if (posture === "standing-frontal") score += 15;
    else if (posture === "standing-quarter") score += 10;
    else score += 5;

    if (framing === "full-body") score += 10;
    else if (framing === "three-quarters") score += 8;
    else score += 4;

    if (lighting === "studio-neutral") score += 5;
    else score += 3;

    return Math.min(100, Math.max(50, score));
  }, [posture, framing, lighting]);

  // Dynamic guidelines reacting to height and posture
  const crownTopPct = useMemo(() => {
    const clamped = Math.max(145, Math.min(210, heightCm));
    return 18.5 - ((clamped - 145) / 65) * 9.5; // 145cm -> 18.5%, 175cm -> 14%, 210cm -> 9%
  }, [heightCm]);

  const groundBottomPct = useMemo(() => {
    const clamped = Math.max(145, Math.min(210, heightCm));
    return 12 - ((clamped - 145) / 65) * 6.5; // 145cm -> 12% (ground at 88%), 175cm -> 8.5% (91.5%), 210cm -> 5.5% (94.5%)
  }, [heightCm]);

  const shoulderTopPct = useMemo(() => crownTopPct + 11, [crownTopPct]);
  const waistTopPct = useMemo(() => crownTopPct + 30, [crownTopPct]);
  const hipTopPct = useMemo(() => crownTopPct + 45, [crownTopPct]);

  // Silhouette-specific guideline horizontal insets and badges
  const silhouetteGuideStyles = useMemo(() => {
    switch (bodySilhouette) {
      case "athletic":
        return {
          shoulderInset: "inset-x-2",
          waistInset: "inset-x-12",
          hipInset: "inset-x-7",
          tag: "⚡ Athletic V-Taper",
          accentColor: "border-sky-400 text-sky-400",
        };
      case "curvy":
        return {
          shoulderInset: "inset-x-6",
          waistInset: "inset-x-14",
          hipInset: "inset-x-2",
          tag: "✨ Curvy Hourglass",
          accentColor: "border-pink-400 text-pink-400",
        };
      case "slim":
        return {
          shoulderInset: "inset-x-8",
          waistInset: "inset-x-10",
          hipInset: "inset-x-8",
          tag: "📏 Slim Linear",
          accentColor: "border-amber-400 text-amber-400",
        };
      case "relaxed":
        return {
          shoulderInset: "inset-x-4",
          waistInset: "inset-x-5",
          hipInset: "inset-x-4",
          tag: "🌿 Relaxed Fit",
          accentColor: "border-emerald-400 text-emerald-400",
        };
      case "regular":
      default:
        return {
          shoulderInset: "inset-x-4",
          waistInset: "inset-x-8",
          hipInset: "inset-x-5",
          tag: "🎯 Classic Balanced",
          accentColor: "border-emerald-400 text-emerald-400",
        };
    }
  }, [bodySilhouette]);

  // Handler for framing coverage change (zooms and frames viewport live)
  const handleFramingCoverageChange = (newFraming: PersonaFraming) => {
    setFraming(newFraming);
    if (newFraming === "three-quarters") {
      setZoom(1.22);
      setYOffset(10);
    } else if (newFraming === "upper-body") {
      setZoom(1.55);
      setYOffset(20);
    } else {
      // full-body
      setZoom(1.0);
      setYOffset(0);
    }
  };

  // Handler for posture change (adjusts alignment axis live)
  const handlePostureChange = (newPosture: PersonaPosture) => {
    setPosture(newPosture);
    if (newPosture === "standing-quarter") {
      setXOffset((prev) => (prev === 0 ? 2 : prev));
    } else if (newPosture === "standing-frontal") {
      setXOffset((prev) => (prev === 2 ? 0 : prev));
    }
  };

  // Carousel horizontal scroll ref and smooth scroll handler
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = 260;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Dynamic CSS filter and ambient lighting simulation based on calibrated lighting
  const lightingStyle = useMemo(() => {
    switch (lighting) {
      case "warm-sunlight":
        return {
          filter: "brightness(1.04) contrast(1.05) saturate(1.15) sepia(0.08)",
          tag: "☀️ Warm Sunlight",
          glowClass: "from-amber-400/15 via-orange-300/10 to-transparent",
        };
      case "cool-ambient":
        return {
          filter: "brightness(0.98) contrast(1.06) saturate(0.92)",
          tag: "❄️ Diffused Cool",
          glowClass: "from-sky-400/20 via-blue-500/10 to-transparent",
        };
      case "studio-neutral":
      default:
        return {
          filter: "brightness(1) contrast(1)",
          tag: "💡 5500K Studio Neutral",
          glowClass: "from-transparent to-transparent",
        };
    }
  }, [lighting]);

  const [isAutoFraming, setIsAutoFraming] = useState(false);

  const handleResetFraming = () => {
    setZoom(1.0);
    setXOffset(0);
    setYOffset(0);
    setFitMode("contain");
  };

  const handleAutoFitFraming = async (targetSrc?: string) => {
    const src = targetSrc || previewImage || targetedPerson?.image;
    if (!src) return;
    setIsAutoFraming(true);
    try {
      const framing = await detectAutoFitFramingFromImageSrc(src);
      if (framing) {
        setZoom(framing.zoom);
        setXOffset(framing.xOffset);
        setYOffset(framing.yOffset);
      }
    } catch (e) {
      console.warn("Auto fit framing failed:", e);
    } finally {
      setIsAutoFraming(false);
    }
  };

  const handleSaveCalibration = async () => {
    if (!targetedPerson) return;
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const updatedCal: PersonaCalibration = {
        heightCm,
        bodySilhouette,
        posture,
        framing,
        lighting,
        zoom,
        xOffset,
        yOffset,
        showGuidelines,
        score: computedScore,
        calibratedAt: new Date().toISOString(),
        notes: notes.trim() || undefined,
      };

      await updatePersonProfile(targetedPerson.id, {
        calibration: updatedCal,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save persona calibration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select an image file (PNG, JPG, WEBP).");
      return;
    }

    setFileToUpload(file);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreviewImage(dataUrl);
      setFitMode("contain");
      if (!nameInput) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_+.]+/g, " ")
          .trim();
        setNameInput(
          cleanName
            ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
            : "Custom Persona"
        );
      }
      // Auto-detect body silhouette and optimal VTON framing from uploaded person photo
      try {
        const detected = await detectBodySilhouetteFromImageSrc(dataUrl);
        if (detected) {
          setBodySilhouette(detected);
          setIsSilhouetteAutoDetected(true);
        }
        const framing = await detectAutoFitFramingFromImageSrc(dataUrl);
        if (framing) {
          setZoom(framing.zoom);
          setXOffset(framing.xOffset);
          setYOffset(framing.yOffset);
        }
      } catch (err) {
        console.warn("Auto silhouette / framing detection fallback:", err);
      }
    };
    reader.readAsDataURL(file);
    setErrorMsg(null);
  };

  const handleCreatePersonaWithCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage && !fileToUpload) {
      setErrorMsg("Please upload a person image to calibrate.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const calibrationPayload: PersonaCalibration = {
      heightCm,
      bodySilhouette,
      posture,
      framing,
      lighting,
      zoom,
      xOffset,
      yOffset,
      score: computedScore,
      calibratedAt: new Date().toISOString(),
      notes: notes.trim() || undefined,
    };

    try {
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("name", nameInput.trim() || "My Persona");
        formData.append("isDefault", "true");
        formData.append("image", fileToUpload);
        formData.append("calibration", JSON.stringify(calibrationPayload));

        const res = await fetch("/api/persons", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload person image");
        const data = await res.json();
        if (data.person?.id) {
          setSelectedPersonaId(data.person.id);
        }
      } else if (previewImage) {
        const res = await fetch("/api/persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameInput.trim() || "My Persona",
            image: previewImage,
            isDefault: true,
            calibration: calibrationPayload,
          }),
        });
        if (!res.ok) throw new Error("Failed to save person profile");
        const data = await res.json();
        if (data.person?.id) {
          setSelectedPersonaId(data.person.id);
        }
      }

      await refreshPersons();
      setPreviewImage(null);
      setFileToUpload(null);
      setNameInput("");
      setIsSilhouetteAutoDetected(false);
      setActiveTab("calibrate");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create persona");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove persona "${name}"?`)) {
      const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshPersons();
      } else {
        const d = await res.json();
        alert(d.error || "Could not remove this profile.");
      }
    }
  };

  const PRESET_MODELS = [
    { name: "Elena (Full Body)", image: "/samples/model.png" },
    { name: "Sofia (Studio)", image: "/samples/model3.png" },
  ];

  const SILHOUETTES: { id: BodySilhouette; label: string; desc: string }[] = [
    { id: "slim", label: "Slim", desc: "Lean frame, tapered drape" },
    { id: "athletic", label: "Athletic", desc: "Defined shoulders, athletic taper" },
    { id: "regular", label: "Regular", desc: "Balanced standard proportions" },
    { id: "curvy", label: "Curvy", desc: "Accentuated waist & hip contours" },
    { id: "relaxed", label: "Relaxed", desc: "Generous fit, soft silhouette" },
  ];

  const POSTURES: { id: PersonaPosture; label: string; tag: string }[] = [
    { id: "standing-frontal", label: "Frontal Standing", tag: "DensePose Optimal" },
    { id: "standing-quarter", label: "3/4 Turn Stance", tag: "Editorial" },
    { id: "seated", label: "Casual Stance", tag: "Artistic" },
  ];

  const FRAMINGS: { id: PersonaFraming; label: string }[] = [
    { id: "full-body", label: "Full-Body (Head to Toe)" },
    { id: "three-quarters", label: "3/4 Length (Mid-Thigh)" },
    { id: "upper-body", label: "Upper Torso (Waist Up)" },
  ];

  const LIGHTINGS: { id: PersonaLighting; label: string; icon: any }[] = [
    { id: "studio-neutral", label: "Studio Neutral (5500K)", icon: Sun },
    { id: "warm-sunlight", label: "Warm Sunlight", icon: Flame },
    { id: "cool-ambient", label: "Diffused Cool", icon: Layers },
  ];

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-flame/10 px-2.5 py-0.5 text-[11px] font-semibold text-flame">
              <Crosshair className="h-3 w-3" />
              DensePose Calibration Studio
            </span>
            <span className="text-xs text-ink-soft">• Studio Framing Engine</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Persona Calibration
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Align body proportions, anatomical posture guides, and lighting for photorealistic virtual try-on
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-paper p-1 shadow-xs self-start sm:self-center">
          <button
            onClick={() => setActiveTab("calibrate")}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "calibrate"
                ? "bg-ink text-bone shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-bone"
            )}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Calibrate Persona</span>
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "add"
                ? "bg-ink text-bone shadow-xs"
                : "text-ink-soft hover:text-ink hover:bg-bone"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register New Persona</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/20 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Persona calibration updated and synchronized with virtual try-on studio!</span>
          </div>
          <Link
            href="/try-on"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 hover:underline"
          >
            <span>Launch Try-On</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </motion.div>
      )}

      {errorMsg && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Persona Carousel / Selector Bar */}
      <div className="mb-8 rounded-3xl border border-line bg-paper p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-soft">
              Active Personas in Your Studio ({persons.length})
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Select any persona to calibrate or set as default model
            </p>
          </div>
          <div className="flex items-center gap-2">
            {targetedPerson && (
              <div>
                {targetedPerson.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <Check className="h-3 w-3 stroke-[3]" />
                    Active Model
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      await setActivePersonById(targetedPerson.id);
                    }}
                    className="rounded-full border border-line bg-bone px-3 py-1 text-[11px] font-semibold text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                  >
                    Make Active Model
                  </button>
                )}
              </div>
            )}

            {/* Left and Right Carousel Arrow Navigation */}
            <div className="flex items-center gap-1 ml-1 border-l border-line pl-2">
              <button
                type="button"
                onClick={() => scrollCarousel("left")}
                className="rounded-full border border-line bg-paper p-1.5 text-ink-soft hover:text-ink hover:bg-bone transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Previous personas"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel("right")}
                className="rounded-full border border-line bg-paper p-1.5 text-ink-soft hover:text-ink hover:bg-bone transition-all shadow-2xs active:scale-95 cursor-pointer"
                title="Next personas"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Personas Carousel */}
        <div
          ref={carouselRef}
          className="flex items-center gap-3.5 overflow-x-auto scroll-smooth py-1 scrollbar-none"
        >
          {persons.map((p) => {
            const isSelected = targetedPerson?.id === p.id;
            const score = p.calibration?.score ?? 92;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPersonaId(p.id);
                  if (activeTab === "add") setActiveTab("calibrate");
                }}
                className={clsx(
                  "group relative cursor-pointer overflow-hidden rounded-2xl border p-2 transition-all duration-200 shrink-0 w-[130px] sm:w-[145px]",
                  isSelected
                    ? "border-ink bg-bone-deep/70 ring-2 ring-ink shadow-sm"
                    : "border-line bg-bone hover:border-ink/40"
                )}
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-bone-deep">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                  />
                  {p.isDefault && (
                    <div className="absolute top-1.5 left-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-bone">
                      Active
                    </div>
                  )}
                  <div className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-[9px] font-mono text-bone backdrop-blur-xs">
                    {score}%
                  </div>
                </div>
                <div className="mt-2 px-1">
                  <p className="text-xs font-semibold text-ink truncate">{p.name}</p>
                  <p className="text-[10px] text-ink-soft truncate font-mono">
                    {p.calibration?.heightCm ? `${p.calibration.heightCm} cm` : "175 cm"} •{" "}
                    {p.calibration?.bodySilhouette || "Athletic"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab === "calibrate" ? (
        /* MAIN CALIBRATION INTERACTIVE STUDIO */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 6 COLS: INTERACTIVE CALIBRATION CANVAS */}
          <div className="lg:col-span-6 flex flex-col items-center space-y-4">
            <div className="w-full rounded-3xl border border-line bg-paper p-5 shadow-sm">
              {/* Studio Viewport Header */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5 px-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-ink">
                    Calibration Viewport
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    2:3 VTON Frame
                  </span>
                </div>

                {/* Streamlined Studio Toolbar */}
                <div className="flex items-center gap-1 bg-bone-deep/50 dark:bg-black/30 p-1 rounded-2xl border border-line">
                  {/* 1. Guides Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowGuidelines(!showGuidelines)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl px-2.5 h-7.5 text-xs font-semibold transition-all cursor-pointer active:scale-95",
                      showGuidelines
                        ? "bg-ink text-bone shadow-2xs"
                        : "text-ink-soft hover:text-ink hover:bg-bone"
                    )}
                    title="Toggle alignment guidelines & VTON frame"
                  >
                    {showGuidelines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>Guides</span>
                  </button>

                  {/* 2. Reset Button */}
                  <button
                    type="button"
                    onClick={handleResetFraming}
                    className="inline-flex items-center justify-center rounded-xl h-7.5 w-7.5 text-ink-soft hover:text-ink hover:bg-bone transition-all cursor-pointer active:scale-95"
                    title="Reset framing & zoom"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>

                  <div className="h-4 w-px bg-line/80 mx-0.5" />

                  {/* 3. Auto-Fit Button */}
                  <button
                    type="button"
                    onClick={() => handleAutoFitFraming()}
                    disabled={isAutoFraming || !targetedPerson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-flame/30 bg-flame/10 px-2.5 h-7.5 text-xs font-bold text-flame hover:bg-flame hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Auto-Fit persona to VTON frame with safe head & shoes margins"
                  >
                    <Wand2 className={clsx("h-3.5 w-3.5", isAutoFraming && "animate-spin")} />
                    <span>Auto-Fit</span>
                  </button>

                  {/* 4. Permanent Save Frame Button */}
                  <button
                    type="button"
                    onClick={handleSaveCalibration}
                    disabled={isSaving || !targetedPerson}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl px-3 h-7.5 text-xs font-bold transition-all cursor-pointer active:scale-95",
                      saveSuccess
                        ? "bg-emerald-600 text-white shadow-2xs shadow-emerald-500/20"
                        : "bg-ink text-bone hover:bg-flame shadow-2xs"
                    )}
                    title="Permanently save fitted framing to this persona"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Viewport Canvas with Guidelines Overlay: Natural 2:3 Studio Canvas */}
              <div className="relative aspect-[2/3] w-full max-w-sm sm:max-w-md mx-auto overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[#fafafa] dark:bg-[#111113] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_35px_-5px_rgba(0,0,0,0.4)] select-none flex items-center justify-center">
                {targetedPerson ? (
                  <div className="relative h-full w-full overflow-hidden flex items-center justify-center">
                    <img
                      src={targetedPerson.image}
                      alt={targetedPerson.name}
                      style={{
                        transform: `scale(${zoom}) translate(${xOffset}%, ${yOffset}%)`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease-out, filter 0.25s ease-out",
                        filter: lightingStyle.filter,
                      }}
                      className="h-full w-full object-contain pointer-events-none"
                    />

                    {/* Ambient Lighting Simulation Overlay */}
                    {lighting !== "studio-neutral" && (
                      <div
                        className={clsx(
                          "absolute inset-0 pointer-events-none transition-opacity duration-300",
                          lighting === "warm-sunlight" && "bg-gradient-to-tr from-amber-400/15 via-orange-300/10 to-transparent mix-blend-soft-light",
                          lighting === "cool-ambient" && "bg-gradient-to-tr from-sky-400/15 via-blue-300/10 to-transparent mix-blend-soft-light"
                        )}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-ink-soft">
                    <User className="h-10 w-10 mb-2" />
                    <p className="text-xs">No persona loaded</p>
                  </div>
                )}


                {/* Professional Studio Camera Viewfinder Guidelines (z-30 Guaranteed on Top of Photo) */}
                {showGuidelines && (
                  <div className="absolute inset-0 pointer-events-none z-30">
                    {/* Outer Dotted VTON Safe Frame with Curved Edges */}
                    <div className="absolute inset-3.5 sm:inset-4.5 rounded-2xl border-2 border-dashed border-emerald-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                      {/* Top Corner Pill: VTON Safe Frame */}
                      <div className="absolute -top-2.5 left-3 bg-black/90 text-emerald-300 border border-emerald-400/50 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>VTON FRAME</span>
                      </div>

                      {/* Bottom Corner Pill: Safe Bounds */}
                      <div className="absolute -bottom-2.5 right-3 bg-black/90 text-emerald-300 border border-emerald-400/50 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md tracking-wider">
                        <span>SAFE BOUNDS</span>
                      </div>
                    </div>

                    {/* 4 High-Contrast Studio Viewfinder Corner Marks */}
                    <div className="absolute top-3.5 left-3.5 w-4 h-4 border-t-2 border-l-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                    <div className="absolute top-3.5 right-3.5 w-4 h-4 border-t-2 border-r-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                    <div className="absolute bottom-3.5 left-3.5 w-4 h-4 border-b-2 border-l-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                    <div className="absolute bottom-3.5 right-3.5 w-4 h-4 border-b-2 border-r-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />

                    {/* Central Vertical Plumb Axis */}
                    <div
                      className={clsx(
                        "absolute top-6 bottom-6 w-px border-l-2 border-dashed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-transform duration-200",
                        posture === "standing-quarter"
                          ? "left-[49%] rotate-[2deg] border-amber-300/80"
                          : "left-1/2 border-sky-300/80"
                      )}
                    />

                    {/* Left Metric Height Ruler */}
                    <div className="absolute left-2.5 top-8 bottom-8 flex flex-col justify-between text-[9px] font-mono text-emerald-300 font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] pointer-events-none">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-0.5 bg-emerald-400 shadow-xs" />
                        <span className="bg-black/85 px-1 py-0.2 rounded border border-emerald-500/30">{heightCm}cm</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-px bg-emerald-400/70" />
                        <span className="bg-black/60 px-0.5 rounded text-[8px] text-emerald-400/80">1/2</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-0.5 bg-emerald-400 shadow-xs" />
                        <span className="bg-black/85 px-1 py-0.2 rounded border border-emerald-500/30">0cm</span>
                      </div>
                    </div>

                    {/* Crown / Eyeline Guide */}
                    <div
                      style={{ top: `${crownTopPct}%` }}
                      className="absolute inset-x-6 border-t-2 border-dashed border-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150"
                    >
                      <span className="text-[9px] font-mono font-bold bg-black/85 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-xs">
                        HEAD / CROWN
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-black/85 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-xs">
                        {crownTopPct.toFixed(0)}%
                      </span>
                    </div>

                    {/* Shoulder Plane Axis */}
                    <div
                      style={{ top: `${shoulderTopPct}%` }}
                      className={clsx(
                        "absolute border-t-2 border-dashed border-sky-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150",
                        silhouetteGuideStyles.shoulderInset,
                        posture === "standing-quarter" && "rotate-[2.5deg]"
                      )}
                    >
                      <span className="text-[9px] font-mono font-bold bg-black/85 text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/40 shadow-xs">
                        SHOULDERS ({bodySilhouette.toUpperCase()})
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-black/85 text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/40 shadow-xs">
                        {silhouetteGuideStyles.tag}
                      </span>
                    </div>

                    {/* Waistline Guide */}
                    <div
                      style={{ top: `${waistTopPct}%` }}
                      className={clsx(
                        "absolute border-t-2 border-dashed drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150",
                        silhouetteGuideStyles.waistInset,
                        bodySilhouette === "curvy" ? "border-pink-400" : "border-emerald-400"
                      )}
                    >
                      <span className={clsx("text-[9px] font-mono font-bold bg-black/85 px-1.5 py-0.5 rounded border shadow-xs", bodySilhouette === "curvy" ? "text-pink-300 border-pink-400/40" : "text-emerald-300 border-emerald-400/40")}>
                        WAIST ({bodySilhouette === "curvy" ? "HOURGLASS" : bodySilhouette === "athletic" ? "V-TAPER" : "TORSO"})
                      </span>
                    </div>

                    {/* Hip / Hemline Level */}
                    <div
                      style={{ top: `${hipTopPct}%` }}
                      className={clsx(
                        "absolute border-t-2 border-dashed drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150",
                        silhouetteGuideStyles.hipInset,
                        bodySilhouette === "curvy" ? "border-pink-400" : "border-purple-400"
                      )}
                    >
                      <span className={clsx("text-[9px] font-mono font-bold bg-black/85 px-1.5 py-0.5 rounded border shadow-xs", bodySilhouette === "curvy" ? "text-pink-300 border-pink-400/40" : "text-purple-300 border-purple-400/40")}>
                        HIP / HEM
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-black/85 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/40 shadow-xs">
                        {hipTopPct.toFixed(0)}%
                      </span>
                    </div>

                    {/* Ground / Footbed Reference Line (High contrast green safe line) */}
                    <div
                      style={{ bottom: `${groundBottomPct}%` }}
                      className="absolute inset-x-6 border-t-2 border-dashed border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150"
                    >
                      <span className="text-[9px] font-mono text-emerald-300 font-bold bg-black/85 px-1.5 py-0.5 rounded border border-emerald-400/40 shadow-xs">
                        {framing === "three-quarters" ? "3/4 THIGH CROP" : "SAFE FOOTBED (SHOES)"}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-300 font-bold bg-black/85 px-1.5 py-0.5 rounded border border-emerald-400/40 shadow-xs">
                        {framing === "three-quarters" ? "3/4" : `${(100 - groundBottomPct).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Framing Fine-Tuning Controls */}
              <div className="mt-4 space-y-3 bg-bone rounded-2xl p-3.5 border border-line">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Maximize2 className="h-3.5 w-3.5 text-flame" />
                    Framing Zoom / Scale
                  </span>
                  <span className="text-xs font-mono font-bold text-ink">{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.02"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full accent-flame h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium text-ink-soft">Vertical Pan</span>
                      <span className="font-mono text-ink font-semibold">{yOffset}%</span>
                    </div>
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={yOffset}
                      onChange={(e) => setYOffset(parseInt(e.target.value))}
                      className="w-full accent-ink h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium text-ink-soft">Horizontal Pan</span>
                      <span className="font-mono text-ink font-semibold">{xOffset}%</span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      value={xOffset}
                      onChange={(e) => setXOffset(parseInt(e.target.value))}
                      className="w-full accent-ink h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="w-full flex items-center gap-3">
              <Link
                href="/try-on"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-semibold text-bone hover:bg-flame transition-colors shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Try Outfits on Calibrated Persona</span>
              </Link>
              {targetedPerson && persons.length > 1 && (
                <button
                  onClick={() => handleDelete(targetedPerson.id, targetedPerson.name)}
                  className="rounded-2xl border border-line bg-paper p-3 text-ink-soft hover:text-red-500 hover:border-red-500/30 transition-colors shadow-sm"
                  title="Remove this profile"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* RIGHT 6 COLS: PHYSICAL ATTRIBUTES & CALIBRATION METRICS */}
          <div className="lg:col-span-6 space-y-6">
            {/* Calibration Metrics Card */}
            <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Physical Calibration Specs
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Calibrate height, silhouette, and posture for DensePose cloth wrapping
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {computedScore}/100 Score
                  </span>
                  <p className="text-[10px] text-ink-soft">VTON Fit Quality</p>
                </div>
              </div>

              {/* 1. Height Adjustment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5 text-flame" />
                    Reference Height
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-bone-deep px-2 py-0.5 text-xs font-mono font-bold text-ink">
                      {heightCm} cm
                    </span>
                    <span className="text-xs font-mono text-ink-soft font-medium">
                      ({heightImperial})
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="145"
                  max="210"
                  step="1"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseInt(e.target.value))}
                  className="w-full accent-flame h-2 bg-bone rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-ink-soft font-mono mt-1">
                  <span>Petite (145 cm)</span>
                  <span>Average (175 cm)</span>
                  <span>Tall (210 cm)</span>
                </div>
              </div>

              {/* 2. Body Silhouette */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink">
                    Body Frame & Silhouette
                  </label>
                  {targetedPerson && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const detected = await detectBodySilhouetteFromImageSrc(targetedPerson.image);
                          if (detected) {
                            setBodySilhouette(detected);
                            setIsSilhouetteAutoDetected(true);
                          }
                        } catch (e) {
                          console.warn("Auto silhouette detection fallback:", e);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Auto-detect</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SILHOUETTES.map((s) => {
                    const isSelected = bodySilhouette === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setBodySilhouette(s.id);
                          setIsSilhouetteAutoDetected(false);
                        }}
                        className={clsx(
                          "flex flex-col text-left p-3 rounded-2xl border transition-all cursor-pointer",
                          isSelected
                            ? "border-ink bg-bone-deep ring-1 ring-ink text-ink shadow-2xs"
                            : "border-line bg-bone hover:border-ink/40 text-ink-soft"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-ink">{s.label}</span>
                          {isSelected && isSilhouetteAutoDetected && (
                            <span className="text-[9px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                              AI Detected
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-ink-soft mt-0.5 leading-tight">
                          {s.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Primary Posture */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink">
                    Reference Stance & Posture
                  </label>
                  <span className="text-[10px] font-mono text-ink-soft">
                    {posture === "standing-frontal" ? "Symmetric Plumb Axis" : "Dynamic 3/4 Turn Axis"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {POSTURES.map((p) => {
                    const isSelected = posture === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePostureChange(p.id)}
                        className={clsx(
                          "flex flex-col text-left p-3 rounded-2xl border transition-all cursor-pointer",
                          isSelected
                            ? "border-ink bg-bone-deep ring-1 ring-ink shadow-2xs"
                            : "border-line bg-bone hover:border-ink/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">{p.label}</span>
                        </div>
                        <span className="text-[9px] font-mono text-flame font-semibold mt-1">
                          {p.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Framing Type & Lighting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink">
                      Framing Coverage
                    </label>
                    <span className="text-[10px] font-mono text-flame font-bold">
                      {framing === "three-quarters" ? "3/4 Crop" : "Full Length"}
                    </span>
                  </div>
                  <select
                    value={framing}
                    onChange={(e) => handleFramingCoverageChange(e.target.value as PersonaFraming)}
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none cursor-pointer"
                  >
                    {FRAMINGS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Lighting Environment
                  </label>
                  <select
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value as PersonaLighting)}
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none cursor-pointer"
                  >
                    {LIGHTINGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save Calibration Button */}
              <button
                type="button"
                onClick={handleSaveCalibration}
                disabled={isSaving || !targetedPerson}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-50 transition-all shadow-sm cursor-pointer active:scale-[0.99]"
              >
                {isSaving ? (
                  <span>Synchronizing calibration specs...</span>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Persona Calibration</span>
                  </>
                )}
              </button>
            </div>

            {/* Diagnostic Scorecard */}
            <div className="rounded-3xl border border-line bg-paper p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                DensePose VTON Compatibility Checklist
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-bone">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-ink">Aspect Ratio Match</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                    2:3 Studio (1024×1536)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-bone">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-ink">DensePose Keypoint Alignment</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                    Optimal
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-bone">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-ink">Local Storage & Privacy</span>
                  </div>
                  <span className="font-mono text-[11px] text-ink-soft">On-Device Only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* REGISTER NEW PERSONA TAB WITH LIVE CALIBRATION */
        <div className="max-w-2xl mx-auto rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="font-display text-xl font-bold text-ink">
              Register & Calibrate New Persona
            </h3>
            <p className="text-xs text-ink-soft mt-1">
              Upload a clear photo in natural or studio lighting. Standing poses with visible head and shoulders give optimal DensePose accuracy.
            </p>
          </div>

          <form onSubmit={handleCreatePersonaWithCalibration} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Persona Label / Name
              </label>
              <input
                type="text"
                placeholder="e.g. Elena Studio / Alex Casual"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full rounded-xl border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:border-ink focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Photo Upload
              </label>

              {previewImage ? (
                <div className="space-y-4">
                  {/* Photo Preview Canvas: Natural 2:3 Studio Canvas */}
                  <div className="relative aspect-[2/3] max-w-sm sm:max-w-md w-full mx-auto overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-[#fafafa] dark:bg-[#111113] shadow-[0_10px_35px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_35px_-5px_rgba(0,0,0,0.4)] flex items-center justify-center">
                    <img
                      src={previewImage}
                      alt="Upload Preview"
                      style={{
                        transform: `scale(${zoom}) translate(${xOffset}%, ${yOffset}%)`,
                        transformOrigin: "center center",
                        filter: lightingStyle.filter,
                      }}
                      className="h-full w-full object-contain pointer-events-none transition-transform duration-150"
                    />

                    {/* Ambient Lighting Simulation Overlay */}
                    {lighting !== "studio-neutral" && (
                      <div
                        className={clsx(
                          "absolute inset-0 pointer-events-none transition-opacity duration-300",
                          lighting === "warm-sunlight" && "bg-gradient-to-tr from-amber-400/15 via-orange-300/10 to-transparent mix-blend-soft-light",
                          lighting === "cool-ambient" && "bg-gradient-to-tr from-sky-400/15 via-blue-300/10 to-transparent mix-blend-soft-light"
                        )}
                      />
                    )}

                    {/* Minimalist Top Control Bar */}
                    <div className="absolute top-2 inset-x-2.5 z-40 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 backdrop-blur-md px-3 py-1 text-[10px] font-mono font-medium text-white/95 border border-white/15 shadow-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Preview • {zoom.toFixed(2)}x</span>
                      </span>

                      <div className="flex items-center gap-1 pointer-events-auto bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/15 shadow-md">
                        <button
                          type="button"
                          onClick={() => handleAutoFitFraming(previewImage)}
                          disabled={isAutoFraming}
                          className="inline-flex items-center gap-1 px-2.5 h-7 text-xs font-bold rounded-xl border border-flame/40 bg-flame/20 text-flame hover:bg-flame hover:text-white transition-all cursor-pointer active:scale-95"
                          title="Auto-Fit persona into VTON frame"
                        >
                          <Wand2 className={clsx("h-3 w-3", isAutoFraming && "animate-spin")} />
                          <span>Auto-Fit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowGuidelines(!showGuidelines)}
                          className={clsx(
                            "inline-flex items-center gap-1 px-2.5 h-7 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95",
                            showGuidelines
                              ? "bg-white text-ink font-bold shadow-2xs"
                              : "text-white/80 hover:text-white hover:bg-white/10"
                          )}
                        >
                          {showGuidelines ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          <span>Guides</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setFileToUpload(null);
                            setIsSilhouetteAutoDetected(false);
                          }}
                          className="rounded-xl p-1.5 text-white/70 hover:text-flame hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
                          title="Clear photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Professional Studio Camera Viewfinder Guidelines (z-30 Guaranteed on Top of Photo) */}
                    {showGuidelines && (
                      <div className="absolute inset-0 pointer-events-none z-30">
                        {/* Outer Dotted VTON Safe Frame with Curved Edges */}
                        <div className="absolute inset-3.5 sm:inset-4.5 rounded-2xl border-2 border-dashed border-emerald-400 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                          {/* Top Corner Pill: VTON Safe Frame */}
                          <div className="absolute -top-2.5 left-3 bg-black/90 text-emerald-300 border border-emerald-400/50 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>VTON FRAME</span>
                          </div>

                          {/* Bottom Corner Pill: Safe Bounds */}
                          <div className="absolute -bottom-2.5 right-3 bg-black/90 text-emerald-300 border border-emerald-400/50 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md tracking-wider">
                            <span>SAFE BOUNDS</span>
                          </div>
                        </div>
                        {/* 4 High-Contrast Studio Viewfinder Corner Marks */}
                        <div className="absolute top-3.5 left-3.5 w-4 h-4 border-t-2 border-l-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                        <div className="absolute top-3.5 right-3.5 w-4 h-4 border-t-2 border-r-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                        <div className="absolute bottom-3.5 left-3.5 w-4 h-4 border-b-2 border-l-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                        <div className="absolute bottom-3.5 right-3.5 w-4 h-4 border-b-2 border-r-2 border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />

                        {/* Central Plumb Line */}
                        <div
                          className={clsx(
                            "absolute top-6 bottom-6 w-px border-l-2 border-dashed drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] transition-transform duration-200",
                            posture === "standing-quarter"
                              ? "left-[49%] rotate-[2deg] border-amber-300/80"
                              : "left-1/2 border-sky-300/80"
                          )}
                        />

                        {/* Crown / Eyeline Guide */}
                        <div
                          style={{ top: `${crownTopPct}%` }}
                          className="absolute inset-x-6 border-t-2 border-dashed border-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150"
                        >
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-xs">
                            HEAD / CROWN
                          </span>
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/40 shadow-xs">
                            {crownTopPct.toFixed(0)}%
                          </span>
                        </div>

                        {/* Shoulders Guide */}
                        <div
                          style={{ top: `${shoulderTopPct}%` }}
                          className={clsx(
                            "absolute border-t-2 border-dashed border-sky-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150",
                            silhouetteGuideStyles.shoulderInset,
                            posture === "standing-quarter" && "rotate-[2.5deg]"
                          )}
                        >
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/40 shadow-xs">
                            SHOULDERS ({bodySilhouette.toUpperCase()})
                          </span>
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/40 shadow-xs">
                            {silhouetteGuideStyles.tag}
                          </span>
                        </div>

                        {/* Waist Guide */}
                        <div
                          style={{ top: `${waistTopPct}%` }}
                          className={clsx(
                            "absolute border-t-2 border-dashed border-pink-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150",
                            silhouetteGuideStyles.waistInset
                          )}
                        >
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-pink-300 px-1.5 py-0.5 rounded border border-pink-400/40 shadow-xs">
                            WAIST / TORSO
                          </span>
                        </div>

                        {/* Feet / Ground Guide (Green safe line, shoes clearly visible below) */}
                        <div
                          style={{ bottom: `${groundBottomPct}%` }}
                          className="absolute inset-x-6 border-t-2 border-dashed border-emerald-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] flex items-center justify-between transition-all duration-150"
                        >
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-400/40 shadow-xs">
                            FEET / SOLES SAFE ZONE
                          </span>
                          <span className="text-[9px] font-mono font-bold bg-black/85 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-400/40 shadow-xs">
                            {(100 - groundBottomPct).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Calibration Sliders for Preview */}
                  <div className="bg-bone rounded-2xl p-4 border border-line space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5 text-flame" />
                        <span>Framing Scale & VTON Fit</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink text-xs font-semibold">{zoom.toFixed(2)}x</span>
                        <button
                          type="button"
                          onClick={() => handleAutoFitFraming(previewImage)}
                          disabled={isAutoFraming}
                          className="inline-flex items-center gap-1 text-[10px] text-flame hover:underline font-mono cursor-pointer"
                        >
                          <Wand2 className="h-3 w-3" />
                          <span>Auto-Fit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setZoom(1.0);
                            setXOffset(0);
                            setYOffset(0);
                          }}
                          className="text-[10px] text-ink-soft hover:text-flame transition-colors font-mono cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="1.6"
                      step="0.02"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-flame h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                    />

                    {/* Pan Sliders */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium text-ink-soft">Vertical Pan</span>
                          <span className="font-mono text-ink font-semibold">{yOffset}%</span>
                        </div>
                        <input
                          type="range"
                          min="-25"
                          max="25"
                          step="1"
                          value={yOffset}
                          onChange={(e) => setYOffset(parseInt(e.target.value))}
                          className="w-full accent-ink h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-medium text-ink-soft">Horizontal Pan</span>
                          <span className="font-mono text-ink font-semibold">{xOffset}%</span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="1"
                          value={xOffset}
                          onChange={(e) => setXOffset(parseInt(e.target.value))}
                          className="w-full accent-ink h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/60 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>VTON Bounds: Head, shoulders & shoes protected</span>
                      </div>
                      <span className="text-ink-soft font-mono text-[10px]">2:3 Native Studio</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-bone p-8 text-center cursor-pointer hover:border-ink transition-colors"
                  >
                    <Camera className="h-8 w-8 text-flame mb-2" />
                    <p className="text-xs font-semibold text-ink">
                      Click to choose photo from device
                    </p>
                    <p className="text-[11px] text-ink-soft mt-1">
                      High resolution, standing upright, uncrossed arms recommended
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Preset quick links */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] text-ink-soft">Quick load preset:</span>
                    {PRESET_MODELS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={async () => {
                          setPreviewImage(preset.image);
                          setNameInput(preset.name);
                          setFitMode("contain");
                          try {
                            const detected = await detectBodySilhouetteFromImageSrc(preset.image);
                            if (detected) {
                              setBodySilhouette(detected);
                              setIsSilhouetteAutoDetected(true);
                            }
                            const framing = await detectAutoFitFramingFromImageSrc(preset.image);
                            if (framing) {
                              setZoom(framing.zoom);
                              setXOffset(framing.xOffset);
                              setYOffset(framing.yOffset);
                            }
                          } catch {}
                        }}
                        className="rounded-full border border-line bg-bone px-3 py-1 text-[11px] font-medium text-ink hover:bg-bone-deep transition-colors cursor-pointer"
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Calibration Defaults */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="140"
                  max="220"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseInt(e.target.value) || 175)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-ink">
                    Body Silhouette
                  </label>
                  {isSilhouetteAutoDetected && (
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded font-bold">
                      AI Auto-Selected
                    </span>
                  )}
                </div>
                <select
                  value={bodySilhouette}
                  onChange={(e) => {
                    setBodySilhouette(e.target.value as BodySilhouette);
                    setIsSilhouetteAutoDetected(false);
                  }}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none cursor-pointer"
                >
                  {SILHOUETTES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.desc})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || (!previewImage && !fileToUpload)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-40 transition-colors shadow-sm"
            >
              {isSaving ? (
                <span>Registering and calibrating persona...</span>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save & Activate Persona</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-ink-soft">Loading calibration studio...</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
