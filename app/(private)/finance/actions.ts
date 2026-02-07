"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  allocateFundsForExpense,
  calculateTagBalances,
  type FundingAllocation,
  type TagBalance,
} from "@/lib/finance/smart-allocation";

// ========================
// TYPE DEFINITIONS
// ========================

/** Account type enum matching Prisma schema */
export type AccountType = "BANK" | "EWALLET" | "CASH" | "INVESTMENT" | "CREDIT";

/** Input data for creating a new account */
export interface CreateAccountInput {
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number | null;
  statementDate?: number | null;
  dueDate?: number | null;
}

/** Response type for account actions */
export interface AccountActionResponse {
  success: boolean;
  message: string;
  accountId?: string;
}

// ========================
// CREATE ACCOUNT ACTION
// ========================

export async function createAccount(
  input: CreateAccountInput,
): Promise<AccountActionResponse> {
  try {
    // 1. Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // 2. Validate required fields
    if (!input.name || input.name.trim() === "") {
      return {
        success: false,
        message: "Nama akun wajib diisi.",
      };
    }

    if (!input.type) {
      return {
        success: false,
        message: "Tipe akun wajib dipilih.",
      };
    }

    // 3. Create account (Atomic Transaction)
    // We strictly use a transaction to ensure Initial Balance is recorded as a Transaction history
    const account = await prisma.$transaction(async (tx) => {
      // A. Create the account with 0 balance initially
      const newAccount = await tx.account.create({
        data: {
          name: input.name.trim(),
          type: input.type,
          balance: 0,
          userId: user.id,
          // Credit-specific fields
          ...(input.type === "CREDIT" && {
            creditLimit: input.creditLimit ?? undefined,
            statementDate: input.statementDate ?? undefined,
            dueDate: input.dueDate ?? undefined,
          }),
        },
      });

      // B. Handle Initial Balance if provided
      if (input.balance && input.balance !== 0) {
        const isPositive = input.balance > 0;
        const amount = Math.abs(input.balance);
        const type = isPositive ? "INCOME" : "EXPENSE"; // Positive = Income (Asset), Negative = Expense (Debt/Liability start)

        // Create the "Initial Balance" transaction
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: type,
            amount: amount,
            date: new Date(),
            description: "Initial Balance",
            // Link to the new account
            toAccountId: isPositive ? newAccount.id : undefined,
            fromAccountId: !isPositive ? newAccount.id : undefined,
            isPersonal: true,
          },
        });

        // Update the account balance
        // Note: For CREDIT accounts, a negative balance means debt, which matches "EXPENSE" logic (money out/owed)
        await tx.account.update({
          where: { id: newAccount.id },
          data: { balance: input.balance },
        });
      }

      return newAccount;
    });

    // 4. Revalidate the finance page
    revalidatePath("/finance");

    return {
      success: true,
      message: `Akun "${account.name}" berhasil dibuat!`,
      accountId: account.id,
    };
  } catch (error) {
    console.error("Error creating account:", error);

    const errorMessage =
      error instanceof Error
        ? `Gagal membuat akun: ${error.message}`
        : "Terjadi kesalahan saat membuat akun. Silakan coba lagi.";

    return {
      success: false,
      message: errorMessage,
    };
  }
}

// ========================
// TRANSACTION TYPES
// ========================

/** Transaction type enum matching Prisma schema */
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

/** Account option for Select dropdown */
export interface AccountOption {
  id: string;
  name: string;
  type: string;
  balance: number;
}

/** Input data for creating a new transaction */
export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  date: string; // ISO date string
  description?: string | null;
  category?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  isPersonal?: boolean;

  /** Name of the funding source (e.g. "Gaji", "Bonus") - For INCOME only */
  fundingSourceName?: string | null;

  /** Manual fund allocations for EXPENSE (optional - if not provided, auto-allocation is used) */
  manualAllocations?: { fundingSourceId: string; amount: number }[] | null;

  /** Itemized expense details (optional) */
  items?:
    | { name: string; price: number; qty: number; category?: string | null }[]
    | null;
}

/** Response type for transaction actions */
export interface TransactionActionResponse {
  success: boolean;
  message: string;
  transactionId?: string;
}

// ========================
// GET USER ACCOUNTS ACTION
// ========================

export async function getUserAccounts(): Promise<AccountOption[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
      },
      orderBy: { name: "asc" },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: Number(acc.balance),
    }));
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

// ========================
// GET ACCOUNT TAG BALANCES ACTION
// ========================

