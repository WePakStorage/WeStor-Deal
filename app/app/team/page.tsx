import { TeamView } from "@/components/undriq/team-view";
import { PageHeader } from "@/components/ui/primitives";
import { effectivePlan, PLANS } from "@/lib/billing/plans";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { uq, store, spaces, space, user, personalOrgId } = await requireContext();
  const ownPlan = effectivePlan(await store.getSubscription(personalOrgId));
  const teams = spaces.filter((s) => s.kind === "team");
  const members = await Promise.all(teams.map(async (t) => ({ orgId: t.orgId, members: await uq.listSpaceMembers(t.orgId) })));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Team"
        description="Your private space is yours alone. Team spaces share one pipeline and buyer list with the people you add."
      />
      <TeamView
        me={user.id}
        activeOrgId={space.orgId}
        ownPlan={ownPlan}
        canCreate={PLANS[ownPlan].features.teamSpace}
        seatsForOwnPlan={PLANS[ownPlan].seats}
        teamsAllowed={PLANS[ownPlan].teams}
        teamsOwned={teams.filter((t) => t.ownerUserId === user.id).length}
        teams={teams.map((t) => ({ ...t, seats: PLANS[t.plan].seats, members: members.find((m) => m.orgId === t.orgId)?.members ?? [] }))}
      />
    </div>
  );
}
