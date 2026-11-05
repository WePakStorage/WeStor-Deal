import type { Metadata, Viewport } from "next";
// Brand type (matches the ads), self-hosted so builds never depend on Google Fonts:
// Inter Tight extra-bold for headlines and big numbers; IBM Plex Sans for UI text and the
// wordmark, because its serifed capital I keeps "UndrIq" from reading as "Undrlq".
import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./globals.css";
import { Analytics } from "@/components/analytics";


export const metadata: Metadata = {
  title: { default: "UndrIq: SI deal analyzer for real estate investors", template: "%s · UndrIq" },
  description: "Paste a listing, get a deal score, five exit strategies, an offer ladder and a ready-to-send offer in minutes. Residential, multifamily, storage, industrial and retail.",
};

export const viewport: Viewport = { themeColor: "#000000" };

const themeScript = `try{var t=localStorage.getItem('undriq-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
