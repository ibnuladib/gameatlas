export type GameLength = {
  main_story_hours: number | null;
  main_plus_extras_hours: number | null;
  completionist_hours: number | null;
  all_styles_hours: number | null;
};

export interface GameLengthProvider {
  getLength(steamAppId: number): Promise<GameLength | null>;
}

/** Default no-op. Do not scrape HowLongToBeat unless a separately approved source exists. */
export class NullGameLengthProvider implements GameLengthProvider {
  async getLength(_steamAppId: number): Promise<GameLength | null> {
    return null;
  }
}

export const gameLengthProvider: GameLengthProvider = new NullGameLengthProvider();
