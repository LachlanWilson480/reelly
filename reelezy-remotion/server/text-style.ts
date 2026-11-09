import fs from 'node:fs';
import path from 'node:path';

// Font choice (bold, italic) and text measuring for captions. drawtext cannot underline or measure text for us,
// so we read the font file ourselves: that tells us how wide a line is and where its baseline sits.

const FONT_DIR = '/usr/share/fonts/truetype/liberation';
const FAMILIES: Record<string, string> = { Sans: 'LiberationSans', Serif: 'LiberationSerif', Mono: 'LiberationMono', Narrow: 'LiberationSansNarrow' };

export type TextFlags = { bold?: boolean; italic?: boolean; underline?: boolean };

const familyOf = (name?: string): string => {
  const n = (name || '').toLowerCase();
  if (n.startsWith('serif')) return 'Serif';
  if (n.startsWith('mono')) return 'Mono';
  if (n.startsWith('narrow') || /impact|anton|bebas|oswald/.test(n)) return 'Narrow';
  return 'Sans';
};

// Is this font bold when nothing else is said? ("Sans Bold", "Impact" and so on are, "Sans" is not)
export const isBoldByDefault = (name?: string): boolean => /bold|impact|anton|bebas/i.test(name || '');

// The font file for a font name plus the person's bold / italic choices. Falls back to what exists.
export function resolveFontFile(name: string | undefined, flags: TextFlags = {}): string | null {
  const base = FAMILIES[familyOf(name)];
  const bold = flags.bold ?? isBoldByDefault(name);
  const italic = flags.italic === true;
  const order = [
    bold && italic ? 'BoldItalic' : null,
    italic ? 'Italic' : null,
    bold ? 'Bold' : null,
    'Regular',
  ].filter((v): v is string => !!v);
  for (const style of order) {
    const file = path.join(FONT_DIR, `${base}-${style}.ttf`);
    if (fs.existsSync(file)) return file;
  }
  const fallback = path.join(FONT_DIR, 'LiberationSans-Bold.ttf');
  return fs.existsSync(fallback) ? fallback : null;
}

type Font = {
  unitsPerEm: number;
  advance: (glyph: number) => number;
  glyphOf: (code: number) => number;
  bounds: (glyph: number) => { yMin: number; yMax: number } | null;
};
const cache = new Map<string, Font | null>();

function loadFont(file: string): Font | null {
  if (cache.has(file)) return cache.get(file)!;
  let font: Font | null = null;
  try {
    const b = fs.readFileSync(file);
    const tables: Record<string, number> = {};
    const count = b.readUInt16BE(4);
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      tables[b.toString('ascii', at, at + 4)] = b.readUInt32BE(at + 8);
    }
    const head = tables.head, hhea = tables.hhea, hmtx = tables.hmtx, cmap = tables.cmap, loca = tables.loca, glyf = tables.glyf;
    if ([head, hhea, hmtx, cmap, loca, glyf].some((v) => v === undefined)) throw new Error('missing table');
    const unitsPerEm = b.readUInt16BE(head + 18);
    const longLoca = b.readInt16BE(head + 50) === 1;
    const metrics = b.readUInt16BE(hhea + 34);
    // cmap: find a Unicode format 4 table
    let sub = -1;
    const nTables = b.readUInt16BE(cmap + 2);
    for (let i = 0; i < nTables; i++) {
      const pid = b.readUInt16BE(cmap + 4 + i * 8), eid = b.readUInt16BE(cmap + 6 + i * 8), off = b.readUInt32BE(cmap + 8 + i * 8);
      if ((pid === 3 && eid === 1) || pid === 0) { if (b.readUInt16BE(cmap + off) === 4) { sub = cmap + off; if (pid === 3) break; } }
    }
    if (sub < 0) throw new Error('no cmap');
    const segX2 = b.readUInt16BE(sub + 6);
    const endCodes = sub + 14, startCodes = endCodes + segX2 + 2, deltas = startCodes + segX2, rangeOffsets = deltas + segX2;
    const glyphOf = (code: number): number => {
      for (let i = 0; i < segX2; i += 2) {
        const end = b.readUInt16BE(endCodes + i);
        if (code > end) continue;
        const start = b.readUInt16BE(startCodes + i);
        if (code < start) return 0;
        const delta = b.readInt16BE(deltas + i);
        const ro = b.readUInt16BE(rangeOffsets + i);
        if (ro === 0) return (code + delta) & 0xffff;
        const g = b.readUInt16BE(rangeOffsets + i + ro + (code - start) * 2);
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
      return 0;
    };
    const advance = (g: number) => b.readUInt16BE(hmtx + Math.min(g, metrics - 1) * 4);
    const offsetOf = (g: number) => (longLoca ? b.readUInt32BE(loca + g * 4) : b.readUInt16BE(loca + g * 2) * 2);
    const bounds = (g: number) => {
      const a = offsetOf(g), z = offsetOf(g + 1);
      if (z <= a) return null; // no outline, like a space
      return { yMin: b.readInt16BE(glyf + a + 4), yMax: b.readInt16BE(glyf + a + 8) };
    };
    font = { unitsPerEm, advance, glyphOf, bounds };
  } catch {
    font = null;
  }
  cache.set(file, font);
  return font;
}

export type Measured = { width: number; inkTop: number; inkHeight: number };

// Width of a line at a font size, plus where the ink starts above the pen (inkTop) and how tall it is,
// which is what drawtext uses for its own y position.
export function measureText(file: string | null, text: string, size: number): Measured | null {
  if (!file) return null;
  const f = loadFont(file);
  if (!f) return null;
  let units = 0, top = -Infinity, bottom = Infinity;
  for (const ch of text) {
    const g = f.glyphOf(ch.codePointAt(0) || 0);
    units += f.advance(g);
    const bd = f.bounds(g);
    if (bd) { top = Math.max(top, bd.yMax); bottom = Math.min(bottom, bd.yMin); }
  }
  if (!Number.isFinite(top)) { top = f.unitsPerEm * 0.7; bottom = 0; }
  const k = size / f.unitsPerEm;
  return { width: units * k, inkTop: top * k, inkHeight: (top - bottom) * k };
}

// Breaks text into lines no wider than maxPx, using the real width of the font when we can measure it
export function wrapText(file: string | null, text: string, size: number, maxPx: number, maxLines: number, fallbackCharW = 0.6): string[] {
  const widthOf = (t: string) => measureText(file, t, size)?.width ?? t.length * size * fallbackCharW;
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && widthOf(next) > maxPx) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

// The drawbox that underlines one line of text. (left, top) is where drawtext puts the ink: top of the tallest letter.
export function underlineBox(m: Measured, size: number, left: number, top: number, color: string, enable: string): string {
  const baseline = top + m.inkTop;
  const thick = Math.max(2, Math.round(size * 0.07));
  const y = Math.round(baseline + size * 0.1);
  return `drawbox=x=${Math.round(left)}:y=${y}:w=${Math.round(m.width)}:h=${thick}:color=${color}:t=fill:enable='${enable}'`;
}
