import { describe, expect, it } from "vitest";
import { resolveTarget, siteBrand, siteTitle } from "../target-language";
import { readVocabularyPage } from "../../api/catalog.server";

describe("resolveTarget", () => {
  it("hoa.chayla.app serves Chinese", () => expect(resolveTarget("hoa.chayla.app")).toBe("zh"));
  it("anh.chayla.app serves English", () => expect(resolveTarget("anh.chayla.app")).toBe("en"));
  it("han.chayla.app serves Korean", () => expect(resolveTarget("han.chayla.app")).toBe("ko"));
  it("nhat.chayla.app serves Japanese", () => expect(resolveTarget("nhat.chayla.app")).toBe("ja"));
  it("unknown host falls back to Japanese", () =>
    expect(resolveTarget("foo.lovable.app")).toBe("ja"));
  it("tolerates port and case", () => expect(resolveTarget("HOA.chayla.app:8080")).toBe("zh"));
  it("missing host falls back to Japanese", () => expect(resolveTarget(null)).toBe("ja"));
  it("Chinese title is hoa.chayLá", () => expect(siteTitle("zh")).toBe("hoa.chayLá"));
  it("brand splits lead from the accent span", () => {
    expect(siteBrand("zh")).toEqual({ lead: "hoa.chay", accent: "Lá" });
    expect(siteBrand("en")).toEqual({ lead: "anh.chay", accent: "Lá" });
    expect(siteBrand("ja")).toEqual({ lead: "nhật.chay", accent: "Lá" });
    for (const locale of ["en", "zh", "ko", "ja"] as const) {
      const { lead, accent } = siteBrand(locale);
      expect(lead + accent).toBe(siteTitle(locale));
    }
  });
});

describe("Chinese deck", () => {
  it("a hoa request returns only Chinese words", () => {
    const page = readVocabularyPage(
      { seed: "testseed01", position: 0, limit: 24, topic: "", level: "", difficulty: "" },
      "zh",
    );
    expect(page.entries.length).toBeGreaterThan(0);
    for (const e of page.entries) expect(e.word.word).toMatch(/^\p{Script=Han}+$/u);
  });
});

describe("Japanese deck", () => {
  const input = {
    seed: "testseed01",
    position: 0,
    limit: 24,
    topic: "",
    level: "" as const,
    difficulty: "",
  };

  it("is the default deck when no locale is supplied", () => {
    const byDefault = readVocabularyPage(input);
    const explicit = readVocabularyPage(input, "ja");
    expect(byDefault.revision).toBe(explicit.revision);
    expect(byDefault.matching).toBe(explicit.matching);
  });

  it("streams every headword in the all-level catalog, not one track", () => {
    const page = readVocabularyPage(input);
    expect(page.total).toBeGreaterThanOrEqual(200);
    expect(page.matching).toBe(page.total);
    expect(page.levels).toEqual(expect.arrayContaining(["JPRIM", "JSEC", "JHIGH", "JCOLL"]));
  });
});
