import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/lib/project";
import { cn } from "@/lib/utils";
import { MotionReady } from "./components/Motion";
import "./globals.css";

// Inter for interface and prose, JetBrains Mono for every figure. Inter holds
// up at the small sizes a data-dense page needs; the mono keeps columns of
// numbers aligned so they can be compared down a column.
const inter = Inter({
  variable: "--font-inter",
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
    "efficient market hypothesis",
    "conditional value at risk",
    "CVaR",
    "portfolio optimisation",
    "NSE",
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
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", inter.variable, jetMono.variable)}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <MotionReady />
        {/* The sidebar is fixed, so the content column is offset by its width. */}
        <div className="lg:pl-[var(--sidebar-w)]">{children}</div>
      </body>
    </html>
  );
}
