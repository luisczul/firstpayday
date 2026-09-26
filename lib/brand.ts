// Single place for the product brand, so it can be renamed later.
export const brand = {
  name: "First Payday",
  tagline: "The chore chart that pays your kids.",
  domain: "firstpayday.app",
  supportEmail: process.env.SUPPORT_EMAIL || "info@firstpayday.app",
  legalEntityName: process.env.LEGAL_ENTITY_NAME || "First Payday",
} as const;
