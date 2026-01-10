# My Super App - Personal Resource Planning (PRP) & Assistant

**My Super App** is an all-in-one personal management application designed to handle Finance, Health, and Vehicle maintenance in a single ecosystem. It leverages AI (Google Gemini) to automate data entry through OCR (receipts) and Vision (food logging), transforming manual tracking into a seamless experience.

Built with performance and mobile usage in mind (PWA ready).

## 🚀 Features

### 💰 Finance Module (Advanced Tracker)

- **Multi-Account System:** Track banks, e-wallets, and cash with double-entry logic.
- **AI-Powered OCR:** Scan shopping receipts, auto-itemize products, and categorize them using Gemini AI.
- **Smart Flow:** Track fund movements (e.g., Salary -> Bank A -> Investment B).
- **Debt & Receivables:** Manage lending/borrowing across specific accounts.
- **Privacy Flag:** Distinguish between personal expenses and "pass-through" transactions (e.g., paying for a friend).

### 🍎 Health Module (AI Nutritionist)

- **Snap & Log:** Take a photo of your meal; AI estimates calories and nutrition facts.
- **Daily Dashboard:** Monitor protein, carbs, and fat intake against goals.

### 🚗 Vehicle Module (Fleet Management)

- **Service Logs:** Track maintenance history (oil change, parts replacement).
- **Predictive Maintenance:** AI predicts the next service date based on daily mileage.
- **Fuel Efficiency:** Calculate generic fuel consumption (KM/L).

## 🛠 Tech Stack

- **Framework:** [Next.js 16+](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + [Shadcn UI](https://ui.shadcn.com/)
- **State Management:** Zustand
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth (Google & Biometrics)
- **Storage:** Supabase Storage (Images)
- **AI:** Google Gemini SDK (Generative AI)
- **Deployment:** Vercel

## ⚙️ Getting Started

### Prerequisites

- Node.js 20+
- npm / yarn / pnpm
- Supabase Account
- Google Gemini API Key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/zakyrmh/my-super-app.git
   cd my-super-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup Create a `.env.local` file in the root directory:**

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

   # Database (Transaction Mode for Prisma)
   DATABASE_URL="your_postgresql_connection_string"

   # Google AI
   GEMINI_API_KEY="your_gemini_api_key"

   # Auth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate_a_random_secret_here"
   ```

4. **Database Setup Push the Prisma schema to your Supabase instance:**

   ```bash
   npx prisma db push
   ```

5. **Run the Development Server**

   ```bash
   npm run dev
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
