"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ListChecks, Plus, Trash2 } from "lucide-react";
import { addTask, deleteTask, toggleTask } from "@/lib/actions/deals";
import { cn } from "@/lib/cn";
import { date } from "@/lib/format";
import type { Task } from "@/lib/types";
import { Button, Card, EmptyState, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";

export function TasksTab({ dealId, tasks }: { dealId: string; tasks: Task[] }) {
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setBusy(true);
          const res = await addTask(dealId, title, due || null);
          setBusy(false);
          if (!res.ok) return toast(res.error, "error");
          setTitle("");
          setDue("");
          toast("Task added");
          router.refresh();
        }}
      >
        <Input aria-label="New task" placeholder="Add a task, e.g. Request rent roll" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
        <Input aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44" />
        <Button type="submit" disabled={busy || !title.trim()}><Plus /> Add task</Button>
      </form>
      {sorted.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No tasks yet" body="Track due diligence: rent roll, tax bills, site visit, financing, closing date." />
      ) : (
        <Card className="divide-y divide-line-soft">
          {sorted.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Mark ${t.title} ${t.done ? "not done" : "done"}`}
                className="size-4 accent-[var(--door)]"
                checked={t.done}
                onChange={async (e) => {
                  await toggleTask(dealId, t.id, e.target.checked);
                  router.refresh();
                }}
              />
              <span className={cn("flex-1 text-sm", t.done && "text-muted line-through")}>{t.title}</span>
              {t.due_date ? (
                <span className={cn("inline-flex items-center gap-1 text-xs tabular", !t.done && t.due_date < today ? "text-stop" : "text-muted")}>
                  <CalendarDays className="size-3.5" />{date(t.due_date)}
                </span>
              ) : null}
              <button
                aria-label={`Delete ${t.title}`}
                className="rounded p-1 text-muted opacity-0 transition hover:text-stop focus:opacity-100 group-hover:opacity-100"
                onClick={async () => {
                  await deleteTask(dealId, t.id);
                  router.refresh();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
