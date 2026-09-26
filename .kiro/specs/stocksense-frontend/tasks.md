# Implementation Plan: StockSense Frontend

## Overview

Build a single-tenant inventory management frontend using Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, and Recharts. All business logic lives in pure functions decoupled from React; an in-memory ledger (React state) replaces a real backend. Property-based tests (Vitest + fast-check) cover all seven correctness properties defined in the design.

---

## Tasks

- [x] 1. Project setup and configuration
  - [x] 1.1 Scaffold Next.js 14 App Router project with TypeScript strict mode
    - Run `npx create-next-app@latest` with `--typescript --tailwind --app --src-dir --import-alias "@/*"` flags inside the `frontend/` directory
    - Verify `tsconfig.json` has `"strict": true`
    - _Requirements: architecture baseline_

  - [x] 1.2 Install and configure UI and form dependencies
    - Install shadcn/ui (`npx shadcn-ui@latest init`), select slate base color and CSS variables
    - Add shadcn components: `card`, `select`, `button`, `input`, `label`, `badge`
    - Install React Hook Form, Zod, and zodResolver: `npm install react-hook-form zod @hookform/resolvers`
    - Install Recharts: `npm install recharts`
    - _Requirements: architecture baseline_

  - [x] 1.3 Install and configure Vitest and fast-check
    - Install `vitest`, `@vitejs/plugin-react`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom` as dev dependencies
    - Create `vitest.config.ts` with jsdom environment and path alias matching `tsconfig`
    - Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`
    - Create the `src/__tests__/` directory
    - _Requirements: testing baseline_

- [ ] 2. Shared types and mock data
  - [x] 2.1 Define shared TypeScript types in `src/lib/types.ts`
    - Define `LedgerEntryType`, `LedgerEntry`, `KpiMetric`, `Product`, `Supplier`, `Customer`, `Location`, `Warehouse`, `ChartSeries`, `ChartDataPoint`, `ActiveFilters`
    - _Requirements: data model_

  - [-] 2.2 Create mock data files in `src/data/`
    - Create `kpis.ts`, `chartData.ts`, `products.ts`, `suppliers.ts`, `customers.ts`, `locations.ts`, `warehouses.ts`
    - Each file exports a typed const array using interfaces from `src/lib/types.ts`
    - Populate each with at least 4–6 realistic sample rows
    - _Requirements: mock data layer_

- [ ] 3. Pure utility functions and Zod schemas
  - [-] 3.1 Implement pure utility functions in `src/lib/utils.ts`
    - Implement `computeVariance(newQty, currentQty): number`
    - Implement `nextDeliveryStep(current: DeliveryStep): DeliveryStep | "done"` with the `pick → pack → validate → done` transition map
    - Implement `applyFilters<T>(data, filters): T[]` with warehouse, category, and date-range predicates
    - Implement `buildChartData(entries: LedgerEntry[]): ChartDataPoint[]`
    - Add UUID fallback: `generateId(): string` using `crypto.randomUUID()` with `Date.now() + Math.random()` fallback
    - _Requirements: R.1, DL.1–DL.3, A.1–A.2, D.2_

  - [~] 3.2 Create Zod schemas in `src/lib/schemas/`
    - `receipt.schema.ts` — `ReceiptSchema` with supplierId, warehouseId, sku (alphanumeric 1–50), productName, quantity (positive int), unitCost (nonneg), optional referenceNote
    - `delivery.schema.ts` — `DeliverySchema` with customerId, warehouseId, sku, quantity, optional deliveryRef
    - `transfer.schema.ts` — `TransferSchema` with sourceLocationId, destLocationId, sku, quantity, optional note; `.superRefine` rejecting same source/dest
    - `adjustment.schema.ts` — `AdjustmentSchema` with locationId, sku, currentQty (nonneg int), newQty (nonneg int), reason
    - Export `z.infer<>` types from each schema file
    - _Requirements: R.3, R.4, T.1, Z.1–Z.3_

  - [ ]* 3.3 Write property tests for Zod schemas (Properties 1, 2, 3)
    - **Property 1: Zod SKU Schema — Valid/Invalid Partition** — `fc.string()` rejects; `fc.stringOf(alphanumeric, {minLength:1, maxLength:50})` accepts — `{ numRuns: 200 }`
    - **Property 2: Zod Quantity Schema — Positive Integer Partition** — only `integer > 0` passes; zero, negatives, floats, non-finite values fail
    - **Property 3: Transfer superRefine — Same-Location Rejection** — for any non-empty string `L`, `TransferSchema.safeParse({sourceLocationId:L, destLocationId:L, ...})` always returns `success: false`
    - File: `src/__tests__/schemas.test.ts`
    - **Validates: Requirements R.3, R.4, T.1, Z.1–Z.3**

  - [ ]* 3.4 Write property tests for utility functions (Properties 5, 6)
    - **Property 5: Delivery State Machine Transitions** — exhaustive: `nextDeliveryStep("pick") === "pack"`, `nextDeliveryStep("pack") === "validate"`, `nextDeliveryStep("validate") === "done"`
    - **Property 6: Adjustment Variance Computation** — `fc.tuple(fc.nat(), fc.nat())` generator; assert `computeVariance(n, c) === n - c` for all pairs
    - File: `src/__tests__/delivery-state-machine.test.ts` and `src/__tests__/adjustment.test.ts`
    - **Validates: Requirements DL.1–DL.3, A.1–A.2**

