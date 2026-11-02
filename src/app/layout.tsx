import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { WardrobeProvider } from "@/context/wardrobe-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "fitcheck — Private AI Wardrobe & Virtual Try-On Studio",
    template: "%s · fitcheck",
  },
  description:
    "Your private digital wardrobe and local AI virtual try-on studio. Organize clothing, build outfits, and render photorealistic looks with on-device FASHN-VTON. 100% local — photos never leave your machine.",
  keywords: [
    "virtual try-on",
    "AI wardrobe",
    "FASHN-VTON",
    "local AI",
    "fashion AI",
    "private wardrobe",
    "outfit generator",
    "DirectML",
  ],
  authors: [{ name: "fitcheck Studio" }],
  openGraph: {
    title: "fitcheck — Private AI Wardrobe & Try-On Studio",
    description:
      "Organize your wardrobe and create photorealistic AI try-on looks, all locally on your device.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "fitcheck — Private AI Wardrobe & Try-On Studio",
    description:
      "Organize your wardrobe and create photorealistic AI try-on looks, all locally on your device.",
  },
  robots: {
    index: false, // private local app — don't index
    follow: false,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-bone font-body text-ink antialiased">
        <div className="grain" aria-hidden="true" />
        <WardrobeProvider>
          <AppNav />
          <div className="min-h-screen lg:pl-64 flex flex-col transition-all duration-300">
            {children}
          </div>
        </WardrobeProvider>
      </body>
    </html>
  );
}
