/**
 * Import workbook Excel/JSON — sheet TongHop hoặc export app.
 */
import * as XLSX from 'xlsx';
import { createDefaultBeam, type BeamInput } from '../engine/beam';
import { createDefaultColumn, type ColumnInput } from '../engine/column';
import { createDefaultSlab, type SlabInput } from '../engine/slab';
import { createDefaultFoundation, type FoundationInput } from '../engine/foundation';

export type ImportResult = {
  beams: BeamInput[];
  columns: ColumnInput[];
  slabs: SlabInput[];
  foundations: FoundationInput[];
  messages: string[];
};

const num = (v: unknown, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-eE]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v).trim());

function sheetToRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== '' && row[k] != null) return row[k];
  }
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lk in lower && lower[lk] !== '' && lower[lk] != null) return lower[lk];
  }
  return undefined;
}

function importBeamsFromRows(rows: Record<string, unknown>[]): BeamInput[] {
  const out: BeamInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Tên dầm', 'Ten dam', 'Dầm', 'Dam', 'name', 'Name', 'Tên']));
    if (!name && !pick(row, ['b', 'h', 'M+', 'MPositive'])) continue;
    const beam = createDefaultBeam();
    beam.name = name || `Dầm ${out.length + 1}`;
    beam.b = num(pick(row, ['b', 'b (mm)']), beam.b);
    beam.h = num(pick(row, ['h', 'h (mm)']), beam.h);
    beam.L = num(pick(row, ['L (m)', 'L', 'L nhịp']), beam.L ?? 0);
    beam.MPositive = num(pick(row, ['M+', 'MPositive', 'M+ ULS']), beam.MPositive);
    beam.MNegative = num(pick(row, ['M−', 'M-', 'MNegative', 'M- ULS']), beam.MNegative);
    beam.Q = num(pick(row, ['Q', 'Q (kN)']), beam.Q);
    const barsTop = str(pick(row, ['Thép trên', 'Thep tren', 'barsTop']));
    const barsBot = str(pick(row, ['Thép dưới', 'Thep duoi', 'barsBottom']));
    if (barsTop) beam.barsTop = barsTop;
    if (barsBot) beam.barsBottom = barsBot;
    out.push(beam);
  }
  return out;
}

function importColumnsFromRows(rows: Record<string, unknown>[]): ColumnInput[] {
  const out: ColumnInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Cột', 'Cot', 'Tên', 'name', 'Name']));
    if (!name && !pick(row, ['N', 'b', 'h'])) continue;
    const col = createDefaultColumn();
    col.name = name || `Cột ${out.length + 1}`;
    const bh = str(pick(row, ['b×h', 'b x h', 'bxh']));
    if (bh.includes('×') || bh.toLowerCase().includes('x')) {
      const parts = bh.split(/[×xX]/).map((s) => num(s));
      if (parts[0]) col.b = parts[0];
      if (parts[1]) col.h = parts[1];
    }
    col.b = num(pick(row, ['b', 'b (mm)']), col.b);
    col.h = num(pick(row, ['h', 'h (mm)']), col.h);
    col.N = num(pick(row, ['N', 'N (kN)']), col.N);
    col.Mx = num(pick(row, ['Mx', 'Mx (kNm)']), col.Mx);
    col.My = num(pick(row, ['My', 'My (kNm)']), col.My);
    const bars = str(pick(row, ['Thép', 'Thep', 'bars']));
    if (bars) col.bars = bars;
    out.push(col);
  }
  return out;
}

function importSlabsFromRows(rows: Record<string, unknown>[]): SlabInput[] {
  const out: SlabInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Sàn', 'San', 'Tên', 'name']));
    if (!name && !pick(row, ['h', 'Lx', 'Ly'])) continue;
    const s = createDefaultSlab();
    s.name = name || `Sàn ${out.length + 1}`;
    s.h = num(pick(row, ['h', 'h (mm)']), s.h);
    s.Lx = num(pick(row, ['Lx']), s.Lx);
    s.Ly = num(pick(row, ['Ly']), s.Ly);
    s.Mtop = num(pick(row, ['M−', 'M-', 'Mtop']), s.Mtop);
    s.Mbot = num(pick(row, ['M+', 'Mbot']), s.Mbot);
    s.Q = num(pick(row, ['Q']), s.Q);
    const bt = str(pick(row, ['Thép trên', 'barsTop']));
    const bb = str(pick(row, ['Thép dưới', 'barsBottom']));
    if (bt) s.barsTop = bt;
    if (bb) s.barsBottom = bb;
    out.push(s);
  }
  return out;
}

