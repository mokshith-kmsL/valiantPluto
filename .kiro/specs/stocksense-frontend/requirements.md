# Requirements Document

## Introduction

StockSense is an enterprise Inventory Management System frontend built with Next.js (App Router) or React + Vite, Tailwind CSS, shadcn/ui components, React Hook Form + Zod for validation, and Recharts for data visualization. The application provides a read layer (Dashboard with KPI cards and stock movement charts) and a write layer (four operation forms: Receipts, Delivery Orders, Internal Transfers, and Stock Adjustments). All forms implement ledger-style operations — recording stock movements rather than directly overwriting stock values. The UI is responsive, professional, and uses an enterprise blue/slate color scheme with a persistent left sidebar navigation.

## Glossary

- **Application**: The StockSense frontend web application
- **Sidebar**: The persistent left navigation panel containing links to all main sections
- **Dashboard**: The landing page displaying KPI cards, charts, and filters
- **KPI_Card**: A top-level summary metric tile displayed on the Dashboard
- **Chart**: The Recharts-based visualization of recent stock movement trends
- **Filter_Bar**: The row of dropdown controls at the top of the Dashboard for narrowing displayed data
- **Receipt_Form**: The form for recording incoming inventory from a supplier
- **Delivery_Form**: The form for recording outgoing inventory to a customer
- **Transfer_Form**: The form for recording inventory movement between internal locations
- **Adjustment_Form**: The form for reconciling physical counted quantities with system quantities
- **Validator**: The React Hook Form + Zod validation layer applied to all write-layer forms
- **Mock_Data**: Static JSON files structured to be replaceable by real `fetch()` API calls
- **SKU**: Stock Keeping Unit — an alphanumeric identifier for a product
- **Quantity**: A positive integer representing a count of product units
- **Location**: A named warehouse zone (e.g., WH/Stock, WH/Input, WH/Output)
- **Supplier**: An external entity that sends inventory to the warehouse
- **Customer**: An external entity that receives inventory from the warehouse

---

## Requirements

### Requirement 1: Global Application Layout

**User Story:** As an inventory operator, I want a persistent sidebar and consistent page layout, so that I can navigate between all sections of the application without losing context.

#### Acceptance Criteria

1. THE Application SHALL render a persistent left Sidebar on every page that remains visible across all route navigations.
2. THE Sidebar SHALL contain navigation links to the following eight sections in order: Dashboard, Products, Receipts, Deliveries, Internal Transfers, Adjustments, Move History, Settings, and Profile.
3. WHEN a user clicks a Sidebar navigation link, THE Application SHALL navigate to the corresponding page without a full browser reload.
4. WHILE a user is on a given page, THE Sidebar SHALL visually highlight the active navigation link to indicate the current section.
5. WHEN the viewport width is less than 768px, THE Sidebar SHALL collapse into a hamburger-toggle menu to preserve screen space on mobile devices.
6. THE Application SHALL apply a consistent enterprise blue and slate color scheme across all pages, components, and typography.
7. THE Application SHALL render all pages correctly on viewport widths from 320px to 1920px.

---

### Requirement 2: Dashboard KPI Cards

**User Story:** As an inventory manager, I want to see high-level stock metrics at a glance on the Dashboard, so that I can quickly assess the current state of inventory.

#### Acceptance Criteria

1. THE Dashboard SHALL display four KPI_Cards at the top of the page with the following labels: "Total Products in Stock", "Low/Out of Stock Items", "Pending Receipts", and "Pending Deliveries".
2. WHEN the Dashboard page loads, THE Dashboard SHALL populate each KPI_Card with a value sourced from Mock_Data.
3. THE Mock_Data structure for KPI_Cards SHALL be organized as a JSON object with named keys so that each key can be replaced by a `fetch()` API call without restructuring the component.
4. WHEN Mock_Data is unavailable or returns an empty value for a KPI_Card, THE Dashboard SHALL display a placeholder value of "—" inside the affected KPI_Card.

---

### Requirement 3: Dashboard Stock Movement Chart

**User Story:** As an inventory manager, I want to see a visual trend of recent stock movements on the Dashboard, so that I can identify patterns in incoming and outgoing inventory over time.

#### Acceptance Criteria

1. THE Dashboard SHALL render one Chart below the KPI_Cards using the Recharts library.
2. THE Chart SHALL display at least two data series: incoming stock quantities and outgoing stock quantities, plotted over a time axis (minimum seven data points representing the last seven days).
3. THE Chart SHALL include a legend identifying each data series by name and color.
4. THE Chart SHALL include labeled axes: a horizontal axis for dates and a vertical axis for quantity values.
5. WHEN the Dashboard page loads, THE Chart SHALL render using data sourced from Mock_Data structured as a JSON array of objects, each containing a date string and quantity values for each series.
6. THE Chart SHALL be responsive and resize proportionally when the browser viewport width changes.

