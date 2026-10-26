import type { Metadata } from "next";
import { Albert_Sans, Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./site.css";
import { getPublicCannabisStorefrontSettings } from "@/features/storefront/lib/data/menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Storefront type: Bricolage Grotesque, condensed and heavy, prints the catalog's names, prices
// and chapter titles; Albert Sans sets everything read. See .impeccable/surfaces/features-storefront.md.
const bricolage = Bricolage_Grotesque({
  variable: "--font-cn-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

const albertSans = Albert_Sans({
  variable: "--font-cn-albert",
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
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${albertSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
