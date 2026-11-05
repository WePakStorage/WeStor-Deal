import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { BrandMark } from "@/components/shell/nav";
import { LoginForm } from "./login-form";
import { authMessage } from "@/lib/auth-messages";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; mode?: string }> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  if (sp.next && demo) redirect("/app");
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center"><BrandMark /></Link>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-panel">
          <h1 className="text-xl font-semibold tracking-tight">{sp.mode === "signup" ? "Create your free account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted">{sp.mode === "signup" ? "Your first deal analysis is fully unlocked. No card needed." : "Sign in to UndrIq, or create a free account."}</p>
          <LoginForm demo={demo} next={sp.next ?? "/app"} initialMode={sp.mode === "signup" ? "signup" : "signin"} />
          {sp.error ? <p role="alert" className="mt-4 text-sm text-stop">{authMessage(sp.error)}</p> : null}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
