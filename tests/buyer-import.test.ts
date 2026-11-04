import { describe, expect, it } from "vitest";
import { guessMapping, mapRow } from "@/lib/buyer-import";
import { buyerSchema } from "@/lib/schemas";

describe("buyer CSV import", () => {
  const headers = ["Company", "Contact", "Email Address", "States", "Min Price", "Max Price", "Property Type", "Takes Assignments", "Strategy"];
  const mapping = guessMapping(headers);

  it("guesses columns", () => {
    expect(mapping.firm_name).toBe("Company");
    expect(mapping.email).toBe("Email Address");
    expect(mapping.accepts_assignment).toBe("Takes Assignments");
  });

  it("maps and validates a row", () => {
    const row = mapRow(
      { Company: "Alamo Storage", Contact: "J. Ruiz", "Email Address": "j@alamo.example", States: "TX; OK", "Min Price": "$500,000", "Max Price": "2,000,000", "Property Type": "Drive-up, Climate", "Takes Assignments": "yes", Strategy: "Value-add" },
      mapping,
    );
    const b = buyerSchema.parse(row);
    expect(b.states).toEqual(["TX", "OK"]);
    expect(b.min_price).toBe(500_000);
    expect(b.max_price).toBe(2_000_000);
    expect(b.property_types).toEqual(["drive_up", "climate"]);
    expect(b.accepts_assignment).toBe(true);
    expect(b.strategy).toBe("value_add");
  });
});
