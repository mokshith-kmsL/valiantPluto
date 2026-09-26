# StockSense Frontend — Technical Design

## Overview

StockSense is a single-tenant inventory management frontend that provides warehouse staff and managers with a real-time view of stock levels, movement history, and operational forms for common warehouse transactions. The application is a fully client-side React application backed by mock JSON data, structured to mirror the contract of a real REST API so the data layer can be swapped for live endpoints with minimal refactoring.

The UI exposes four core transaction forms (receipts, deliveries, transfers, adjustments), a KPI dashboard with filtering, a move history log, and several stub pages for future features. All form submissions write to an in-memory ledger stored in React state — no backend is required for the initial implementation.

### Goals

- Deliver a visually polished, production-quality UI that can be demo'd to stakeholders.
- Keep all business logic in pure, testable functions decoupled from React rendering.
- Establish a component and data layer structure that scales to a real backend without rewrites.
- Enforce correctness through Zod schemas, property-based tests, and TypeScript types.

---

## Architecture

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | File-based routing, server components for static pages, easy deployment |
| Language | TypeScript (strict mode) | Catches schema mismatches at compile time; essential for form data integrity |
| Styling | Tailwind CSS v3 | Utility-first; consistent with shadcn/ui's assumptions |
| UI primitives | shadcn/ui | Accessible, unstyled-by-default components that compose cleanly with Tailwind |
| Forms | React Hook Form + Zod (zodResolver) | Minimal re-renders; declarative validation; schema reuse between form and type |
| Charts | Recharts | Mature React-native charting; simple API for line/bar series |
| State | React `useState` / `useReducer` | Ledger state is app-local; no external store needed at this scope |
| Testing | Vitest + fast-check | Vitest is the natural test runner for Vite-adjacent tooling; fast-check is the leading JS PBT library |

### High-Level Data Flow

```
Mock JSON files (src/data/)
        │
        ▼
  Type-safe imports (typed consts)
        │
        ▼
  Page / Layout components
  ┌─────┴──────────────────────────────┐
  │  Dashboard          Forms           │
  │  ┌─────────┐   ┌────────────────┐  │
  │  │ KpiCard │   │ React Hook Form│  │
  │  │ StockChart   │ + zodResolver  │  │
  │  │ FilterBar│   │                │  │
  │  └─────────┘   └───────┬────────┘  │
  └──────────────────────  │  ──────────┘
                           ▼
                    LedgerEntry[]
                    (useState in
                     page component)
```

### Project Directory Layout

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (Sidebar + main slot)
│   ├── page.tsx                # Dashboard (/)
│   ├── receipts/page.tsx       # /receipts
│   ├── deliveries/page.tsx     # /deliveries
│   ├── transfers/page.tsx      # /transfers
│   ├── adjustments/page.tsx    # /adjustments
│   ├── history/page.tsx        # /history (stub)
│   ├── products/page.tsx       # /products (stub)
│   ├── settings/page.tsx       # /settings (stub)
│   └── profile/page.tsx        # /profile (stub)
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx
│   ├── dashboard/
│   │   ├── KpiCard.tsx
│   │   ├── StockChart.tsx
│   │   └── FilterBar.tsx
│   └── forms/
│       ├── ReceiptForm.tsx
│       ├── DeliveryForm.tsx
│       ├── TransferForm.tsx
│       └── AdjustmentForm.tsx
│
├── data/                       # Mock data (mirrors API response shapes)
│   ├── kpis.ts
│   ├── chartData.ts
│   ├── products.ts
│   ├── suppliers.ts
│   ├── customers.ts
│   ├── locations.ts
│   └── warehouses.ts
│
├── lib/
│   ├── schemas/                # Zod validation schemas
│   │   ├── receipt.schema.ts
│   │   ├── delivery.schema.ts
│   │   ├── transfer.schema.ts
│   │   └── adjustment.schema.ts
│   ├── types.ts                # Shared TypeScript types (LedgerEntry, etc.)
│   └── utils.ts                # Pure helper functions (variance, filter, transform)
│
└── __tests__/                  # Vitest + fast-check tests
    ├── schemas.test.ts
    ├── ledger.test.ts
    ├── delivery-state-machine.test.ts
    ├── adjustment.test.ts
    └── dashboard-filter.test.ts