function importFoundationsFromRows(rows: Record<string, unknown>[]): FoundationInput[] {
  const out: FoundationInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Móng', 'Mong', 'Tên', 'name', 'Name']));
    if (!name && !pick(row, ['N', 'Lx', 'Ly'])) continue;
    const f = createDefaultFoundation();
    f.name = name || `Móng ${out.length + 1}`;
    f.Lx = num(pick(row, ['Lx', 'Bx']), f.Lx);
    f.Ly = num(pick(row, ['Ly', 'By']), f.Ly);
    f.Hf = num(pick(row, ['Hf']), f.Hf);
    f.N = num(pick(row, ['N', 'N (kN)', 'FZ']), f.N);
    f.Mx = num(pick(row, ['Mx', 'MX']), f.Mx);
    f.My = num(pick(row, ['My', 'MY']), f.My);
    f.Rtc = num(pick(row, ['Rtc']), f.Rtc);
    const bx = str(pick(row, ['Thép X', 'barsX']));
    const by = str(pick(row, ['Thép Y', 'barsY']));
    if (bx) f.barsX = bx;
    if (by) f.barsY = by;
    out.push(f);
  }
  return out;
}

function importFromJson(text: string): ImportResult {
  const data = JSON.parse(text);
  const messages: string[] = [];
  const beams: BeamInput[] = [];
  const columns: ColumnInput[] = [];
  const slabs: SlabInput[] = [];
  const foundations: FoundationInput[] = [];
  const beamList = Array.isArray(data) ? data : data.beams;
  if (Array.isArray(beamList)) {
    for (const b of beamList) beams.push({ ...createDefaultBeam(), ...b, id: b.id || crypto.randomUUID() });
    if (beams.length) messages.push(`JSON: ${beams.length} dầm`);
  }
  if (Array.isArray(data.columns)) {
    for (const c of data.columns) columns.push({ ...createDefaultColumn(), ...c, id: c.id || crypto.randomUUID() });
    if (columns.length) messages.push(`JSON: ${columns.length} cột`);
  }
  if (Array.isArray(data.slabs)) {
    for (const s of data.slabs) slabs.push({ ...createDefaultSlab(), ...s, id: s.id || crypto.randomUUID() });
    if (slabs.length) messages.push(`JSON: ${slabs.length} sàn`);
  }
  if (Array.isArray(data.foundations)) {
    for (const f of data.foundations) foundations.push({ ...createDefaultFoundation(), ...f, id: f.id || crypto.randomUUID() });
    if (foundations.length) messages.push(`JSON: ${foundations.length} móng`);
  }
  return { beams, columns, slabs, foundations, messages };
}

export async function importWorkbookFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return importFromJson(await file.text());

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const messages: string[] = [];
  let beams: BeamInput[] = [];
  let columns: ColumnInput[] = [];
  let slabs: SlabInput[] = [];
  let foundations: FoundationInput[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = sheetToRows(ws);
    if (!rows.length) continue;
    const lower = sheetName.toLowerCase();
    if (lower.includes('dam') || lower.includes('beam') || lower.includes('dầm')) {
      const list = importBeamsFromRows(rows);
      if (list.length) { beams = beams.concat(list); messages.push(`Sheet «${sheetName}»: ${list.length} dầm`); }
      continue;
    }
    if (lower.includes('cot') || lower.includes('column') || lower.includes('cột')) {
      const list = importColumnsFromRows(rows);
      if (list.length) { columns = columns.concat(list); messages.push(`Sheet «${sheetName}»: ${list.length} cột`); }
      continue;
    }
    if (lower.includes('san') || lower.includes('slab') || lower.includes('sàn')) {
      const list = importSlabsFromRows(rows);
      if (list.length) { slabs = slabs.concat(list); messages.push(`Sheet «${sheetName}»: ${list.length} sàn`); }
      continue;
    }
    if (lower.includes('mong') || lower.includes('found') || lower.includes('móng')) {
      const list = importFoundationsFromRows(rows);
      if (list.length) { foundations = foundations.concat(list); messages.push(`Sheet «${sheetName}»: ${list.length} móng`); }
      continue;
    }
    const headers = Object.keys(rows[0] || {}).join('|').toLowerCase();
    if (headers.includes('dầm') || headers.includes('mpositive') || headers.includes('m+')) {
      const list = importBeamsFromRows(rows);
      if (list.length) { beams = beams.concat(list); messages.push(`Sheet «${sheetName}» auto dầm: ${list.length}`); }
    } else if (headers.includes('cột') || (headers.includes('mx') && headers.includes('n'))) {
      const list = importColumnsFromRows(rows);
      if (list.length) { columns = columns.concat(list); messages.push(`Sheet «${sheetName}» auto cột: ${list.length}`); }
    } else if (headers.includes('sàn') || headers.includes('lx')) {
      const list = importSlabsFromRows(rows);
      if (list.length) { slabs = slabs.concat(list); messages.push(`Sheet «${sheetName}» auto sàn: ${list.length}`); }
    } else if (headers.includes('móng') || headers.includes('rtc')) {
      const list = importFoundationsFromRows(rows);
      if (list.length) { foundations = foundations.concat(list); messages.push(`Sheet «${sheetName}» auto móng: ${list.length}`); }
    }
  }
  if (!messages.length) messages.push('Không nhận diện được cấu kiện. Dùng sheet có cột Dầm/Cột/Sàn/Móng.');
  return { beams, columns, slabs, foundations, messages };
}
