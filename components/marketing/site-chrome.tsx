import Link from "next/link";
import { BrandMark } from "@/components/shell/nav";
import { Button } from "@/components/ui/primitives";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/"><BrandMark /></Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/pricing" className="rounded-md px-3 py-2 text-sm text-muted hover:text-text">Pricing</Link>
          <Link href="/login" className="hidden rounded-md px-3 py-2 text-sm text-muted hover:text-text sm:block">Sign in</Link>
          <Button asChild size="sm"><Link href="/login">Start free</Link></Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-[1fr_auto] sm:px-6">
        <div className="space-y-3">
          <BrandMark />
          <p className="max-w-xl text-xs leading-relaxed">
            UndrIq provides information and calculation tools only. It is not legal, tax or investment advice, and nothing here is an offer to sell or a solicitation to buy any security. Follow your state&apos;s wholesaling and disclosure rules and have an attorney review your documents.
          </p>
          <p className="text-xs">© {new Date().getFullYear()} WePak Storage. A WePak WeShip LLC company.</p>
        </div>
        <nav className="flex gap-5 sm:flex-col sm:gap-2 sm:text-right">
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
