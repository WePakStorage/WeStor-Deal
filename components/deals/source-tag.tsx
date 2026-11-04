import { cn } from "@/lib/cn";
import { SOURCE_LABEL, type Source } from "@/lib/types";

const TONE: Record<Source, string> = {
  seller: "text-go/90 bg-go/10",
  broker_om: "text-door bg-door/10",
  appraisal: "text-gold bg-gold/10",
  calculated: "text-muted bg-raised",
  user: "text-amber bg-amber/10",
};

export function SourceTag({ source, className }: { source: Source | undefined | null; className?: string }) {
  if (!source) return null;
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-px text-[10.5px] font-medium leading-4", TONE[source], className)} title={`Source: ${SOURCE_LABEL[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  );
}
