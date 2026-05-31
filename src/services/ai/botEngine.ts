/**
 * BORO chat assistant engine.
 *
 * A lightweight, fully on-device intent engine over the user's real fixture +
 * prediction data. No external LLM — every answer is grounded in the same
 * predictions the rest of the app shows (one source of truth), so the bot can
 * never contradict a card. Bilingual (it/en).
 *
 * Supported intents:
 *   - safest pick / accumulator / value plays
 *   - live now (matches in play)
 *   - a specific team or "TeamA vs TeamB" lookup (fuzzy)
 *   - market-specific: over/under, BTTS, goals
 *   - help, greeting, capabilities
 */
import type { Fixture } from '@/types/match';
import type { PredictionResult } from '@/types/prediction';
import { isLive } from '@/types/match';

export interface BotContext {
  fixtures: Fixture[];
  predict: (f: Fixture) => PredictionResult | null;
  isIt: boolean;
  /** Localize a raw selection string (e.g. "Over 2.5 Goals"). */
  formatSelection: (selection: string) => string;
}

export interface BotReply {
  text: string;
  matches?: Fixture[];
}

interface Scored {
  fixture: Fixture;
  prediction: PredictionResult;
}

const withPredictions = (ctx: BotContext): Scored[] =>
  ctx.fixtures
    .map((f) => ({ fixture: f, prediction: ctx.predict(f) }))
    .filter((x): x is Scored => x.prediction != null);

const odds = (s: Scored) => s.prediction.topPick.odds;
const prob = (s: Scored) => s.prediction.topPick.probability;

/** Normalize a string for fuzzy team-name matching. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

const teamMatchesQuery = (teamName: string, q: string): boolean => {
  const tn = norm(teamName);
  const nq = norm(q);
  if (!tn || !nq) return false;
  if (tn.includes(nq) || nq.includes(tn)) return true;
  // word-level overlap (>=3 chars)
  const tw = tn.split(' ');
  const qw = nq.split(' ').filter((w) => w.length >= 3);
  return qw.some((w) => tw.some((t) => t.includes(w)));
};

const num = (n: number) => Math.round(n);

/** ───────────────────────── intent: safest ───────────────────────── */
const safest = (ctx: BotContext): BotReply => {
  const scored = withPredictions(ctx).sort((a, b) => prob(b) - prob(a));
  if (scored.length === 0) {
    return {
      text: ctx.isIt
        ? 'Sto ancora analizzando le quote di oggi. Riprova tra poco.'
        : "I'm still analyzing today's odds. Try again shortly.",
    };
  }
  const top = scored[0];
  const sel = ctx.formatSelection(top.prediction.topPick.selection);
  const text = ctx.isIt
    ? `🛡️ **Pronostico più sicuro di oggi**\n\n**${top.fixture.teams.home.name} vs ${top.fixture.teams.away.name}**\n${top.fixture.league.name}\n\n• Giocata: **${sel}**\n• Probabilità: **${num(prob(top))}%**\n• Quota: **${odds(top).toFixed(2)}**\n\nTocca la scheda per l'analisi completa.`
    : `🛡️ **Safest pick today**\n\n**${top.fixture.teams.home.name} vs ${top.fixture.teams.away.name}**\n${top.fixture.league.name}\n\n• Play: **${sel}**\n• Probability: **${num(prob(top))}%**\n• Odds: **${odds(top).toFixed(2)}**\n\nTap the card for the full breakdown.`;
  return { text, matches: [top.fixture] };
};