---

### Requirement 4: Dashboard Filter Bar

**User Story:** As an inventory operator, I want to filter Dashboard data by document type, status, and warehouse, so that I can focus on the subset of movements relevant to my current task.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Filter_Bar containing three dropdown controls labeled "Document Type", "Status", and "Warehouse".
2. THE "Document Type" dropdown SHALL offer the following options: All, Receipt, Delivery, Internal Transfer, Adjustment.
3. THE "Status" dropdown SHALL offer the following options: All, Draft, Waiting, Ready, Done, Canceled.
4. THE "Warehouse" dropdown SHALL offer options sourced from Mock_Data representing available warehouse names.
5. WHEN a user selects a value in any Filter_Bar dropdown, THE Dashboard SHALL update the Chart and KPI_Cards to reflect only data matching the selected filter combination.
6. WHEN all Filter_Bar dropdowns are set to "All", THE Dashboard SHALL display unfiltered data across all document types, statuses, and warehouses.

---

### Requirement 5: Receipt Form (Incoming Inventory)

**User Story:** As a warehouse receiver, I want to record incoming inventory from a supplier, so that the system logs the stock increase as a ledger entry.

#### Acceptance Criteria

1. THE Receipt_Form SHALL present the following fields: Supplier (required, select from list), Product (required, select from list), SKU (required, alphanumeric text), Quantity Received (required, positive integer), and Reference Number (optional, text).
2. WHEN a user submits the Receipt_Form, THE Validator SHALL validate all required fields before accepting the submission.
3. IF the Supplier field is empty on submission, THEN THE Validator SHALL display the error message "Supplier is required" below the Supplier field.
4. IF the Product field is empty on submission, THEN THE Validator SHALL display the error message "Product is required" below the Product field.
5. IF the SKU field contains characters other than letters and numbers on submission, THEN THE Validator SHALL display the error message "SKU must be alphanumeric" below the SKU field.
6. IF the Quantity Received field contains a value that is not a positive integer on submission, THEN THE Validator SHALL display the error message "Quantity must be a positive number" below the Quantity Received field.
7. WHEN the Receipt_Form passes all validation checks, THE Receipt_Form SHALL record the receipt as a new ledger entry that adds the specified Quantity to the Product's stock total.
8. WHEN a receipt ledger entry is successfully recorded, THE Receipt_Form SHALL reset all fields to their default empty state and display a success notification to the user.
9. THE Receipt_Form SHALL source its Supplier and Product select options from Mock_Data structured as JSON arrays replaceable by `fetch()` API calls.

---

### Requirement 6: Delivery Orders Form (Outgoing Inventory)

**User Story:** As a warehouse dispatcher, I want to record outgoing inventory to a customer through a pick-pack-validate flow, so that the system logs the stock decrease as a ledger entry.

#### Acceptance Criteria

1. THE Delivery_Form SHALL present the following fields: Customer (required, select from list), Product (required, select from list), SKU (required, alphanumeric text), Quantity to Deliver (required, positive integer), and Delivery Reference (optional, text).
2. THE Delivery_Form SHALL present three sequential action controls labeled "Pick Items", "Pack Items", and "Validate", where "Pack Items" is enabled only after "Pick Items" is activated, and "Validate" is enabled only after "Pack Items" is activated.
3. WHEN a user activates the "Validate" control, THE Validator SHALL validate all required fields before accepting the submission.
4. IF the Customer field is empty on validation, THEN THE Validator SHALL display the error message "Customer is required" below the Customer field.
5. IF the SKU field contains characters other than letters and numbers on validation, THEN THE Validator SHALL display the error message "SKU must be alphanumeric" below the SKU field.
6. IF the Quantity to Deliver field contains a value that is not a positive integer on validation, THEN THE Validator SHALL display the error message "Quantity must be a positive number" below the Quantity to Deliver field.
7. WHEN the Delivery_Form passes all validation checks on "Validate", THE Delivery_Form SHALL record the delivery as a new ledger entry that subtracts the specified Quantity from the Product's stock total.
8. WHEN a delivery ledger entry is successfully recorded, THE Delivery_Form SHALL reset all fields and display a success notification to the user.
9. THE Delivery_Form SHALL source its Customer and Product select options from Mock_Data structured as JSON arrays replaceable by `fetch()` API calls.

---

### Requirement 7: Internal Transfer Form

**User Story:** As a warehouse operator, I want to record a product movement between two internal locations, so that the system logs the transfer as a ledger entry without changing the total stock count.

#### Acceptance Criteria

