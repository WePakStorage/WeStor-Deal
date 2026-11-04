import { SourcingView } from "@/components/sourcing/sourcing-view";
import { PageHeader } from "@/components/ui/primitives";
import { requireContext } from "@/lib/server/context";
import { isPro } from "@/lib/server/gate";

export const metadata = { title: "Sourcing" };

export default async function SourcingPage() {
  const { store, orgId } = await requireContext();
  const [pro, org] = await Promise.all([isPro(store, orgId), store.getOrg(orgId)]);
  const candidates = pro ? await store.listCandidates(orgId) : [];
  const domain = process.env.RESEND_INBOUND_DOMAIN || "inbound.westor.app";
  return (
    <>
      <PageHeader title="Sourcing" description="Listing alerts you forward, plus off-market facilities scored for owner motivation from county records." />
      <SourcingView candidates={candidates} inboundAddress={`alerts+${org?.inbound_token ?? ""}@${domain}`} />
    </>
  );
}
