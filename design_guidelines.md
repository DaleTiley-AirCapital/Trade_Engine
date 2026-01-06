# Design Guidelines: Crypto Trading Bot Dashboard

## Design Approach

**Selected Approach**: Design System – Tailwind CSS + shadcn/ui component patterns

**Justification**: This is a data-dense, operations-focused dashboard requiring clarity, consistency, and rapid comprehension. The system prioritizes information hierarchy, scannable metrics, and reliable interaction patterns over visual creativity.

**Key Design Principles**:
- Information clarity over decoration
- Scannable metrics at a glance  
- Immediate status recognition
- Minimal cognitive load for daily checks

---

## Typography

**Font Family**: Inter (Google Fonts)
- Primary: Inter (400, 500, 600, 700)

**Hierarchy**:
- Page Titles: text-2xl font-semibold (24px)
- Section Headers: text-lg font-semibold (18px)
- Subsection Headers: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Labels/Meta: text-xs font-medium uppercase tracking-wide (12px)
- Metric Values: text-3xl font-bold (30px) for key numbers
- Table Content: text-sm (14px)

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20**
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Card spacing: p-6
- Grid gaps: gap-4, gap-6
- Page margins: px-6 py-8 (mobile), px-8 py-12 (desktop)

**Container Strategy**:
- Max width: max-w-7xl mx-auto
- Dashboard grid: 12-column system
- Responsive breakpoints: sm, md, lg, xl

---

## Component Library

### Navigation
**Top Bar** (sticky):
- Logo + Bot name (left)
- Status indicator pill (center-left)
- User menu + Emergency Flatten button (right)
- Height: h-16, border-b

**Sidebar** (desktop only, lg:block):
- Width: w-64, fixed
- Navigation items with icons (left-aligned)
- Active state: border-l-4 + background fill
- Padding: p-4 per item

### Status Indicators

**Bot Status Badge**:
- Large pill format: px-6 py-2 rounded-full
- States: RUNNING (success), PAUSED (warning), ERROR (destructive)
- Position: Prominent in header and Overview page

**Metric Cards**:
- Grid layout: grid-cols-2 md:grid-cols-4 gap-4
- Card structure: border rounded-lg p-6
- Label (top): text-xs uppercase tracking-wide
- Value (large): text-3xl font-bold
- Change indicator (bottom): text-sm with trend arrow
- Height: min-h-[120px]

### Data Tables

**Trade History Table**:
- Striped rows for readability
- Sticky header: sticky top-0
- Row hover state
- Cell padding: px-4 py-3
- Compact mode: text-sm
- Action column (right-aligned) for details/expand
- Pagination footer: justify-between items-center p-4

**Column Widths**:
- Timestamp: 140px
- Symbol: 100px
- Side: 80px
- Entry/Exit: 110px each
- PnL: 100px
- Duration: 90px
- Actions: 60px

### Forms & Configuration

**Config Editor**:
- Two-column layout: lg:grid-cols-2 gap-6
- Grouped sections with border-l-4 accent
- Input groups: space-y-4
- Label-input pairing: space-y-2
- Input fields: h-10 px-3 rounded-md border
- Validation messages: text-sm mt-1
- Action buttons (bottom): justify-end space-x-3

**Range Inputs**: 
- Display current value inline
- Show min/max constraints as text-xs below slider

### Control Panel

**Emergency Controls Card**:
- Elevated prominence: border-2 p-6
- Button layout: flex flex-col space-y-3
- Primary action (Flatten): w-full h-12
- Secondary actions (Pause/Resume): w-full h-10
- Confirmation modals for destructive actions

### Real-time Monitoring

**Signals/Events Feed**:
- Timeline layout with timestamps (left)
- Event cards: border-l-4 pl-4 py-3
- Rejected signals: reduced opacity
- Auto-scroll to latest
- Filter chips at top: flex gap-2

**Logs Viewer**:
- Monospace font for log entries: font-mono text-xs
- Level badges inline: ERROR, WARN, INFO
- Expandable stack traces
- Virtual scrolling for performance
- Sticky search/filter bar

### Checklist View (Daily Workflow)

**Health Checklist Card**:
- List format: space-y-3
- Each item: flex justify-between items-center
- Checkbox icons (left)
- Item label + subtext
- Status indicator (right): badge or icon
- Overall progress bar at top

---

## Layout Specifications

### Overview Page
- Status header: full-width, h-20
- Metric grid: 4 columns (2 on mobile)
- Open position card: full-width if exists
- Risk limits progress bars: 2-column grid
- Recent activity feed: right sidebar on xl

### Trades Page
- Filter bar: sticky top-16, h-14
- Table: full-width with horizontal scroll
- Summary stats: top-right of table header

### Config Page
- Form sections in card containers
- Version history sidebar: w-80 on xl
- Publish button: fixed bottom-right on scroll

### Logs Page  
- Full-height scrollable area
- Filters: sticky top bar
- Timestamps: w-32 fixed column

---

## Responsive Behavior

**Mobile** (< 768px):
- Hide sidebar, use hamburger menu
- Stack metric cards: 2 columns
- Tables: horizontal scroll with sticky first column
- Controls: full-width buttons

**Tablet** (768px - 1024px):
- Collapsible sidebar
- 2-3 column metric grids
- Comfortable table spacing

**Desktop** (> 1024px):
- Fixed sidebar navigation
- Full 4-column metric layouts
- Side-by-side config/version panels

---

## Animations

**Minimal Motion**:
- Status badge transitions: transition-colors duration-200
- Hover states: transition-all duration-150
- Page transitions: None (instant navigation)
- Live metric updates: animate-pulse on change (once, 1s)

Avoid scroll-triggered animations, carousels, or decorative motion.