import { LegalPage } from "@/components/marketing/legal";

export const metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      sections={[
        { h: "The service", p: "WeStor DealFlow is software for organizing, analyzing and marketing self-storage acquisition opportunities. It provides information and calculation tools only." },
        { h: "Not advice", p: "Nothing in the service is legal, tax, accounting or investment advice. Calculations depend on the data you enter or upload and may be wrong. You are responsible for verifying every number and for your own decisions." },
        { h: "Your documents and compliance", p: "Generated previews and offering memorandums are templates. You are responsible for complying with all laws that apply to you, including state real-estate licensing, wholesaling and disclosure rules and securities laws, and for having an attorney review your documents." },
        { h: "Listing data", p: "You may only upload or forward data you have the right to use. The service does not scrape third-party listing sites." },
        { h: "Billing", p: "Paid plans renew monthly until cancelled in the billing portal. If a payment fails, paid features may be suspended after the payment processor's retry period. Your data is kept on the Free plan." },
        { h: "Limitation of liability", p: "To the extent allowed by law, the service is provided as is, and our liability is limited to the fees you paid in the prior three months." },
      ]}
    />
  );
}
