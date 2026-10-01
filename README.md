# StockSense — Inventory Management System

A full-stack inventory management system built for the Odoo GCET Hackathon. Replaces manual registers and spreadsheets with a centralized, real-time stock tracking system.

---

## How it works

Stock levels are never stored as a number. Every movement — receipt, delivery, transfer, adjustment — is written as a permanent entry in an append-only ledger. The current stock at any location is always calculated by summing those entries. Nothing can drift out of sync because there's no mutable value to corrupt.

The ledger is tamper-proof at the database level. PostgreSQL triggers physically block any UPDATE or DELETE on ledger rows. Corrections happen through reversing entries, not mutations — so the full history of every change is always visible.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, PostgreSQL |
| Frontend | Next.js, Tailwind CSS, shadcn/ui |

---

## Running locally

**Backend**
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
# API on http://localhost:3000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# App on http://localhost:3001
```

**Demo login**
```
manager@stocksense.com / demo1234
staff@stocksense.com   / demo1234
```

---

## Features

- **Receipts** — incoming stock from suppliers
- **Deliveries** — outgoing stock to customers, with availability check before commit
- **Internal Transfers** — atomic two-leg moves between warehouses
- **Stock Adjustments** — cycle count corrections with auto-computed delta
- **Dashboard** — live KPIs, low-stock alerts, recent activity
- **Move History** — full audit trail with filters by type, status, location, date
- **Products & Warehouses** — full CRUD with stock breakdown per location

---

## Project structure

```
├── backend/      Node.js + Express API
│   ├── migrations/   PostgreSQL schema
│   └── src/
│       ├── ledger/   Core ledger engine (append-only writes, stock calc)
│       ├── routes/   REST endpoints
│       └── events/   Low-stock event emitter
└── frontend/     Next.js app
    └── src/
        ├── app/      Pages
        ├── components/
        └── lib/      API client, schemas
```
