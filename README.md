# BORO AI — Premium Football Prediction App

> Pixel-faithful React Native + Expo implementation of the BORO AI design system.
> Real API-Football data, on-device AI prediction engine, glassmorphic dark UI, neon-green accent.

![BORO AI](./assets/images/logo.png)

---

## Features

- **5 production screens** matching the original HTML designs 1:1 (Intro / Predictor / Live / Stats / Match Detail) plus Leagues, Profile, Settings, and AI Insights.
- **Real football data** via API-Football (live scores, lineups, statistics, standings, H2H).
- **On-device AI prediction engine** combining ELO + form + xG + momentum + Poisson goal model.
- **Local-only authentication** (sign up / log in via AsyncStorage + SHA-256, zero backend).
- **Glassmorphism** with `expo-blur`, animated momentum bars and ambient orbs via Reanimated 3.
- **Smart caching** with React Query + AsyncStorage persistor (offline-tolerant).
- **API quota tracker** so you stay within the free 100 req/day limit.
- **Haptics, skeletons, error states, pull-to-refresh, search, filters** — full polish.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Expo SDK 51 + React Native 0.74 |
| Language | TypeScript (strict mode) |
| Navigation | Expo Router v3 (file-based, typed routes) |
| Styling | NativeWind v4 + custom theme tokens |
| Server state | TanStack Query v5 with AsyncStorage persistor |
| Client state | Zustand |
| Animations | Reanimated 3 |
| Storage | AsyncStorage + expo-secure-store |
| HTTP | Axios with interceptors (quota guard + retry) |
| Charts | react-native-svg (probability rings, xG sparkline, momentum bars) |
| Fonts | Hanken Grotesk + Inter (via `@expo-google-fonts`) |
| Icons | `@expo/vector-icons` (MaterialIcons) |

---

## 1. Prerequisites

Install once on your machine:

- **Node.js 18+** — https://nodejs.org
- **Git** — https://git-scm.com
- **Expo Go** on your Android/iOS phone — https://expo.dev/go
- **(Optional) Android Studio** if you want an emulator or local APK builds

---

## 2. Install dependencies

```bash
cd c:\Users\boxxt\Pictures\BORO
npm install
```

> If you hit peer-dep warnings, re-run with `npm install --legacy-peer-deps`.

---

## 3. Configure your API key

BORO AI uses the free tier of **API-Football** (100 requests/day, no credit card).

1. Sign up at https://www.api-football.com/ and copy your `x-apisports-key`.
2. Create `.env` in the project root:

```bash
cp .env.example .env
```

3. Open `.env` and paste your key:

```env
EXPO_PUBLIC_API_FOOTBALL_KEY=your_real_key_here
```

The app will boot without a key (you'll see a setup card on the home tab), but no fixtures or AI predictions will load until the key is set.

---

## 4. Run on your phone with Expo Go

```bash
npm run start
```

- Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS).
- The app installs on your phone via the Expo Go runtime — no Xcode/Android Studio required.
- Press `r` in the terminal to reload, `j` to open the JS debugger.

### Run on emulator

```bash
npm run android   # Android Studio emulator
npm run ios       # macOS only, requires Xcode
```

---

## 5. Build an Android APK (preview build)

For a real `.apk` you can sideload to any Android device:

```bash
# One-time setup
npm install -g eas-cli
eas login                 # use your Expo account (free)
eas build:configure       # accepts defaults from eas.json

# Build
npm run build:android:preview
```

The build runs in EAS cloud and outputs a downloadable `.apk` URL when done (~10-20 min). Click the link, install on your phone via "Install from unknown sources".

---

## 6. Publish to Google Play Store

### Build a signed AAB

```bash
npm run build:android:production
```

This produces a Play-Store-ready `.aab` (Android App Bundle).

### Create the Play Console listing

1. Sign up for a Google Play developer account (one-time $25): https://play.google.com/console
2. Create a new app:
   - **App name**: BORO AI
   - **Default language**: English
   - **App / Game**: App
   - **Free / Paid**: Free
3. Complete the required sections:
   - **App access** → All functionality available without restrictions
   - **Ads** → No
   - **Content rating** → Sports / Information (no gambling content, picks are entertainment only)
   - **Target audience** → 18+
   - **News app** → No
   - **Data safety** → Collects email + name locally (no third-party sharing), encrypted in transit
   - **Privacy policy** → Required (host a simple page, e.g. on Notion or GitHub Pages)

### Upload + release

```bash
eas submit -p android       # uploads the AAB to your Play Console internal track
```

Then in Play Console:
- Promote internal → closed testing → open testing → production as you finish QA.
- Add at least **2 phone screenshots**, a **512×512 icon** (already generated from `logo.png`), and a **1024×500 feature graphic**.

### OTA updates after launch

```bash
eas update --branch production --message "Hotfix: fixture timezone bug"
```

JS changes ship to users without a new Play Store submission.

---

## Project structure