- [~] 4. Checkpoint — Ensure all schema and utility tests pass
  - Run `npm test` and confirm zero failures before proceeding to UI components. Ask the user if questions arise.

- [ ] 5. Layout and navigation
  - [~] 5.1 Implement `src/components/layout/Sidebar.tsx`
    - Render persistent left nav rail with all nine nav items and their routes
    - Highlight active item with `bg-blue-600 text-white rounded-md`; inactive items `text-slate-300 hover:bg-slate-800`
    - Below 768 px: hide rail, show hamburger button that opens a slide-over drawer using shadcn/ui `Sheet`
    - Accept `currentPath: string` prop
    - _Requirements: layout, navigation_

  - [~] 5.2 Wire Sidebar into `src/app/layout.tsx`
    - Root layout wraps children in a flex container: `<Sidebar>` + `<main>` slot
    - Pass `currentPath` from `usePathname()` to `Sidebar`
    - Apply global Tailwind base styles and dark slate background
    - _Requirements: layout_

- [ ] 6. Dashboard components
  - [~] 6.1 Implement `src/components/dashboard/KpiCard.tsx`
    - Render shadcn/ui `Card` with label, value, optional unit, optional trend badge
    - Trend badge: green arrow for `"up"`, red for `"down"`, slate for `"neutral"`
    - _Requirements: D.1_

  - [~] 6.2 Implement `src/components/dashboard/FilterBar.tsx`
    - Three shadcn/ui `Select` dropdowns: Warehouse, Category, Date Range
    - Accept `warehouses`, `categories`, `dateRanges` arrays and `onChange` callback
    - Emit `ActiveFilters` on every selection change
    - _Requirements: D.2_

  - [~] 6.3 Implement `src/components/dashboard/StockChart.tsx`
    - Wrap Recharts `ResponsiveContainer` + `ComposedChart`
    - Support `"line"` and `"bar"` series types driven by `ChartSeries[]` prop
    - Render "No data yet" empty-state card when data array is empty
    - _Requirements: D.3_

  - [~] 6.4 Implement the Dashboard page at `src/app/page.tsx`
    - Hold `LedgerEntry[]` state with `useState`
    - Hold `ActiveFilters` state; pass `onChange` to `FilterBar`
    - Apply `applyFilters` and `buildChartData` to derive display data
    - Render four `KpiCard` tiles from `src/data/kpis.ts`, `FilterBar`, and `StockChart`
    - _Requirements: D.1, D.2, D.3_

  - [ ]* 6.5 Write property test for dashboard filter (Property 7)
    - **Property 7: Dashboard Filter Subset Invariant** — `fc.array(fc.record({warehouseId: fc.string(), categoryId: fc.string()}))` + random `ActiveFilters`; assert every returned item satisfies active predicates and result is a subset of input
    - File: `src/__tests__/dashboard-filter.test.ts`
    - **Validates: Requirements D.2**

