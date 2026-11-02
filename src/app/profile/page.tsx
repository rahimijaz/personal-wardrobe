"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";
import Link from "next/link";

export default function ProfilePage() {
  const {
    persons,
    activePerson,
    refreshPersons,
    setActivePersonById,
  } = useWardrobe();

  const [isUploading, setIsUploading] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const PRESET_MODELS = [
    { name: "Elena (Full Body)", image: "/samples/model.png" },
    { name: "Sofia (Studio)", image: "/samples/model3.png" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
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
    setError(null);
  };

  const handleCreatePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage && !fileToUpload) {
      setError("Please upload a person image.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      if (fileToUpload) {
        const formData = new FormData();
        formData.append("name", nameInput.trim() || "My Persona");
        formData.append("isDefault", "true");
        formData.append("image", fileToUpload);

        const res = await fetch("/api/persons", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Failed to upload person image");
      } else if (previewImage) {
        const res = await fetch("/api/persons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: nameInput.trim() || "My Persona",
            image: previewImage,
            isDefault: true,
          }),
        });
        if (!res.ok) throw new Error("Failed to save person profile");
      }

      await refreshPersons();
      setPreviewImage(null);
      setFileToUpload(null);
      setNameInput("");
      setSuccessMsg("Persona profile saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create persona");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete persona "${name}"?`)) {
      const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
      if (res.ok) {
        await refreshPersons();
      } else {
        const d = await res.json();
        alert(d.error || "Could not delete this profile.");
      }
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-8 md:p-10 max-w-5xl mx-auto w-full page-enter">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
          Person Profile
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage your virtual try-on personas and reference photos
        </p>
      </div>

      {/* Privacy Notice Card */}
      <div className="mb-8 flex items-start gap-3.5 rounded-2xl border border-emerald-600/20 dark:border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 p-4 text-emerald-900 dark:text-emerald-300">
        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-semibold text-emerald-950 dark:text-emerald-200">
            Private by Design — Your photos stay on your device
          </p>
          <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-400/90 leading-relaxed">
            This image is processed locally for virtual try-on. No photos are ever sent to
            third-party clouds, external APIs, or analytics servers.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/15 dark:bg-emerald-500/20 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Active Persona Preview */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="w-full rounded-3xl border border-line bg-paper p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-ink-soft">
                Current Active Persona
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                Ready for VTON
              </span>
            </div>

            {activePerson ? (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep">
                <img
                  src={activePerson.image}
                  alt={activePerson.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent p-4 text-bone">
                  <h3 className="font-display text-lg font-bold">
                    {activePerson.name}
                  </h3>
                  <p className="text-[11px] text-bone/80 font-mono mt-0.5">
                    Added {new Date(activePerson.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-[3/4] w-full rounded-2xl border-2 border-dashed border-line flex flex-col items-center justify-center p-6 text-center text-ink-soft">
                <User className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">No persona selected</p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <Link
                href="/try-on"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-bone hover:bg-flame transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Try Clothes On</span>
              </Link>

              {activePerson && persons.length > 1 && (
                <button
                  onClick={() => handleDelete(activePerson.id, activePerson.name)}
                  className="rounded-xl border border-line p-2.5 text-ink-soft hover:text-red-500 transition-colors"
                  title="Remove this profile"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Switch Personas & Upload New Persona */}
        <div className="md:col-span-7 space-y-6">
          {/* Persona Switcher */}
          <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-ink mb-1">
              Select Reference Persona
            </h3>
            <p className="text-xs text-ink-soft mb-4">
              Switch between studio reference models or your own photos
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {persons.map((p) => {
                const isActive = activePerson?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePersonById(p.id)}
                    className={clsx(
                      "group relative cursor-pointer overflow-hidden rounded-2xl border p-2 transition-all duration-200",
                      isActive
                        ? "border-ink bg-bone-deep/60 ring-2 ring-ink"
                        : "border-line bg-bone hover:border-ink/50"
                    )}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-bone-deep">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      {isActive && (
                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-bone shadow-xs">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-ink truncate px-1">
                      {p.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload New Reference Photo Form */}
          <div className="rounded-3xl border border-line bg-paper p-6 shadow-sm">
            <h3 className="font-display text-lg font-bold text-ink mb-1">
              Add New Reference Photo
            </h3>
            <p className="text-xs text-ink-soft mb-4">
              Upload a clear, full-body or upper-body photo in natural light
            </p>

            <form onSubmit={handleCreatePersona} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Persona Label / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Casual Look / Alex"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bone px-3.5 py-2 text-xs text-ink focus:border-ink focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  Reference Photo
                </label>

                {previewImage ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-bone-deep">
                    <img
                      src={previewImage}
                      alt="Persona Preview"
                      className="h-full w-full object-contain p-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null);
                        setFileToUpload(null);
                      }}
                      className="absolute top-2.5 right-2.5 rounded-full bg-ink/80 p-1 text-bone hover:bg-flame"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-bone p-6 text-center cursor-pointer hover:border-ink transition-colors"
                    >
                      <Camera className="h-6 w-6 text-flame mb-2" />
                      <p className="text-xs font-semibold text-ink">
                        Click to select photo from device
                      </p>
                      <p className="text-[10px] text-ink-soft mt-0.5">
                        High resolution, standing pose recommended
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>

                    {/* Presets */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] text-ink-soft">Or load preset:</span>
                      {PRESET_MODELS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setPreviewImage(preset.image);
                            setNameInput(preset.name);
                          }}
                          className="rounded-full border border-line bg-bone px-2.5 py-0.5 text-[10px] font-medium text-ink hover:bg-bone-deep"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isUploading || (!previewImage && !fileToUpload)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-bone hover:bg-flame disabled:opacity-40 transition-colors shadow-sm"
              >
                {isUploading ? (
                  <span>Saving photo locally...</span>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Save Persona Profile</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
