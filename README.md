# UK Finance Tracker

A React app for tracking personal finances using UK bank data, payslips, and HMRC tax scheme recommendations.

## Features

- **Bank Transaction Import** — Upload midata or bank CSV exports (auto-detects Barclays, HSBC, Lloyds, NatWest, Nationwide, and generic CSV formats)
- **Smart Categorisation** — Transactions are auto-categorised (Groceries, Transport, Dining Out, etc.) using the Type and Description fields
- **Direction Tagging** — Each transaction is tagged as "Ingoing" or "Outgoing" based on the raw CSV amount sign
- **Payslip Management** — Manual entry or CSV upload, with employer-matched Net Pay selection from bank credits
- **Monthly Analysis** — Income vs expenditure charts, net position trends, and spending breakdowns by category
- **HMRC Tax Schemes** — Interactive checklist of 12 UK tax schemes with eligibility criteria, filterable by married/children status
- **Supabase Backend** — Auth (email + Google OAuth), PostgreSQL database, and file storage for CSVs

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Recharts (charts)
- Lucide React (icons)
- Supabase (Auth, Database, Storage)

## Getting Started

```bash
npm install
npm run dev
```

## Supabase

- **Project:** UK Finance Tracker (eu-west-2)
- **Tables:** profiles, transactions, payslips, csv_uploads
- **Storage:** csv-uploads bucket
- **Auth:** Email/password + Google OAuth

## Supported Bank Formats

| Format | Detection |
|--------|-----------|
| Midata (Standard) | Date, Type, Merchant/Description columns |
| Barclays | Number, Date, Account, Amount, Subcategory |
| HSBC | Date, Description, Paid In/Paid Out |
| Lloyds | Transaction Date, Transaction Description, Debit/Credit Amount |
| NatWest / RBS | Date, Description, Value, Account Name |
| Nationwide | Date, Transactions, Paid In/Paid Out |
| Generic CSV | Auto-detects date/description/amount columns |
