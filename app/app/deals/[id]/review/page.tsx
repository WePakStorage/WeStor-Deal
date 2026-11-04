import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OmReview } from "@/components/deals/om-review";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { toReview } from "@/lib/om/review";
import { requireContext } from "@/lib/server/context";

export const metadata = { title: "Review OM" };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { id } = await params;
  const { doc: docId } = await searchParams;
  const { store, orgId } = await requireContext();
  const bundle = await store.getDealBundle(orgId, id);
  if (!bundle) notFound();
  const doc = docId ? await store.getDocument(orgId, docId) : bundle.documents.find((d) => d.kind === "broker_om") ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/app/deals/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Back to deal
      </Link>
      <PageHeader title="Review the OM" description="Confirm or fix each number. Anything you change is tagged as yours; the rest stays tagged Broker OM." />
      {doc ? (
        <OmReview dealId={id} docId={doc.id} docName={doc.name} status={doc.parse_status} note={doc.parse_error} initial={toReview(doc.extraction, bundle.deal.name)} />
      ) : (
        <EmptyState title="No OM uploaded yet" body="Upload a broker OM from the Documents tab and we'll extract it here for review." />
      )}
    </div>
  );
}
