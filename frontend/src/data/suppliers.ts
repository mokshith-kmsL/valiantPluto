import type { Supplier } from "@/lib/types";

// Supplier IDs match the seeded suppliers in the database (migration 003)
export const suppliers: Supplier[] = [
  { id: "00000000-0000-0000-0003-000000000001", name: "Default Supplier" },
];