1. THE Transfer_Form SHALL present the following fields: Source Location (required, select from list), Destination Location (required, select from list), Product (required, select from list), SKU (required, alphanumeric text), and Quantity (required, positive integer).
2. WHEN a user submits the Transfer_Form, THE Validator SHALL validate all required fields before accepting the submission.
3. IF the Source Location field is empty on submission, THEN THE Validator SHALL display the error message "Source Location is required" below the Source Location field.
4. IF the Destination Location field is empty on submission, THEN THE Validator SHALL display the error message "Destination Location is required" below the Destination Location field.
5. IF the Source Location and Destination Location fields contain the same value on submission, THEN THE Validator SHALL display the error message "Source and Destination locations must be different" below the Destination Location field.
6. IF the SKU field contains characters other than letters and numbers on submission, THEN THE Validator SHALL display the error message "SKU must be alphanumeric" below the SKU field.
7. IF the Quantity field contains a value that is not a positive integer on submission, THEN THE Validator SHALL display the error message "Quantity must be a positive number" below the Quantity field.
8. WHEN the Transfer_Form passes all validation checks, THE Transfer_Form SHALL record the transfer as a new ledger entry that decreases the Source Location's stock and increases the Destination Location's stock by the specified Quantity.
9. WHEN a transfer ledger entry is successfully recorded, THE Transfer_Form SHALL reset all fields and display a success notification to the user.
10. THE Transfer_Form SHALL source its Location and Product select options from Mock_Data structured as JSON arrays replaceable by `fetch()` API calls.

---

### Requirement 8: Stock Adjustment Form

**User Story:** As an inventory auditor, I want to enter a physical counted quantity for a product at a location, so that the system calculates and logs the variance as a ledger adjustment entry.

#### Acceptance Criteria

1. THE Adjustment_Form SHALL present the following fields: Product (required, select from list), Location (required, select from list), SKU (required, alphanumeric text), and Physical Counted Quantity (required, positive integer or zero).
2. WHEN a user selects a Product and Location, THE Adjustment_Form SHALL display the current system-recorded quantity for that product at that location, sourced from Mock_Data.
3. WHEN a user submits the Adjustment_Form, THE Validator SHALL validate all required fields before accepting the submission.
4. IF the Product field is empty on submission, THEN THE Validator SHALL display the error message "Product is required" below the Product field.
5. IF the Location field is empty on submission, THEN THE Validator SHALL display the error message "Location is required" below the Location field.
6. IF the SKU field contains characters other than letters and numbers on submission, THEN THE Validator SHALL display the error message "SKU must be alphanumeric" below the SKU field.
7. IF the Physical Counted Quantity field contains a value that is not a non-negative integer on submission, THEN THE Validator SHALL display the error message "Quantity must be zero or a positive number" below the Physical Counted Quantity field.
8. WHEN the Adjustment_Form passes all validation checks, THE Adjustment_Form SHALL calculate the variance as (Physical Counted Quantity minus System Quantity) and record it as a new ledger adjustment entry.
9. WHEN an adjustment ledger entry is successfully recorded, THE Adjustment_Form SHALL display the calculated variance to the user (e.g., "+5 units" or "-3 units") alongside the success notification, then reset all fields.
10. THE Adjustment_Form SHALL source its Product and Location select options from Mock_Data structured as JSON arrays replaceable by `fetch()` API calls.

---

### Requirement 9: Validation Error Display

**User Story:** As a form user, I want to see clear red error messages directly below each invalid field, so that I can correct my input without confusion about what went wrong.

#### Acceptance Criteria

1. THE Validator SHALL display all field-level error messages in red text positioned directly below the corresponding input field.
2. WHEN a field error is displayed, THE Validator SHALL apply a red border or red highlight to the corresponding input field to visually distinguish it from valid fields.
3. WHEN a user corrects an invalid field value, THE Validator SHALL remove the error message and red highlight for that field in real time without requiring form resubmission.
4. THE Validator SHALL display all triggered error messages simultaneously so that the user can see and correct all errors in a single review pass.

---

### Requirement 10: Modular Component Architecture

**User Story:** As a frontend developer, I want the application built from named, single-responsibility components, so that each piece can be maintained, tested, and replaced independently.

#### Acceptance Criteria

1. THE Application SHALL implement the Sidebar as a standalone component named `Sidebar` in its own file `Sidebar.tsx`.
2. THE Application SHALL implement the Dashboard page as a standalone component named `Dashboard` in its own file `Dashboard.tsx`.
3. THE Application SHALL implement each operation form as a standalone component in its own file: `ReceiptForm.tsx`, `DeliveryForm.tsx`, `TransferForm.tsx`, and `AdjustmentForm.tsx`.
4. THE Application SHALL co-locate all Mock_Data JSON files in a dedicated `/data` or `/mocks` directory so that substituting `fetch()` calls requires changes only within that directory.
5. THE Application SHALL define all Zod validation schemas in a dedicated `/schemas` or `/lib/schemas` directory, one schema file per form.
6. THE Application SHALL use shadcn/ui or an equivalent modern component library for all UI primitives (buttons, inputs, selects, cards) to maintain visual consistency.
