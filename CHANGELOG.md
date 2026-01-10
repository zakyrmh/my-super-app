# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **Finance:** Integration with Gemini AI for receipt parsing (OCR).
- **Health:** Food image recognition module.
- **Vehicle:** Predictive maintenance logic based on mileage.

## [0.1.0] - 2024-01-10

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
