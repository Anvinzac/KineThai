/**
 * Sample pack and the LLM prompt used to generate one. Both mirror the deck format the
 * importer accepts (lib/custom-pack.ts → lib/schema.ts), so a pack produced from this
 * prompt imports without edits.
 *
 * Exports: SAMPLE_PACK_JSON, PACK_GENERATOR_PROMPT, downloadSamplePack
 */

/** A minimal valid pack in the default format — two words, every common field shown. */
export const SAMPLE_PACK_JSON = `{
  "meta": { "name": "Gói mẫu của tôi" },
  "words": [
    {
      "id": "wander",
      "word": "wander",
      "level": "A2",
      "pos": "verb",
      "ipa": "/ˈwɒndə(r)/",
      "defVi": "đi lang thang, đi dạo không mục đích",
      "leadVi": "Bạn bước ra phố chẳng biết đi đâu…",
      "anticipateVi": "Không cần bản đồ, không cần đích đến — chỉ cần bước chân.",
      "topic": "travel",
      "usage": [
        { "en": "We spent the afternoon wandering around the old town.", "vi": "Chúng tôi dành cả buổi chiều đi dạo quanh khu phố cổ." }
      ],
      "emphasis": ["đi dạo quanh"]
    },
    {
      "id": "twilight",
      "word": "twilight",
      "level": "B1",
      "pos": "noun",
      "ipa": "/ˈtwaɪlaɪt/",
      "defVi": "ánh hoàng hôn, lúc chạng vạng",
      "leadVi": "Nhiếp ảnh gia nào cũng chờ khoảnh khắc này…",
      "anticipateVi": "Mặt trời vừa lặn, bầu trời còn lại một vệt sáng dịu.",
      "topic": "nature",
      "usage": [
        { "en": "The city looks magical in the twilight.", "vi": "Thành phố trông kỳ diệu trong ánh hoàng hôn." }
      ],
      "emphasis": ["ánh hoàng hôn"]
    }
  ]
}
`;

/**
 * Full prompt to paste into an LLM. The word list goes between the markers at the end;
 * commas, newlines, semicolons or any other separators are all fine.
 */
export const PACK_GENERATOR_PROMPT = `You are generating a vocabulary pack for a kinetic-typography word-learning app. Output ONE valid JSON file and nothing else — no markdown fences, no commentary.

## Required format

{
  "meta": { "name": "<short pack name>" },
  "words": [ <one object per word, see below> ]
}

## Each word object

{
  "id": "unique-lowercase-slug",        // letters, digits, - and _ only; unique across the pack
  "word": "the headword",               // English letters (may contain ' or -), or Chinese characters
  "level": "A1",                        // one of A1 A2 B1 B2 C1 C2 (or HSK1–HSK9 for Chinese)
  "pos": "noun | verb | adjective | …", // optional
  "ipa": "/pronunciation/",             // optional
  "defVi": "Vietnamese definition, 2–400 chars",
  "leadVi": "optional short Vietnamese hook that teases the word (max 240 chars)",
  "anticipateVi": "optional Vietnamese clue sentence (max 180 chars) — must NOT contain the answer word itself",
  "topic": "one-lowercase-slug",        // e.g. travel, food, work; letters/digits/dashes only
  "usage": [
    { "en": "one natural example sentence using the word", "vi": "Vietnamese translation" }
  ],
  "emphasis": ["a short Vietnamese phrase (max 6 words) from the usage translation to highlight"]
}

## Rules

- Include every word from my list below, exactly once each; skip exact duplicates.
- defVi, leadVi, anticipateVi and usage[].vi are in Vietnamese; word and usage[].en stay in the source language.
- anticipateVi must never contain the answer word (it is a guessing clue).
- Keep emphasis phrases short and meaningful — they are highlighted on screen.
- Output must parse with JSON.parse: double quotes, no trailing commas, no comments.

## My word list (separated by commas, newlines, or any characters — treat every token as one word):

<PASTE YOUR WORD LIST HERE>
`;

/** Download the sample pack as a JSON file (same-origin blob, works everywhere). */
export function downloadSamplePack() {
  const blob = new Blob([SAMPLE_PACK_JSON], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "goi-tu-vung-mau.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