/**
 * Fetches available funding sources (with balances) for a specific account.
 * Used to show allocation preview in the transaction form.
 */
export async function getAccountTagBalances(
  accountId: string,
): Promise<TagBalance[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return [];
    }

    // Get tag balances using the smart allocation logic
    const tagBalances = await calculateTagBalances(accountId);
    return tagBalances;
  } catch (error) {
    console.error("Error fetching tag balances:", error);
    return [];
  }
}

// ========================
// CREATE TRANSACTION ACTION
// ========================

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionActionResponse> {
  try {
    // 1. Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Unauthorized: Silakan login terlebih dahulu.",
      };
    }

    // 2. Validate required fields
    if (!input.type) {
      return {
        success: false,
        message: "Tipe transaksi wajib dipilih.",
      };
    }

    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        message: "Jumlah transaksi harus lebih dari 0.",
      };
    }

    // 3. Validate account based on transaction type
    if (input.type === "INCOME" && !input.toAccountId) {
      return {
        success: false,
        message: "Akun tujuan pemasukan wajib dipilih.",
      };
    }

    if (input.type === "EXPENSE" && !input.fromAccountId) {
      return {
        success: false,
        message: "Akun sumber pengeluaran wajib dipilih.",
      };
    }

    if (input.type === "TRANSFER") {
      if (!input.fromAccountId || !input.toAccountId) {
        return {
          success: false,
          message: "Akun asal dan tujuan transfer wajib dipilih.",
        };
      }
      if (input.fromAccountId === input.toAccountId) {
        return {
          success: false,
          message: "Akun asal dan tujuan tidak boleh sama.",
        };
      }
    }

    // 4. Verify accounts belong to user
    if (input.fromAccountId) {
      const fromAccount = await prisma.account.findFirst({
        where: { id: input.fromAccountId, userId: user.id },
      });
      if (!fromAccount) {
        return {
          success: false,
          message: "Akun asal tidak ditemukan.",
        };
      }
    }

    if (input.toAccountId) {
      const toAccount = await prisma.account.findFirst({
        where: { id: input.toAccountId, userId: user.id },
      });
      if (!toAccount) {
        return {
          success: false,
          message: "Akun tujuan tidak ditemukan.",
        };
      }
    }

    // 5. Handle EXPENSE and TRANSFER with Fund Allocation
    // For EXPENSE: funding sources are consumed (balance checks)
    // For TRANSFER: funding sources are moved
    let fundingAllocations: FundingAllocation[] = [];

    if (
      (input.type === "EXPENSE" || input.type === "TRANSFER") &&
      input.fromAccountId
    ) {
      // Use manual allocations if provided, otherwise auto-allocate
      if (input.manualAllocations && input.manualAllocations.length > 0) {
        // Validate manual allocations total matches amount
        const manualTotal = input.manualAllocations.reduce(
          (sum, a) => sum + a.amount,
          0,
        );
        if (manualTotal !== input.amount) {
          return {
            success: false,
            message: `Total alokasi (Rp ${manualTotal.toLocaleString(
              "id-ID",
            )}) tidak sama dengan jumlah transaksi (Rp ${input.amount.toLocaleString(
              "id-ID",
            )})`,
          };
        }

        // Use manual allocations (map structure if needed, or check validity)
        // Here we assume simpler manual input: [{fundingSourceId, amount}]
        // We need to map it to FundingAllocation structure which expects sourceName?
        // Actually, for DB creation we only need ID. But FundingAllocation interface has sourceName.
        // We can fetch names or just use placeholders if strictly data processing.
        // For robustness, let's just proceed with IDs. We will cast or adjust types if needed.
        // However, FundingAllocation interface requires sourceName. Let's just create array with placeholder.

        fundingAllocations = input.manualAllocations.map((ma) => ({
          fundingSourceId: ma.fundingSourceId,
          sourceName: "", // Placeholder - not used for DB creation
          amount: ma.amount,
        }));
      } else {
        // Auto-allocate using waterfall logic
        try {
          const allocationResult = await allocateFundsForExpense(
            input.fromAccountId,
            input.amount,
            false, // Don't allow overdraft
          );
          fundingAllocations = allocationResult.allocations;
        } catch (error) {
          if (error instanceof Error) {
            return {
              success: false,
              message: error.message,
            };
          }
          throw error;
        }
      }
    }

    // 6. Resolve Category (Find or Create)
    let finalCategoryId: string | null = null;
    if (input.category) {
      const categoryName = input.category.trim();
      const existingCategory = await prisma.category.findFirst({
        where: {
          userId: user.id,
          name: { equals: categoryName, mode: "insensitive" },
          type: input.type,
        },
      });

      if (existingCategory) {
        finalCategoryId = existingCategory.id;
      } else {
        const newCategory = await prisma.category.create({
          data: {
            name: categoryName,
            type: input.type,
            userId: user.id,
            keywords: [categoryName.toLowerCase()],
          },
        });
        finalCategoryId = newCategory.id;
      }
    }

    // 7. Handle INCOME Funding Source Resolution
    let incomeFundingSourceId: string | null = null;
    if (input.type === "INCOME" && input.fundingSourceName) {
      const fsName = input.fundingSourceName.trim();
      // Find or create Funding Source
      const fundingSource = await prisma.fundingSource.findUnique({
        where: {
          userId_name: {
            userId: user.id,
            name: fsName,
          },
        },
      });

      if (fundingSource) {
        incomeFundingSourceId = fundingSource.id;
      } else {
        // Create new
        const newFs = await prisma.fundingSource.create({
          data: {
            userId: user.id,
            name: fsName,
            type: "INCOME",
          },
        });
        incomeFundingSourceId = newFs.id;
      }
    }

    // 8. Create transaction and update balances in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          type: input.type,
          amount: input.amount,
          date: input.date ? new Date(input.date) : new Date(),
          description: input.description?.trim() || null,
          categoryId: finalCategoryId,
          fromAccountId: input.fromAccountId || null,
          toAccountId: input.toAccountId || null,
          isPersonal: input.isPersonal ?? true,
          // flowTag logic is REMOVED. Tracking happens via TransactionFunding relations.
        },
      });

      // Create Funding Record for INCOME
      if (input.type === "INCOME" && incomeFundingSourceId) {
        await tx.transactionFunding.create({
          data: {
            transactionId: transaction.id,
            fundingSourceId: incomeFundingSourceId,
            amount: input.amount,
          },
        });
      }

      // Handle account balance updates and funding records based on type
      if (input.type === "INCOME" && input.toAccountId) {
        // Income: Add to receiving account
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: { increment: input.amount } },
        });
      } else if (input.type === "EXPENSE" && input.fromAccountId) {
        // Expense: Subtract from sending account
        await tx.account.update({
          where: { id: input.fromAccountId },
          data: { balance: { decrement: input.amount } },
        });

        // Create TransactionFunding records for each allocation
        if (fundingAllocations.length > 0) {
          await tx.transactionFunding.createMany({
            data: fundingAllocations.map((alloc) => ({
              transactionId: transaction.id,
              fundingSourceId: alloc.fundingSourceId, // Use ID relation
              amount: alloc.amount,
            })),
          });
        }

        // Create TransactionItem records for itemized expenses
        if (input.items && input.items.length > 0) {
          for (const item of input.items) {
            let itemCategoryId: string | null = null;

            if (item.category) {
              const iCatName = item.category.trim();
              const existingItemCat = await tx.category.findFirst({
                where: {
                  userId: user.id,
                  name: { equals: iCatName, mode: "insensitive" },
                  type: "EXPENSE", // Items are always expenses
                },
              });

              if (existingItemCat) {
                itemCategoryId = existingItemCat.id;
              } else {
                const newItemCat = await tx.category.create({
                  data: {
                    name: iCatName,
                    type: "EXPENSE",
                    userId: user.id,
                    keywords: [iCatName.toLowerCase()],
                  },
                });
                itemCategoryId = newItemCat.id;
              }
            }

            await tx.transactionItem.create({
              data: {
                transactionId: transaction.id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                categoryId: itemCategoryId,
              },
            });
          }
        }
      } else if (
        input.type === "TRANSFER" &&
        input.fromAccountId &&
        input.toAccountId
      ) {
        // Transfer: Subtract from source, add to destination
        await tx.account.update({
          where: { id: input.fromAccountId },
          data: { balance: { decrement: input.amount } },
        });
        await tx.account.update({
          where: { id: input.toAccountId },
          data: { balance: { increment: input.amount } },
        });

        // Create TransactionFunding records for TRANSFER
        // This tracks which funds are being moved
        if (fundingAllocations.length > 0) {
          // Note: For transfer, the funding source follows the money.
          // We just record which source was used.
          await tx.transactionFunding.createMany({
            data: fundingAllocations.map((alloc) => ({
              transactionId: transaction.id,
              fundingSourceId: alloc.fundingSourceId,
              amount: alloc.amount,
            })),
          });
        }
      }

      return transaction;
    });

    // 9. Revalidate the finance page
    revalidatePath("/finance");

    // Generate success message based on type
    let successMessage: string;
    if (input.type === "INCOME") {
      successMessage = "Pemasukan berhasil dicatat!";
    } else if (input.type === "EXPENSE") {
      // Include allocation details in success message
      if (fundingAllocations.length > 0 && fundingAllocations[0].sourceName) {
        // Use sourceName if available (from auto-allocation)
        const allocationSummary = fundingAllocations
          .map((a) => `${a.sourceName}: Rp ${a.amount.toLocaleString("id-ID")}`)
          .join(", ");
        successMessage = `Pengeluaran berhasil dicatat! (${allocationSummary})`;
      } else {
        successMessage = "Pengeluaran berhasil dicatat!";
      }
    } else {
      successMessage = "Transfer berhasil dicatat!";
    }

    return {
      success: true,
      message: successMessage,
      transactionId: result.id,
    };
  } catch (error) {
    console.error("Error creating transaction:", error);

    return {
      success: false,
      message: "Terjadi kesalahan saat mencatat transaksi. Silakan coba lagi.",
    };
  }
}

