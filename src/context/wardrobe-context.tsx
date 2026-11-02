"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type {
  Garment,
  Person,
  Outfit,
  VtonJob,
  VtonCategory,
  GarmentPhotoType,
  InferenceParameters,
} from "@/lib/types";
import { DEFAULT_INFERENCE_PARAMETERS } from "@/lib/types";

interface EngineStatus {
  online: boolean;
  engine: string;
  device: string;
  weightsFound: boolean;
  modelSizeMb?: number;
  url: string;
  message: string;
}

interface WardrobeContextType {
  garments: Garment[];
  persons: Person[];
  activePerson: Person | null;
  outfits: Outfit[];
  activeJob: VtonJob | null;
  engineStatus: EngineStatus | null;
  isLoadingGarments: boolean;
  isLoadingOutfits: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  inferenceParams: InferenceParameters;
  updateInferenceParams: (partial: Partial<InferenceParameters>) => void;
  resetInferenceParams: () => void;
  refreshGarments: () => Promise<void>;
  refreshPersons: () => Promise<void>;
  refreshOutfits: () => Promise<void>;
  setActivePersonById: (id: string) => Promise<void>;
  startTryOn: (
    personId: string,
    garmentId: string,
    category: VtonCategory,
    garmentPhotoType: GarmentPhotoType,
    customParams?: Partial<InferenceParameters>
  ) => Promise<VtonJob>;
  clearActiveJob: () => void;
  toggleFavoriteGarment: (id: string) => Promise<void>;
  deleteGarment: (id: string) => Promise<boolean>;
  toggleFavoriteOutfit: (id: string) => Promise<void>;
  deleteOutfit: (id: string) => Promise<boolean>;
  saveOutfit: (data: {
    name?: string;
    personId: string;
    garmentIds: string[];
    resultImage: string;
    category?: string;
  }) => Promise<Outfit>;
}

