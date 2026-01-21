"use server";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 },
      );
    }

    // 1. Get all REPAYMENT transactions (credit sources) with flowTag
    const repaymentTransactions = await prisma.transaction.findMany({
      where: {
        type: "REPAYMENT",
        toAccountId: accountId,
      },
      select: {
        id: true,
        date: true,
        description: true,
        flowTag: true,
        amount: true,
      },
      orderBy: { date: "desc" },
    });

    // 2. Get all TransactionFunding with sourceTag (debits)
    const expenseFundings = await prisma.transactionFunding.findMany({
      where: {
        transaction: {
          type: "EXPENSE",
          fromAccountId: accountId,
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            type: true,
          },
        },
      },
    });

    // 3. Aggregate data per tag
    const tagCredits = new Map<string, number>();
    const tagDebits = new Map<string, number>();

    for (const tx of repaymentTransactions) {
      if (tx.flowTag) {
        const current = tagCredits.get(tx.flowTag) || 0;
        tagCredits.set(tx.flowTag, current + Number(tx.amount));
      }
    }

    for (const f of expenseFundings) {
      const current = tagDebits.get(f.sourceTag) || 0;
      tagDebits.set(f.sourceTag, current + Number(f.amount));
    }

    // Build summary
    const allTags = new Set([...tagCredits.keys(), ...tagDebits.keys()]);
    const tagSummary = Array.from(allTags).map((tag) => ({
      tag,
      credit: tagCredits.get(tag) || 0,
      debit: tagDebits.get(tag) || 0,
      balance: (tagCredits.get(tag) || 0) - (tagDebits.get(tag) || 0),
    }));

    return NextResponse.json({
      accountId,
      repaymentTransactions: repaymentTransactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
      })),
      expenseFundings: expenseFundings.map((f) => ({
        sourceTag: f.sourceTag,
        amount: Number(f.amount),
        transactionDescription: f.transaction.description,
        transactionDate: f.transaction.date,
      })),
      tagSummary,
      diagnosis: {
        uniqueFlowTags: [...tagCredits.keys()],
        uniqueSourceTags: [...tagDebits.keys()],
        mismatchedTags:
          [...tagCredits.keys()].filter(
            (t) => ![...tagDebits.keys()].includes(t),
          ).length > 0 ||
          [...tagDebits.keys()].filter(
            (t) => ![...tagCredits.keys()].includes(t),
          ).length > 0,
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
