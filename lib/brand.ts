// Single place for the product brand (SPEC §16 #14), so it can be renamed later.
export const brand = {
  name: "Chore Board",
  tagline: "Chores kids actually want to do.",
  domain: "kids.diegoczul.com",
  supportEmail: "hello@diegoczul.com",
  legalEntityName: process.env.LEGAL_ENTITY_NAME || "Chore Board",
} as const;
