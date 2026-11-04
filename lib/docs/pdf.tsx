import "server-only";
import * as React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { OmModel, PreviewModel } from "./models";

const C = { ink: "#0E1726", navy: "#152238", muted: "#5B6B85", line: "#D9E0EB", gold: "#B08A4A", door: "#2F6BF0", soft: "#F4F6FA" };

const s = StyleSheet.create({
  page: { padding: 44, paddingBottom: 70, fontFamily: "Helvetica", fontSize: 10, color: C.ink, lineHeight: 1.45 },
  band: { backgroundColor: C.ink, color: "#FFFFFF", marginHorizontal: -44, marginTop: -44, paddingHorizontal: 44, paddingVertical: 28, marginBottom: 24 },
  brand: { fontSize: 10, color: "#D6B981", letterSpacing: 0.5 },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6 },
  sub: { fontSize: 11, color: "#B8C4D8", marginTop: 4 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 18, color: C.navy },
  grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.line },
  cell: { width: "25%", padding: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  cell3: { width: "33.333%", padding: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  label: { fontSize: 8, color: C.muted, marginBottom: 2 },
  value: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  bullet: { flexDirection: "row", marginBottom: 4 },
  dot: { width: 10, color: C.gold },
  table: { borderTopWidth: 1, borderColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.line, paddingVertical: 4 },
  th: { fontSize: 8, color: C.muted, fontFamily: "Helvetica-Bold" },
  box: { backgroundColor: C.soft, borderRadius: 4, padding: 12, marginTop: 14 },
  small: { fontSize: 8.5, color: C.muted },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7, color: C.muted, borderTopWidth: 1, borderColor: C.line, paddingTop: 6 },
});

