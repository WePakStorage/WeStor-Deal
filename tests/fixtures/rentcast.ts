// Sample responses in the shape RentCast documents (developers.rentcast.io). Values are made up for tests.
export const property = [{
  id: "1234-Main-St,-Memphis,-TN-38118", formattedAddress: "1234 Main St, Memphis, TN 38118", city: "Memphis", state: "TN", zipCode: "38118", county: "Shelby",
  propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFootage: 1450, lotSize: 8712, yearBuilt: 1972,
  lastSaleDate: "2015-06-12T00:00:00.000Z", lastSalePrice: 64000, ownerOccupied: false,
  features: { floorCount: 1, garage: true },
  taxAssessments: { "2023": { year: 2023, value: 98000, land: 15000, improvements: 83000 }, "2024": { year: 2024, value: 104000, land: 16000, improvements: 88000 } },
  propertyTaxes: { "2023": { year: 2023, total: 1890 }, "2024": { year: 2024, total: 1984 } },
  owner: { names: ["Private Person"], type: "Individual" },
}];
export const value = {
  price: 205000, priceRangeLow: 188000, priceRangeHigh: 222000,
  comparables: [
    { formattedAddress: "1200 Main St, Memphis, TN 38118", propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFootage: 1500, price: 212000, distance: 0.3, status: "Inactive" },
    { formattedAddress: "77 Elm Ave, Memphis, TN 38118", propertyType: "Single Family", bedrooms: 3, bathrooms: 1, squareFootage: 1380, price: 199000, distance: 0.6, status: "Active" },
  ],
};
export const rent = { rent: 1625, rentRangeLow: 1450, rentRangeHigh: 1800, comparables: [{ formattedAddress: "9 Oak Ct, Memphis, TN 38118", bedrooms: 3, squareFootage: 1400, price: 1650, distance: 0.4 }] };
export const listing = [{
  formattedAddress: "1234 Main St, Memphis, TN 38118", price: 129900, status: "Active", daysOnMarket: 96, listedDate: "2026-08-01T00:00:00.000Z", mlsNumber: "10123456",
  listingAgent: { name: "Pat Agent", phone: "9015550100", email: "pat@brokerage.example" }, listingOffice: { name: "Main Street Realty" },
}];
