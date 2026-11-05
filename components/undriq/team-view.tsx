"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Crown, Lock, LogOut, Mail, Pencil, Plus, Trash2, User, UserMinus, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { useApp } from "@/components/shell/app-provider";
import { createTeam, deleteTeam, inviteToTeam, leaveTeam, removeFromTeam, renameTeam, revokeInvite, switchSpace } from "@/lib/actions/undriq";
import { PLANS } from "@/lib/billing/plans";
import type { Plan } from "@/lib/types";
import type { Space, SpaceMember } from "@/lib/undriq/types";
import { track } from "@/components/analytics";

type TeamRow = Space & { seats: number; members: SpaceMember[] };

export function TeamView(p: { me: string; activeOrgId: string; ownPlan: Plan; canCreate: boolean; seatsForOwnPlan: number; teams: TeamRow[] }) {
  const { openUpgrade } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, start] = React.useTransition();

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string; status?: number }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return r.status === 402 ? openUpgrade(r.error, "firm") : toast(r.error, "error");
      if (msg) toast(msg);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-text text-ink"><Lock className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">My private space</div>
            <p className="text-sm text-muted">Your own pipeline and buyer list. Nobody else can see it, including teammates.</p>
          </div>
          {p.teams.some((t) => t.orgId === p.activeOrgId) ? null : <Badge>Active</Badge>}
        </div>
      </Card>

      {p.teams.map((t) => <TeamCard key={t.orgId} t={t} me={p.me} active={t.orgId === p.activeOrgId} act={act} pending={pending} />)}

      <Card>
        <CardHeader title="Create a team space" description={p.canCreate ? `Your ${PLANS[p.ownPlan].name} plan includes team spaces for up to ${p.seatsForOwnPlan} people, you included.` : "Team spaces come with Firm (5 people) and Fund (15 people)."} />
        <form
          className="flex flex-col gap-2 p-5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!p.canCreate) return openUpgrade("Team spaces come with Firm and Fund.", "firm");
            act(async () => {
              const r = await createTeam(name);
              if (r.ok) {
                track("team_created");
                setName("");
              }
              return r;
            }, "Team created. You're now working in it");
          }}
        >
          <Input aria-label="Team name" placeholder="Acquisitions team" value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
          <Button type="submit" disabled={pending}><Plus /> Create team</Button>
        </form>
      </Card>
    </div>
  );
}

function TeamCard({ t, me, active, act, pending }: { t: TeamRow; me: string; active: boolean; act: (fn: () => Promise<{ ok: true } | { ok: false; error: string; status?: number }>, msg?: string) => void; pending: boolean }) {
  const [email, setEmail] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(t.name);
  const owner = t.ownerUserId === me;
  const used = t.members.length;
  const toast = useToast();
  const router = useRouter();

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3 border-b border-line-soft px-5 py-4">
        <span className="grid size-9 place-items-center rounded-lg bg-raised"><Users className="size-4" /></span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRenaming(false); act(() => renameTeam(t.orgId, newName), "Team renamed"); }}>
              <Input aria-label="Team name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" autoFocus />
              <Button size="sm" type="submit">Save</Button>
            </form>
          ) : (
            <div className="flex items-center gap-2 font-medium">
              {t.name}
              {owner ? <button aria-label="Rename team" onClick={() => setRenaming(true)} className="text-muted hover:text-text"><Pencil className="size-3.5" /></button> : null}
            </div>
          )}
          <p className="text-sm text-muted">{owner ? "You own this team" : "You're a member"} · {PLANS[t.plan].name} · {used} of {t.seats} seats</p>
        </div>
        <div className="flex items-center gap-2">
          {active ? <Badge>Active</Badge> : <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => switchSpace(t.orgId), `Switched to ${t.name}`)}><ArrowRightLeft /> Switch here</Button>}
          {!owner ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm(`Leave ${t.name}? You'll lose access to its deals and buyers.`) && act(() => leaveTeam(t.orgId), "You left the team")}><LogOut /> Leave</Button> : null}
        </div>
      </div>
      {t.plan !== "firm" && t.plan !== "fund" ? (
        <p className="border-b border-line-soft bg-amber/10 px-5 py-2.5 text-sm text-amber">
          {owner ? "Your plan no longer includes team spaces. Upgrade to Firm or Fund to keep working here." : "The owner's plan no longer includes team spaces. Paid features are paused here until they upgrade."}
        </p>
      ) : null}
      <ul className="divide-y divide-line-soft">
        {t.members.map((m) => (
          <li key={m.email + String(m.userId)} className="flex items-center gap-3 px-5 py-3 text-sm">
            {m.pending ? <Mail className="size-4 text-muted" /> : m.role === "owner" ? <Crown className="size-4" /> : <User className="size-4 text-muted" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.pending ? m.email : m.name}{m.userId === me ? " (you)" : ""}</div>
              <div className="truncate text-xs text-muted">{m.pending ? "Invited. Joins when they sign up with this email" : m.email}</div>
            </div>
            {m.role === "owner" ? <Badge>Owner</Badge> : null}
            {owner && m.pending ? <Button size="sm" variant="ghost" onClick={() => act(() => revokeInvite(t.orgId, m.email), "Invite revoked")}>Revoke</Button> : null}
            {owner && !m.pending && m.role !== "owner" && m.userId ? (
              <Button size="sm" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => window.confirm(`Remove ${m.name} from ${t.name}?`) && act(() => removeFromTeam(t.orgId, m.userId!), "Removed")}><UserMinus /></Button>
            ) : null}
          </li>
        ))}
      </ul>
      {owner ? (
        <div className="space-y-3 border-t border-line-soft p-5">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await inviteToTeam(t.orgId, email);
              if (!r.ok) return toast(r.error, "error");
              setEmail("");
              toast(r.data.result === "added" ? "Added. They can switch to this team now" : r.data.result === "invited" ? "Invite saved. They join when they sign up with that email" : "They're already on this team");
              router.refresh();
            }}
          >
            <Input aria-label="Teammate email" type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={used >= t.seats}><Plus /> Add person</Button>
          </form>
          {used >= t.seats ? <p className="text-xs text-muted">This team is full. {t.plan === "firm" ? "Fund teams get up to 15 seats." : "Remove someone to add another person."}</p> : null}
          <div className="flex justify-end">
            <Button size="sm" variant="danger" disabled={pending} onClick={() => {
              const typed = window.prompt(`This permanently deletes ${t.name} and every deal and buyer in it. Type the team name to confirm.`);
              if (typed != null) act(() => deleteTeam(t.orgId, typed), "Team deleted");
            }}><Trash2 /> Delete team</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
