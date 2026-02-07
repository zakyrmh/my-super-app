/**
 * Smart Fund Allocation Logic
 *
 * This module provides utilities for calculating available balances per "Funding Source"
 * and intelligently allocating funds for expense transactions.
 *
 * Business Logic:
 * - Money flow is tracked via `FundingSource` entities (e.g. "Gaji Januari", "Bonus").
 * - `TransactionFunding` records link Transactions to FundingSources.
 * - Balance per Funding Source per Account is calculated by aggregating:
 *   - Credits: Transactions coming INTO the account (INCOME, TRANSFER IN) linked to the source.
 *   - Debits: Transactions going OUT of the account (EXPENSE, TRANSFER OUT) linked to the source.
 * - Priority: Funding Sources with highest balance are used first (waterfall allocation).
 */

import { prisma } from "@/lib/prisma";

// ========================
// TYPE DEFINITIONS
// ========================

/** Represents available balance for a specific funding source in an account */
export interface TagBalance {
  fundingSourceId: string;
  tagName: string; // The human-readable name of the funding source
  credit: number; // Total incoming
  debit: number; // Total outgoing
  balance: number; // credit - debit
}

/** Represents a funding allocation for an expense */
export interface FundingAllocation {
  fundingSourceId: string;
  sourceName: string;
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
 * Calculates available balance per Funding Source for a specific account.
 *
 * Logic:
 * 1. Query ALL TransactionFunding records where the related Transaction involves this account.
 * 2. Determine direction (Credit/Debit) based on Transaction type and Account role (Sender/Receiver).
 * 3. Aggregate by FundingSource.
 *
 * @param accountId - The account ID to calculate balances for
 * @returns Array of TagBalance objects, sorted by balance (highest first)
 */
export async function calculateTagBalances(
  accountId: string,
): Promise<TagBalance[]> {
  // Query all TransactionFunding records related to this account
  const allFundings = await prisma.transactionFunding.findMany({
    where: {
      transaction: {
        OR: [
          { fromAccountId: accountId }, // Outgoing
          { toAccountId: accountId }, // Incoming
        ],
      },
    },
    include: {
      fundingSource: {
        select: { name: true },
      },
      transaction: {
        select: {
          type: true,
          fromAccountId: true,
          toAccountId: true,
        },
      },
    },
  });

  // Map structure: fundingSourceId -> data
  const tagDataMap = new Map<
    string,
    { name: string; credit: number; debit: number }
  >();

  // Helper to get or create map entry
  const getTagData = (id: string, name: string) => {
    if (!tagDataMap.has(id)) {
      tagDataMap.set(id, { name, credit: 0, debit: 0 });
    }
    return tagDataMap.get(id)!;
  };

  for (const funding of allFundings) {
    const { fundingSourceId, amount } = funding;
    const sourceName = funding.fundingSource.name;
    const tx = funding.transaction;
    const numAmount = Number(amount);

    const tagData = getTagData(fundingSourceId, sourceName);

    // Analyze direction relative to THIS account
    const isIncoming = tx.toAccountId === accountId;
    const isOutgoing = tx.fromAccountId === accountId;

    if (isIncoming) {
      // Money entering this account (INCOME, TRANSFER IN, REPAYMENT)
      // Note: Even for TRANSFER, if it carries a FundingSource, it adds to that Source's balance in this Account.
      tagData.credit += numAmount;
    } else if (isOutgoing) {
      // Money leaving this account (EXPENSE, TRANSFER OUT, LENDING)
      tagData.debit += numAmount;
    }
  }

  // Convert map to array
  const balances: TagBalance[] = [];

  for (const [id, data] of tagDataMap) {
    const balance = data.credit - data.debit;

    // Only include sources with positive balance
    if (balance > 0) {
      balances.push({
        fundingSourceId: id,
        tagName: data.name,
        credit: data.credit,
        debit: data.debit,
        balance,
      });
    }
  }

  // Sort by balance descending
  balances.sort((a, b) => b.balance - a.balance);

  return balances;
}

// ========================
// SMART FUND ALLOCATION
// ========================

/**
 * Allocates funds from available funding sources using waterfall logic.
 *
 * @param accountId - The account ID to allocate from
 * @param totalAmount - The total amount to allocate
 * @param allowOverdraft - If true, allows allocation even if insufficient funds (not implemented yet for strict mode)
 * @returns AllocationResult
 */
export async function allocateFundsForExpense(
  accountId: string,
  totalAmount: number,
  allowOverdraft = false,
): Promise<AllocationResult> {
  // 1. Get available balances
  const tagBalances = await calculateTagBalances(accountId);

  // 2. Calculate total available
  const totalAvailable = tagBalances.reduce((sum, tb) => sum + tb.balance, 0);

  // 3. Check sufficiency
  if (!allowOverdraft && totalAvailable < totalAmount) {
    throw new Error(
      `Saldo sumber dana tidak mencukupi (Flow Tracked). Dibutuhkan: Rp ${totalAmount.toLocaleString(
        "id-ID",
      )}, Tersedia: Rp ${totalAvailable.toLocaleString("id-ID")}`,
    );
  }

  // 4. Waterfall allocation
  const allocations: FundingAllocation[] = [];
  let remaining = totalAmount;

  for (const tagBalance of tagBalances) {
    if (remaining <= 0) break;

    const amountFromTag = Math.min(tagBalance.balance, remaining);

    if (amountFromTag > 0) {
      allocations.push({
        fundingSourceId: tagBalance.fundingSourceId,
        sourceName: tagBalance.tagName,
        amount: amountFromTag,
      });
      remaining -= amountFromTag;
    }
  }

  const shortfall = Math.max(0, remaining);
  const totalAllocated = totalAmount - shortfall;

  return {
    allocations,
    totalAllocated,
    shortfall,
  };
}