```
app/                       expo-router routes
├── _layout.tsx            providers (Query, fonts, safe area, gesture handler)
├── index.tsx              session gate (auth vs tabs)
├── +not-found.tsx
├── (auth)/                intro / login / signup
├── (tabs)/                Predictor / Live / Leagues / Stats / Profile
├── match/[id].tsx         match detail
├── insights.tsx           AI insights discovery
└── settings.tsx

src/
├── components/
│   ├── ui/                GlassCard, NeonButton, AmbientOrb, ProbabilityRing,
│   │                      MomentumBars, LivePulse, SearchBar, Chip, ConfidenceBadge,
│   │                      Skeleton, TeamCrest
│   ├── layouts/           TopBar, ScreenContainer
│   ├── match/             BestPickCard, MatchListItem, LiveScoreHero,
│   │                      AIInsightCard, StatComparison, QuickBetSlip, MatchTimeline
│   └── stats/             MomentumIndexCard, XgEloBento, StandingsTable
├── services/
│   ├── api/               client.ts (quota guard) + apiFootball.ts + sportsdb.ts
│   ├── ai/                elo.ts + form.ts + poisson.ts + momentum.ts + predictor.ts
│   ├── auth/              localAuth.ts (SHA-256 + per-user salt)
│   └── storage/           favorites.ts + settings.ts
├── hooks/                 useFixtures, usePrediction, useHaptics
├── store/                 Zustand stores (auth, settings, favorites)
├── theme/                 colors, typography, spacing tokens
├── constants/             config (env), leagues
├── types/                 match, team, league, prediction, user
└── utils/                 date, format
```

---

## AI Prediction Engine

For every fixture, `predictFixture()` produces:

```ts
{
  homeWinPct: 56.2,
  drawPct: 23.4,
  awayWinPct: 20.4,
  predictedScore: { home: 2, away: 1 },
  bttsPct: 61.5,
  over25Pct: 64.0,
  under25Pct: 36.0,
  confidence: 'HIGH',
  topPick: { market: 'WIN', selection: 'Arsenal to Win', probability: 56.2, odds: 1.78 },
  reasoning: [
    'Arsenal on a 3-match win streak at home.',
    'ELO gap of +124 favors Arsenal.',
    'Expected goal total 2.85 — Over 2.5 strong.',
  ],
  metrics: { homeElo: 1742, awayElo: 1618, homeForm: 0.78, awayForm: 0.42, homeXg: 1.85, awayXg: 1.00, homeAdvantage: 0.25 }
}
```

Pipeline:

1. **ELO** — `computeEloFromHistory()` walks every finished fixture in both teams' last 10 matches, k-factor=20, +100 home bonus, goal-diff multiplier.
2. **Form** — weighted score across last 5 matches with recency decay `[1.0, 0.85, 0.7, 0.55, 0.4]`.
3. **xG / goal averages** — pulled from API-Football team statistics, falls back to historical averages.
4. **Poisson scoreline matrix** — `computeMatchProbabilities(λ_home, λ_away)` with home advantage of +0.25 goals, generates W/D/L + BTTS + Over 2.5 + most likely score.
5. **H2H bias** — last 5 head-to-heads add a ±2% nudge per result.
6. **Form boost** — `(form - 0.5) * 0.08` widens decisive games.
7. **Logistic fusion** — Poisson 55% + ELO 35% + form/H2H 10%, normalized.
8. **Confidence tier** — ELITE / HIGH / MEDIUM / LOW based on top probability + margin + data freshness.

Live matches also use `computeMomentumWindows()` to bucket events into 5-min windows for the bar chart, and `computePressureSwing()` for the headline "+24% Pressure" metric.

---

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_FOOTBALL_KEY` | _(required)_ | Your `x-apisports-key` |
| `EXPO_PUBLIC_API_FOOTBALL_HOST` | `v3.football.api-sports.io` | Override for RapidAPI host |
| `EXPO_PUBLIC_SPORTSDB_KEY` | `3` | TheSportsDB (free, no signup) |
| `EXPO_PUBLIC_DEFAULT_SEASON` | `2024` | Default season for standings/stats |
| `EXPO_PUBLIC_LIVE_REFRESH_MS` | `15000` | Live fixture polling interval |
| `EXPO_PUBLIC_FIXTURES_REFRESH_MS` | `300000` | Today's fixtures polling interval |

---

## Troubleshooting

**Blank screen on launch**
- Make sure `npm install` finished without errors.
- Delete `node_modules` and `.expo` directories, re-install.

**"API key missing" banner**
- Confirm `.env` exists in the project root with `EXPO_PUBLIC_API_FOOTBALL_KEY`.
- Restart `npm run start` — env vars are read at boot.

**Quota exceeded**
- Free tier caps at 100 requests/day. The Settings tab shows your current usage.
- Cache persists across restarts, so re-opening the app re-uses data without burning quota.

**Reanimated babel error**
- `react-native-reanimated/plugin` **must be the last** plugin in `babel.config.js` (it already is).
- Clear Metro cache: `npx expo start --clear`.

---

## License

MIT — for personal & educational use.

## Disclaimer

AI predictions are statistical estimates for entertainment only. **No real-money betting integration is included.** Please gamble responsibly if you choose to act on any output.
