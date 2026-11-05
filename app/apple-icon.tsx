import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhone: the Uq monogram from the social profiles. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff", fontSize: 92, fontWeight: 800, letterSpacing: -4, fontFamily: "sans-serif" }}>
        Uq
        <div style={{ width: 18, height: 18, borderRadius: 18, background: "#22c55e", marginLeft: 2, marginTop: -60 }} />
      </div>
    ),
    size,
  );
}
