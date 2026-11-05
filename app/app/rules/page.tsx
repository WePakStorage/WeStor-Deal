import { RulesView } from "@/components/undriq/rules-view";
import { UpgradeCard } from "@/components/undriq/upgrade-card";
import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/server/context";
import { DEFAULT_RULES } from "@/lib/undriq/engine";
import { rulesFor } from "@/lib/undriq/service";

export const metadata = { title: "Buy box rules" };

export default async function RulesPage() {
  const ctx = await requireContext();
  if (!ctx.plan.features.buyBoxRules) return <UpgradeCard title="Your own buy box rules" body="Set your ARV percentage, fees, cap rates, financing and flip margins. Every score, max offer and offer ladder in this space uses them." min="fund" />;
  const rules = await rulesFor(ctx);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Buy box rules" description={`Used for every analysis in ${ctx.space.kind === "personal" ? "your private space" : ctx.space.name}. Existing deals re-score with the new rules when you open them.`} />
      <RulesView initial={rules} defaults={DEFAULT_RULES} />
    </div>
  );
}
