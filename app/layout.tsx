import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";

const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: "WeStor DealFlow", template: "%s · WeStor DealFlow" },
  description: "Acquisition intelligence for self-storage. Find deals, underwrite them in seconds, match them to buyers, and produce compliant offering materials.",
};

export const viewport: Viewport = { themeColor: "#0E1726" };

const themeScript = `try{var t=localStorage.getItem('westor-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrument.variable} suppressHydrationWarning>
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
