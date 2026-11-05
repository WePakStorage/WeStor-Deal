import Link from "next/link";
import { BrandMark } from "@/components/shell/nav";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)] px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center"><BrandMark /></Link>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-panel">
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-1 text-sm text-muted">Choose a password you haven&apos;t used here before.</p>
          <ResetForm />
        </div>
      </div>
    </div>
  );
}
