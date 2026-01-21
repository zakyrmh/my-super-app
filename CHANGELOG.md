# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **Finance:** Integration with Gemini AI for receipt parsing (OCR).
- **Health:** Food image recognition module.
- **Vehicle:** Predictive maintenance logic based on mileage.

## [0.1.0] - 2026-01-10

### Added

- **Project Initialization:** Setup Next.js App Router with TypeScript.
- **UI Framework:** Integrated Tailwind CSS and Shadcn UI.
- **Database:**
  - Configured Prisma with PostgreSQL.
  - Defined initial schema for `User`, `Account`, `Transaction`, and `TransactionItem`.
- **Authentication:** Setup Supabase Auth client & helper.
- **State Management:** Installed Zustand for global store.
- **Docs:** Added README.md and CHANGELOG.md.

### Security

- Configured Environment variables for Supabase and Database connections.

## [0.2.0] - 2026-01-11

### Added

- **Dashboard:** Implemented dashboard layout with sidebar and bottom navigation.
- **Header:** Added header component with user profile and navigation links.
- **Sidebar:** Created sidebar component with collapsible functionality.
- **Bottom Navigation:** Implemented bottom navigation for mobile devices.

## [0.3.0] - 2026-01-12

### Added

- **Transaction:** Implemented transaction form with itemized expense support.

### Changed

- **Schema:** added 'TransactionFunding' model.

## [0.4.0] - 2026-01-18

### Added

- **AI Category Suggestion:** Implemented AI category suggestion for transactions.
- **Debt:** Implemented debt management features.

## [0.5.0] - 2026-01-19

### Added

- **AI Item Category Suggestion:** Implemented AI category suggestion for transaction items.

### Changed

- **Category:** Only show categories from database.

### Fixed

- **Monthly Income:** Fixed monthly income calculation.

## [0.6.0] - 2026-01-21

### Added

- **Transaction History Page:** Implemented `/finance/transactions` page with:
  - Monthly summary cards (total transactions, income, expense, net balance).
  - Filter by transaction type, month, and search query.
  - Paginated transaction table with type badges and amount styling.
  - Support for all transaction types including LENDING and REPAYMENT.
- **Account Detail:** Implemented account detail sheet with transaction history and fund sources.
- **Transaction Fundings Display:** Show funding source tags (sourceTag) on expense/lending transactions in account detail.
- **Debug API:** Added `/api/debug-tags` endpoint for diagnosing tag balance issues.

### Changed

- **Smart Allocation Refactor:** Refactored `calculateTagBalances()` in `lib/finance/smart-allocation.ts`:
  - Now uses single query for TransactionFunding with `include { transaction }`.
  - Manual calculation with switch-case based on transaction type.
  - Correctly handles INCOME, REPAYMENT, EXPENSE, LENDING, and TRANSFER transactions.
- **FlowTag Format Consistency:** Updated REPAYMENT flowTag format from `"Pengembalian: {name}"` to `"Pengembalian dari {name}"` for consistency with existing data.
- **Transaction Types:** Extended `AccountTransaction` interface to include `LENDING` and `REPAYMENT` types.

### Fixed

- **Tag Balance Bug:** Fixed critical bug where REPAYMENT transactions weren't included as credit sources in tag balance calculations.
- **Lending Debit Bug:** Fixed bug where LENDING transaction fundings weren't deducted from tag balances.
- **Transaction Display:** Fixed transaction item display in account detail to show correct icons and colors for LENDING (orange) and REPAYMENT (green) types.
- **Tag Transfer:** Fixed tag transfer functionality.
- **Debt Allocation:** Fixed debt allocation functionality to properly track fund sources.

### Database Migration Required

After updating, run the following SQL to fix existing REPAYMENT transactions:

```sql
UPDATE "Transaction"
SET "flowTag" = REPLACE("flowTag", 'Pengembalian: ', 'Pengembalian dari ')
WHERE type = 'REPAYMENT'
  AND "flowTag" LIKE 'Pengembalian: %';
```