// ========================
// GET ACCOUNT DETAIL ACTION
// ========================

/** Detailed account information */
export interface AccountDetail {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number | null;
  statementDate?: number | null;
  dueDate?: number | null;
  createdAt?: Date;
  // Statistics
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
}

/** Funding source for expense transactions */
export interface TransactionFundingInfo {
  sourceName: string; // Changed from sourceTag to Source Name via relation
  amount: number;
}

/** Transaction summary for account detail */
export interface AccountTransaction {
  id: string;
  date: Date;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "LENDING" | "REPAYMENT";
  amount: number;
  description: string | null;
  category: string | null;
  // flowTag: string | null; <-- Removed
  fromAccountId: string | null;
  fromAccountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  /** Funding sources */
  fundings: TransactionFundingInfo[];
}

/**
 * Fetches detailed account information including stats.
 */
export async function getAccountDetail(
  accountId: string,
): Promise<AccountDetail | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Get account with basic info
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return null;
    }

    // Get transaction statistics for this account
    const [incomeStats, expenseStats, transactionCount] = await Promise.all([
      // Total income to this account
      prisma.transaction.aggregate({
        where: {
          toAccountId: accountId,
          type: "INCOME",
        },
        _sum: { amount: true },
      }),
      // Total expense from this account
      prisma.transaction.aggregate({
        where: {
          fromAccountId: accountId,
          type: "EXPENSE",
        },
        _sum: { amount: true },
      }),
      // Total transaction count involving this account
      prisma.transaction.count({
        where: {
          OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
        },
      }),
    ]);

    return {
      id: account.id,
      name: account.name,
      type: account.type as AccountType,
      balance: Number(account.balance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      statementDate: account.statementDate,
      dueDate: account.dueDate,
      totalIncome: Number(incomeStats._sum.amount ?? 0),
      totalExpense: Number(expenseStats._sum.amount ?? 0),
      transactionCount,
    };
  } catch (error) {
    console.error("Error fetching account detail:", error);
    return null;
  }
}

