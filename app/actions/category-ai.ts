"use server";

import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";

export type CategorySuggestion = {
  category: string;
  isNew: boolean;
  confidence: number;
  reason?: string;
  keywords?: string[];
};

export async function suggestCategory(
  description: string,
  type: TransactionType
): Promise<CategorySuggestion | null> {
  if (!description || description.trim().length < 3) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Cek database kita dulu (Personalized Learning)
  // Cari kategori yang punya keyword yang cocok dengan deskripsi
  const categories = await prisma.category.findMany({
    where: {
      userId: user.id,
      type: type,
    },
  });

  // Simple keyword matching (bisa ditingkatkan dengan fuzzy search atau vector db nanti)
  const normalizedDesc = description.toLowerCase();

  // Prioritas 1: Exact match atau contains match pada nama kategori
  const directMatch = categories.find((c) =>
    normalizedDesc.includes(c.name.toLowerCase())
  );
  if (directMatch) {
    return { category: directMatch.name, isNew: false, confidence: 1.0 };
  }

  // Prioritas 2: Match dengan keywords yang tersimpan
  for (const cat of categories) {
    if (cat.keywords.some((k) => normalizedDesc.includes(k.toLowerCase()))) {
      return { category: cat.name, isNew: false, confidence: 0.9 };
    }
  }

  // 2. Jika tidak ada di DB, tanya AI (Generative)
  try {
    const aiSuggestion = await generateWithGemini(
      description,
      type,
      categories.map((c) => c.name)
    );
    if (aiSuggestion) {
      // Cek apakah AI menyarankan kategori yang SUDAH ADA (tapi keywordnya belum kita tangkap)
      const existing = categories.find(
        (c) => c.name.toLowerCase() === aiSuggestion.category.toLowerCase()
      );

      if (existing) {
        // Update keyword otomatis? (Opsional, untuk sekarang kita return existing saja)
        return { category: existing.name, isNew: false, confidence: 0.8 };
      }

      return {
        category: aiSuggestion.category,
        isNew: true,
        confidence: 0.8,
        keywords: aiSuggestion.keywords, // AI juga suggest keywords baru
      };
    }
  } catch (error) {
    console.error("AI Generation failed:", error);
  }

  return null;
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

  // Bersihkan keywords kosong
  const validKeywords = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  // Pastikan keywords unik
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

// Helper untuk fetch Gemini API
async function generateWithGemini(
  description: string,
  type: TransactionType,
  existingCategories: string[]
): Promise<{ category: string; keywords: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `
Context: Aplikasi keuangan pribadi.
Task: Tentukan kategori transaksi yang setepat mungkin berdasarkan deskripsi.
Type: ${type}
Description: "${description}"
Existing Categories: ${existingCategories.join(", ")}

Instruksi:
1. Jika deskripsi cocok dengan salah satu Existing Categories, gunakan itu.
2. Jika tidak, buat kategori baru yang ringkas (1-2 kata) dan umum (contoh: "Makanan", "Transportasi", "Hiburan").
3. Berikan juga 2-3 keywords relevan dari deskripsi untuk future matching.
4. Output JSON only: { "category": "Nama Kategori", "keywords": ["keyword1", "keyword2"] }
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    const data = await response.json();

    if (
      data.candidates &&
      data.candidates[0].content &&
      data.candidates[0].content.parts[0].text
    ) {
      const text = data.candidates[0].content.parts[0].text;
      // Clean up markdown json blocks if any
      const jsonStr = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.error("Gemini API Error:", e);
  }

  return null;
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