```

---

## Components and Interfaces

### `layout/Sidebar.tsx`

Renders a persistent left navigation rail. On screens narrower than 768 px the rail is hidden and replaced by a hamburger icon in the top bar that opens a slide-over drawer.

```ts
interface SidebarProps {
  currentPath: string; // highlights active nav item
}
```

Nav items:
- Dashboard `/`
- Products `/products`
- Receipts `/receipts`
- Deliveries `/deliveries`
- Transfers `/transfers`
- Adjustments `/adjustments`
- Move History `/history`
- Settings `/settings`
- Profile `/profile`

Active item: `bg-blue-600 text-white rounded-md`. Inactive: `text-slate-300 hover:bg-slate-800`.

---

### `dashboard/KpiCard.tsx`

Renders a single metric tile using a shadcn/ui `Card`.

```ts
interface KpiCardProps {
  label: string;         // e.g. "Total SKUs"
  value: number | string;
  unit?: string;         // e.g. "units", "$"
  trend?: "up" | "down" | "neutral";
  trendValue?: string;   // e.g. "+4.2%"
}
```

Layout: `label` on top in `text-sm text-slate-500`, `value` large in `text-3xl font-bold`, optional trend badge below.

---

### `dashboard/FilterBar.tsx`

Three shadcn/ui `Select` dropdowns rendered in a horizontal row.

```ts
interface FilterBarProps {
  warehouses: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  dateRanges: { id: string; label: string }[];
  onChange: (filters: ActiveFilters) => void;
}

interface ActiveFilters {
  warehouseId: string | "all";
  categoryId: string | "all";
  dateRange: string | "all";
}
```

Emits `onChange` on every selection change. The parent page applies `applyFilters(data, filters)` (pure function in `lib/utils.ts`) and passes filtered data down to `KpiCard` and `StockChart`.

---

### `dashboard/StockChart.tsx`

Wraps a Recharts `ResponsiveContainer` + `ComposedChart` (line + bar).

```ts
interface StockChartProps {
  series: ChartSeries[];
  xKey: string;
}

interface ChartSeries {
  dataKey: string;
  label: string;
  type: "line" | "bar";
  color: string;
}

type ChartDataPoint = Record<string, string | number>;
```

The component itself is presentational. Data transformation (raw ledger entries → `ChartDataPoint[]`) lives in `lib/utils.ts::buildChartData()`.

---

### `forms/ReceiptForm.tsx`

```ts
// Zod schema (receipt.schema.ts)
const ReceiptSchema = z.object({
  supplierId:    z.string().min(1, "Supplier is required"),
  warehouseId:   z.string().min(1, "Warehouse is required"),
  sku:           z.string().regex(/^[a-zA-Z0-9]+$/, "SKU must be alphanumeric").min(1).max(50),
  productName:   z.string().min(1, "Product name is required"),
  quantity:      z.number().int().positive("Quantity must be a positive integer"),
  unitCost:      z.number().nonnegative("Unit cost must be zero or greater"),
  referenceNote: z.string().optional(),
});

type ReceiptFormValues = z.infer<typeof ReceiptSchema>;
```

On valid submit: appends a `LedgerEntry` of `type: "receipt"` to parent state, resets the form.

---

### `forms/DeliveryForm.tsx`

Implements a 3-step state machine. Current step stored in local `useState<"pick" | "pack" | "validate">`.

```ts
const DeliverySchema = z.object({
  customerId:  z.string().min(1, "Customer is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  sku:         z.string().regex(/^[a-zA-Z0-9]+$/).min(1).max(50),
  quantity:    z.number().int().positive(),
  deliveryRef: z.string().optional(),
});
```

Step flow:
1. **Pick** — select customer, warehouse, product, qty → "Confirm Pick"
2. **Pack** — review line items, confirm packaging → "Confirm Pack"
3. **Validate** — final confirmation screen → "Complete Delivery"

Only on completing step 3 does the `LedgerEntry` get appended (`type: "delivery"`).

State machine transition function (pure, lives in `lib/utils.ts`):

```ts
type DeliveryStep = "pick" | "pack" | "validate";

function nextDeliveryStep(current: DeliveryStep): DeliveryStep | "done" {
  const transitions: Record<DeliveryStep, DeliveryStep | "done"> = {
    pick: "pack",
    pack: "validate",
    validate: "done",
  };
  return transitions[current];
}
```

---

### `forms/TransferForm.tsx`

```ts
const TransferSchema = z.object({
  sourceLocationId: z.string().min(1, "Source location is required"),
  destLocationId:   z.string().min(1, "Destination location is required"),
  sku:              z.string().regex(/^[a-zA-Z0-9]+$/).min(1).max(50),
  quantity:         z.number().int().positive(),
  note:             z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.sourceLocationId === data.destLocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destLocationId"],
      message: "Destination must differ from source location",
    });
  }
});
```

---

### `forms/AdjustmentForm.tsx`

```ts
const AdjustmentSchema = z.object({
  locationId:  z.string().min(1, "Location is required"),
  sku:         z.string().regex(/^[a-zA-Z0-9]+$/).min(1).max(50),
  currentQty:  z.number().int().nonnegative(),
  newQty:      z.number().int().nonnegative(),
  reason:      z.string().min(1, "Reason is required"),
});
```

Variance is derived on submit (not a form field):

```ts
function computeVariance(newQty: number, currentQty: number): number {
  return newQty - currentQty;
}
```

The `LedgerEntry` appended is `type: "adjustment"` and includes the computed `variance` field.

---

## Data Models

### `LedgerEntry`

The central record type. All four form submissions produce a `LedgerEntry`.

```ts
type LedgerEntryType = "receipt" | "delivery" | "transfer" | "adjustment";

