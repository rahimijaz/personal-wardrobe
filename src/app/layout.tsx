import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { WardrobeProvider } from "@/context/wardrobe-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "fitcheck — Digital Wardrobe & Virtual Try-On Studio",
    template: "%s · fitcheck",
  },
  description:
    "Your private digital wardrobe and virtual styling studio. Organize your collection, craft complete outfits, and preview realistic try-on looks with precision detail.",
  keywords: [
    "virtual try-on",
    "digital wardrobe",
    "outfit planner",
    "fashion studio",
    "personal styling",
    "outfit generator",
  ],
  authors: [{ name: "fitcheck Studio" }],
  openGraph: {
    title: "fitcheck — Digital Wardrobe & Styling Studio",
    description:
      "Organize your wardrobe and preview realistic try-on looks in your personal styling studio.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "fitcheck — Digital Wardrobe & Styling Studio",
    description:
      "Organize your wardrobe and preview realistic try-on looks in your personal styling studio.",
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
