"use server";

import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";
import { GoogleGenAI } from "@google/genai";

export type CategorySuggestion = {
  category: string;
  isNew: boolean;
  confidence: number;
  reason?: string;
  keywords?: string[];
};

// Output simple string array for suggestions
export async function suggestCategory(
  description: string,
  type: TransactionType
): Promise<string[]> {
  if (!description || description.trim().length < 3) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 1. Ambil kategori existing dari DB
  const categories = await prisma.category.findMany({
    where: {
      userId: user.id,
      type: type,
    },
  });

  const normalizedDesc = description.toLowerCase();
  const suggestions: Set<string> = new Set();

  // 2. Local Matching (Prioritas Utama)
  // a. Keyword matching
  for (const cat of categories) {
    if (cat.keywords.some((k) => normalizedDesc.includes(k.toLowerCase()))) {
      suggestions.add(cat.name);
    }
  }

  // b. Name matching
  for (const cat of categories) {
    if (normalizedDesc.includes(cat.name.toLowerCase())) {
      suggestions.add(cat.name);
    }
  }

  // Jika sudah ada 3 suggestion dari lokal, kembalikan saja (hemat token AI)
  if (suggestions.size >= 3) {
    return Array.from(suggestions).slice(0, 3);
  }

  // 3. AI Generation (Jika kurang dari 3)
  try {
    const aiSuggestions = await generateWithGemini(
      description,
      type,
      categories.map((c) => c.name),
      3 - suggestions.size // Minta sisa kekurangannya
    );

    aiSuggestions.forEach((s) => suggestions.add(s));
  } catch (error) {
    console.error("AI Warning:", error);
  }

  // Fallback default jika kosong banget (Local & AI failed)
  if (suggestions.size === 0) {
    console.warn("Using Default Fallbacks (AI failed or returned empty)");
    if (type === "EXPENSE") {
      ["Lainnya", "Belanja", "Makanan"].forEach((s) => suggestions.add(s));
    } else {
      ["Lainnya", "Gaji", "Bonus"].forEach((s) => suggestions.add(s));
    }
  }

  return Array.from(suggestions).slice(0, 3);
}

export async function saveNewCategory(
  name: string,
  type: TransactionType,
  keywords: string[] = []
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const validKeywords = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const uniqueKeywords = Array.from(new Set(validKeywords));

  return await prisma.category.create({
    data: {
      name: name.trim(),
      type: type,
      keywords: uniqueKeywords,
      userId: user.id,
    },
  });
}

// Helper Gemini Updated
async function generateWithGemini(
  description: string,
  type: TransactionType,
  existingCategories: string[],
  count: number = 3
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Context: Aplikasi keuangan pribadi.
Task: Berikan ${count} rekomendasi kategori untuk transaksi ini.

Type Transaction: ${type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
Description Transaction: "${description}"
Existing Categories: ${
    existingCategories.length > 0 ? existingCategories.join(", ") : "Belum ada"
  }

Instruksi:
1. Prioritaskan kategori yang sudah ada (Existing Categories) jika relevan.
2. Jika tidak ada yang cocok, buat nama kategori baru yang umum (1-2 kata).
3. Output HANYA JSON objekt dengan key "categories" berisi array string.
   Contoh: { "categories": ["Kategori1", "Kategori2"] }
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return [];

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.categories)) {
      return parsed.categories;
    }
    return [];
  } catch (error) {
    // Log complete error including cause if available
    console.error(
      "Gemini SDK Error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    return [];
  }
}

export async function getUserCategories(type: TransactionType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const categories = await prisma.category.findMany({
    where: {
      userId: user.id,
      type: type,
    },
    orderBy: {
      name: "asc",
    },
  });

  return categories.map((c) => c.name);
}
