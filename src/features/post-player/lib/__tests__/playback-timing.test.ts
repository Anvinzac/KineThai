import { describe, expect, it } from "vitest";
import { getJapaneseMoraTokens } from "@/features/kinetic-text";
import { getMoraDelay, getPageDuration, tempoConfig } from "../playback-timing";

describe("getPageDuration on Japanese pages", () => {
  it("uses the mora cascade and leaves only a short read-hold", () => {
    const page = "頭の 回転が 速い！";
    const morae = getJapaneseMoraTokens(page).length;
    const duration = getPageDuration(page, "steady", "smooth");
    const lastMoraLands =
      (getMoraDelay(morae - 1, "steady", "smooth") + tempoConfig.steady.wordDuration) * 1000;
    const hold = duration - lastMoraLands;

    expect(duration).toBeLessThan(2500);
    expect(hold).toBeGreaterThanOrEqual(800);
    expect(hold).toBeLessThan(1000);
  });

  it("keeps the read-hold short on a long page instead of scaling it by word count", () => {
    const page = "待たされたり、 物事が 進まなかったりして いらいらする 気持ち。";
    const morae = getJapaneseMoraTokens(page).length;
    const duration = getPageDuration(page, "steady", "smooth");
    const lastMoraLands =
      (getMoraDelay(morae - 1, "steady", "smooth") + tempoConfig.steady.wordDuration) * 1000;

    expect(duration - lastMoraLands).toBeGreaterThanOrEqual(800);
    expect(duration - lastMoraLands).toBeLessThan(1000);
  });
});
