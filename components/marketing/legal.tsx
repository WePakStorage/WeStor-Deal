import { SiteFooter, SiteHeader } from "./site-chrome";

export function LegalPage({ title, sections }: { title: string; sections: { h: string; p: string }[] }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-8 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
          Placeholder text. This page must be reviewed and replaced by an attorney before launch.
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated November 2026</p>
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-semibold">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-muted">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
