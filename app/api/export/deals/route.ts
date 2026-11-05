import { toCsv } from "@/lib/csv";
import { csvResponse, handle } from "@/lib/server/http";
import { capRate } from "@/lib/underwriting";

export const GET = () =>
  handle(
    async ({ store, orgId }) => {
      const deals = await store.listDeals(orgId);
      const rows = deals.map((d) => ({
        name: d.name,
        city: d.market_city,
        state: d.market_state,
        stage: d.stage,
        property_type: d.property_type,
        units: d.units,
        nrsf: d.nrsf,
        acres: d.acres,
        year_built: d.year_built,
        list_price: d.list_price,
        target_price: d.target_price,
        appraised_value: d.appraised_value,
        contract_price: d.contract_price,
        contract_signed_at: d.contract_signed_at,
        t12_noi: d.noi.t12 ?? null,
        t12_cap_at_target: d.noi.t12 && d.target_price ? capRate(d.noi.t12, d.target_price).toFixed(4) : null,
      }));
      return csvResponse(toCsv(rows), "westor-deals.csv");
    },
    { feature: "csvExport" },
  );
