# Design Guidelines: Telegram Bot Admin Panel

## Design Approach

**Selected Approach:** Design System - Material Design / Linear-inspired
**Justification:** This is a utility-focused admin panel requiring efficiency, clarity, and data-dense displays. Drawing from Material Design's robust component library with Linear's clean aesthetic for modern dashboard experiences.

**Key Design Principles:**
- Clarity over decoration - information hierarchy is paramount
- Efficient data scanning with clear visual grouping
- Minimal cognitive load for monitoring tasks
- Professional, trustworthy interface for admin functions

## Typography

**Font Family:** 
- Primary: Inter (Google Fonts) for UI text and data
- Monospace: JetBrains Mono for bot commands, IDs, and technical data

**Hierarchy:**
- Page Titles: text-3xl font-semibold (tracking-tight)
- Section Headers: text-xl font-semibold
- Card/Component Titles: text-lg font-medium
- Body Text: text-sm font-normal
- Labels/Metadata: text-xs font-medium uppercase tracking-wide
- Technical Data: text-sm font-mono

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-6 for cards, p-4 for compact elements
- Section spacing: space-y-6 between major sections, space-y-4 within groups
- Page margins: px-6 py-8 for main content areas
- Grid gaps: gap-6 for primary grids, gap-4 for compact lists

**Grid Structure:**
- Sidebar navigation: Fixed 64-unit width (w-64)
- Main content: Fluid with max-w-7xl container
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Tables/Lists: Full-width within container

## Component Library

### Navigation
**Sidebar Navigation:**
- Fixed left sidebar with logo at top
- Navigation items with icons (Heroicons) and labels
- Active state: Strong visual indicator with subtle accent
- Sections: Dashboard, Group Joins, Bot Settings, Account

### Dashboard Components
**Stat Cards:**
- Prominent number display with icon
- Supporting label and trend indicator
- Compact 3-column grid layout
- Stats: Active Groups, Pending Joins, Verified Today

**Activity Feed:**
- Chronological list with timestamps
- Icon indicators for different event types (join, verify, error)
- Truncated group names with expand option
- Real-time updates badge

**Group Join Table:**
- Columns: Group Name, Link, Status, Joined Date, Actions
- Status badges: Pending (amber), Joined (blue), Verified (green), Failed (red)
- Sortable headers
- Action buttons: View Details, Retry

### Authentication
**Login Page:**
- Centered card layout (max-w-md)
- Telegram logo/branding
- Telegram Login Widget integration
- Brief explanation text
- Clean, focused single-purpose design

### Forms & Inputs
**Bot Configuration:**
- Label-above-input pattern
- Input fields: border with focus ring
- Helper text below inputs
- Toggle switches for enable/disable features
- Save/Cancel action buttons

### Status Indicators
**Bot Status Badge:**
- Prominent placement in header
- Green dot + "Active" or Red dot + "Inactive"
- Last activity timestamp

**Notification System:**
- Toast notifications for real-time events
- Fixed top-right positioning
- Auto-dismiss after 5 seconds
- Icon + message + close button

## Images

**No Large Hero Image Required** - This is a functional admin panel, not a marketing site.

**Visual Elements:**
- Telegram logo: Login page and header navigation
- Empty state illustrations: When no groups are tracked yet (use placeholder comment for custom SVG or illustration)
- Status icons: Throughout dashboard for visual scanning (use Heroicons)
- Avatar placeholders: For linked Telegram account in header

**Image Specifications:**
- Telegram logo: 40x40px in header, 80x80px on login page
- Empty state illustration: max-w-md, centered in empty table/list areas
- Icons: Standard 20x20px for navigation, 16x16px inline with text

## Page-Specific Layouts

**Login Page:**
- Centered vertical layout
- Card with shadow and rounded corners (rounded-xl shadow-lg)
- Telegram branding at top
- Login widget centered
- Footer with privacy/terms links

**Dashboard:**
- Full-height layout with sidebar
- Top stats row (3 stat cards)
- Activity feed and quick actions below stats
- Recent group joins table at bottom

**Group Joins Page:**
- Full-width table as primary element
- Filter/search bar above table
- Pagination at bottom
- Bulk action toolbar when items selected

**Bot Settings:**
- Two-column form layout on desktop, stacked on mobile
- Grouped settings with section headers
- Inline help text for complex options
- Sticky save bar at bottom when changes detected

## Accessibility
- All interactive elements have keyboard navigation
- Focus visible indicators on all inputs and buttons
- ARIA labels for icon-only buttons
- Color never used as only indicator (pair with icons/text)
- Sufficient contrast ratios for all text