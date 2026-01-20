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

    // 3. Create account in database
    // Using Prisma's expected types (Decimal fields accept number)
    const account = await prisma.account.create({
      data: {
        name: input.name.trim(),
        type: input.type,
        balance: input.balance || 0,
        userId: user.id,
        // Credit-specific fields (only set if type is CREDIT)
        ...(input.type === "CREDIT" && {
          creditLimit: input.creditLimit ?? undefined,
          statementDate: input.statementDate ?? undefined,
          dueDate: input.dueDate ?? undefined,
        }),
      },
    });

    // 4. Revalidate the finance page to show new data
    revalidatePath("/finance");

    return {
      success: true,
      message: `Akun "${account.name}" berhasil dibuat!`,
      accountId: account.id,
    };
  } catch (error) {
    console.error("Error creating account:", error);

    // Provide more specific error message if available
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
  flowTag?: string | null;
  /** Manual fund allocations for EXPENSE (optional - if not provided, auto-allocation is used) */
  manualAllocations?: { sourceTag: string; amount: number }[] | null;
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
 * Fetches available fund source tags (with balances) for a specific account.
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
    // For EXPENSE: tags are consumed (balance decreases)
    // For TRANSFER: tags are moved from source account to destination account
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
        // Use manual allocations
        fundingAllocations = input.manualAllocations;
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

    // 7. Create transaction and update balances in a transaction
    // For TRANSFER: determine the flowTag from allocations
    // If single allocation, use that tag. If multiple, combine them or use primary.
    let transferFlowTag: string | null = null;
    if (input.type === "TRANSFER" && fundingAllocations.length > 0) {
      // For TRANSFER, if only one tag is used, pass it to the destination account
      // If multiple tags, we need to combine them. For simplicity, use the first/primary tag.
      // A more complex approach could store multiple tags, but current schema uses single flowTag.
      if (fundingAllocations.length === 1) {
        transferFlowTag = fundingAllocations[0].sourceTag;
      } else {
        // Multiple tags being transferred - use primary (highest amount) tag
        // The full breakdown is still tracked via TransactionFunding records
        const primaryAllocation = fundingAllocations.reduce((max, alloc) =>
          alloc.amount > max.amount ? alloc : max,
        );
        transferFlowTag = primaryAllocation.sourceTag;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      // Note: For EXPENSE, flowTag is NOT set (funding tracked via TransactionFunding)
      // For TRANSFER, flowTag IS set to carry the tag to the destination account
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
          // flowTag is set for INCOME and TRANSFER (source tracking)
          flowTag:
            input.type === "INCOME"
              ? input.flowTag?.trim() || null
              : input.type === "TRANSFER"
                ? transferFlowTag
                : null,
        },
      });

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
              sourceTag: alloc.sourceTag,
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
        // This tracks which tags are being moved from the source account
        if (fundingAllocations.length > 0) {
          await tx.transactionFunding.createMany({
            data: fundingAllocations.map((alloc) => ({
              transactionId: transaction.id,
              sourceTag: alloc.sourceTag,
              amount: alloc.amount,
            })),
          });
        }
      }

      return transaction;
    });

    // 8. Revalidate the finance page
    revalidatePath("/finance");

    // Generate success message based on type
    let successMessage: string;
    if (input.type === "INCOME") {
      successMessage = "Pemasukan berhasil dicatat!";
    } else if (input.type === "EXPENSE") {
      // Include allocation details in success message
      if (fundingAllocations.length > 0) {
        const allocationSummary = fundingAllocations
          .map((a) => `${a.sourceTag}: Rp ${a.amount.toLocaleString("id-ID")}`)
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
