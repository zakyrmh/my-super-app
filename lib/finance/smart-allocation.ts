/**
 * Smart Fund Allocation Logic
 *
 * This module provides utilities for calculating available balances per "Tag"
 * and intelligently allocating funds for expense transactions.
 *
 * Business Logic:
 * - Each INCOME transaction can have a `flowTag` (e.g., "Gaji", "Bonus")
 * - When making an EXPENSE, funds are drawn from these tags
 * - Priority: Tags with highest balance are used first (waterfall allocation)
 */

import { prisma } from "@/lib/prisma";

// ========================
// TYPE DEFINITIONS
// ========================

/** Represents available balance for a specific tag */
export interface TagBalance {
  tag: string;
  credit: number; // Total incoming (from INCOME transactions)
  debit: number; // Total outgoing (from TransactionFunding)
  balance: number; // credit - debit
}

/** Represents a funding allocation for an expense */
export interface FundingAllocation {
  sourceTag: string;
  amount: number;
}

/** Result of the smart allocation process */
export interface AllocationResult {
  allocations: FundingAllocation[];
  totalAllocated: number;
  shortfall: number; // Amount that couldn't be allocated (if insufficient funds)
}

// ========================
// CALCULATE TAG BALANCES
// ========================

/**
 * Calculates available balance per Tag for a specific account.
 *
 * Refactored approach:
 * 1. Query INCOME and REPAYMENT transactions (direct credits via flowTag)
 * 2. Query ALL TransactionFunding records with include transaction
 * 3. Calculate net balance per tag based on transaction type:
 *    - INCOME/REPAYMENT (via flowTag): +amount (credit)
 *    - TRANSFER to this account (via TransactionFunding): +amount (credit)
 *    - EXPENSE from this account (via TransactionFunding): -amount (debit)
 *    - TRANSFER from this account (via TransactionFunding): -amount (debit)
 *    - LENDING from this account (via TransactionFunding): -amount (debit)
 *
 * @param accountId - The account ID to calculate balances for
 * @returns Array of TagBalance objects, sorted by balance (highest first)
 */
export async function calculateTagBalances(
  accountId: string,
): Promise<TagBalance[]> {
  // 1. Get all INCOME transactions for this account with flowTag (direct credit)
  const incomeTransactions = await prisma.transaction.findMany({
    where: {
      type: "INCOME",
      toAccountId: accountId,
      flowTag: { not: null },
    },
    select: {
      flowTag: true,
      amount: true,
    },
  });

  // 2. Get all REPAYMENT transactions for this account with flowTag (direct credit)
  // This includes money returned from loans (piutang) - creates new fund source
  const repaymentTransactions = await prisma.transaction.findMany({
    where: {
      type: "REPAYMENT",
      toAccountId: accountId,
      flowTag: { not: null },
    },
    select: {
      flowTag: true,
      amount: true,
    },
  });

  // 3. Query ALL TransactionFunding records related to this account with transaction included
  // This allows us to determine the direction based on transaction type and account relations
  const allFundings = await prisma.transactionFunding.findMany({
    where: {
      OR: [
        // Outgoing: EXPENSE, LENDING, or TRANSFER from this account
        {
          transaction: {
            fromAccountId: accountId,
            type: { in: ["EXPENSE", "LENDING", "TRANSFER"] },
          },
        },
        // Incoming: TRANSFER to this account
        {
          transaction: {
            toAccountId: accountId,
            type: "TRANSFER",
          },
        },
      ],
    },
    include: {
      transaction: {
        select: {
          type: true,
          fromAccountId: true,
          toAccountId: true,
        },
      },
    },
  });

  // 4. Build balance map using reduce - calculate net balance per tag
  // Map structure: tag -> { credit, debit }
  const tagDataMap = new Map<string, { credit: number; debit: number }>();

  // Helper function to get or create tag data
  const getTagData = (tag: string) => {
    if (!tagDataMap.has(tag)) {
      tagDataMap.set(tag, { credit: 0, debit: 0 });
    }
    return tagDataMap.get(tag)!;
  };

  // Add credits from INCOME transactions (flowTag based)
  for (const tx of incomeTransactions) {
    if (tx.flowTag) {
      const tagData = getTagData(tx.flowTag);
      tagData.credit += Number(tx.amount);
    }
  }

  // Add credits from REPAYMENT transactions (flowTag based)
  for (const tx of repaymentTransactions) {
    if (tx.flowTag) {
      const tagData = getTagData(tx.flowTag);
      tagData.credit += Number(tx.amount);
    }
  }

  // Process all TransactionFunding records based on transaction type and direction
  for (const funding of allFundings) {
    const tagData = getTagData(funding.sourceTag);
    const amount = Number(funding.amount);
    const txType = funding.transaction.type;
    const isFromThisAccount = funding.transaction.fromAccountId === accountId;
    const isToThisAccount = funding.transaction.toAccountId === accountId;

    switch (txType) {
      case "INCOME":
      case "REPAYMENT":
        // These should not have TransactionFunding, but if they do, treat as credit
        tagData.credit += amount;
        break;

      case "EXPENSE":
        // Expense always deducts from the source account
        if (isFromThisAccount) {
          tagData.debit += amount;
        }
        break;

      case "LENDING":
        // Lending money to others - deducts from source account
        if (isFromThisAccount) {
          tagData.debit += amount;
        }
        break;

      case "TRANSFER":
        // Transfer: debit from source, credit to destination
        if (isFromThisAccount) {
          // Outgoing transfer - deduct from this account
          tagData.debit += amount;
        } else if (isToThisAccount) {
          // Incoming transfer - add to this account
          tagData.credit += amount;
        }
        break;

      default:
        // Ignore unknown types
        break;
    }
  }

  // 5. Convert map to array and calculate final balance
  const balances: TagBalance[] = [];

  for (const [tag, data] of tagDataMap) {
    const balance = data.credit - data.debit;

    // Only include tags with positive balance (can't spend from negative)
    if (balance > 0) {
      balances.push({
        tag,
        credit: data.credit,
        debit: data.debit,
        balance,
      });
    }
  }

  // 6. Sort by balance descending (highest first for priority spending)
  balances.sort((a, b) => b.balance - a.balance);

  return balances;
}

