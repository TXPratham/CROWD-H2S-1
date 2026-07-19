# 🏟️ Stadium — Real-Time Stadium Monitoring & AI Operations Dashboard

A dual-interface stadium monitoring system combining a **2D operational dashboard** and a **3D architectural blueprint** to provide real-time waste management, crowd analytics, and AI-powered operational recommendations.

![Stadium](https://img.shields.io/badge/Platform-Web-blue) ![Firebase](https://img.shields.io/badge/Backend-Firebase_RTDB-orange) ![Three.js](https://img.shields.io/badge/3D-Three.js-green) ![AI](https://img.shields.io/badge/AI-Local_Reasoning-purple)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Firebase Configuration](#firebase-configuration)
- [Deployment](#deployment)
- [Data Pipeline](#data-pipeline)
- [AI Reasoning Engine](#ai-reasoning-engine)
- [Cross-Window Synchronization](#cross-window-synchronization)
- [License](#license)

---

## Overview

**Stadium** is a comprehensive real-time monitoring platform designed for large venue management. It provides two synchronized views:

| Interface | File | Description |
|-----------|------|-------------|
| **2D Dashboard** | `dashboard.html` | Operational panels for zones, bins, AI priority feeds, staffing recommendations, and crowd redirects |
| **3D Blueprint** | `index.html` | Interactive Three.js architectural model with fly-to navigation, color-coded telemetry, and an AI recommendations overlay |

Both interfaces share a **single source of truth** via Firebase Realtime Database, and selections made in one view are automatically reflected in the other through `BroadcastChannel` synchronization.

---

## Features

### 🗺️ Live Zone Monitoring
- **4 zones** — North, South, East, West — displayed as a stadium map (2D) and explorable 3D stands
- Real-time occupancy tracking with color-coded thresholds:
  - 🟢 **Green** — Normal (< 75%)
  - 🟡 **Amber** — High (75–90%)
  - 🔴 **Red** — Critical (> 90%)

### 🗑️ Waste Bin Telemetry
- 6 smart waste bins (BIN-E1, BIN-E2, BIN-W1, BIN-W2, BIN-N1, BIN-S1)
- Live fill-level tracking with auto-empty cycle at 100%
- Sustainability score integration from CSV dataset

### 🤖 AI Reasoning Engine
- **Fully local/deterministic** — no external API dependencies
- Two-stage pipeline:
  1. **Bin-Priority Analysis** — urgency scoring, risk classification (CRITICAL/HIGH/LOW)
  2. **Staffing Recommendations** — idle staff reassignment + crowd redirect generation
- Triggered by:
  - Threshold crossings (>80% bin fill, >90% zone occupancy)
  - Periodic 30-second scans
- Rate-limited with hysteresis to prevent alert spam

### 🔗 Cross-Window Sync
- Click a zone or bin in either interface → the other interface highlights and navigates to the same element
- Uses `BroadcastChannel('stadium_sync')` for zero-latency tab-to-tab communication

### 🏗️ 3D Architectural Blueprint
- Three.js rendered stadium with transparent wireframe aesthetic
- 3-tier seating bowl, roof trusses, corner sections, pitch markings
- Raycaster-based bin clicking with animated selection states
- Smooth camera interpolation (fly-to) on zone/bin selection
- Dynamic scanning particles for visual effect

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Firebase RTDB                   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐│
│  │ bins/    │ │ zones/   │ │ ai_recommendations││
│  └────┬─────┘ └────┬─────┘ └────────┬──────────┘│
└───────┼────────────┼────────────────┼────────────┘
        │            │                │
   onValue()    onValue()        onValue()
        │            │                │
┌───────┴────────────┴────────────────┴────────────┐
│              index.html (3D Blueprint)           │
│  ┌────────────────┐  ┌─────────────────────────┐ │
│  │ Three.js Scene │  │ Local AI Reasoning      │ │
│  │ + OrbitControls │  │ (Bin Priority +         │ │
│  │ + Raycaster    │  │  Staffing + Redirects)  │ │
│  └────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Synthetic Data Generator (CSV → Firebase)   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────┘
                       │ BroadcastChannel
                       │ ('stadium_sync')
┌──────────────────────┴───────────────────────────┐
│           dashboard.html (2D Dashboard)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Zone Map │ │ Bin List │ │ AI Feed Panels   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML/CSS/JS, Three.js (r128) |
| **3D Engine** | Three.js with OrbitControls |
| **Backend** | Firebase Realtime Database |
| **AI** | Local deterministic reasoning engine (JavaScript) |
| **Data** | CSV dataset (`sports_management_dataset.csv`) |
| **Dev Server** | Vite 8.x |
| **Fonts** | Google Fonts — Rajdhani, Inter |
| **Deployment** | Vercel (static) |

---

## Project Structure

```
CROWD H2S-1/
├── index.html                    # 3D Architectural Blueprint (main entry)
├── dashboard.html                # 2D Operational Dashboard
├── sports_management_dataset.csv # Synthetic telemetry source (17 MB)
├── package.json                  # Node.js config (Vite dev server)
├── firebase.json                 # Firebase project config
├── database.rules.json           # Firebase RTDB security rules
├── .firebaserc                   # Firebase project alias
├── .env                          # Environment variables (gitignored)
├── .gitignore
├── bin_schema.json               # JSON schema for bin data
├── zone_schema.json              # JSON schema for zone data
├── bins_data.json                # Sample bin data export
├── zones_data.json               # Sample zone data export
├── bins_data.csv                 # Bin data in CSV format
├── zones_data.csv                # Zone data in CSV format
├── extract_waste.py              # Python utility for data extraction
├── fifa_crowd_data.json          # FIFA 2026 crowd analytics data
├── fifa_2026_host_cities.csv     # FIFA host city reference
├── fifa_2026_matches.csv         # FIFA match schedule reference
├── functions/                    # Firebase Cloud Functions
├── dist/                         # Vite build output (gitignored)
└── node_modules/                 # Dependencies (gitignored)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A Firebase project with Realtime Database enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/TXPratham/CROWD-H2S-1.git
cd CROWD-H2S-1

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Vite dev server
npm run dev
```

This will start a local server (typically at `http://localhost:5173/`):
- **3D Blueprint**: `http://localhost:5173/index.html`
- **2D Dashboard**: `http://localhost:5173/dashboard.html`

> **Note**: The default landing page (`/`) serves `index.html` (the 3D Blueprint). Use the navigation links in the header to switch between views.

---

## Firebase Configuration

The app connects to a Firebase Realtime Database. The configuration is embedded in both HTML files:

```javascript
const firebaseConfig = {
    projectId: "d-e-s-fbaf2",
    databaseURL: "https://d-e-s-fbaf2-default-rtdb.firebaseio.com",
    apiKey: "AIzaSyD29Go8AeD5CsEaLmYfkJP2X5MHhck504A",
    // ... other fields
};
```

### Database Structure

```
stadium_data/
├── bins/
│   ├── BIN-E1    { bin_id, zone, fill_level, timestamp, sustainability_score }
│   ├── BIN-E2
│   ├── BIN-W1
│   ├── BIN-W2
│   ├── BIN-N1
│   └── BIN-S1
├── zones/
│   ├── East      { zone_id, occupancy, capacity, timestamp, sustainability_score }
│   ├── West
│   ├── North
│   └── South
└── ai_recommendations/
    ├── timestamp
    ├── trigger
    ├── bin_priority   { risk_level, priority_order[], summary }
    └── staffing       { reassignments[], crowd_redirects[], summary }
```

### Security Rules

Current rules (development mode — open read/write for authenticated users):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ **Production**: Tighten these rules before going live.

---

## Deployment

### Vercel (Recommended)

The project deploys as a **static site** to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deploy
vercel --prod
```

The project root is deployed directly — Vercel serves the HTML files as static assets.

### Firebase Hosting (Alternative)

```bash
# Add hosting config to firebase.json, then:
firebase deploy --only hosting
```

---

## Data Pipeline

### Synthetic Data Generator

The 3D Blueprint (`index.html`) runs a synthetic data loop that processes `sports_management_dataset.csv`:

1. **Every 2.5 seconds**, reads the next row from the CSV
2. Extracts `Waste Generation` (Low/Moderate/High) and `Community Engagement` levels
3. Applies waste factors to bin fill levels and crowd factors to zone occupancy
4. Pushes updated data to Firebase via `update()`
5. UI updates reactively via `onValue()` listeners

```
CSV Row → Waste/Crowd Factors → dataState Update → Firebase Write → onValue Listener → UI Render
```

### Data Schemas

**Bin Data** (`bin_schema.json`):
```json
{
  "bin_id": "BIN-E1",
  "zone": "East",
  "fill_level": 72.5,
  "timestamp": "2026-07-19T16:00:00.000Z",
  "sustainability_score": "Moderate"
}
```

**Zone Data** (`zone_schema.json`):
```json
{
  "zone_id": "North",
  "occupancy": 8500,
  "capacity": 10000,
  "timestamp": "2026-07-19T16:00:00.000Z",
  "sustainability_score": "High"
}
```

---

## AI Reasoning Engine

The AI pipeline runs **entirely locally** in JavaScript (no external API calls):

### Stage 1: Bin-Priority Analysis

```
For each bin:
  urgency_score = fill_level + (zone_occupancy_pct × 0.3)
  
  if fill_level ≥ 80% → CRITICAL
  if fill_level ≥ 50% → WARNING
  else               → NORMAL

Overall risk = CRITICAL if any bin critical, else HIGH if warnings, else LOW
```

### Stage 2: Staffing Recommendations

```
1. Identify idle staff from the roster
2. Match idle staff to critical/warning bins (nearest available)
3. Generate reassignment orders with reasoning text
4. Detect zones at ≥90% capacity → generate crowd redirect advisories
```

### Trigger Conditions

| Trigger | Condition | Cooldown |
|---------|-----------|----------|
| Threshold crossing | Bin ≥ 80% fill OR zone ≥ 90% capacity | 30s min interval |
| Hysteresis reset | Bin drops below 75% / zone below 85% | — |
| Periodic scan | Every 30 seconds if any bin ≥ 50% or zone ≥ 75% | 30s |

### Output

Results are written to `stadium_data/ai_recommendations` in Firebase, making them available to both interfaces simultaneously.

---

## Cross-Window Synchronization

The two interfaces communicate via the `BroadcastChannel` API:

```javascript
const syncChannel = new BroadcastChannel('stadium_sync');

// Sending
syncChannel.postMessage({ action: 'select', itemType: 'zone', id: 'North' });

// Receiving
syncChannel.addEventListener('message', (event) => {
    const { action, itemType, id } = event.data;
    // Handle selection/deselection
});
```

### Sync Behaviors

| Action in 2D Dashboard | Effect in 3D Blueprint |
|------------------------|----------------------|
| Click zone on map | Camera flies to corresponding stand |
| Click bin in list | Camera flies to bin, info panel shows |
| Click AI feed item | Highlights related zone/bin |

| Action in 3D Blueprint | Effect in 2D Dashboard |
|------------------------|----------------------|
| Click bin in 3D | Bin highlighted in lists |
| Click zone data item | Zone highlighted on map |

---

## License

ISC

---

<p align="center">
  <strong>Stadium</strong> — Real-Time Venue Intelligence<br>
  Built with 🏟️ Three.js · Firebase · Local AI
</p>
