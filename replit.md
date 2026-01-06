# Trading Bot Dashboard

## Overview
A real-time monitoring dashboard for an automated crypto trading bot that executes post-liquidation reversion strategies on Binance Futures. The dashboard provides comprehensive visibility into bot status, trades, market signals, configuration, and controls.

## Current State
- **Status**: MVP Complete
- **Mode**: Paper Trading (simulated)
- **Features**: All core dashboard functionality implemented

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite
- **Routing**: Wouter
- **State Management**: TanStack Query v5
- **UI Components**: shadcn/ui with Tailwind CSS
- **Theme**: Dark/Light mode support with Inter font

### Backend (Express + TypeScript)
- **Server**: Express.js
- **Storage**: In-memory (MemStorage) with sample data
- **API**: RESTful endpoints for all dashboard operations

### Data Models (shared/schema.ts)
- `BotState`: Bot status, heartbeat, trading mode
- `Metrics`: Equity, PnL, trade counts, win rate
- `Trade`: Trade history with entry/exit details
- `MarketEvent`: Liquidation signals and detection
- `Config`: Strategy parameters and risk settings
- `LogEntry`: System logs with levels

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

## API Endpoints

### GET Endpoints
- `/api/health` - System health status
- `/api/state` - Bot state
- `/api/overview` - Combined dashboard data
- `/api/metrics/today` - Today's metrics
- `/api/trades` - Trade history (with filters)
- `/api/events` - Market events (with filters)
- `/api/logs` - System logs (with filters)
- `/api/config/current` - Current configuration

### POST Endpoints
- `/api/config/publish` - Update configuration
- `/api/control/pause` - Pause trading
- `/api/control/resume` - Resume trading
- `/api/control/flatten` - Emergency flatten

## Design System
- **Font**: Inter for UI, JetBrains Mono for code/logs
- **Colors**: Custom success/warning colors for status
- **Components**: shadcn/ui with consistent spacing
- **Theme**: Dark mode default with light mode support

## Development

### Running the App
```bash
npm run dev
```

### File Structure
```
client/src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── hooks/         # Custom hooks
├── lib/           # Utilities
server/
├── routes.ts      # API endpoints
├── storage.ts     # In-memory storage
shared/
├── schema.ts      # Type definitions
```

## Future Enhancements
- Real Binance API integration
- PostgreSQL persistence
- WebSocket for real-time updates
- Authentication (JWT-based)
- Telegram/Slack notifications
- Paper trading validation (14-day requirement)
