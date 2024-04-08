import type { SportLeague } from "./SportLeague";

export type GameStartTimes = {
  [key in SportLeague]?: number[];
};
