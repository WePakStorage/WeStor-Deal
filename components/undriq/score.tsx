import { cn } from "@/lib/cn";
import { scoreBand } from "@/lib/undriq/engine";

const tone = { go: "text-go", amber: "text-amber", stop: "text-stop" } as const;

export function ScoreDot({ score, className }: { score: number; className?: string }) {
  const b = scoreBand(score);
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border border-line text-sm font-semibold tabular", tone[b], className)} aria-label={`Deal score ${score}`}>
      {score}
    </span>
  );
}

/** Big circular score. Pure SVG, works in both themes. */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const b = scoreBand(score);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} className={tone[b]} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="display text-5xl leading-none tabular">{score}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">Deal score</div>
        </div>
      </div>
    </div>
  );
}

export const bandText = tone;
