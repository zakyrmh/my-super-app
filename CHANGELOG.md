# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **Finance:** Integration with Gemini AI for receipt parsing (OCR).
- **Health:** Food image recognition module.
- **Vehicle:** Predictive maintenance logic based on mileage.

## [0.10.0] - 2026-02-09

### Added

- **Finance (Edit Transactions):** Implemented comprehensive transaction edit functionality with full ACID compliance:
  - **Edit Regular Transactions:** Users can now edit INCOME, EXPENSE, and TRANSFER transactions directly from the transaction history page.
  - **Edit Debt Transactions:** Added ability to edit debt/lending details (amount, due date, contact, description).
  - **Atomic Updates:** All edits use database transactions with proper rollback/replay strategy:
    - Step 1: Rollback old transaction effects (reverse account balance changes).
    - Step 2: Apply new transaction with updated values.
    - Step 3: Update related records (funding sources, items, debt balances).
  - **Balance Validation:** Prevents edits that would result in negative balances or insufficient funds.
  - **Race Condition Protection:** Uses optimistic locking to detect and prevent concurrent modification conflicts.
  - **Fund Reallocation:** Automatically reallocates funding sources when editing expenses or transfers.
  - **Debt Balance Sync:** Editing debt amounts automatically adjusts remaining balance proportionally.
  - **UI Components:**
    - `EditTransactionDialog`: Sheet-based form for editing regular transactions.
    - `EditDebtDialog`: Sheet-based form for editing debt/lending records.
    - Edit button added to each transaction row in the all transactions page.

### Technical Details

- **Files Added:**
  - `app/(private)/finance/edit-actions.ts` - Server actions for all edit operations
  - `components/finance/edit-transaction-dialog.tsx` - Edit transaction UI component
  - `components/finance/edit-debt-dialog.tsx` - Edit debt UI component
- **Files Modified:**
  - `app/(private)/finance/transactions/page.tsx` - Added edit button to transaction rows
  - `components/finance/index.ts` - Exported new components
- **ACID Guarantees:**
  - **Atomicity:** All changes succeed or fail together within a single transaction
  - **Consistency:** Balance constraints and business rules are enforced
  - **Isolation:** Optimistic locking prevents concurrent conflicts
  - **Durability:** All changes are persisted to PostgreSQL before confirmation
- **Validation:**
  - Type-specific validation (account requirements for each transaction type)
  - Amount validation (must be positive)
  - Balance sufficiency checks for expenses and transfers
  - Account relationship validation (transfer recipients cannot be the same)
- **Error Handling:** User-friendly error messages for validation failures and race conditions

### Security

- **Double-Entry Accounting:** Edit operations maintain strict double-entry bookkeeping by reversing old entries before applying new ones.
- **Audit Trail:** Original transaction IDs are preserved, allowing for complete audit history.
- **Access Control:** All edit actions verify user ownership before allowing modifications.

## [0.9.0] - 2026-02-08

### Security

- **Finance (ACID Compliance):** Implemented comprehensive ACID properties for all financial transactions to prevent data corruption and race conditions:
  - **Optimistic Locking:** Added conditional updates with balance validation to prevent negative balances and detect concurrent transaction conflicts.
  - **Transfer Transactions:** Enhanced with pre-transaction balance validation and race condition detection using `updateMany` with `WHERE balance >= amount` clause.
  - **Expense Transactions:** Added optimistic locking to prevent insufficient balance scenarios during concurrent operations.
  - **Debt Management:**
    - **LENDING (Create):** Protected account balance updates with optimistic locking when lending money.
    - **BORROWING Payment:** Added race condition protection when repaying borrowed money.
  - **Error Handling:** User-friendly error messages for race conditions ("Saldo berubah oleh transaksi lain. Silakan coba lagi.").

### Technical Details

- **Files Modified:**
  - `app/(private)/finance/actions.ts` - TRANSFER and EXPENSE transactions
  - `app/(private)/finance/debt-actions.ts` - LENDING create and BORROWING payment