/**
 * Fetches transactions for a specific account.
 * @param accountId - The account ID to get transactions for
 * @param limit - Maximum number of transactions to return. Use 0 for no limit (all transactions).
 */
export async function getAccountTransactions(
  accountId: string,
  limit: number = 20,
): Promise<AccountTransaction[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    // Verify account belongs to user
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return [];
    }

    // Get transactions involving this account
    // If limit is 0, don't apply any limit (get all)
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      },
      include: {
        category: { select: { name: true } },
        fromAccount: { select: { id: true, name: true } },
        toAccount: { select: { id: true, name: true } },
        fundings: {
          select: {
            amount: true,
            fundingSource: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      ...(limit > 0 ? { take: limit } : {}),
    });

    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      type: tx.type as
        | "INCOME"
        | "EXPENSE"
        | "TRANSFER"
        | "LENDING"
        | "REPAYMENT",
      amount: Number(tx.amount),
      description: tx.description,
      category: tx.category?.name ?? null,
      fromAccountId: tx.fromAccountId,
      fromAccountName: tx.fromAccount?.name ?? null,
      toAccountId: tx.toAccountId,
      toAccountName: tx.toAccount?.name ?? null,
      fundings: tx.fundings.map((f) => ({
        sourceName: f.fundingSource.name,
        amount: Number(f.amount),
      })),
    }));
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    return [];
  }
}
