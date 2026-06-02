const fs = require('fs');
const path = require('path');

const TOP_MAPPING = {
  8: { id: 39, shortName: 'EPL', countryCode: 'GB', emoji: '🏴' },
  564: { id: 140, shortName: 'LaLiga', countryCode: 'ES', emoji: '🇪🇸' },
  384: { id: 135, shortName: 'Serie A', countryCode: 'IT', emoji: '🇮🇹' },
  82: { id: 78, shortName: 'BuLi', countryCode: 'DE', emoji: '🇩🇪' },
  301: { id: 61, shortName: 'Ligue 1', countryCode: 'FR', emoji: '🇫🇷' },
  72: { id: 88, shortName: 'Eredivisie', countryCode: 'NL', emoji: '🇳🇱' },
  462: { id: 94, shortName: 'Liga PT', countryCode: 'PT', emoji: '🇵🇹' },
  9: { id: 40, shortName: 'Champ', countryCode: 'GB', emoji: '🏴' },
  12: { id: 41, shortName: 'L1 ENG', countryCode: 'GB', emoji: '🏴' },
  14: { id: 42, shortName: 'L2 ENG', countryCode: 'GB', emoji: '🏴' },
  567: { id: 141, shortName: 'LaLiga2', countryCode: 'ES', emoji: '🇪🇸' },
  387: { id: 136, shortName: 'Serie B', countryCode: 'IT', emoji: '🇮🇹' },
  85: { id: 79, shortName: 'BuLi 2', countryCode: 'DE', emoji: '🇩🇪' },
  304: { id: 62, shortName: 'Ligue 2', countryCode: 'FR', emoji: '🇫🇷' },
  208: { id: 144, shortName: 'Belgium', countryCode: 'BE', emoji: '🇧🇪' },
  181: { id: 218, shortName: 'Austria', countryCode: 'AT', emoji: '🇦🇹' },
  591: { id: 207, shortName: 'Swiss', countryCode: 'CH', emoji: '🇨🇭' },
  271: { id: 119, shortName: 'Denmark', countryCode: 'DK', emoji: '🇩🇰' },
  444: { id: 103, shortName: 'Norway', countryCode: 'NO', emoji: '🇳🇴' },
  573: { id: 113, shortName: 'Sweden', countryCode: 'SE', emoji: '🇸🇪' },
  453: { id: 106, shortName: 'Poland', countryCode: 'PL', emoji: '🇵🇱' },
  325: { id: 197, shortName: 'Greece', countryCode: 'GR', emoji: '🇬🇷' },
  600: { id: 203, shortName: 'Türkiye', countryCode: 'TR', emoji: '🇹🇷' },
  501: { id: 179, shortName: 'Scotland', countryCode: 'GB', emoji: '🏴' },
  486: { id: 235, shortName: 'Russia', countryCode: 'RU', emoji: '🇷🇺' },
  609: { id: 333, shortName: 'Ukraine', countryCode: 'UA', emoji: '🇺🇦' },
  244: { id: 210, shortName: 'Croatia', countryCode: 'HR', emoji: '🇭🇷' },
  944: { id: 307, shortName: 'Saudi Pro', countryCode: 'SA', emoji: '🇸🇦' },
  779: { id: 253, shortName: 'MLS', countryCode: 'US', emoji: '🇺🇸' },
  743: { id: 262, shortName: 'Liga MX', countryCode: 'MX', emoji: '🇲🇽' },
  648: { id: 71, shortName: 'Brasil A', countryCode: 'BR', emoji: '🇧🇷' },
  651: { id: 72, shortName: 'Brasil B', countryCode: 'BR', emoji: '🇧🇷' },
  636: { id: 128, shortName: 'Argentina', countryCode: 'AR', emoji: '🇦🇷' },
  968: { id: 98, shortName: 'J1', countryCode: 'JP', emoji: '🇯🇵' },
  1034: { id: 292, shortName: 'K League', countryCode: 'KR', emoji: '🇰🇷' },
  989: { id: 169, shortName: 'China', countryCode: 'CN', emoji: '🇨🇳' },
  830: { id: 233, shortName: 'Egypt', countryCode: 'EG', emoji: '🇪🇬' },
  390: { id: 137, shortName: 'Coppa IT', countryCode: 'IT', emoji: '🇮🇹', isCup: true },
  24: { id: 45, shortName: 'FA Cup', countryCode: 'GB', emoji: '🏴', isCup: true },
  27: { id: 48, shortName: 'Carabao', countryCode: 'GB', emoji: '🏴', isCup: true },
  570: { id: 143, shortName: 'Copa Rey', countryCode: 'ES', emoji: '🇪🇸', isCup: true },
  109: { id: 81, shortName: 'DFB Pokal', countryCode: 'DE', emoji: '🇩🇪', isCup: true },
  307: { id: 66, shortName: 'Coupe FR', countryCode: 'FR', emoji: '🇫🇷', isCup: true },
  2: { id: 2, shortName: 'UCL', emoji: '🏆', isInternational: true },
  5: { id: 3, shortName: 'UEL', emoji: '🏆', isInternational: true },
  2286: { id: 13, shortName: 'UECL', emoji: '🏆', isInternational: true },
  1328: { id: 531, shortName: 'Super Cup', emoji: '🏆', isInternational: true, isCup: true },
  1371: { id: 532, shortName: 'UEL P/O', emoji: '🏆', isInternational: true, isCup: true },
  1122: { id: 17, shortName: 'Libertadores', emoji: '🏆', isInternational: true },
  1116: { id: 11, shortName: 'Sudamericana', emoji: '🏆', isInternational: true },
  1101: { id: 667, shortName: 'Friendlies', emoji: '🤝', isInternational: true, isCup: true }
};

