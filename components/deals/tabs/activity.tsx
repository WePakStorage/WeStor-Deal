import { Activity as ActivityIcon } from "lucide-react";
import { money, timeAgo } from "@/lib/format";
import { STAGE_LABEL, type Activity, type Stage } from "@/lib/types";
import { EmptyState } from "@/components/ui/primitives";

function describe(a: Activity): string {
  const p = a.payload as Record<string, unknown>;
  switch (a.action) {
    case "stage_changed":
      return `moved the deal from ${STAGE_LABEL[p.from as Stage] ?? p.from} to ${STAGE_LABEL[p.to as Stage] ?? p.to}${p.contract_price ? ` with a ${money(Number(p.contract_price))} contract` : ""}`;
    case "deal_created": return "created the deal";
    case "deal_updated": return "updated deal details";
    case "om_uploaded": return `uploaded ${String(p.name ?? "an OM")}`;
    case "om_reviewed": return `confirmed the OM extraction (${String(p.flags ?? 0)} checks)`;
    case "unit_mix_updated": return "edited the unit mix";
    case "financials_updated": return "edited financials";
    case "buyer_status": return `marked ${String(p.buyer)} as ${String(p.status)}`;
    case "preview_generated": return "generated a pre-contract preview";
    case "om_generated": return "generated the offering memorandum";
    case "alert_imported": return "created this deal from a forwarded listing alert";
    default: return a.action.replace(/_/g, " ");
  }
}

export function ActivityTab({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) return <EmptyState icon={<ActivityIcon />} title="No activity yet" body="Stage moves, uploads and buyer outreach show up here." />;
  return (
    <ol className="mx-auto max-w-2xl">
      {activity.map((a, i) => (
        <li key={a.id} className="relative flex gap-4 pb-6">
          {i < activity.length - 1 ? <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-line" /> : null}
          <span aria-hidden className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-door bg-ink" />
          <div className="text-sm">
            <span className="font-medium">{a.actor}</span> <span className="text-muted">{describe(a)}</span>
            <div className="mt-0.5 text-xs text-muted">{timeAgo(a.created_at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
