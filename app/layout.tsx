import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";

const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "UndrIq: SI deal analyzer for real estate investors", template: "%s · UndrIq" },
  description: "Paste a listing, get a deal score, five exit strategies, an offer ladder and a ready-to-send offer in minutes. Residential, multifamily, storage, industrial and retail.",
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

const themeScript = `try{var t=localStorage.getItem('undriq-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${serif.variable}`} suppressHydrationWarning>
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
