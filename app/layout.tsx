import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { getPublicCannabisStorefrontSettings } from "@/features/storefront/lib/data/menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Storefront type: see docs/design/cannabis-redesign-2026-10-23.md.
const fraunces = Fraunces({
  variable: "--font-cn-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-cn-instrument",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicCannabisStorefrontSettings();
  return {
    title: settings.businessName ? `${settings.businessName} · Menu` : "Dispensary menu",
    description: settings.description || settings.tagline || "Dispensary menu.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.svg" rel="icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${instrumentSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