interface LedgerEntry {
  id:        string;           // crypto.randomUUID()
  type:      LedgerEntryType;
  timestamp: string;           // ISO 8601
  sku:       string;
  quantity:  number;
  // Receipt-specific
  supplierId?:    string;
  warehouseId?:   string;
  unitCost?:      number;
  referenceNote?: string;
  // Delivery-specific
  customerId?:    string;
  deliveryRef?:   string;
  // Transfer-specific
  sourceLocationId?: string;
  destLocationId?:   string;
  // Adjustment-specific
  currentQty?: number;
  newQty?:     number;
  variance?:   number;
  reason?:     string;
}
```

### Mock Data Files

Each file in `src/data/` exports a typed const array:

```ts
// src/data/kpis.ts
export const kpiData: KpiMetric[] = [
  { id: "total-skus",    label: "Total SKUs",     value: 342,   unit: "SKUs" },
  { id: "total-units",   label: "Units in Stock", value: 14820, unit: "units" },
  { id: "low-stock",     label: "Low Stock Alerts", value: 7,   unit: "items" },
  { id: "pending-moves", label: "Pending Moves",  value: 23,    unit: "moves" },
];

// src/data/products.ts
export const products: Product[] = [
  { id: "P001", sku: "WIDGET01", name: "Blue Widget", category: "Widgets", currentQty: 500 },
  // ...
];
```

All mock data shapes use interfaces defined in `src/lib/types.ts`.

### `applyFilters` (pure utility)

```ts
// src/lib/utils.ts
function applyFilters<T extends { warehouseId?: string; categoryId?: string; date?: string }>(
  data: T[],
  filters: ActiveFilters
): T[] {
  return data.filter((item) => {
    if (filters.warehouseId !== "all" && item.warehouseId !== filters.warehouseId) return false;
    if (filters.categoryId  !== "all" && item.categoryId  !== filters.categoryId)  return false;
    // date range filtering omitted for brevity
    return true;
  });
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature has several pure functions (schema validators, the variance computation, the state machine transition function, the filter utility, and the ledger mutation logic) that are well-suited to property-based testing. The UI rendering layer is excluded from PBT; it is covered by example-based tests.

---

### Property 1: Zod SKU Schema — Valid/Invalid Partition

*For any* string input, the SKU Zod schema SHALL accept it if and only if it matches `/^[a-zA-Z0-9]+$/` and has length between 1 and 50 (inclusive); all other strings SHALL produce a `ZodError`.

**Validates: Requirements R.3, Z.1**

---

### Property 2: Zod Quantity Schema — Positive Integer Partition

*For any* number input, the quantity Zod schema SHALL accept it if and only if it is a finite integer greater than zero; zero, negative integers, non-integers, and non-finite values SHALL produce a `ZodError`.

**Validates: Requirements R.4, Z.2**

---

### Property 3: Transfer superRefine — Same-Location Rejection

*For any* location identifier `L`, a TransferSchema parse where both `sourceLocationId` and `destLocationId` equal `L` SHALL always produce a `ZodError` on `destLocationId`, regardless of all other field values being valid.

**Validates: Requirements T.1, Z.3**

---

### Property 4: Ledger Round-Trip — Valid Submission Appends Correct Entry

*For any* valid form payload (receipt, delivery, transfer, or adjustment), submitting the form SHALL increase the ledger array length by exactly 1, and the new entry SHALL have a `type` field equal to the form's transaction type, a `sku` matching the submitted SKU, and a `quantity` matching the submitted quantity.

**Validates: Requirements R.1, DL.4, T.3, A.3**

---

### Property 5: Delivery State Machine Transitions

*For any* sequence of valid step submissions through the delivery form (pick → pack → validate), the state SHALL advance monotonically through `"pick" → "pack" → "validate" → "done"`, and no step SHALL be skippable — `nextDeliveryStep("pick")` must equal `"pack"` and `nextDeliveryStep("pack")` must equal `"validate"` for all inputs.

**Validates: Requirements DL.1, DL.2, DL.3**

---

### Property 6: Adjustment Variance Computation

*For any* pair of non-negative integers `(newQty, currentQty)`, `computeVariance(newQty, currentQty)` SHALL equal `newQty - currentQty`, including negative results when `newQty < currentQty`.

**Validates: Requirements A.1, A.2**

---

### Property 7: Dashboard Filter Subset Invariant

*For any* dataset and any `ActiveFilters` value, `applyFilters(data, filters)` SHALL return an array that is a subset of the original dataset — it SHALL NOT introduce items not present in the input, and every returned item SHALL satisfy all non-`"all"` filter predicates.

**Validates: Requirements D.2**

---

## Error Handling

### Form Validation Errors

All validation errors surface through React Hook Form's `formState.errors` map, which is populated by zodResolver on submit (and optionally on blur/change via `mode: "onChange"`).

Visual treatment:
- Input field: `border-red-500 focus:ring-red-500`
- Error message below field: `text-sm text-red-500 mt-1`

No toast or modal is shown for field-level errors — inline messages are sufficient.

### Invalid State Navigation

If a user navigates directly to `/history` or other stub pages, the page renders a `<ComingSoon />` placeholder component rather than a blank screen or error.

### Ledger Integrity

Because there is no backend, there is no network error path. However, if `crypto.randomUUID()` is unavailable (very old browsers), the app falls back to a `Date.now() + Math.random()` string for ID generation. A TypeScript type guard enforces this at the call site in `lib/utils.ts`.

### Chart Data Gaps

If `buildChartData()` receives an empty ledger, it returns an empty array. `StockChart` renders a "No data yet" empty-state card rather than a broken Recharts canvas.

---

## Testing Strategy

### Approach

A dual-layer testing strategy is used:

- **Unit / example-based tests** (Vitest): verify specific scenarios, integration between components, edge cases, and error conditions.
- **Property-based tests** (Vitest + fast-check): verify universal properties across large randomised input spaces, corresponding to the Correctness Properties above.

Both layers are complementary: unit tests catch concrete regression bugs; property tests verify that logic holds across the entire input space including edge cases the developer might not think to write.

### Property-Based Test Configuration

Library: **fast-check** (`npm install --save-dev fast-check`)

Each property test is configured with a minimum of **100 iterations** (fast-check default is 100; increase with `{ numRuns: 200 }` for the schema tests where the input space is large).

Each property test is tagged with a comment referencing the design property:

```ts
// Feature: stocksense-frontend, Property 1: Zod SKU schema accepts valid / rejects invalid
```

### Test Files and Coverage

#### `__tests__/schemas.test.ts`

- Property 1: SKU schema accept/reject partition
  - Generator: `fc.string()` + `fc.stringOf(fc.constantFrom(...alphanumeric), { minLength: 1, maxLength: 50 })`
  - Assert: valid strings parse without error; invalid strings throw
- Property 2: Quantity schema positive-integer partition
  - Generator: `fc.integer()`, `fc.float()`, `fc.constantFrom(0, -1, -100, 1.5)`
  - Assert: only `integer > 0` values pass

#### `__tests__/transfer-schema.test.ts`

- Property 3: superRefine same-location rejection
  - Generator: `fc.string().filter(s => s.length > 0)` for location ID
  - Assert: `TransferSchema.safeParse({ sourceLocationId: L, destLocationId: L, ... })` always fails

#### `__tests__/ledger.test.ts`

- Property 4: ledger round-trip
  - Generator: `fc.record({ sku: validSku, quantity: positiveInt, supplierId: fc.string() })`
  - Assert: ledger length increases by 1; new entry matches payload

#### `__tests__/delivery-state-machine.test.ts`

- Property 5: state machine transitions
  - Generator: none needed (finite state space — exhaustive example-based test)
  - Assert: `nextDeliveryStep("pick") === "pack"`, `nextDeliveryStep("pack") === "validate"`, etc.

#### `__tests__/adjustment.test.ts`

- Property 6: variance computation
  - Generator: `fc.tuple(fc.nat(), fc.nat())` for `(newQty, currentQty)`
  - Assert: `computeVariance(n, c) === n - c`

#### `__tests__/dashboard-filter.test.ts`

- Property 7: filter subset invariant
  - Generator: `fc.array(fc.record({ warehouseId: ..., categoryId: ... }))` + random filter combos
  - Assert: every returned item satisfies the active filter predicates

### Example-Based Tests

- Routing smoke: each page path renders its expected heading (using React Testing Library + Next.js test helpers)
- Sidebar: at `width < 768` the nav list is hidden and the hamburger button is visible
- FilterBar: selecting "all" returns the full unfiltered dataset
- DeliveryForm: newly created delivery starts in `"pick"` state
- AdjustmentForm: negative variance (newQty < currentQty) submits without error
- StockChart: empty data renders the empty-state message

### Running Tests

```bash
# Single run (CI-safe)
npx vitest run

# Watch mode (local development)
npx vitest
```
