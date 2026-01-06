# Trading Bot Dashboard

## Overview
A real-time monitoring dashboard for an automated crypto trading bot that executes post-liquidation reversion strategies on Binance Futures. The dashboard connects to a PostgreSQL database that is shared with the trading bot on Railway.

## Architecture

```
Railway (Trading Bot)                Replit (Dashboard)
┌─────────────────────┐              ┌─────────────────────┐
│  Trading Bot        │              │  Dashboard Frontend │
│  - Binance WS       │              │  - React + Vite     │
│  - Trade Execution  │─────────────▶│  - Real-time UI     │
│  - Signal Detection │   PostgreSQL │  - Monitoring       │
└─────────────────────┘      ▲       └─────────────────────┘
                             │
                    Railway PostgreSQL
                    (Shared Database)
```

**Current Setup:**
- **Replit**: Frontend dashboard only (reads from database)
- **Railway**: Trading bot + PostgreSQL database (writes to database)

## Connecting to Railway PostgreSQL

To connect this dashboard to your Railway database:
1. Get the PostgreSQL connection string from Railway dashboard
2. Go to Replit Secrets tab
3. Update `DATABASE_URL` with the Railway PostgreSQL connection string
4. The dashboard will automatically read data from Railway's database

## Pages

### Overview (/)
- Bot status badge (Running/Paused/Error)
- Key metrics: Equity, Today PnL, Trades, Win Rate
- Open position card (if any)
- Risk limits progress bars
- Daily health checklist

### Trades (/trades)
- Trade history table with filters
- Symbol, Side, Exit Reason filters
- Pagination support
- Win/Loss visualization

### Signals (/signals)
- Market event feed (liquidation spikes)
- Pass/Reject status for each signal
- Filter by symbol and status

### Config (/config)
- Risk Management: Leverage, risk per trade, daily loss
- Execution: Take profit, stop loss, time stop
- Signal Detection: Liquidation window, volume multiplier
- Feature Flags: Enable SOL, momentum variant

### Logs (/logs)
- System log viewer
- Filter by level (INFO/WARN/ERROR)
- Expandable details for errors

### Controls (/controls)
- Pause/Resume trading
- Emergency flatten (close all positions)
- System health check

## Database Tables

The dashboard reads from these tables (created by the bot):
- `bot_states`: Bot status, heartbeat, trading mode
- `metrics`: Equity, PnL, trade counts, win rate
- `trades`: Complete trade history
- `market_events`: Liquidation signals
- `log_entries`: System logs
- `configs`: Strategy configuration
- `health_checks`: Connection status

## Bot Code Location

The trading bot code is in the `railway-bot/` folder. Copy this to a separate GitHub repository and deploy to Railway.

## Development

### Running the Dashboard
```bash
npm run dev
```

### File Structure
```
client/src/
├── components/     # UI components
├── pages/         # Page components
├── hooks/         # Custom hooks
├── lib/           # Utilities
server/
├── routes.ts      # API endpoints
├── storage.ts     # Database storage
├── db.ts          # Database connection
shared/
├── schema.ts      # Drizzle schema
railway-bot/       # Bot code for Railway deployment
```

## Design System
- **Font**: Inter for UI, JetBrains Mono for code/logs
- **Theme**: Dark mode default with light mode support
- **Components**: shadcn/ui with Tailwind CSS
