// Post-process Whisper transcript to fix proper nouns using user's profile data.
// Uses Levenshtein distance to catch phonetic near-misses (e.g. "kingcumber" → "kincumber").

type Word = { word: string; start: number; end: number };

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function correctTranscript(words: Word[], properNouns: string[]): Word[] {
  // Build a flat list of individual proper noun tokens (split multi-word names)
  const targets = properNouns.flatMap(n => n.split(/\s+/).filter(w => w.length > 3));
  if (targets.length === 0) return words;

  return words.map(w => {
    const norm = normalize(w.word);
    for (const target of targets) {
      const normTarget = normalize(target);
      // Only attempt correction if lengths are reasonably close
      if (Math.abs(norm.length - normTarget.length) > 3) continue;
      const dist = levenshtein(norm, normTarget);
      // Allow 1 edit per 4 chars of the target word
      const threshold = Math.max(1, Math.floor(normTarget.length / 4));
      if (dist > 0 && dist <= threshold) {
        // Preserve original capitalisation style
        const corrected = w.word[0] === w.word[0].toUpperCase()
          ? target.charAt(0).toUpperCase() + target.slice(1)
          : target;
        return { ...w, word: corrected };
      }
    }
    return w;
  });
}