const jsonPath = path.join(__dirname, 'all_subscription_leagues.json');
const rawData = fs.readFileSync(jsonPath, 'utf8');
const subLeagues = JSON.parse(rawData);

const mappedLeagues = subLeagues.map(l => {
  const smId = l.sportmonksId;
  const isTop = TOP_MAPPING[smId];
  
  if (isTop) {
    return {
      id: isTop.id,
      sportmonksId: smId,
      name: l.name,
      shortName: isTop.shortName,
      country: l.country,
      countryCode: isTop.countryCode,
      emoji: isTop.emoji,
      isCup: isTop.isCup || l.isCup || false,
      isInternational: isTop.isInternational || l.isInternational || false
    };
  } else {
    return {
      id: smId + 20000,
      sportmonksId: smId,
      name: l.name,
      shortName: l.shortName,
      country: l.country,
      emoji: l.emoji === 'âš½' ? '⚽' : l.emoji,
      isCup: l.isCup || false,
      isInternational: l.isInternational || false
    };
  }
});

// Sort to keep top leagues at the top of settings selection list
mappedLeagues.sort((a, b) => {
  const aTop = TOP_MAPPING[a.sportmonksId] ? 1 : 0;
  const bTop = TOP_MAPPING[b.sportmonksId] ? 1 : 0;
  if (aTop !== bTop) return bTop - aTop;
  return a.name.localeCompare(b.name);
});

let code = `/**
 * Leagues tracked by BORO AI.
 *
 * Generated automatically from active plan subscriptions.
 */
export interface TrackedLeague {
  id: number;
  sportmonksId: number;
  name: string;
  shortName: string;
  country: string;
  countryCode?: string;
  emoji: string;
  isInternational?: boolean;
  isCup?: boolean;
}

export const DEFAULT_LEAGUES: TrackedLeague[] = [
`;

mappedLeagues.forEach(l => {
  const escName = l.name.replace(/'/g, "\\'");
  const escShort = l.shortName.replace(/'/g, "\\'");
  const escCountry = l.country.replace(/'/g, "\\'");
  
  let line = `  { id: ${l.id}, sportmonksId: ${l.sportmonksId}, name: '${escName}', shortName: '${escShort}', country: '${escCountry}', `;
  if (l.countryCode) {
    line += `countryCode: '${l.countryCode}', `;
  }
  line += `emoji: '${l.emoji}', `;
  if (l.isCup) {
    line += `isCup: true, `;
  }
  if (l.isInternational) {
    line += `isInternational: true, `;
  }
  line = line.trim() + ' },';
  code += line + '\n';
});

code += `];

export const DEFAULT_LEAGUE_IDS = DEFAULT_LEAGUES.map((l) => l.id);

const LEAGUE_BY_ID = new Map<number, TrackedLeague>(DEFAULT_LEAGUES.map((l) => [l.id, l]));

export const getLeagueById = (id: number): TrackedLeague | undefined => LEAGUE_BY_ID.get(id);

/** API-Football style internal ID -> Sportmonks league ID. */
export const LEAGUE_TO_SPORTMONKS: Record<number, number> = Object.fromEntries(
  DEFAULT_LEAGUES.map((l) => [l.id, l.sportmonksId]),
);

/** Sportmonks league ID -> internal ID. */
export const SPORTMONKS_TO_LEAGUE: Record<number, number> = Object.fromEntries(
  DEFAULT_LEAGUES.map((l) => [l.sportmonksId, l.id]),
);
`;

const outputPath = path.join(__dirname, '..', 'src', 'constants', 'leagues.ts');
fs.writeFileSync(outputPath, code, 'utf8');
console.log(`Leagues synced successfully! Replaced all leagues. Total active: ${mappedLeagues.length}`);
