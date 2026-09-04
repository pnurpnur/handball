export const CURRENT_SEASON_ID = 2; // Update when a new season starts
export const CURRENT_SEASON_NAME = "2026/2027";

// handball.no's own internal season ID (found via the TerminListeForTeam API
// response's "seasons" field). Update alongside CURRENT_SEASON_ID each season.
export const HANDBALL_SEASON_ID = 201068;

// Update each season (Emre's teams). matchLength = full match length in
// minutes, used to calculate Emre's playing-time percentage.
export const TEAM_CONFIG: Record<number, { matchLength: number }> = {
  698373: { matchLength: 60 }, // Tiller 2 senior
  682520: { matchLength: 50 }, // Tiller G18
  709787: { matchLength: 50 }, // Tiller G20
};
export const TEAM_IDS = Object.keys(TEAM_CONFIG).map(Number);

export const EMRE_NAME = "Emre Askim Pettersen";

export const BASE_URL = "https://www.handball.no";
export const TEAM_PAGE = (id: number) =>
  `${BASE_URL}/system/kamper/lag/?lagid=${id}#allmatches`;
export const MATCH_PAGE = (matchId: string) =>
  `${BASE_URL}/system/kamper/kamp/?matchid=${matchId}`;
export const TERMINLISTE_API = (teamId: number, handballSeasonId: number) =>
  `${BASE_URL}/api/AjaxData/TerminListeForTeam?id=${teamId}&seasonId=${handballSeasonId}`;
