import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

export const alt = "UndrIq: underwrite any deal in minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview card (Instagram, iMessage, LinkedIn, X, Slack): the ad look, drawn at build time. */
export default function OpengraphImage() {
  const exits: [string, string, boolean][] = [["BRRRR", "92", true], ["Wholesale", "76", false], ["Flip", "74", false], ["Hold", "66", false], ["Seller fin.", "64", false]];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#000", color: "#fff", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
            UndrIq
            <div style={{ width: 12, height: 12, borderRadius: 12, background: "#22c55e", marginLeft: 4, marginTop: 6 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, maxWidth: 640 }}>{SITE_TAGLINE}</div>
            <div style={{ fontSize: 26, color: "#a1a1a1", marginTop: 24, maxWidth: 620, lineHeight: 1.35 }}>{SITE_DESCRIPTION}</div>
          </div>
          <div style={{ display: "flex" }}>
            <div style={{ background: "#fff", color: "#000", borderRadius: 999, padding: "14px 28px", fontSize: 24, fontWeight: 700 }}>Analyze your first deal free</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 330, marginLeft: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", border: "1px solid #262626", borderRadius: 28, padding: 32, background: "#0b0b0b" }}>
            <div style={{ width: 170, height: 170, borderRadius: 170, border: "14px solid #22c55e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 64, fontWeight: 800 }}>82</div>
              <div style={{ fontSize: 14, color: "#a1a1a1", letterSpacing: 2 }}>DEAL SCORE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 26 }}>
              {exits.map(([name, score, best]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 22, padding: "6px 0", color: best ? "#22c55e" : "#e5e5e5" }}>
                  <span>{name}</span>
                  <span style={{ fontWeight: 700 }}>{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