- **Pattern Used:** Optimistic locking via `updateMany()` with conditional WHERE clause instead of direct `update()`
- **Database:** Leverages PostgreSQL READ COMMITTED isolation level + application-level optimistic locking
- **Impact:** Zero breaking changes - all updates are backward compatible

### What This Protects Against

1. **Race Conditions:** Multiple simultaneous transactions can no longer cause balance inconsistencies
2. **Negative Balances:** Impossible to overdraft accounts even under high concurrent load
3. **Lost Updates:** Optimistic locking ensures all balance changes are properly sequenced
4. **Data Corruption:** Full ACID compliance guarantees database integrity

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

## [0.8.0] - 2026-02-07

### Added

- **Health Module (Enhanced):**
  - **Detailed Nutrition:** Expanded `FoodLog` with comprehensive macro (Saturated, Trans, Poly/Mono Fats) and micro nutrients (Vitamins A/C/D, Calcium, Iron, Potassium).
  - **Medical History:** Added `MedicalHistory` model to track diseases, severity (`MedicalSeverity`), status (`MedicalStatus`), and treatments.
  - **Exercise Tracking:** Added `ExerciseLog` model for logging workouts with types (`ExerciseType`), intensity (`ExerciseIntensity`), and stats (duration, calories, distance, heart rate).

### Changed

- **Finance (Robustness):** Refactored `createAccount` to use atomic database transactions.
  - Initial balance now automatically creates a corresponding "Initial Balance" transaction record (INCOME/EXPENSE) to ensure strict double-entry accounting.
  - Added support for `creditLimit`, `statementDate`, and `dueDate` during account creation.
- **Finance (Flow Tracking):** Upgraded `createTransaction` (especially INCOME) to use the new `FundingSource` model.
  - Income transactions now require linking to a specific named Funding Source (e.g., "Salary", "Bonus") instead of a loose string tag.
  - Expenses and Transfers now accurately track funding depletion using `TransactionFunding` relations.
- **Finance (Fix):** Resolved build error in Debt module by removing deprecated `flowTag` usage and implementing full `FundingSource` integration for Lending/Borrowing.
- **Finance (UX):** Added semi-automatic "Funding Source" input in transaction form for Income, giving users control over tag naming while providing smart defaults.
- **Finance (Fix):** Improved account selection stability in transaction form.
- **Finance (Breaking):** Expense transactions now **require itemization** - all expenses must have at least one item with name, price, and category.
- **Finance (UX):** Transaction-level category removed for expenses - category now only exists at item level for better granularity.
- **Finance (Feature):** Added loan date field to debt/loan tracking - now uses Transaction.date instead of hardcoded current date.
- **Finance (UX):** Semi-automatic funding source naming for BORROWING - auto-generates "Pinjaman: ContactName" but allows user override for better organization.
- **Finance (Feature):** Added payment date field to debt payment form - enables accurate historical tracking of when payments were made.

## [0.7.0] - 2026-02-07

### Added

- **Finance Module:**
  - **Budgeting:** Added `Budget` model for monthly tracking per category and funding source.
  - **Recurring Transactions:** Added `RecurringTransaction` model for automated bills/subscriptions with `RecurringInterval`.
  - **Financial Goals:** Added `FinancialGoal` model for saving targets.
  - **Wealth Tracking:** Added `NetWorthSnapshot` to track assets vs liabilities over time.
  - **Funding Sources:** Added `FundingSource` model to distinct income streams (Income, Saving, Other).
  - **Credit/Paylater Support:** Added `creditLimit`, `statementDate`, and `dueDate` to `Account` model.
  - **Reconciliation:** Added `reconciliationStatus` to `Transaction` for bank matching.

- **Health Module:**
  - **Food Logging:** Added `FoodLog` model with support for:
    - Macro nutrients (Calories, Protein, Carbs, Fat).
    - Micro nutrients (Fiber, Sugar, Sodium, etc.).
    - AI Analysis field.
    - Flexible JSON storage for detailed micronutrients.

- **Vehicle Module:**
  - **Vehicle Management:** Added `Vehicle` model with odometer tracking.
  - **Service Logs:** Added `ServiceLog` for maintenance history.
  - **Fuel Logs:** Added `FuelLog` for fuel consumption tracking.

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
