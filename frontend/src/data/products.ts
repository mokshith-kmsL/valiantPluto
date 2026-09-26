import type { Product } from "@/lib/types";

export const products: Product[] = [
  { id: "P001", sku: "WIDGET01", name: "Blue Widget",          category: "Widgets",      currentQty: 500  },
  { id: "P002", sku: "GADGET02", name: "Smart Gadget Pro",     category: "Electronics",  currentQty: 128  },
  { id: "P003", sku: "CABLE03",  name: "USB-C Cable 2m",       category: "Accessories",  currentQty: 1200 },
  { id: "P004", sku: "STAND04",  name: "Adjustable Monitor Stand", category: "Furniture", currentQty: 47  },
  { id: "P005", sku: "PAPER05",  name: "A4 Copy Paper (ream)",  category: "Stationery",  currentQty: 350  },
  { id: "P006", sku: "HEADSET06", name: "Wireless Headset",    category: "Electronics",  currentQty: 3    },
];
