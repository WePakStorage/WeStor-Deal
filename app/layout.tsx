import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Inter_Tight } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";

// Brand type (matches the ads): Inter Tight extra-bold for headlines and big numbers.
// IBM Plex Sans for UI text and the wordmark: its capital I has serifs, so "UndrIq" never reads as "Undrlq".
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const display = Inter_Tight({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "UndrIq: SI deal analyzer for real estate investors", template: "%s · UndrIq" },
  description: "Paste a listing, get a deal score, five exit strategies, an offer ladder and a ready-to-send offer in minutes. Residential, multifamily, storage, industrial and retail.",
};

export const viewport: Viewport = { themeColor: "#000000" };

const themeScript = `try{var t=localStorage.getItem('undriq-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