/** ───────────────────────── intent: accumulator ───────────────────────── */
const accumulator = (ctx: BotContext): BotReply => {
  const scored = withPredictions(ctx).sort((a, b) => prob(b) - prob(a)).slice(0, 3);
  if (scored.length < 2) {
    return {
      text: ctx.isIt
        ? 'Servono almeno 2 partite con dati affidabili per una multipla. Aggiungi più campionati nelle impostazioni!'
        : 'I need at least 2 matches with reliable data to build an accumulator. Add more leagues in settings!',
    };
  }
  const total = scored.reduce((a, s) => a * odds(s), 1);
  const avg = scored.reduce((a, s) => a + prob(s), 0) / scored.length;
  const lines = scored
    .map((s) => `• ${s.fixture.teams.home.name} v ${s.fixture.teams.away.name}: **${ctx.formatSelection(s.prediction.topPick.selection)}** (${odds(s).toFixed(2)})`)
    .join('\n');
  const text = ctx.isIt
    ? `🔥 **Multipla consigliata (${scored.length} eventi)**\n\n${lines}\n\n• Quota totale: **${total.toFixed(2)}**\n• Probabilità media: **${num(avg)}%**`
    : `🔥 **Recommended accumulator (${scored.length}-fold)**\n\n${lines}\n\n• Total odds: **${total.toFixed(2)}**\n• Avg probability: **${num(avg)}%**`;
  return { text, matches: scored.map((s) => s.fixture) };
};

/** ───────────────────────── intent: value ───────────────────────── */
const value = (ctx: BotContext): BotReply => {
  // Prefer real model-vs-market value bets when present, else mid-prob/high-odds.
  const scored = withPredictions(ctx);
  const withEdge = scored
    .filter((s) => (s.prediction.valueBets?.length ?? 0) > 0)
    .sort((a, b) => (b.prediction.valueBets![0].edge) - (a.prediction.valueBets![0].edge))
    .slice(0, 3);

  if (withEdge.length > 0) {
    const lines = withEdge
      .map((s) => {
        const v = s.prediction.valueBets![0];
        return `• ${s.fixture.teams.home.name} v ${s.fixture.teams.away.name}: **${v.selection}** @ **${v.bestOdds.toFixed(2)}** (+${num(v.edge * 100)}% ${ctx.isIt ? 'valore' : 'edge'})`;
      })
      .join('\n');
    const text = ctx.isIt
      ? `⚠️ **Quote di valore rilevate**\n\nIl nostro modello stima questi esiti più probabili di quanto dicano i bookmaker:\n\n${lines}`
      : `⚠️ **Value bets detected**\n\nOur model rates these outcomes more likely than the bookmakers' price:\n\n${lines}`;
    return { text, matches: withEdge.map((s) => s.fixture) };
  }

  const fallback = scored
    .filter((s) => prob(s) >= 38 && prob(s) <= 60 && odds(s) >= 1.7)
    .sort((a, b) => odds(b) - odds(a))
    .slice(0, 2);
  if (fallback.length === 0) {
    return {
      text: ctx.isIt
        ? 'Nessuna quota di valore evidente oggi: i bookmaker hanno allineato bene le probabilità.'
        : 'No clear value today — the bookmaker lines are well-aligned with the model.',
    };
  }
  const lines = fallback
    .map((s) => `• ${s.fixture.teams.home.name} v ${s.fixture.teams.away.name}: **${ctx.formatSelection(s.prediction.topPick.selection)}** (${odds(s).toFixed(2)} | ${num(prob(s))}%)`)
    .join('\n');
  return {
    text: ctx.isIt
      ? `⚠️ **Possibili colpi di valore / underdog**\n\n${lines}`
      : `⚠️ **Possible value / underdog plays**\n\n${lines}`,
    matches: fallback.map((s) => s.fixture),
  };
};

/** ───────────────────────── intent: live now ───────────────────────── */
const liveNow = (ctx: BotContext): BotReply => {
  const live = ctx.fixtures.filter((f) => isLive(f.fixture.status.short));
  if (live.length === 0) {
    return {
      text: ctx.isIt
        ? '📡 Nessuna partita in diretta in questo momento tra i tuoi campionati.'
        : "📡 No live matches right now in your leagues.",
    };
  }
  const lines = live
    .slice(0, 6)
    .map((f) => `• ${f.teams.home.name} ${f.goals.home ?? 0}–${f.goals.away ?? 0} ${f.teams.away.name}  (${f.fixture.status.elapsed ?? 0}')`)
    .join('\n');
  return {
    text: ctx.isIt ? `📡 **In diretta ora (${live.length})**\n\n${lines}` : `📡 **Live now (${live.length})**\n\n${lines}`,
    matches: live.slice(0, 6),
  };
};

