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
- **Schema Location**: `shared/schema.ts` (Drizzle table definitions and types)
- **Connection**: Uses `DATABASE_URL` environment variable (automatically provided by Replit)

Core tables:
- `users`: Telegram-authenticated users
- `groupJoins`: Tracks group invite links and their status (pending, joined, verified, failed)
- `botSettings`: Per-user bot configuration (welcome messages, auto-join settings)
- `activityLogs`: Audit trail of bot actions
- `userSessions`: Encrypted Telegram userbot sessions for API access

### Userbot Session Feature
The bot supports a userbot feature that allows users to connect their Telegram account:
1. User sends `/session` command
2. Bot asks for API ID (from my.telegram.org)
3. Bot asks for API Hash
4. Bot asks for phone number with country code
5. Bot sends OTP to user's Telegram and asks for the code
6. If 2FA is enabled, asks for password
7. Session is saved encrypted in database

Once connected, when users send group links:
- Userbot joins the group using the connected account
- Checks the group age automatically
- If group is old enough (marked with "A"), asks user to transfer ownership
- When ownership is verified, adds payment to user's balance

Security:
- API credentials are encrypted with AES-256 using random IV
- SESSION_SECRET must be at least 32 characters
- User ID validation prevents session hijacking
- Session status tracking with auto-deactivation on errors

### Authentication Flow
1. User clicks Telegram Login Widget on login page
2. Telegram returns signed user data with HMAC hash
3. Backend verifies hash using bot token as secret key
4. Session created with user ID stored in session data
5. Protected routes check `req.session.userId` for authorization

### Admin Security Features (OTP & 2-Step Verification)
The admin panel supports enhanced security with:
- **Phone OTP Login**: Admin can login using phone number with SMS OTP (requires Twilio configuration)
- **2-Step Verification**: OTP + password for additional security
- **Twilio Integration**: SMS OTP sent via Twilio API (credentials stored securely in database, never exposed to frontend)

To configure:
1. Go to Admin Settings > Security Settings
2. Enter your phone number
3. Configure Twilio credentials (Account SID, Auth Token, Phone Number)
4. Set a password for 2-step verification
5. Enable OTP and/or 2-Step verification toggles

Note: Twilio credentials and password hash are NEVER returned to the frontend for security.

### Build System
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- TypeScript paths: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

## External Dependencies

### Third-Party Services
- **Telegram Bot API**: Core integration for bot functionality and user authentication
- **PostgreSQL Database**: Primary data store (automatically provided by Replit via `DATABASE_URL`)

### Key NPM Packages
- `node-telegram-bot-api`: Telegram bot SDK for message handling
- `drizzle-orm`: PostgreSQL ORM for database operations
- `express-session` + `connect-pg-simple`: Session management with PostgreSQL session store
- `@tanstack/react-query`: Server state synchronization
- `zod` + `drizzle-zod`: Runtime validation with schema generation

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string (automatically provided by Replit)
- `TELEGRAM_BOT_TOKEN`: Telegram bot token (optional, for bot functionality)
- `SESSION_SECRET`: Session encryption key (at least 32 characters for userbot feature)

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal`: Development error overlay
- `@replit/vite-plugin-cartographer`: Development tooling
- Dynamic URL detection using `REPLIT_DEV_DOMAIN` and `REPL_SLUG` environment variables