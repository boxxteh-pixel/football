# Read all subscription leagues from JSON
$jsonPath = "scratch/all_subscription_leagues.json"
$leaguesJson = Get-Content -Path $jsonPath -Raw | ConvertFrom-Json

# Define existing sportmonksIds we have in the original file to avoid duplicates
$existingSportmonksIds = @(8, 564, 384, 82, 301, 72, 462, 9, 12, 14, 567, 387, 85, 304, 208, 181, 591, 271, 444, 573, 453, 325, 600, 501, 486, 609, 244, 944, 779, 743, 648, 651, 636, 968, 1034, 989, 830, 390, 24, 27, 570, 109, 307, 2, 5, 2286, 1328, 1371, 1122, 1116, 1101)

# Base list of DEFAULT_LEAGUES in TypeScript syntax
$output = @"
/**
 * Leagues tracked by BORO AI.
 *
 * `id`            - internal identifier (API-Football style ID, used across the app + stored settings).
 * `sportmonksId`  - the Sportmonks v3 league ID (single source of truth for the API mapping).
 *
 * Only leagues whose `sportmonksId` is covered by the active Sportmonks plan will
 * return live data.
 */
export interface TrackedLeague {
  id: number;
  sportmonksId: number;
  name: string;
  shortName: string;
  country: string;
  countryCode?: string;
  emoji: string;
  /** Continental / international competition (no fixed home advantage). */
  isInternational?: boolean;
  /** Knockout cup competition (reduced home advantage, more variance). */
  isCup?: boolean;
}