- [ ] 7. Transaction forms
  - [~] 7.1 Implement `src/components/forms/ReceiptForm.tsx`
    - Use `useForm` with `zodResolver(ReceiptSchema)`
    - Dropdowns for supplier (from `src/data/suppliers.ts`) and warehouse (from `src/data/warehouses.ts`)
    - On valid submit: call `onSubmit(entry: LedgerEntry)` prop with `type: "receipt"` entry, then `reset()`
    - Inline field errors with `border-red-500` and `text-sm text-red-500 mt-1`
    - _Requirements: R.1, R.2, R.3, R.4_

  - [~] 7.2 Implement `src/components/forms/DeliveryForm.tsx` with 3-step state machine
    - Local `useState<"pick" | "pack" | "validate">` initialized to `"pick"`
    - Step 1 (Pick): customer, warehouse, product, qty fields — "Confirm Pick" advances via `nextDeliveryStep`
    - Step 2 (Pack): read-only review of line items — "Confirm Pack" advances state
    - Step 3 (Validate): final confirmation screen — "Complete Delivery" appends `LedgerEntry` of `type: "delivery"` via `onSubmit` prop and resets to `"pick"`
    - Only step 3 completion mutates the ledger
    - _Requirements: DL.1, DL.2, DL.3, DL.4_

  - [~] 7.3 Implement `src/components/forms/TransferForm.tsx`
    - Use `useForm` with `zodResolver(TransferSchema)`
    - Two location dropdowns from `src/data/locations.ts`
    - `superRefine` same-location error surfaces on `destLocationId` field
    - On valid submit: call `onSubmit` with `type: "transfer"` entry, then `reset()`
    - _Requirements: T.1, T.2, T.3_

  - [~] 7.4 Implement `src/components/forms/AdjustmentForm.tsx`
    - Use `useForm` with `zodResolver(AdjustmentSchema)`
    - On valid submit: compute `variance = computeVariance(newQty, currentQty)`, call `onSubmit` with `type: "adjustment"` entry including `variance`, then `reset()`
    - _Requirements: A.1, A.2, A.3_

  - [ ]* 7.5 Write property test for ledger round-trip (Property 4)
    - **Property 4: Ledger Round-Trip — Valid Submission Appends Correct Entry** — generate valid payloads for all four form types using `fc.record`; assert ledger grows by exactly 1 and new entry has matching `type`, `sku`, and `quantity`
    - File: `src/__tests__/ledger.test.ts`
    - **Validates: Requirements R.1, DL.4, T.3, A.3**

- [ ] 8. App Router pages
  - [~] 8.1 Create transaction pages wiring forms to ledger state
    - `src/app/receipts/page.tsx` — holds `LedgerEntry[]` state, renders `<ReceiptForm onSubmit={...} />`
    - `src/app/deliveries/page.tsx` — holds state, renders `<DeliveryForm onSubmit={...} />`
    - `src/app/transfers/page.tsx` — holds state, renders `<TransferForm onSubmit={...} />`
    - `src/app/adjustments/page.tsx` — holds state, renders `<AdjustmentForm onSubmit={...} />`
    - _Requirements: R.1, DL.4, T.3, A.3_

  - [~] 8.2 Create stub pages with `<ComingSoon />` placeholder
    - Implement `src/components/ComingSoon.tsx` — simple card with "Coming Soon" heading and subtext
    - Create `src/app/history/page.tsx`, `src/app/products/page.tsx`, `src/app/settings/page.tsx`, `src/app/profile/page.tsx` — each renders `<ComingSoon />`
    - _Requirements: navigation completeness_

- [~] 9. Final checkpoint — Ensure all tests pass
  - Run `npm test` (maps to `vitest run`). Confirm all property tests and unit tests pass with zero failures. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build
- The design uses TypeScript throughout — all code examples and implementations follow TypeScript strict mode
- Each task references design sections and requirement IDs for traceability
- Property tests must include the design property comment tag, e.g. `// Feature: stocksense-frontend, Property 1: ...`
- The `onSubmit` prop pattern on form components keeps ledger state in the page, not the form — this makes forms reusable and pure
- `crypto.randomUUID()` fallback in `generateId()` must be applied at every `LedgerEntry` creation site

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2", "6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 9, "tasks": ["6.5", "7.5", "8.1", "8.2"] }
  ]
}
```
