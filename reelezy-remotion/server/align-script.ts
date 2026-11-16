// Lines the speech-to-text words up with a reference text (the person's script, or the speech-to-text's own full
// text), so captions get every word, spelt right, at the moment it is said.
//
// - A word heard and in the script keeps the time it was heard, with the script's spelling.
// - A scripted word the speech-to-text missed gets a time worked out from the words either side of it.
// - Where the person said something different to the script, what the script says is shown over that stretch.
// - Something said that is not in the script at all (an ad-lib) is kept as heard.
// - If the person clearly did not follow the script, the script is left out and the words are used as heard.

export type TimedWord = { word: string; start: number; end: number };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]/gu, '');

function similar(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

// The words of a script, leaving out notes in brackets like "[show the coffee]"
export function scriptTokens(text: string): string[] {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => norm(t).length > 0);
}

type Step = { kind: 'match' | 'sub' | 'ref' | 'heard'; r?: number; h?: number };

// Best line-up of the two word lists: like a spell-checker's edit distance, but for whole words
function lineUp(ref: string[], heard: string[]): Step[] {
  const R = ref.map(norm), H = heard.map(norm);
  const m = R.length, n = H.length;
  const GAP = 1;
  const cost = (i: number, j: number) => {
    const s = similar(R[i], H[j]);
    return s === 1 ? 0 : s >= 0.6 ? 0.6 : 2.2;
  };
  const dp = Array.from({ length: m + 1 }, () => new Float64Array(n + 1));
  for (let i = 1; i <= m; i++) dp[i][0] = i * GAP;
  for (let j = 1; j <= n; j++) dp[0][j] = j * GAP;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost(i - 1, j - 1), dp[i - 1][j] + GAP, dp[i][j - 1] + GAP);
  const steps: Step[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + cost(i - 1, j - 1)) {
      steps.push({ kind: cost(i - 1, j - 1) < 1 ? 'match' : 'sub', r: i - 1, h: j - 1 }); i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + GAP) {
      steps.push({ kind: 'ref', r: i - 1 }); i--;
    } else {
      steps.push({ kind: 'heard', h: j - 1 }); j--;
    }
  }
  return steps.reverse();
}

// Spread words across a stretch of time, longer words getting a little longer
export function spread(words: string[], start: number, end: number): TimedWord[] {
  const total = words.reduce((n, w) => n + Math.max(2, norm(w).length), 0);
  let t = start;
  return words.map((w) => {
    const d = ((end - start) * Math.max(2, norm(w).length)) / total;
    const out = { word: w, start: t, end: t + d };
    t += d;
    return out;
  });
}

// minShare: how much of the reference has to have been heard for it to be trusted
export function alignToText(heard: TimedWord[], reference: string, minShare = 0.5): TimedWord[] {
  const ref = scriptTokens(reference);
  if (heard.length === 0 || ref.length === 0) return heard;
  const steps = lineUp(ref, heard.map((w) => w.word.trim()));
  const matched = steps.filter((s) => s.kind === 'match').length;
  if (matched / ref.length < minShare) return heard;

  const out: TimedWord[] = [];
  // Walk through, collecting stretches between words that line up
  let pendRef: number[] = [], pendHeard: number[] = [];
  const flush = (nextStart: number | null) => {
    if (pendRef.length === 0 && pendHeard.length === 0) return;
    const prevEnd = out.length ? out[out.length - 1].end : null;
    if (pendHeard.length > 0) {
      const a = heard[pendHeard[0]], b = heard[pendHeard[pendHeard.length - 1]];
      if (pendRef.length > 0) {
        // Said differently to the script over this stretch: show the script's words across the time it took
        out.push(...spread(pendRef.map((r) => ref[r]), a.start, Math.max(b.end, a.start + 0.05)));
      } else {
        // Not in the script: keep what was said
        for (const h of pendHeard) out.push({ ...heard[h], word: heard[h].word.trim() });
      }
    } else {
      // Scripted words the speech-to-text missed: fit them into the gap if there was time to say them
      const s = prevEnd ?? Math.max(0, (nextStart ?? 0) - 0.3 * pendRef.length);
      const e = nextStart ?? s + 0.3 * pendRef.length;
      if (e - s >= 0.12 * pendRef.length) out.push(...spread(pendRef.map((r) => ref[r]), s, e));
      else if (pendRef.length <= 2 && out.length > 0) {
        // No gap left for them: the speech-to-text folded them into the word before, so they share its time
        const p = out.pop()!;
        out.push(...spread([p.word, ...pendRef.map((r) => ref[r])], p.start, Math.max(e, p.end)));
      }
    }
    pendRef = []; pendHeard = [];
  };
  for (const st of steps) {
    if (st.kind === 'match') {
      flush(heard[st.h!].start);
      out.push({ word: ref[st.r!], start: heard[st.h!].start, end: heard[st.h!].end });
    } else if (st.kind === 'sub') { pendRef.push(st.r!); pendHeard.push(st.h!); }
    else if (st.kind === 'ref') pendRef.push(st.r!);
    else pendHeard.push(st.h!);
  }
  flush(null);
  // Keep times in order and never overlapping
  for (let k = 1; k < out.length; k++) {
    if (out[k].start < out[k - 1].end) out[k].start = out[k - 1].end;
    if (out[k].end < out[k].start) out[k].end = out[k].start + 0.05;
  }
  return out;
}

// Captions clip by clip, for a filmed video where each clip has its own line of the script.
// Each clip's heard words are matched to that clip's line, so one clip that was heard badly (or not at all)
// cannot stop the others getting their captions. A clip with a line but nothing heard shows its line across the clip.
export function alignByClip(heard: TimedWord[], lines: string[], spans: { start: number; end: number }[]): TimedWord[] {
  const out: TimedWord[] = [];
  spans.forEach((sp, i) => {
    const from = i === 0 ? -Infinity : sp.start;
    const to = i === spans.length - 1 ? Infinity : sp.end;
    const inClip = heard.filter((w) => { const mid = (w.start + w.end) / 2; return mid >= from && mid < to; });
    const words = scriptTokens(lines[i] || '');
    if (words.length === 0) { out.push(...inClip); return; }
    let mine: TimedWord[];
    if (inClip.length > 0) {
      mine = alignToText(inClip, lines[i], 0.3);
    } else {
      const pad = Math.min(0.3, (sp.end - sp.start) * 0.1);
      mine = spread(words, sp.start + pad, Math.max(sp.start + pad + 0.1 * words.length, sp.end - pad));
    }
    // Words that ran past the end of the clip are squeezed back inside it
    const k = mine.findIndex((w) => w.end > sp.end + 0.05);
    if (k >= 0 && sp.end > sp.start) {
      const a = k > 0 ? Math.min(mine[k - 1].end, sp.end - 0.05 * (mine.length - k)) : sp.start;
      const tail = spread(mine.slice(k).map((w) => w.word), Math.max(sp.start, a), sp.end);
      mine = [...mine.slice(0, k), ...tail];
    }
    out.push(...mine);
  });
  for (let k = 1; k < out.length; k++) {
    if (out[k].start < out[k - 1].end) out[k].start = out[k - 1].end;
    if (out[k].end < out[k].start) out[k].end = out[k].start + 0.05;
  }
  return out;
}