export const DEFAULT_LEAGUES: TrackedLeague[] = [
  // Top-5 European leagues
  { id: 39, sportmonksId: 8, name: 'Premier League', shortName: 'EPL', country: 'England', countryCode: 'GB', emoji: '🏴' },
  { id: 140, sportmonksId: 564, name: 'La Liga', shortName: 'LaLiga', country: 'Spain', countryCode: 'ES', emoji: '🇪🇸' },
  { id: 135, sportmonksId: 384, name: 'Serie A', shortName: 'Serie A', country: 'Italy', countryCode: 'IT', emoji: '🇮🇹' },
  { id: 78, sportmonksId: 82, name: 'Bundesliga', shortName: 'BuLi', country: 'Germany', countryCode: 'DE', emoji: '🇩🇪' },
  { id: 61, sportmonksId: 301, name: 'Ligue 1', shortName: 'L1', country: 'France', countryCode: 'FR', emoji: '🇫🇷' },
  { id: 88, sportmonksId: 72, name: 'Eredivisie', shortName: 'Eredivisie', country: 'Netherlands', countryCode: 'NL', emoji: '🇳🇱' },
  { id: 94, sportmonksId: 462, name: 'Primeira Liga', shortName: 'Liga PT', country: 'Portugal', countryCode: 'PT', emoji: '🇵🇹' },

  // Second tiers
  { id: 40, sportmonksId: 9, name: 'Championship', shortName: 'Champ', country: 'England', countryCode: 'GB', emoji: '🏴' },
  { id: 41, sportmonksId: 12, name: 'League One', shortName: 'L1 ENG', country: 'England', countryCode: 'GB', emoji: '🏴' },
  { id: 42, sportmonksId: 14, name: 'League Two', shortName: 'L2 ENG', country: 'England', countryCode: 'GB', emoji: '🏴' },
  { id: 141, sportmonksId: 567, name: 'LaLiga 2', shortName: 'LaLiga2', country: 'Spain', countryCode: 'ES', emoji: '🇪🇸' },
  { id: 136, sportmonksId: 387, name: 'Serie B', shortName: 'Serie B', country: 'Italy', countryCode: 'IT', emoji: '🇮🇹' },
  { id: 79, sportmonksId: 85, name: '2. Bundesliga', shortName: 'BuLi 2', country: 'Germany', countryCode: 'DE', emoji: '🇩🇪' },
  { id: 62, sportmonksId: 304, name: 'Ligue 2', shortName: 'L2', country: 'France', countryCode: 'FR', emoji: '🇫🇷' },

  // Other European top divisions
  { id: 144, sportmonksId: 208, name: 'Pro League', shortName: 'Belgium', country: 'Belgium', countryCode: 'BE', emoji: '🇧🇪' },
  { id: 218, sportmonksId: 181, name: 'Bundesliga', shortName: 'Austria', country: 'Austria', countryCode: 'AT', emoji: '🇦🇹' },
  { id: 207, sportmonksId: 591, name: 'Super League', shortName: 'Swiss', country: 'Switzerland', countryCode: 'CH', emoji: '🇨🇭' },
  { id: 119, sportmonksId: 271, name: 'Superliga', shortName: 'Denmark', country: 'Denmark', countryCode: 'DK', emoji: '🇩🇰' },
  { id: 103, sportmonksId: 444, name: 'Eliteserien', shortName: 'Norway', country: 'Norway', countryCode: 'NO', emoji: '🇳🇴' },
  { id: 113, sportmonksId: 573, name: 'Allsvenskan', shortName: 'Sweden', country: 'Sweden', countryCode: 'SE', emoji: '🇸🇪' },
  { id: 106, sportmonksId: 453, name: 'Ekstraklasa', shortName: 'Poland', country: 'Poland', countryCode: 'PL', emoji: '🇵🇱' },
  { id: 197, sportmonksId: 325, name: 'Super League', shortName: 'Greece', country: 'Greece', countryCode: 'GR', emoji: '🇬🇷' },
  { id: 203, sportmonksId: 600, name: 'Süper Lig', shortName: 'Türkiye', country: 'Türkiye', countryCode: 'TR', emoji: '🇹🇷' },
  { id: 179, sportmonksId: 501, name: 'Premiership', shortName: 'Scotland', country: 'Scotland', countryCode: 'GB', emoji: '🏴' },
  { id: 235, sportmonksId: 486, name: 'Premier League', shortName: 'Russia', country: 'Russia', countryCode: 'RU', emoji: '🇷🇺' },
  { id: 333, sportmonksId: 609, name: 'Premier League', shortName: 'Ukraine', country: 'Ukraine', countryCode: 'UA', emoji: '🇺🇦' },
  { id: 210, sportmonksId: 244, name: '1. HNL', shortName: 'Croatia', country: 'Croatia', countryCode: 'HR', emoji: '🇭🇷' },

  // Rest of the world
  { id: 307, sportmonksId: 944, name: 'Saudi Pro League', shortName: 'Saudi Pro', country: 'Saudi Arabia', countryCode: 'SA', emoji: '🇸🇦' },
  { id: 253, sportmonksId: 779, name: 'Major League Soccer', shortName: 'MLS', country: 'USA', countryCode: 'US', emoji: '🇺🇸' },
  { id: 262, sportmonksId: 743, name: 'Liga MX', shortName: 'Liga MX', country: 'Mexico', countryCode: 'MX', emoji: '🇲🇽' },
  { id: 71, sportmonksId: 648, name: 'Brasileirão Serie A', shortName: 'Brasil A', country: 'Brazil', countryCode: 'BR', emoji: '🇧🇷' },
  { id: 72, sportmonksId: 651, name: 'Brasileirão Serie B', shortName: 'Brasil B', country: 'Brazil', countryCode: 'BR', emoji: '🇧🇷' },
  { id: 128, sportmonksId: 636, name: 'Liga Profesional', shortName: 'Argentina', country: 'Argentina', countryCode: 'AR', emoji: '🇦🇷' },
  { id: 98, sportmonksId: 968, name: 'J1 League', shortName: 'J1', country: 'Japan', countryCode: 'JP', emoji: '🇯🇵' },
  { id: 292, sportmonksId: 1034, name: 'K League 1', shortName: 'K League', country: 'South Korea', countryCode: 'KR', emoji: '🇰🇷' },
  { id: 169, sportmonksId: 989, name: 'Super League', shortName: 'China', country: 'China', countryCode: 'CN', emoji: '🇨🇳' },
  { id: 233, sportmonksId: 830, name: 'Premier League', shortName: 'Egypt', country: 'Egypt', countryCode: 'EG', emoji: '🇪🇬' },

  // Domestic cups
  { id: 137, sportmonksId: 390, name: 'Coppa Italia', shortName: 'Coppa IT', country: 'Italy', countryCode: 'IT', emoji: '🇮🇹', isCup: true },
  { id: 45, sportmonksId: 24, name: 'FA Cup', shortName: 'FA Cup', country: 'England', countryCode: 'GB', emoji: '🏴', isCup: true },
  { id: 48, sportmonksId: 27, name: 'EFL Cup', shortName: 'Carabao', country: 'England', countryCode: 'GB', emoji: '🏴', isCup: true },
  { id: 143, sportmonksId: 570, name: 'Copa del Rey', shortName: 'Copa Rey', country: 'Spain', countryCode: 'ES', emoji: '🇪🇸', isCup: true },
  { id: 81, sportmonksId: 109, name: 'DFB Pokal', shortName: 'DFB Pokal', country: 'Germany', countryCode: 'DE', emoji: '🇩🇪', isCup: true },
  { id: 66, sportmonksId: 307, name: 'Coupe de France', shortName: 'Coupe FR', country: 'France', countryCode: 'FR', emoji: '🇫🇷', isCup: true },

  // International / continental
  { id: 2, sportmonksId: 2, name: 'UEFA Champions League', shortName: 'UCL', country: 'Europe', emoji: '🏆', isInternational: true },
  { id: 3, sportmonksId: 5, name: 'UEFA Europa League', shortName: 'UEL', country: 'Europe', emoji: '🏆', isInternational: true },
  { id: 13, sportmonksId: 2286, name: 'UEFA Conference League', shortName: 'UECL', country: 'Europe', emoji: '🏆', isInternational: true },
  { id: 531, sportmonksId: 1328, name: 'UEFA Super Cup', shortName: 'Super Cup', country: 'Europe', emoji: '🏆', isInternational: true, isCup: true },
  { id: 532, sportmonksId: 1371, name: 'Europa League Play-offs', shortName: 'UEL P/O', country: 'Europe', emoji: '🏆', isInternational: true, isCup: true },
  { id: 17, sportmonksId: 1122, name: 'Copa Libertadores', shortName: 'Libertadores', country: 'South America', emoji: '🏆', isInternational: true },
  { id: 11, sportmonksId: 1116, name: 'Copa Sudamericana', shortName: 'Sudamericana', country: 'South America', emoji: '🏆', isInternational: true },

  // Friendlies
  { id: 667, sportmonksId: 1101, name: 'Club Friendlies', shortName: 'Friendlies', country: 'World', emoji: '🤝', isInternational: true, isCup: true },
"@

$newLeaguesLines = @()
foreach ($l in $leaguesJson) {
    if ($existingSportmonksIds -notcontains $l.sportmonksId) {
        $escapedName = $l.name.Replace("'", "\'")
        $escapedShort = $l.shortName.Replace("'", "\'")
        $escapedCountry = $l.country.Replace("'", "\'")
        $isCupVal = if ($l.isCup) { "true" } else { "false" }
        $isIntVal = if ($l.isInternational) { "true" } else { "false" }

        # Generate a safe unique internal ID by adding 20000 to the sportmonksId
        $uniqueId = $l.sportmonksId + 20000
        $line = "  { id: $uniqueId, sportmonksId: $($l.sportmonksId), name: '$escapedName', shortName: '$escapedShort', country: '$escapedCountry', emoji: '$($l.emoji)', isCup: $isCupVal, isInternational: $isIntVal },"
        $newLeaguesLines += $line
    }
}

$output += "`n  // Auto-added Subscription Leagues`n"
$output += ($newLeaguesLines -join "`n")
$output += "`n];"

$output += @"


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
"@

$output | Out-File -FilePath "src/constants/leagues.ts" -Encoding utf8
Write-Host "Leagues merged successfully with unique IDs!"
