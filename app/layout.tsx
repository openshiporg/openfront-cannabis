import type { Metadata } from "next";
import { Besley, Geist, Geist_Mono, Libre_Franklin } from "next/font/google";
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

// Storefront type: a Clarendon for the booklet's printed names and figures,
// a plain gothic for everything read. See .impeccable/surfaces/features-storefront.md.
const besley = Besley({
  variable: "--font-cn-besley",
  subsets: ["latin"],
});

const libreFranklin = Libre_Franklin({
  variable: "--font-cn-franklin",
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
        className={`${geistSans.variable} ${geistMono.variable} ${besley.variable} ${libreFranklin.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
