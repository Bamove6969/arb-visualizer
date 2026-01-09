# Arbitrage Calculator

## Overview

A prediction market arbitrage calculator web application that helps users identify risk-free profit opportunities across different betting platforms (like Kalshi and Polymarket). Users input YES prices from two different sites, and the calculator determines if an arbitrage opportunity exists by comparing combined costs against payout values. The app displays profit margins, ROI percentages, and investment projections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS with CSS variables for theming
- **Component Library**: shadcn/ui (Radix UI primitives with custom styling)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (compiled with tsx)
- **API Structure**: RESTful endpoints under `/api` prefix
- **Static Serving**: Express serves built frontend in production

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Current Schema**: Basic users table (id, username, password)
- **In-Memory Fallback**: MemStorage class for development without database

### Project Structure
```
├── client/           # Frontend React application
│   └── src/
│       ├── components/ui/  # shadcn/ui components
│       ├── pages/          # Route components
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schemas
└── attached_assets/  # Reference Python scripts for arbitrage logic
```

### Design System
- Material Design principles adapted for financial data
- Typography: Inter for UI, JetBrains Mono for numerical data
- Color scheme uses CSS custom properties with light/dark mode support
- Focus on clear visual hierarchy for profit/loss states

## External Dependencies

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema push (`db:push` script)

### Third-Party Services
- None currently integrated (pure client-side calculation app)

### Key NPM Packages
- **@tanstack/react-query**: Async state management
- **drizzle-orm** + **drizzle-zod**: Type-safe database operations
- **express**: HTTP server framework
- **zod**: Runtime schema validation
- **class-variance-authority**: Component variant styling
- **lucide-react**: Icon library

### Development Tools
- **Vite**: Frontend build and HMR
- **tsx**: TypeScript execution for Node.js
- **Replit plugins**: Dev banner, cartographer, runtime error overlay