// ========================
// SMART FUND ALLOCATION
// ========================

/**
 * Allocates funds from available tags using waterfall logic.
 *
 * Algorithm:
 * 1. Get all available tag balances, sorted by highest balance first
 * 2. For each tag (in priority order):
 *    - Use as much as possible from this tag
 *    - If remaining amount > 0, move to next tag
 * 3. If all tags exhausted but amount remains, throw error
 *
 * @param accountId - The account ID to allocate from
 * @param totalAmount - The total amount to allocate
 * @param allowOverdraft - If true, allows allocation even if insufficient funds
 * @returns AllocationResult with breakdown of how funds were allocated
 * @throws Error if insufficient funds and allowOverdraft is false
 */
export async function allocateFundsForExpense(
  accountId: string,
  totalAmount: number,
  allowOverdraft = false,
): Promise<AllocationResult> {
  // 1. Get available tag balances
  const tagBalances = await calculateTagBalances(accountId);

  // 2. Calculate total available
  const totalAvailable = tagBalances.reduce((sum, tb) => sum + tb.balance, 0);

  // 3. Check if sufficient funds
  if (!allowOverdraft && totalAvailable < totalAmount) {
    throw new Error(
      `Saldo tidak mencukupi. Dibutuhkan: Rp ${totalAmount.toLocaleString(
        "id-ID",
      )}, ` + `Tersedia: Rp ${totalAvailable.toLocaleString("id-ID")}`,
    );
  }

  // 4. Perform waterfall allocation
  const allocations: FundingAllocation[] = [];
  let remaining = totalAmount;

  for (const tagBalance of tagBalances) {
    if (remaining <= 0) break;

    // Calculate how much to take from this tag
    const amountFromTag = Math.min(tagBalance.balance, remaining);

    if (amountFromTag > 0) {
      allocations.push({
        sourceTag: tagBalance.tag,
        amount: amountFromTag,
      });
      remaining -= amountFromTag;
    }
  }

  // 5. Calculate shortfall (if any)
  const shortfall = Math.max(0, remaining);
  const totalAllocated = totalAmount - shortfall;

  return {
    allocations,
    totalAllocated,
    shortfall,
  };
}

// ========================
// HELPER: Get Untagged Balance
// ========================

/**
 * Calculates the "untagged" balance for an account.
 * This is income that was received without a flowTag.
 *
 * Useful for allowing expenses even when no tags have balance,
 * falling back to the general account balance.
 *
 * @param accountId - The account ID to check
 * @returns The untagged balance amount
 */
export async function getUntaggedBalance(accountId: string): Promise<number> {
  // Get account's current balance
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { balance: true },
  });

  if (!account) {
    return 0;
  }

  // Get total tagged balance (what's already tracked via tags)
  const tagBalances = await calculateTagBalances(accountId);
  const totalTaggedBalance = tagBalances.reduce(
    (sum, tb) => sum + tb.balance,
    0,
  );

  // Untagged = Account balance - Tagged balance
  const untagged = Number(account.balance) - totalTaggedBalance;
  return Math.max(0, untagged);
}

// ========================
// HELPER: Create Funding Records
// ========================

/**
 * Creates TransactionFunding records from allocation results.
 * This is a helper to convert allocation results to Prisma create data.
 *
 * @param allocations - Array of funding allocations
 * @returns Array of create data for TransactionFunding
 */
export function createFundingRecords(
  allocations: FundingAllocation[],
): { amount: number; sourceTag: string }[] {
  return allocations.map((alloc) => ({
    amount: alloc.amount,
    sourceTag: alloc.sourceTag,
  }));
}
