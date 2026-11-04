"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import type { SourcingCandidate } from "@/lib/data/store";

/** OpenStreetMap tiles via Leaflet (free, no API key). */
export default function CandidateMap({ candidates }: { candidates: SourcingCandidate[] }) {
  const el = React.useRef<HTMLDivElement>(null);
  const withCoords = React.useMemo(() => candidates.filter((c) => c.lat !== null && c.lng !== null), [candidates]);

  React.useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current || withCoords.length === 0) return;
      map = L.map(el.current, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
      const pts: [number, number][] = [];
      for (const c of withCoords) {
        const color = c.score >= 70 ? "#3DD68C" : c.score >= 45 ? "#F2B33D" : "#8A9AB5";
        const marker = L.circleMarker([c.lat!, c.lng!], { radius: 6 + c.score / 20, color, weight: 2, fillColor: color, fillOpacity: 0.55 }).addTo(map);
        const div = document.createElement("div");
        div.style.font = "13px/1.4 system-ui";
        const b = document.createElement("b");
        b.textContent = c.owner_name;
        div.append(b, document.createElement("br"), `Score ${c.score} · ${c.building_sf?.toLocaleString("en-US") ?? "?"} SF · built ${c.year_built ?? "?"}`);
        marker.bindPopup(div);
        pts.push([c.lat!, c.lng!]);
      }
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [withCoords]);

  if (withCoords.length === 0) {
    return <div className="grid h-60 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">This CSV has no latitude and longitude columns, so there&apos;s nothing to map. Use the list view.</div>;
  }
  return <div ref={el} className="h-[460px] overflow-hidden rounded-2xl border border-line" role="region" aria-label="Map of scored facilities" />;
}