function Footer({ text, brand }: { text: string; brand: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{text}</Text>
      <Text render={({ pageNumber, totalPages }) => `${brand} · Page ${pageNumber} of ${totalPages}`} style={{ marginTop: 3 }} />
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.dot}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function PreviewDoc({ m }: { m: PreviewModel }) {
  return (
    <Document title={m.title} author={m.brand}>
      <Page size="LETTER" style={s.page}>
        <View style={s.band}>
          <Text style={s.brand}>{m.brand}{m.tagline ? ` · ${m.tagline}` : ""}</Text>
          <Text style={s.h1}>{m.title}</Text>
          <Text style={s.sub}>Pre-contract preview · {m.generatedOn}</Text>
        </View>
        <View style={[s.box, { marginTop: 0, backgroundColor: "#FFF7E6", borderWidth: 1, borderColor: "#F2D49B" }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Please read</Text>
          {m.disclaimer.map((d, i) => <Text key={i} style={{ marginBottom: 2 }}>{d}</Text>)}
        </View>
        <Text style={s.h2}>At a glance</Text>
        <View style={s.grid}>
          {m.facts.map((f) => (
            <View key={f.label} style={s.cell3}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.value}>{f.value}</Text>
            </View>
          ))}
        </View>
        <Text style={s.h2}>Why it may interest you</Text>
        <Bullets items={m.thesis} />
        <View style={s.box}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Interested?</Text>
          <Text>Reply to {m.contact.name || m.brand}{m.contact.phone ? ` · ${m.contact.phone}` : ""}{m.contact.email ? ` · ${m.contact.email}` : ""} with your buy box. Details are shared after a contract and NDA are in place.</Text>
        </View>
        <Footer text={m.footer} brand={m.brand} />
      </Page>
    </Document>
  );
}

function OmDoc({ m }: { m: OmModel }) {
  return (
    <Document title={m.title} author={m.brand}>
      <Page size="LETTER" style={s.page}>
        <View style={[s.band, { paddingVertical: 60 }]}>
          {m.logoUrl ? <Image src={m.logoUrl} style={{ width: 90, marginBottom: 16 }} /> : null}
          <Text style={s.brand}>{m.brand}{m.tagline ? ` · ${m.tagline}` : ""}</Text>
          <Text style={[s.h1, { fontSize: 30 }]}>{m.title}</Text>
          <Text style={s.sub}>{m.subtitle}</Text>
          <Text style={[s.sub, { marginTop: 18 }]}>Confidential offering memorandum · {m.generatedOn}</Text>
        </View>
        <Text style={s.h2}>Investment summary</Text>
        <View style={s.grid}>
          {m.summary.map((f) => (
            <View key={f.label} style={s.cell}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.value}>{f.value}</Text>
            </View>
          ))}
        </View>
        {m.narrative ? (
          <>
            <Text style={s.h2}>The opportunity</Text>
            {m.narrative.split(/\n{2,}/).map((p, i) => <Text key={i} style={{ marginBottom: 6 }}>{p.trim()}</Text>)}
          </>
        ) : null}
        <Text style={s.h2}>Highlights</Text>
        <Bullets items={m.highlights} />
        <Footer text={m.footer} brand={m.brand} />
      </Page>

      <Page size="LETTER" style={s.page}>
        {m.unitMix.length ? (
          <>
            <Text style={[s.h2, { marginTop: 0 }]}>Unit mix</Text>
            <View style={s.table}>
              <View style={s.tr}>
                {["Unit type", "Units", "Occupied", "Street rent", "In-place rent"].map((h, i) => <Text key={h} style={[s.th, { flex: i === 0 ? 2 : 1, textAlign: i === 0 ? "left" : "right" }]}>{h}</Text>)}
              </View>
              {m.unitMix.map((u) => (
                <View key={u.type} style={s.tr}>
                  <Text style={{ flex: 2 }}>{u.type}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>{u.units}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>{u.occupied}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>{u.street}</Text>
                  <Text style={{ flex: 1, textAlign: "right" }}>{u.inPlace}</Text>
                </View>
              ))}
              <View style={[s.tr, { borderBottomWidth: 0 }]}>
                <Text style={{ flex: 2, fontFamily: "Helvetica-Bold" }}>Total</Text>
                <Text style={{ flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{m.unitMixTotals.units}</Text>
                <Text style={{ flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }}>{m.unitMixTotals.occupied}</Text>
                <Text style={{ flex: 2, textAlign: "right", color: C.muted }}>Rent upside {m.unitMixTotals.upside}</Text>
              </View>
            </View>
          </>
        ) : null}

        <Text style={s.h2}>Income and expenses</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {m.income.map((p) => (
            <View key={p.period} style={{ flex: 1 }}>
              <Text style={[s.th, { marginBottom: 4 }]}>{p.period}</Text>
              {p.rows.map((r) => (
                <View key={r.label} style={[s.tr, { paddingVertical: 2.5 }]}>
                  <Text style={{ flex: 1, fontSize: 8.5, fontFamily: r.label === "Net operating income" ? "Helvetica-Bold" : "Helvetica" }}>{r.label}</Text>
                  <Text style={{ fontSize: 8.5, fontFamily: r.label === "Net operating income" ? "Helvetica-Bold" : "Helvetica" }}>{r.value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Text style={s.h2}>Returns at the offering price</Text>
        <View style={s.grid}>
          {m.returns.map((f) => (
            <View key={f.label} style={s.cell}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.value}>{f.value}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.small, { marginTop: 6 }]}>{m.returnsNote}</Text>

        <View style={s.box}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Contact</Text>
          <Text>{m.contact.name}{m.contact.phone ? ` · ${m.contact.phone}` : ""}{m.contact.email ? ` · ${m.contact.email}` : ""}</Text>
        </View>
        <View style={[s.box, { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.line }]}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Disclosure of equitable interest</Text>
          <Text style={s.small}>{m.disclosure}</Text>
        </View>
        <Footer text={m.footer} brand={m.brand} />
      </Page>
    </Document>
  );
}

export const renderPreviewPdf = (m: PreviewModel) => renderToBuffer(<PreviewDoc m={m} />);
export const renderOmPdf = (m: OmModel) => renderToBuffer(<OmDoc m={m} />);