/** ───────────────────────── intent: goals market ───────────────────────── */
const goalsMarket = (ctx: BotContext, wantOver: boolean | null): BotReply => {
  const scored = withPredictions(ctx);
  // Rank by the relevant goals probability.
  const ranked = scored
    .map((s) => {
      const over = s.prediction.over25Pct;
      const p = wantOver === false ? s.prediction.under25Pct : over;
      return { s, p };
    })
    .sort((a, b) => b.p - a.p)
    .slice(0, 4);
  if (ranked.length === 0) {
    return { text: ctx.isIt ? 'Dati gol non ancora pronti, riprova tra poco.' : 'Goals data not ready yet, try again shortly.' };
  }
  const label = wantOver === false ? (ctx.isIt ? 'Under 2.5' : 'Under 2.5') : (ctx.isIt ? 'Over 2.5' : 'Over 2.5');
  const lines = ranked
    .map(({ s, p }) => `• ${s.fixture.teams.home.name} v ${s.fixture.teams.away.name}: **${num(p)}%** ${label}`)
    .join('\n');
  return {
    text: ctx.isIt
      ? `⚽ **Migliori partite per ${label} gol**\n\n${lines}`
      : `⚽ **Best matches for ${label} goals**\n\n${lines}`,
    matches: ranked.map((r) => r.s.fixture),
  };
};

/** ───────────────────────── intent: BTTS ───────────────────────── */
const bttsMarket = (ctx: BotContext): BotReply => {
  const ranked = withPredictions(ctx)
    .sort((a, b) => b.prediction.bttsPct - a.prediction.bttsPct)
    .slice(0, 4);
  if (ranked.length === 0) {
    return { text: ctx.isIt ? 'Dati non ancora pronti, riprova tra poco.' : 'Data not ready yet, try again shortly.' };
  }
  const lines = ranked
    .map((s) => `• ${s.fixture.teams.home.name} v ${s.fixture.teams.away.name}: **${num(s.prediction.bttsPct)}%**`)
    .join('\n');
  return {
    text: ctx.isIt
      ? `🥅 **Migliori partite per "Entrambe Segnano"**\n\n${lines}`
      : `🥅 **Best matches for "Both Teams To Score"**\n\n${lines}`,
    matches: ranked.map((s) => s.fixture),
  };
};

/** ───────────────────────── intent: team / match lookup ───────────────────────── */
const teamLookup = (ctx: BotContext, query: string): BotReply | null => {
  // Try "A vs B" first.
  const vs = query.split(/\s+(?:vs|v|contro|-)\s+/i);
  let found: Scored | undefined;

  const scored = withPredictions(ctx);
  if (vs.length === 2) {
    found = scored.find(
      (s) =>
        (teamMatchesQuery(s.fixture.teams.home.name, vs[0]) && teamMatchesQuery(s.fixture.teams.away.name, vs[1])) ||
        (teamMatchesQuery(s.fixture.teams.home.name, vs[1]) && teamMatchesQuery(s.fixture.teams.away.name, vs[0])),
    );
  }
  if (!found) {
    // Single-team mention.
    const candidates = scored.filter(
      (s) => teamMatchesQuery(s.fixture.teams.home.name, query) || teamMatchesQuery(s.fixture.teams.away.name, query),
    );
    if (candidates.length === 0) return null;
    found = candidates.sort((a, b) => prob(b) - prob(a))[0];
  }
  if (!found) return null;

  const p = found.prediction;
  const sel = ctx.formatSelection(p.topPick.selection);
  const scoreLine = `${p.predictedScore.home}–${p.predictedScore.away}`;
  const text = ctx.isIt
    ? `🔎 **${found.fixture.teams.home.name} vs ${found.fixture.teams.away.name}**\n${found.fixture.league.name}\n\n• 1X2: casa ${num(p.homeWinPct)}% · X ${num(p.drawPct)}% · ospite ${num(p.awayWinPct)}%\n• Giocata BORO: **${sel}** (${p.topPick.odds.toFixed(2)})\n• Over 2.5: ${num(p.over25Pct)}% · BTTS: ${num(p.bttsPct)}%\n• Risultato stimato: **${scoreLine}**\n\nTocca la scheda per l'analisi completa.`
    : `🔎 **${found.fixture.teams.home.name} vs ${found.fixture.teams.away.name}**\n${found.fixture.league.name}\n\n• 1X2: home ${num(p.homeWinPct)}% · draw ${num(p.drawPct)}% · away ${num(p.awayWinPct)}%\n• BORO play: **${sel}** (${p.topPick.odds.toFixed(2)})\n• Over 2.5: ${num(p.over25Pct)}% · BTTS: ${num(p.bttsPct)}%\n• Projected score: **${scoreLine}**\n\nTap the card for the full breakdown.`;
  return { text, matches: [found.fixture] };
};

