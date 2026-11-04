import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <div className="text-sm text-muted">404</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted">The deal may have been removed, or the link is out of date.</p>
        <Button asChild className="mt-6"><Link href="/app">Back to pipeline</Link></Button>
      </div>
    </div>
  );
}
