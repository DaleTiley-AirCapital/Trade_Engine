# Liquidation Reversion Trading Bot

Post-liquidation reversion trading bot for Binance Futures. Designed for minimal latency and fast execution.

## Architecture

```
Railway (This Bot)                    Replit (Dashboard)
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

## Features

- **Real-time liquidation detection** via Binance WebSocket
- **Fast market order execution** (<100ms latency target)
- **Risk management**: Daily loss limits, consecutive loss limits
- **Automatic TP/SL/Time-stop** exit conditions
- **Volume confirmation** with configurable multipliers
- **Spread filtering** to avoid high-slippage entries
- **Symbol cooldowns** to prevent overtrading

## Setup on Railway

### 1. Create Railway Project

1. Go to [railway.com](https://railway.com)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select this repository
4. Railway will auto-detect and build the project

### 2. Add PostgreSQL Database

1. In your Railway project, click "Add Service"
2. Select "Database" → "PostgreSQL"
3. Railway automatically creates `DATABASE_URL` environment variable

### 3. Configure Environment Variables

In Railway dashboard → Variables tab, add:

```
DATABASE_URL=<auto-provided by Railway PostgreSQL>
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
TRADING_MODE=paper  # or "live" for real trading
```

### 4. Get Binance API Keys

1. Log in to [Binance Futures](https://www.binance.com/en/futures)
2. Go to API Management
3. Create new API key with:
   - Enable Futures trading
   - Restrict to IP if possible (recommended)
   - For paper trading, use Testnet keys from https://testnet.binancefuture.com

### 5. Push Database Schema

Railway will run `npm run build && npm start` on deploy.

To push the schema manually:
```bash
npm run db:push
```

### 6. Connect Replit Dashboard

In your Replit dashboard project:
1. Go to Secrets/Environment Variables
2. Replace `DATABASE_URL` with your Railway PostgreSQL connection string
3. The dashboard will now read data from the same database the bot writes to

## Trading Strategy

### Entry Conditions
1. Large liquidation detected (>$2.5M for BTC, >$1.25M for ETH)
2. Volume spike confirms (2x+ normal volume)
3. Spread within limits (<4bps)
4. Symbol not in cooldown
5. Daily limits not exceeded

### Exit Conditions
- **Take Profit**: 0.35% profit target
- **Stop Loss**: 0.45% maximum loss
- **Time Stop**: 150 seconds maximum hold

### Risk Management
- 0.25% of equity risked per trade
- Maximum 1.5% daily loss
- Maximum 3 consecutive losses before pause
- Maximum 10 trades per day

## File Structure

```
railway-bot/
├── src/
│   ├── index.ts              # Main entry point
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   └── schema.ts         # Drizzle schema (matches Replit)
│   ├── services/
│   │   ├── binance-ws.ts     # WebSocket for price/liquidations
│   │   ├── binance-api.ts    # REST API for trading
│   │   └── logger.ts         # Logging to DB
│   └── strategies/
│       └── liquidation-reversion.ts  # Main strategy
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── README.md
```

## Monitoring

The bot writes all data to PostgreSQL:
- **bot_states**: Bot status, heartbeat
- **metrics**: Equity, PnL, trade counts
- **trades**: All trade history
- **market_events**: All liquidation signals
- **log_entries**: System logs
- **configs**: Strategy configuration

View all of this in the Replit dashboard!

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run in development mode
npm run dev
```

## Safety Notes

1. **Start with paper trading** - Set `TRADING_MODE=paper`
2. **Use Testnet first** - Get testnet API keys from Binance Futures Testnet
3. **Set IP restrictions** on your API keys
4. **Never enable withdrawals** on trading API keys
5. **Monitor the dashboard** - Check bot status daily

## Support

Check the Replit dashboard for:
- Real-time bot status
- Trade history and PnL
- Signal detection logs
- Error messages and warnings
