# FiveM Server Tracker

<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet?style=for-the-badge" alt="Built with Claude Code" />
  <img src="https://img.shields.io/badge/Development%20Time-~4%20hours-orange?style=for-the-badge" alt="Dev Time" />
  <img src="https://img.shields.io/badge/Commits-35-green?style=for-the-badge" alt="Commits" />
  <img src="https://img.shields.io/badge/Human%20Interventions-1-red?style=for-the-badge" alt="Human Interventions" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License" />
</p>

<p align="center">
  A real-time tracker that polls <strong>~30,000 FiveM servers</strong> via protobuf stream, stores historical data in SQLite with tiered retention, and serves an analytics web dashboard — built entirely with AI-assisted development in a single session.
</p>

---

## The Experiment

This project is a **demo of AI-assisted programming**. The entire codebase — backend poller, database layer, web frontend, tests — was developed from scratch using AI

| Metric | Value |
|--------|-------|
| First commit | `2026-03-03 22:57` |
| Last commit | `2026-03-04 03:10` |
| Total development time | **~4 hours 13 minutes** |
| Total commits | 35 |
| Source files | 43 |
| Lines of code | ~7,000 |
| Test files | 9 |
| Human interventions | **1** (the initial prompt) |

The only human input was the initial prompt describing the project idea. From there, AI handled the entire development cycle — architecture decisions, implementation, testing, and iteration — autonomously.

From zero to a fully working full-stack application — polling live data from FiveM's master server, storing it with tiered retention, and rendering it in a searchable, filterable web dashboard — in a single evening session.

---

## What It Does

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  FiveM API   │────▸│   Poller     │────▸│   SQLite     │────▸│  Astro Web   │
│  (protobuf)  │     │  (7 stages)  │     │  (3 tiers)   │     │  Dashboard   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Every 15 minutes**, the poller:

1. Opens an HTTP stream to FiveM's master server list
2. Decodes length-prefixed protobuf frames (~30K servers)
3. Sanitizes server names (strips FiveM formatting codes)
4. Applies hysteresis-based online/offline detection
5. Upserts servers and creates snapshots in a single SQLite transaction
6. Rolls up snapshots into hourly and daily aggregates
7. Enforces tiered data retention (7d → 90d → indefinite)

**The web dashboard** provides:

- Server listing with search, filters, and pagination
- Server detail pages with metadata and player history charts
- Category/tag browsing with locale-based region filtering
- Real-time player count trends via tiered historical data

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (ESM) |
| Language | TypeScript (strict mode, `noUncheckedIndexedAccess`) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Protobuf | protobufjs (citizenfx/fivem schema) |
| Frontend | Astro 5 + Preact islands + Tailwind CSS 4 |
| Charts | uPlot |
| Scheduling | node-cron |
| Testing | Vitest |

---

## Challenges

Building this project exposed several interesting engineering challenges that had to be solved within the time constraint:

### 1. Decoding an Undocumented Protobuf Stream

FiveM's master server list is served as a binary protobuf stream with a custom framing protocol — **4-byte little-endian length headers** followed by protobuf payloads. There's no official API documentation. The schema had to be reverse-engineered from the [citizenfx/fivem](https://github.com/citizenfx/fivem) source code, and the frame reader had to handle partial reads, oversized frames, and malformed data gracefully.

### 2. Hysteresis-Based Status Detection

Servers frequently disappear from the master list for a single poll cycle due to transient network issues. A naive approach would cause constant online/offline flapping. The solution was a **hysteresis algorithm**: servers go offline only after 3 consecutive missed polls (45 minutes), but come back online immediately on a single detection. This required tracking per-server miss counters across poll cycles.

### 3. Atomic Writes at Scale

Each poll cycle processes ~30K servers. All database writes (upserts + snapshots) happen inside a **single SQLite transaction** to ensure data consistency. This required careful batching and error handling — a partial write could leave the database in an inconsistent state with snapshots referencing stale server data.

### 4. Tiered Data Retention

Storing a snapshot per server per poll (30K × 96 daily = 2.8M rows/day) would quickly exhaust storage. The solution is a **three-tier retention system**:
- Raw snapshots: 7 days
- Hourly rollups (avg/min/max players): 90 days
- Daily rollups: indefinite

The aggregation pipeline runs after each poll, and the history query layer automatically selects the appropriate tier based on the requested time range.

### 5. Server Name Sanitization

FiveM servers use a custom markup syntax for colored/formatted names: caret codes (`^0`–`^9`), tilde tags (`~tagname~`), and various zero-width Unicode characters. All of these had to be stripped to produce clean, searchable plain text without breaking legitimate Unicode server names (many servers use CJK characters, emoji, etc.).

### 6. Full-Stack in One Session

The most unusual constraint was building the entire stack — from binary protocol parsing to a polished web dashboard — in a single development session. This meant making pragmatic architectural decisions upfront: SQLite over PostgreSQL (zero deployment friction), Astro with Preact islands (minimal JavaScript shipped), and Drizzle ORM (type-safe queries without a heavy abstraction layer).

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/VictorMinemu/FivemServerTracker.git
cd FivemServerTracker
npm install
```

### Configuration

Copy `.env.example` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_FILE_NAME` | `data/fivem-tracker.db` | SQLite database path |
| `FIVEM_STREAM_URL` | *(FiveM default)* | Override master server URL |
| `POLL_INTERVAL_CRON` | `*/15 * * * *` | Poll frequency (cron) |
| `OFFLINE_THRESHOLD` | `3` | Missed polls before offline |

### Running

```bash
# Start the poller (backend)
npm run dev

# Start the web dashboard (separate terminal)
npm run dev:web

# Run tests
npm run test

# Type check
npm run typecheck
```

---

## Project Structure

```
src/
├── poller/          # 7-stage polling pipeline
│   ├── fetcher.ts       # HTTP stream reader
│   ├── decoder.ts       # Protobuf frame decoder
│   ├── sanitizer.ts     # Name cleanup
│   ├── status.ts        # Hysteresis logic
│   └── poller.ts        # Pipeline orchestrator
├── db/
│   ├── schema.ts        # Drizzle table definitions
│   ├── connection.ts    # SQLite setup (WAL mode)
│   └── operations.ts    # CRUD + retention
├── cache/
│   └── server-cache.ts  # In-memory fallback
├── proto/
│   ├── master.proto     # FiveM protobuf schema
│   └── generated/       # pbjs/pbts output
└── types/
    └── server.ts        # DecodedServer, ServerUpsert, etc.

web/
└── src/
    ├── components/      # Astro + Preact islands
    ├── layouts/         # Base HTML layout
    ├── pages/           # File-based routing
    └── lib/             # Query layer + utilities
```

---

## License

ISC

---

<p align="center">
  <em>Built from scratch in ~4 hours as a demonstration of AI-assisted software development.</em>
</p>
