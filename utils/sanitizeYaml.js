/**
 * sanitizeYaml.js
 * Cleans AI-generated YAML before parsing.
 * Handles the most common model mistakes:
 *   1. Duplicate keys in the same mapping (e.g. two `run:` in one step)
 *   2. Markdown fences the model forgot to strip
 *   3. Garbled / non-ASCII junk characters injected mid-value
 *   4. Tabs used as indentation (YAML disallows them)
 */

/**
 * Remove markdown code fences if the model wrapped its output.
 *   ```yaml        or   ```yml   or   ```
 */
const stripFences = (raw) =>
  raw.replace(/^```(?:ya?ml)?\s*\n?/im, "").replace(/\n?```\s*$/m, "").trim();

/**
 * Replace hard tabs with 2 spaces (YAML spec forbids tabs).
 */
const fixTabs = (raw) => raw.replace(/\t/g, "  ");

/**
 * Remove non-ASCII / control characters that LLMs occasionally emit
 * (e.g. the Korean character 참 in the error above, stray UTF-8 BOM, etc.)
 * We keep standard printable ASCII + common safe Unicode (letters, digits,
 * punctuation, CJK only when intentional — but for CI YAML that's never needed).
 *
 * Strategy: strip characters that are almost certainly model glitches:
 *   - C0/C1 control codes except \n, \r, \t (already fixed above)
 *   - Unicode private-use area
 *   - Zero-width joiners / non-joiners / BOM
 */
const stripGarbled = (raw) =>
  raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // C0 controls
    .replace(/[\uFFFE\uFFFF]/g, "")          // non-characters
    .replace(/\uFEFF/g, "")                  // BOM
    .replace(/[\u200B-\u200D\u2060]/g, "");  // zero-width chars

/**
 * Fix duplicate mapping keys within the same step/block.
 *
 * The specific bug seen:
 *   - name: Install Dependencies
 *     run: mkdir -p ~/dist      ← first run: key
 *     run: pnpm install         ← duplicate → INVALID
 *
 * Fix: merge consecutive duplicate keys at the same indentation level
 * by joining their values with " && " (shell-safe for `run:` blocks).
 *
 * Algorithm:
 *   - Walk lines tracking (indent, key) pairs.
 *   - When we see the exact same key at the exact same indent as the
 *     previous sibling key, merge the value into the previous line
 *     using " && " and drop the duplicate line.
 */
const fixDuplicateKeys = (raw) => {
  const lines = raw.split("\n");
  const result = [];

  // Track the last seen key at each indentation depth
  // Map<indent → { lineIndex, key, value }>
  const lastKey = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match "  key: value" — simple scalar on same line
    const match = line.match(/^( *)([a-zA-Z_][\w-]*):\s*(.*)/);

    if (!match) {
      // Not a key line — reset tracking for deeper indents
      result.push(line);
      continue;
    }

    const [, indent, key, value] = match;
    const depth = indent.length;

    // Prune lastKey entries that are deeper than current (we've left their block)
    for (const d of [...lastKey.keys()]) {
      if (d > depth) lastKey.delete(d);
    }

    const prev = lastKey.get(depth);

    if (prev && prev.key === key) {
      // Duplicate key at same indent → merge into previous line
      const prevLine = result[prev.lineIndex];

      if (value.trim()) {
        // Append with && if both have values (handles duplicate `run:`)
        result[prev.lineIndex] = prevLine.trimEnd() + " && " + value.trim();
      }
      // Drop the duplicate line entirely (don't push)
      // Update the stored value so a third duplicate also merges correctly
      prev.value = result[prev.lineIndex];
    } else {
      // Normal key — record and push
      lastKey.set(depth, { lineIndex: result.length, key, value });
      result.push(line);
    }
  }

  return result.join("\n");
};

/**
 * Master sanitizer — run all fixes in order.
 * Returns the cleaned string ready for yaml.load().
 */
export const sanitizeYaml = (raw) => {
  if (!raw || typeof raw !== "string") return "";

  let out = raw;
  out = stripFences(out);
  out = fixTabs(out);
  out = stripGarbled(out);
  out = fixDuplicateKeys(out);
  return out;
};