"use client";

import * as React from "react";
import { FileSignature } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/interactive";
import { Button, Field, Input } from "@/components/ui/primitives";
import { STAGE_LABEL, type Stage } from "@/lib/types";

export interface ContractValues {
  contract_signed_at: string;
  contract_price: number;
  assignable: boolean;
}

/** Required before a deal can move to Under contract (or Assigned without a contract on file). */
export function ContractModal({ open, onOpenChange, dealName, stage, defaultPrice, onSubmit, error }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealName: string;
  stage: Stage;
  defaultPrice: number | null;
  onSubmit: (v: ContractValues) => Promise<void>;
  error?: string | null;
}) {
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = React.useState(defaultPrice ? String(defaultPrice) : "");
  const [assignable, setAssignable] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setPrice(defaultPrice ? String(defaultPrice) : "");
  }, [open, defaultPrice]);

  const priceNum = Number(price.replace(/[$,\s]/g, ""));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && priceNum > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Record the contract`} description={`${dealName} moves to ${STAGE_LABEL[stage]} once the signed contract is on file.`}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setBusy(true);
            await onSubmit({ contract_signed_at: date, contract_price: priceNum, assignable });
            setBusy(false);
          }}
        >
          <Field label="Date signed" htmlFor="c-date">
            <Input id="c-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Contract price" htmlFor="c-price">
            <Input id="c-price" inputMode="numeric" required placeholder="$715,000" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised/60 p-3.5">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--door)]" checked={assignable} onChange={(e) => setAssignable(e.target.checked)} />
            <span>
              <span className="block text-sm font-medium">Contract is assignable</span>
              <span className="block text-xs text-muted">Buyers who don&apos;t accept assignments are listed as direct purchase only.</span>
            </span>
          </label>
          {error ? <p className="text-sm text-stop">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || busy}>
              <FileSignature /> {busy ? "Saving…" : `Move to ${STAGE_LABEL[stage]}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
