/**
 * Share codes: the short, opaque handle a reader sends a friend to challenge them
 * with a word.
 *
 * The requirement is narrow and worth stating, because it is easy to over-build:
 * the LINK must not give the answer away. `anh.chayla.app/w/K7F` says nothing;
 * `/w/apple` would end the game before it started. Word ids in this catalog ARE
 * the answers (`agree`, `allow`), so a code can never be derived from the id in
 * any reversible way — codes are assigned at random and recorded.
 *
 * This is deliberately NOT a secret. The catalog ships to the browser, so anyone
 * willing to open devtools can find any answer. It is a game between friends, and
 * the code only has to stop the answer appearing in the chat message itself.
 *
 * Alphabet: Crockford-style base32 — digits and letters minus I, L, O and U, so a
 * code is safe to read aloud, and 0/1 can never be confused with O/I because those
 * letters are not in the set. Input is normalised forgivingly (see `normalize`),
 * which is the one defence against a mistyped code at this length.
 *
 * Length 3 covers 32^3 = 32,768 words. At a 20,000-word catalog that is 61% of the
 * space in use, so codes are NOT sparse: a mistyped character usually lands on a
 * different real word rather than a miss, and the format has to change (breaking
 * every code already shared) if the catalog ever passes 32,768.
 *
 * Exports: SHARE_CODE_ALPHABET, SHARE_CODE_LENGTH, SHARE_CODE_SPACE,
 *   isShareCode, normalizeShareCode, randomShareCode
 * Depends on: none (pure, runs in node and the browser)
 */

/** Digits + letters, minus the four that are misread: I, L, O, U. */
export const SHARE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Characters per code. */
export const SHARE_CODE_LENGTH = 3;
/** How many distinct codes the format can express. */
export const SHARE_CODE_SPACE = SHARE_CODE_ALPHABET.length ** SHARE_CODE_LENGTH;

/**
 * Characters a reader is likely to type for one that is not in the alphabet.
 * Crockford's substitutions: the excluded letters map to the digit they resemble.
 */
const FORGIVE: Record<string, string> = { I: "1", L: "1", O: "0", U: "V" };

/**
 * Clean up a code a reader typed or pasted: trim, drop separators, uppercase, and
 * fold the four excluded letters onto what they were meant to be.
 * @param raw Whatever arrived from a URL, a paste or an input.
 * @returns The canonical form, which may still not be a valid code.
 */
export function normalizeShareCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-_]/g, "")
    .split("")
    .map((character) => FORGIVE[character] ?? character)
    .join("");
}

/**
 * Whether a string is exactly one well-formed code.
 * @param value Candidate, already normalized or not.
 * @returns True when it is the right length and every character is in the alphabet.
 */
export function isShareCode(value: string): boolean {
  const code = normalizeShareCode(value);
  if (code.length !== SHARE_CODE_LENGTH) return false;
  return [...code].every((character) => SHARE_CODE_ALPHABET.includes(character));
}

/**
 * Draw one random code. Callers assigning codes must check it against the ones
 * already issued: at a 20,000-word catalog most of the space is taken, so
 * collisions are the normal case rather than a rare one.
 * @param random Injectable source, for deterministic tests.
 * @returns A well-formed code, not guaranteed unused.
 */
export function randomShareCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < SHARE_CODE_LENGTH; index += 1) {
    code += SHARE_CODE_ALPHABET[Math.floor(random() * SHARE_CODE_ALPHABET.length)];
  }
  return code;
}
