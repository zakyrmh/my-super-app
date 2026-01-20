# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **Finance:** Integration with Gemini AI for receipt parsing (OCR).
- **Health:** Food image recognition module.
- **Vehicle:** Predictive maintenance logic based on mileage.

## [0.1.0] - 2026-01-10

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

## [0.2.0] - 2026-01-11

### Added

- **Dashboard:** Implemented dashboard layout with sidebar and bottom navigation.
- **Header:** Added header component with user profile and navigation links.
- **Sidebar:** Created sidebar component with collapsible functionality.
- **Bottom Navigation:** Implemented bottom navigation for mobile devices.

## [0.3.0] - 2026-01-12

### Added

- **Transaction:** Implemented transaction form with itemized expense support.

### Changed

- **Schema:** added 'TransactionFunding' model.

## [0.4.0] - 2026-01-18

### Added

- **AI Category Suggestion:** Implemented AI category suggestion for transactions.
- **Debt:** Implemented debt management features.

## [0.5.0] - 2026-01-19

### Added

- **AI Item Category Suggestion:** Implemented AI category suggestion for transaction items.

### Changed

- **Category:** Only show categories from database.

### Fixed

- **Monthly Income:** Fixed monthly income calculation.

## [0.6.0] - 2026-01-21

### Added

- **Account Detail:** Implemented account detail sheet.

### Fixed

- **Tag Transfer:** Fixed tag transfer functionality.
