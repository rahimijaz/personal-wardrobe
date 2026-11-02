"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Shirt,
  Sparkles,
  Layers,
  User,
  Settings,
  ShieldCheck,
  Menu,
  X,
  Loader2,
  ChevronRight,
  Cpu,
  Sun,
  Moon,
  Asterisk,
  Activity,
} from "lucide-react";
import clsx from "clsx";
import { useWardrobe } from "@/context/wardrobe-context";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, description: "Overview & quick actions" },
  { href: "/wardrobe", label: "My Wardrobe", icon: Shirt, description: "Browse & manage garments" },
  { href: "/try-on", label: "Virtual Try-On", icon: Sparkles, description: "AI outfit generation" },
  { href: "/outfits", label: "My Outfits", icon: Layers, description: "Saved looks gallery" },
  { href: "/profile", label: "Profile", icon: User, description: "Persona management" },
  { href: "/settings", label: "Settings", icon: Settings, description: "Engine & preferences" },
];

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeJob, activePerson, engineStatus, theme, toggleTheme } = useWardrobe();

  const isJobRunning =
    activeJob && (activeJob.status === "processing" || activeJob.status === "queued");

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <div className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={clsx(
              "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "nav-item-active"
                : "text-ink-soft hover:bg-bone-deep hover:text-ink"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-white/10"
                  : "bg-transparent group-hover:bg-bone"
              )}>
                <Icon
                  className={clsx(
                    "h-4 w-4 transition-all duration-200",
                    isActive ? "text-flame" : "text-ink-soft group-hover:text-ink"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span className="tracking-tight">{item.label}</span>
            </div>
            {item.href === "/try-on" && isJobRunning && (
              <span className="flex h-2 w-2 rounded-full bg-flame" />
            )}
            {isActive && <ChevronRight className="h-3.5 w-3.5 text-ink-soft/60" />}
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-line bg-bone/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink shadow-sm">
            <Asterisk className="h-4 w-4 text-flame" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-ink leading-none">
              fitcheck
            </span>
            <span className="block text-[9px] font-mono uppercase tracking-widest text-ink-soft leading-none mt-0.5">
              Studio
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {isJobRunning && (
            <Link
              href="/try-on"
              className="flex items-center gap-1.5 rounded-full bg-flame/10 px-2.5 py-1 text-xs font-semibold text-flame border border-flame/20"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Generating</span>
            </Link>
          )}

          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bone-deep text-ink hover:text-flame transition-colors"
            aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bone-deep text-ink"
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 z-30 border-b border-line bg-bone/95 backdrop-blur-lg px-5 py-5 shadow-2xl lg:hidden"
          >
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>100% Local · Your photos stay on your device</span>
            </div>
            <NavLinks onClick={() => setMobileOpen(false)} />
            {activePerson && (
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <img
                  src={activePerson.image}
                  alt={activePerson.name}
                  className="h-9 w-9 rounded-full border-2 border-line object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{activePerson.name}</p>
                  <p className="text-[10px] text-ink-soft">Active Persona</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-paper/95 backdrop-blur-xl lg:flex">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-line">
          <Link href="/" className="group flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink shadow-md transition-all duration-300 group-hover:scale-105">
              <Asterisk className="h-4.5 w-4.5 text-flame transition-transform duration-500 group-hover:rotate-90" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <span className="font-display text-xl font-bold tracking-tight text-ink block leading-none">
                fitcheck
              </span>
              <span className="text-[9px] uppercase font-mono tracking-widest text-ink-soft block mt-0.5">
                Studio Edition
              </span>
            </div>
          </Link>
        </div>

        {/* Privacy Badge */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-700/15 dark:border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/12 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="leading-tight">
              <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                100% Local Storage
              </p>
              <p className="text-[10px] text-emerald-700/75 dark:text-emerald-400/80">
                Your photos stay on your device
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 no-scrollbar">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-soft/60">
            Navigation
          </p>
          <NavLinks />

          {/* Active Try-On Job Card */}
          {isJobRunning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="mt-5 rounded-xl border border-flame/25 bg-flame/5 p-3.5 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-flame/5 to-transparent pointer-events-none" />
              <div className="relative">
                <div className="flex items-center justify-between text-xs font-bold text-flame">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating Try-On...
                  </span>
                  <span className="text-[10px] font-mono bg-flame/10 px-1.5 py-0.5 rounded-full">
                    LIVE
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-ink-soft line-clamp-2">
                  {activeJob.detail ||
                    (activeJob.stage === "preparing_person" && "Preparing body pose (DWPose)...") ||
                    (activeJob.stage === "preparing_garment" && "Isolating garment cloth...") ||
                    (activeJob.stage === "generating" &&
                      (activeJob.step && activeJob.total_steps
                        ? `Diffusion step ${activeJob.step}/${activeJob.total_steps}`
                        : "Diffusion Euler sampling...")) ||
                    (activeJob.stage === "finalizing" && "Rendering high-res output...") ||
                    "In local GPU queue..."}
                </p>
                {activeJob.step && activeJob.total_steps && (
                  <div className="mt-2.5">
                    <div className="h-1 w-full rounded-full bg-flame/15 overflow-hidden">
                      <div
                        className="h-full bg-flame rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((activeJob.step / activeJob.total_steps) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] font-mono text-ink-soft">
                      Step {activeJob.step}/{activeJob.total_steps}
                    </p>
                  </div>
                )}
                <Link
                  href="/try-on"
                  className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-ink hover:text-flame transition-colors"
                >
                  <span>View Progress</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Section */}
        <div className="border-t border-line px-4 pt-4 pb-5 space-y-2">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-bone-deep/50 px-3 py-2">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className="text-xs font-semibold text-ink">
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm hover:text-flame transition-colors"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>

          {/* Active Persona */}
          {activePerson && (
            <Link
              href="/profile"
              className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-bone-deep"
            >
              <div className="relative shrink-0">
                <img
                  src={activePerson.image}
                  alt={activePerson.name}
                  className="h-9 w-9 rounded-full border-2 border-line object-cover"
                />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-paper" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink group-hover:text-flame transition-colors">
                  {activePerson.name}
                </p>
                <p className="text-[10px] text-ink-soft">Active Persona</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-ink-soft shrink-0" />
            </Link>
          )}

          {/* Engine Status */}
          <div className="flex items-center justify-between rounded-lg bg-bone-deep/50 px-3 py-2 text-[11px] text-ink-soft">
            <div className="flex items-center gap-2 truncate">
              <Activity className="h-3.5 w-3.5 text-ink-soft shrink-0" />
              <span className="truncate">
                {engineStatus?.device ? `Engine: ${engineStatus.device}` : "FASHN-VTON DirectML"}
              </span>
            </div>
            <span
              className={clsx(
                "h-2 w-2 rounded-full shrink-0 ml-2",
                engineStatus?.online ? "bg-emerald-500" : "bg-amber-500"
              )}
              title={engineStatus?.online ? "VTON Service Connected" : "Local Engine Ready"}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
