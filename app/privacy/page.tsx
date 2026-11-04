import { LegalPage } from "@/components/marketing/legal";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={[
        { h: "What we collect", p: "Account details (name, email), the deal, buyer and document data you add, billing records from Stripe, and basic product analytics such as page views." },
        { h: "How we use it", p: "To run the service, process documents you upload (including sending them to our AI provider for extraction), bill you, and improve the product. We don't sell your data." },
        { h: "Service providers", p: "We use Supabase (database and file storage), Anthropic (document reading), Stripe (payments), Resend (email) and PostHog (analytics). Each processes data on our behalf." },
        { h: "Your choices", p: "You can export your deals and buyers as CSV at any time and ask us to delete your account and data." },
        { h: "Security", p: "Data is isolated per organization with row-level security, files are stored privately, and secrets are kept server-side." },
      ]}
    />
  );
}
