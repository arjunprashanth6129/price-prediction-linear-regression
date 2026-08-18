import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/project";
import { cn } from "@/lib/utils";
import "./globals.css";

// Plex Sans for prose and labels; JetBrains Mono for every figure. The pairing
// reads as research software rather than generic startup sans.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetMono = JetBrains_Mono({
  variable: "--font-jet",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.live),
  // Each page sets its own title; this is the suffix they share.
  title: {
    default: `${SITE.name} - ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.author }],
  keywords: [
    "quantitative finance",
    "linear regression",
    "momentum",
    "golden cross",
    "efficient market hypothesis",
    "conditional value at risk",
    "CVaR",
    "portfolio optimisation",
    "NSE",
    "scikit-learn",
    "CVXPY",
  ],
  openGraph: {
    type: "website",
    url: SITE.live,
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
    siteName: SITE.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} - ${SITE.tagline}`,
    description: SITE.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        plexSans.variable,
        jetMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col bg-ink-900 text-fg">
        {children}
      </body>
    </html>
  );
}
