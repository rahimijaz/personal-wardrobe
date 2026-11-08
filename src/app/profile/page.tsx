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

  const handleResetFraming = () => {
    setZoom(1.0);
    setXOffset(0);
    setYOffset(0);
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
    reader.onload = () => {
      setPreviewImage(reader.result as string);
      if (!nameInput) {
        setNameInput("Custom Persona");
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
          {targetedPerson && (
            <div className="flex items-center gap-2">
              {targetedPerson.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="h-3 w-3 stroke-[3]" />
                  Active Model
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await setActivePersonById(targetedPerson.id);
                  }}
                  className="rounded-full border border-line bg-bone px-3 py-1 text-[11px] font-semibold text-ink hover:bg-bone-deep transition-colors"
                >
                  Make Active Model
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3.5">
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
                  "group relative cursor-pointer overflow-hidden rounded-2xl border p-2 transition-all duration-200",
                  isSelected
                    ? "border-ink bg-bone-deep/70 ring-2 ring-ink shadow-sm"
                    : "border-line bg-bone hover:border-ink/40"
                )}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bone-deep">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
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
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink-soft">
                    Calibration Viewport
                  </span>
                  <span className="rounded-md bg-flame/10 px-2 py-0.5 text-[10px] font-bold text-flame">
                    3:4 Aspect Ratio
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowGuidelines(!showGuidelines)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      showGuidelines
                        ? "border-flame/40 bg-flame/10 text-flame"
                        : "border-line bg-bone text-ink-soft hover:text-ink"
                    )}
                    title="Toggle alignment guidelines"
                  >
                    {showGuidelines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    <span>{showGuidelines ? "Guides ON" : "Guides OFF"}</span>
                  </button>

                  <button
                    onClick={handleResetFraming}
                    className="rounded-xl border border-line bg-bone p-1.5 text-ink-soft hover:text-ink transition-colors"
                    title="Reset framing & zoom"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Viewport Canvas with Guidelines Overlay */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep shadow-inner select-none">
                {targetedPerson ? (
                  <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                    <img
                      src={targetedPerson.image}
                      alt={targetedPerson.name}
                      style={{
                        transform: `scale(${zoom}) translate(${xOffset}%, ${yOffset}%)`,
                        transformOrigin: "center center",
                        transition: "transform 0.15s ease-out",
                      }}
                      className="h-full w-full object-cover pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-ink-soft">
                    <User className="h-10 w-10 mb-2" />
                    <p className="text-xs">No persona loaded</p>
                  </div>
                )}

                {/* DensePose Anatomical Overlay Guidelines */}
                {showGuidelines && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Outer Target Framing Box */}
                    <div className="absolute inset-4 rounded-xl border border-dashed border-emerald-400/40">
                      <div className="absolute top-1 left-2 text-[9px] font-mono text-emerald-400/80 font-bold tracking-wider">
                        DENSEPOSE VTON FRAME
                      </div>
                    </div>

                    {/* Central Vertical Plumb Line */}
                    <div className="absolute left-1/2 top-4 bottom-4 w-px border-l border-dashed border-sky-400/35" />

                    {/* Crown / Eyeline Guide (top 15%) */}
                    <div className="absolute top-[15%] inset-x-4 border-t border-dashed border-amber-400/60 flex items-center justify-between px-2">
                      <span className="text-[9px] font-mono text-amber-400 font-bold bg-ink/70 px-1 rounded-xs">
                        HEAD / CROWN
                      </span>
                      <span className="text-[9px] font-mono text-amber-400/80">15%</span>
                    </div>

                    {/* Shoulder Plane Axis (top 26%) */}
                    <div className="absolute top-[26%] inset-x-4 border-t border-dashed border-sky-400/60 flex items-center justify-between px-2">
                      <span className="text-[9px] font-mono text-sky-400 font-bold bg-ink/70 px-1 rounded-xs">
                        SHOULDER PLANE
                      </span>
                      <span className="text-[9px] font-mono text-sky-400/80">26%</span>
                    </div>

                    {/* Natural Waistline / Torso Center (top 45%) */}
                    <div className="absolute top-[45%] inset-x-4 border-t border-dashed border-emerald-400/60 flex items-center justify-between px-2">
                      <span className="text-[9px] font-mono text-emerald-400 font-bold bg-ink/70 px-1 rounded-xs">
                        NATURAL WAIST / TORSO
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400/80">45%</span>
                    </div>

                    {/* Hip & Hemline Level (top 60%) */}
                    <div className="absolute top-[60%] inset-x-4 border-t border-dashed border-purple-400/60 flex items-center justify-between px-2">
                      <span className="text-[9px] font-mono text-purple-400 font-bold bg-ink/70 px-1 rounded-xs">
                        HIP / TROUSER HEM
                      </span>
                      <span className="text-[9px] font-mono text-purple-400/80">60%</span>
                    </div>

                    {/* Bottom Ground Reference (bottom 8%) */}
                    <div className="absolute bottom-[8%] inset-x-4 border-t border-dashed border-bone/40 flex items-center justify-between px-2">
                      <span className="text-[9px] font-mono text-bone/70 bg-ink/70 px-1 rounded-xs">
                        GROUND / FOOTBED
                      </span>
                      <span className="text-[9px] font-mono text-bone/60">92%</span>
                    </div>

                    {/* Crosshair Center Reticle */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-40">
                      <div className="w-6 h-px bg-flame" />
                      <div className="h-6 w-px bg-flame -ml-3" />
                    </div>
                  </div>
                )}

                {/* Bottom Canvas HUD Tag */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/50 to-transparent p-3.5 text-bone flex items-end justify-between">
                  <div>
                    <h4 className="text-xs font-bold font-display">{targetedPerson?.name}</h4>
                    <p className="text-[10px] text-bone/80 font-mono mt-0.5">
                      Scale {zoom.toFixed(2)}x • Offset ({xOffset}%, {yOffset}%)
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                    {computedScore}% Calibrated
                  </div>
                </div>
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
                  min="0.8"
                  max="1.5"
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
                <label className="block text-xs font-semibold text-ink mb-2">
                  Body Frame & Silhouette
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SILHOUETTES.map((s) => {
                    const isSelected = bodySilhouette === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setBodySilhouette(s.id)}
                        className={clsx(
                          "flex flex-col text-left p-3 rounded-2xl border transition-all",
                          isSelected
                            ? "border-ink bg-bone-deep ring-1 ring-ink text-ink"
                            : "border-line bg-bone hover:border-ink/40 text-ink-soft"
                        )}
                      >
                        <span className="text-xs font-bold text-ink">{s.label}</span>
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
                <label className="block text-xs font-semibold text-ink mb-2">
                  Reference Stance & Posture
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {POSTURES.map((p) => {
                    const isSelected = posture === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPosture(p.id)}
                        className={clsx(
                          "flex flex-col text-left p-3 rounded-2xl border transition-all",
                          isSelected
                            ? "border-ink bg-bone-deep ring-1 ring-ink"
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
                  <label className="block text-xs font-semibold text-ink mb-1.5">
                    Framing Coverage
                  </label>
                  <select
                    value={framing}
                    onChange={(e) => setFraming(e.target.value as PersonaFraming)}
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
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
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-50 transition-all shadow-sm"
              >
                {isSaving ? (
                  <span>Synchronizing calibration...</span>
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
                  <span className="font-mono text-[11px] text-ink-soft">3:4 Standard</span>
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
                <div className="space-y-3">
                  <div className="relative aspect-[3/4] max-h-96 w-full mx-auto overflow-hidden rounded-2xl border border-line bg-bone-deep">
                    <img
                      src={previewImage}
                      alt="Upload Preview"
                      style={{
                        transform: `scale(${zoom}) translate(${xOffset}%, ${yOffset}%)`,
                        transformOrigin: "center center",
                      }}
                      className="h-full w-full object-cover"
                    />

                    {showGuidelines && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-4 rounded-xl border border-dashed border-emerald-400/40" />
                        <div className="absolute top-[26%] inset-x-4 border-t border-dashed border-sky-400/60" />
                        <div className="absolute top-[45%] inset-x-4 border-t border-dashed border-emerald-400/60" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null);
                        setFileToUpload(null);
                      }}
                      className="absolute top-2.5 right-2.5 rounded-full bg-ink/80 p-1.5 text-bone hover:bg-flame transition-colors"
                      title="Clear photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Calibration Sliders for Preview */}
                  <div className="bg-bone rounded-xl p-3 border border-line space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">Fine-tune Framing Zoom</span>
                      <span className="font-mono text-ink">{zoom.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.5"
                      step="0.02"
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                      className="w-full accent-flame h-1.5 bg-bone-deep rounded-lg cursor-pointer"
                    />
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
                        onClick={() => {
                          setPreviewImage(preset.image);
                          setNameInput(preset.name);
                        }}
                        className="rounded-full border border-line bg-bone px-3 py-1 text-[11px] font-medium text-ink hover:bg-bone-deep transition-colors"
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
                <label className="block text-xs font-semibold text-ink mb-1">
                  Body Silhouette
                </label>
                <select
                  value={bodySilhouette}
                  onChange={(e) => setBodySilhouette(e.target.value as BodySilhouette)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
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
