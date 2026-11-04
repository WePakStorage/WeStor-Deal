import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { BrandMark } from "@/components/shell/nav";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  if (sp.next && demo) redirect("/app");
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center"><BrandMark /></Link>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-panel">
          <h1 className="text-xl font-semibold tracking-tight">Sign in to DealFlow</h1>
          <p className="mt-1 text-sm text-muted">New here? Signing in creates your account.</p>
          <LoginForm demo={demo} next={sp.next ?? "/app"} />
          {sp.error ? <p className="mt-4 text-sm text-stop">{sp.error}</p> : null}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
