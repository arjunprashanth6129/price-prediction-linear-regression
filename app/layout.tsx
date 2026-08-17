import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { PROJECT } from "@/lib/project";
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
  metadataBase: new URL(PROJECT.live),
  title: PROJECT.name,
  description: PROJECT.description,
  applicationName: PROJECT.name,
  authors: [{ name: PROJECT.author }],
  keywords: [
    "linear regression",
    "momentum",
    "golden cross",
    "moving average",
    "efficient market hypothesis",
    "NSE",
    "scikit-learn",
    "quantitative finance",
  ],
  openGraph: {
    type: "article",
    url: PROJECT.live,
    title: PROJECT.name,
    description: PROJECT.description,
    siteName: PROJECT.name,
  },
  twitter: {
    card: "summary_large_image",
    title: PROJECT.name,
    description: PROJECT.description,
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
