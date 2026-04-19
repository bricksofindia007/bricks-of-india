import type { Metadata } from "next";
import Script from "next/script";
import { Poppins, Fredoka, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SchemaLD, organizationSchema, websiteSchema } from "@/components/SchemaLD";
import { BreadcrumbSchema } from "@/components/BreadcrumbSchema";
import { BRAND, ASSETS } from "@/lib/brand";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    "Compare LEGO prices across India's top stores. Updated every 6 hours. Plus honest reviews and guides. More Bricks. Less Nonsense.",
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
    url: "https://bricksofindia.com",
    siteName: "Bricks of India",
    title: "Bricks of India — LEGO Price Comparison & Reviews in India 2026",
    description:
      "Compare LEGO prices across India's top stores. Updated every 6 hours. More Bricks. Less Nonsense.",
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
    description: "Compare LEGO prices across India's top stores. More Bricks. Less Nonsense.",
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

        <SchemaLD data={[organizationSchema, websiteSchema]} />
        <BreadcrumbSchema />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
