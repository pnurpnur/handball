export const CURRENT_SEASON_ID = 1; // Update when a new season starts
export const TEAM_IDS = [928241, 771912, 709787, 682520, 698373]; // Update each season (Emre's teams)

export const EMRE_NAME = "Emre Askim Pettersen";

export const BASE_URL = "https://www.handball.no";
export const TEAM_PAGE = (id: number) =>
  `${BASE_URL}/system/kamper/lag/?lagid=${id}#allmatches`;
export const MATCH_PAGE = (matchId: string) =>
  `${BASE_URL}/system/kamper/kamp/?matchid=${matchId}`;
