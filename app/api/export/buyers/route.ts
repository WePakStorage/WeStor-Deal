import { toCsv } from "@/lib/csv";
import { csvResponse, handle } from "@/lib/server/http";

const COLUMNS = ["firm_name", "contact_name", "email", "phone", "buyer_type", "accepts_assignment", "states", "min_price", "max_price", "min_nrsf", "max_nrsf", "property_types", "strategy", "financing", "notes"];

export const GET = () =>
  handle(
    async ({ store, orgId }) => {
      const buyers = await store.listBuyers(orgId);
      return csvResponse(toCsv(buyers as unknown as Record<string, unknown>[], COLUMNS), "undriq-buyers.csv");
    },
    { feature: "csvExport" },
  );