const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [activePerson, setActivePerson] = useState<Person | null>(null);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [activeJob, setActiveJob] = useState<VtonJob | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [isLoadingGarments, setIsLoadingGarments] = useState(true);
  const [isLoadingOutfits, setIsLoadingOutfits] = useState(true);
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [inferenceParams, setInferenceParams] = useState<InferenceParameters>(DEFAULT_INFERENCE_PARAMETERS);

  const activeJobRef = useRef<VtonJob | null>(null);
  activeJobRef.current = activeJob;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("wardrobe_theme") as "light" | "dark" | null;
      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
        document.documentElement.classList.toggle("dark", stored === "dark");
      } else if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setThemeState("dark");
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // ignore
    }

    try {
      const storedParams = localStorage.getItem("wardrobe_inference_params");
      if (storedParams) {
        setInferenceParams({ ...DEFAULT_INFERENCE_PARAMETERS, ...JSON.parse(storedParams) });
      }
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback((newTheme: "light" | "dark") => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("wardrobe_theme", newTheme);
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const nextTheme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("wardrobe_theme", nextTheme);
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
      } catch {
        // ignore
      }
      return nextTheme;
    });
  }, []);

  const updateInferenceParams = useCallback((partial: Partial<InferenceParameters>) => {
    setInferenceParams((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem("wardrobe_inference_params", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const resetInferenceParams = useCallback(() => {
    setInferenceParams(DEFAULT_INFERENCE_PARAMETERS);
    try {
      localStorage.setItem("wardrobe_inference_params", JSON.stringify(DEFAULT_INFERENCE_PARAMETERS));
    } catch {
      // ignore
    }
  }, []);

  const refreshGarments = useCallback(async () => {
    try {
      const res = await fetch("/api/garments");
      if (res.ok) {
        const data = await res.json();
        setGarments(data.garments || []);
      }
    } catch (err) {
      console.error("Failed to load garments:", err);
    } finally {
      setIsLoadingGarments(false);
    }
  }, []);

  const refreshPersons = useCallback(async () => {
    try {
      const res = await fetch("/api/persons");
      if (res.ok) {
        const data = await res.json();
        setPersons(data.persons || []);
        if (data.defaultPerson) {
          setActivePerson(data.defaultPerson);
        } else if (data.persons?.length > 0) {
          setActivePerson(data.persons[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load persons:", err);
    }
  }, []);

  const refreshOutfits = useCallback(async () => {
    try {
      const res = await fetch("/api/outfits");
      if (res.ok) {
        const data = await res.json();
        setOutfits(data.outfits || []);
      }
    } catch (err) {
      console.error("Failed to load outfits:", err);
    } finally {
      setIsLoadingOutfits(false);
    }
  }, []);

  const checkEngine = useCallback(async () => {
    try {
      const res = await fetch("/api/engine/status");
      if (res.ok) {
        const data = await res.json();
        setEngineStatus(data);
      }
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    refreshGarments();
    refreshPersons();
    refreshOutfits();
    checkEngine();
  }, [refreshGarments, refreshPersons, refreshOutfits, checkEngine]);

  // Poll active job while processing
  useEffect(() => {
    if (!activeJob || (activeJob.status !== "processing" && activeJob.status !== "queued")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/try-on/jobs/${activeJob.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setActiveJob(data.job);
            if (data.job.status === "completed" || data.job.status === "failed") {
              clearInterval(interval);
            }
          }
        }
      } catch (e) {
        console.error("Error polling job:", e);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status]);

  const setActivePersonById = async (id: string) => {
    try {
      const res = await fetch(`/api/persons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setActivePerson(data.person);
        setPersons((prev) =>
          prev.map((p) => ({ ...p, isDefault: p.id === id }))
        );
      }
    } catch (err) {
      console.error("Failed to set default person:", err);
    }
  };

  const startTryOn = async (
    personId: string,
    garmentId: string,
    category: VtonCategory,
    garmentPhotoType: GarmentPhotoType,
    customParams?: Partial<InferenceParameters>
  ): Promise<VtonJob> => {
    const activeParams = { ...inferenceParams, ...customParams };
    const res = await fetch("/api/try-on/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        garmentId,
        category,
        garmentPhotoType,
        params: activeParams,
      }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to start try-on");
    }

    const data = await res.json();
    setActiveJob(data.job);
    return data.job;
  };

  const clearActiveJob = () => {
    setActiveJob(null);
  };

  const toggleFavoriteGarment = async (id: string) => {
    try {
      const res = await fetch(`/api/garments/${id}/favorite`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGarments((prev) =>
          prev.map((g) => (g.id === id ? data.garment : g))
        );
      }
    } catch (err) {
      console.error("Failed to toggle favorite garment:", err);
    }
  };

  const deleteGarment = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/garments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setGarments((prev) => prev.filter((g) => g.id !== id));
        return true;
      }
    } catch (err) {
      console.error("Failed to delete garment:", err);
    }
    return false;
  };

  const toggleFavoriteOutfit = async (id: string) => {
    try {
      const res = await fetch(`/api/outfits/${id}/favorite`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setOutfits((prev) =>
          prev.map((o) => (o.id === id ? data.outfit : o))
        );
      }
    } catch (err) {
      console.error("Failed to toggle favorite outfit:", err);
    }
  };

  const deleteOutfit = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/outfits/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOutfits((prev) => prev.filter((o) => o.id !== id));
        return true;
      }
    } catch (err) {
      console.error("Failed to delete outfit:", err);
    }
    return false;
  };

  const saveOutfit = async (data: {
    name?: string;
    personId: string;
    garmentIds: string[];
    resultImage: string;
    category?: string;
  }): Promise<Outfit> => {
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to save outfit");
    }

    const resData = await res.json();
    setOutfits((prev) => [resData.outfit, ...prev]);
    return resData.outfit;
  };

  return (
    <WardrobeContext.Provider
      value={{
        garments,
        persons,
        activePerson,
        outfits,
        activeJob,
        engineStatus,
        isLoadingGarments,
        isLoadingOutfits,
        theme,
        toggleTheme,
        setTheme,
        inferenceParams,
        updateInferenceParams,
        resetInferenceParams,
        refreshGarments,
        refreshPersons,
        refreshOutfits,
        setActivePersonById,
        startTryOn,
        clearActiveJob,
        toggleFavoriteGarment,
        deleteGarment,
        toggleFavoriteOutfit,
        deleteOutfit,
        saveOutfit,
      }}
    >
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);
  if (!context) {
    throw new Error("useWardrobe must be used within a WardrobeProvider");
  }
  return context;
}
