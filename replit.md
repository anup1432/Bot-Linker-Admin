# Telegram Bot Admin Panel

## Overview

This is a Telegram bot admin panel application that allows users to manage group join requests through a web interface. Users authenticate via Telegram Login Widget, then can monitor bot activity, manage group joins, and configure bot settings. The application follows a clean admin dashboard pattern with a sidebar navigation, data-dense displays, and real-time status tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin

The frontend follows a page-based architecture with shared components. Key pages include Dashboard, Groups management, Settings, and Login. The design system draws from Material Design and Linear for a professional admin interface.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **API Pattern**: RESTful JSON APIs under `/api/*` prefix
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Telegram Integration**: node-telegram-bot-api for bot functionality

The server handles authentication verification using Telegram's HMAC-based login validation, manages user sessions, and provides CRUD operations for group joins and bot settings.

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with push-based migrations (`npm run db:push`)

Core tables:
- `users`: Telegram-authenticated users
- `groupJoins`: Tracks group invite links and their status (pending, joined, verified, failed)
- `botSettings`: Per-user bot configuration (welcome messages, auto-join settings)
- `activityLogs`: Audit trail of bot actions

### Authentication Flow
1. User clicks Telegram Login Widget on login page
2. Telegram returns signed user data with HMAC hash
3. Backend verifies hash using bot token as secret key
4. Session created with user ID stored in session data
5. Protected routes check `req.session.userId` for authorization

### Build System
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- TypeScript paths: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

## External Dependencies

### Third-Party Services
- **Telegram Bot API**: Core integration for bot functionality and user authentication
- **PostgreSQL Database**: Primary data store (requires `DATABASE_URL` environment variable)

### Key NPM Packages
- `node-telegram-bot-api`: Telegram bot SDK for message handling
- `drizzle-orm` + `drizzle-kit`: Type-safe ORM and migration tooling
- `express-session` + `connect-pg-simple`: Session management with PostgreSQL backing
- `@tanstack/react-query`: Server state synchronization
- `zod` + `drizzle-zod`: Runtime validation with schema generation

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- Telegram bot token (accessed via bot settings or environment)

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Development tooling
- Dynamic URL detection using `REPLIT_DEV_DOMAIN` and `REPL_SLUG` environment variables