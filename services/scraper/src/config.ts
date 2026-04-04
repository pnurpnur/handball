export const TEAM_IDS = [928241, 771912, 709787, 682520, 698373];

export const EMRE_NAME = "Emre Askim Pettersen";

export const BASE_URL = "https://www.handball.no";
export const TEAM_PAGE = (id: number) =>
  `${BASE_URL}/system/kamper/lag/?lagid=${id}#allmatches`;
export const MATCH_PAGE = (matchId: string) =>
  `${BASE_URL}/system/kamper/kamp/?matchid=${matchId}`;
