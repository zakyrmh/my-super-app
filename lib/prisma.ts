// Prisma client singleton for Next.js (Prisma 7.x with adapter)
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
});

// Create adapter instance
const adapter = new PrismaPg(pool);

// Create a singleton PrismaClient instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