const helpText = (isIt: boolean): string =>
  isIt
    ? `💡 **Cosa posso fare**\n\nChiedimi pure con parole tue, ad esempio:\n• "Partita più sicura di oggi"\n• "Fammi una multipla"\n• "Quote di valore"\n• "Partite live adesso"\n• "Migliori Over 2.5" o "Entrambe segnano"\n• "Inter vs Milan" (analisi di una partita)\n\nTutti i numeri vengono dallo stesso modello che vedi nelle schede.`
    : `💡 **What I can do**\n\nAsk me in your own words, e.g.:\n• "Safest match today"\n• "Build me an accumulator"\n• "Value bets"\n• "Live matches now"\n• "Best Over 2.5" or "both teams to score"\n• "Arsenal vs Chelsea" (single-match analysis)\n\nEvery number comes from the same model you see on the cards.`;

/**
 * Main entry: classify the query and produce a grounded reply.
 */
export const runBot = (rawQuery: string, ctx: BotContext): BotReply => {
  const q = rawQuery.toLowerCase().trim();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (ctx.fixtures.length === 0) {
    return {
      text: ctx.isIt
        ? 'Non vedo partite in programma a breve per i tuoi campionati. Aggiungine altri dalle impostazioni o riprova più tardi.'
        : "I don't see any matches coming up for your leagues. Add more in settings or check back later.",
    };
  }

  // Help / capabilities
  if (has('help', 'aiuto', 'funziona', 'come si usa', 'guida', 'cosa puoi', 'what can you')) {
    return { text: helpText(ctx.isIt) };
  }
  // Live now
  if (has('live', 'diretta', 'in corso', 'adesso', 'now', 'in gioco')) return liveNow(ctx);
  // Accumulator
  if (has('multipla', 'combo', 'bolla', 'schedina', 'accumulator', 'acca', 'parlay')) return accumulator(ctx);
  // Value
  if (has('valore', 'value', 'underdog', 'sorpres', 'anomali', 'edge', 'quota alta')) return value(ctx);
  // BTTS
  if (has('entrambe', 'btts', 'both teams', 'gol gol', 'gol/gol', 'goal goal', 'goal/goal')) return bttsMarket(ctx);
  // Over / Under
  if (has('over', 'piu di', 'più di', 'tanti gol', 'molti gol')) return goalsMarket(ctx, true);
  if (has('under', 'meno di', 'pochi gol')) return goalsMarket(ctx, false);
  // Safest
  if (has('safe', 'sicur', 'tranquill', 'scudo', 'shield', 'affidabil', 'banker', 'certezz')) return safest(ctx);

  // Greeting (only if short / no other signal)
  if (has('ciao', 'buongiorno', 'buonasera', 'hello', 'hi ', 'hey', 'salve') && q.length < 20) {
    return {
      text: ctx.isIt
        ? 'Ciao! 👋 Chiedimi la partita più sicura, una multipla, le quote di valore, oppure scrivi il nome di una squadra.'
        : 'Hi! 👋 Ask me for the safest match, an accumulator, value bets, or just type a team name.',
    };
  }

  // Team / match lookup (try last, since it is the broadest).
  const lookup = teamLookup(ctx, rawQuery);
  if (lookup) return lookup;

  // Smart fallback.
  return {
    text: ctx.isIt
      ? 'Non ho trovato una corrispondenza. Prova con:\n\n• "Partita più sicura"\n• "Multipla"\n• "Quote di valore"\n• "Live adesso"\n• Il nome di una squadra (es. "Napoli")'
      : "I couldn't find a match for that. Try:\n\n• \"Safest match\"\n• \"Accumulator\"\n• \"Value bets\"\n• \"Live now\"\n• A team name (e.g. \"Napoli\")",
  };
};
