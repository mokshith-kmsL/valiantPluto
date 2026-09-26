import type { Location } from "@/lib/types";

export const locations: Location[] = [
  { id: "LOC001", name: "WH/Stock",   warehouseId: "WH01" },
  { id: "LOC002", name: "WH/Input",   warehouseId: "WH01" },
  { id: "LOC003", name: "WH/Output",  warehouseId: "WH01" },
  { id: "LOC004", name: "WH/Packing", warehouseId: "WH02" },
  { id: "LOC005", name: "STORE/Front", warehouseId: "WH03" },
  { id: "LOC006", name: "STORE/Back",  warehouseId: "WH03" },
];
