import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/JsonLd";
import { BreadcrumbSchema } from "@/components/BreadcrumbSchema";
import { organizationSchema, websiteSchema } from "@/lib/schemas";
import { BRAND } from "@/lib/brand";
import { PRICE_CADENCE } from '@/lib/price-freshness';

// Self-hosted (#219): next/font/google fetched fonts.googleapis.com at build
// time, and a flaky fetch failed whole builds -- 3 on 2026-09-26 alone,
// including a required email-guard check. Same families, weights, latin
// subset, CSS variables and display: swap as before; files are the OFL-
// licensed Fontsource latin builds in ./fonts (licences alongside).
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const fredoka = localFont({
  src: [
    { path: "./fonts/fredoka-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fredoka-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fredoka-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const metadata: Metadata = {
  metadataBase: new URL("https://bricksofindia.com"),
  title: {
    default: "Bricks of India — LEGO Price Comparison & Reviews in India 2026",
    template: "%s | Bricks of India",
  },
  description:
    `Compare LEGO prices across India's top stores. Updated ${PRICE_CADENCE}. Plus honest reviews and guides. ${BRAND.tagline}.`,
  keywords: [
    "LEGO India",
    "LEGO price comparison India",
    "buy LEGO India",
    "LEGO sets price India",
    "LEGO reviews India",
    "best LEGO deals India",
  ],
  authors: [{ name: "Bricks of India" }],
  creator: "Bricks of India",
  openGraph: {
    type: "website",
    locale: "en_IN",
    // No `url` here (#208): a layout-level og:url was inherited by every
    // static route, pointing all of them at the homepage. Each route now
    // sets og:url = its own canonical via buildMetadata() (src/lib/metadata.ts).
    siteName: "Bricks of India",
    title: "Bricks of India — LEGO Price Comparison & Reviews in India 2026",
    description:
      `Compare LEGO prices across India's top stores. Updated ${PRICE_CADENCE}. ${BRAND.tagline}.`,
    images: [
      {
        url: "/assets/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bricks of India — LEGO Price Comparison India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bricks of India — LEGO Price Comparison India",
    description: `Compare LEGO prices across India's top stores. ${BRAND.tagline}.`,
    images: ["/assets/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`${poppins.variable} ${fredoka.variable} ${inter.variable}`}>
      <body className="bg-white text-dark font-body antialiased">
        {/* Google Analytics */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}

        <JsonLd data={[organizationSchema, websiteSchema]} />
        <BreadcrumbSchema />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
