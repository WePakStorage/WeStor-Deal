/** Asset classes UndrIq analyzes. Defaults here feed the buy box rules. */
export const ASSET_CLASSES = ["residential", "multifamily", "storage", "industrial", "commercial"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export interface AssetInfo {
  label: string;
  cap: number;
  types: Record<string, string>;
}

export const ASSETS: Record<AssetClass, AssetInfo> = {
  residential: { label: "Residential 1–4", cap: 0.07, types: { sfr: "Single-family", small_multi: "2–4 units" } },
  multifamily: { label: "Multifamily", cap: 0.065, types: { multifamily: "Multifamily 5+" } },
  storage: {
    label: "Self storage",
    cap: 0.085,
    types: { drive_up: "Drive-up storage", climate: "Climate-controlled storage", mixed: "Mixed storage", rv_boat: "RV and boat storage" },
  },
  industrial: { label: "Industrial", cap: 0.075, types: { warehouse: "Warehouse", flex: "Flex industrial", distribution: "Distribution" } },
  commercial: { label: "Retail and office", cap: 0.08, types: { retail: "Retail", office: "Office", mixed_use: "Mixed-use" } },
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = Object.assign({}, ...Object.values(ASSETS).map((a) => a.types));

export const isAssetClass = (v: unknown): v is AssetClass => typeof v === "string" && (ASSET_CLASSES as readonly string[]).includes(v);

export function assetOf(type: string | null | undefined): AssetClass {
  const hit = ASSET_CLASSES.find((k) => type != null && type in ASSETS[k].types);
  return hit ?? "commercial";
}

export const defaultType = (a: AssetClass): string => Object.keys(ASSETS[a].types)[0] ?? "sfr";
