/**
 * Import workbook Excel thật (Beam.xlsm / MongDon.xlsm / TongHop / Design) + JSON app.
 */
import * as XLSX from 'xlsx';
import { createDefaultBeam, type BeamInput } from '../engine/beam';
import { createDefaultColumn, type ColumnInput } from '../engine/column';
import { createDefaultSlab, type SlabInput } from '../engine/slab';
import { createDefaultFoundation, type FoundationInput } from '../engine/foundation';

export type SheetMapPreview = {
  sheet: string;
  kind: string;
  headers: string[];
  rowCount: number;
  emptyCells: string[];
};

export type ImportResult = {
  beams: BeamInput[];
  columns: ColumnInput[];
  slabs: SlabInput[];
  foundations: FoundationInput[];
  messages: string[];
  sheetMaps?: SheetMapPreview[];
};

const num = (v: unknown, fallback = 0): number => {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, '.').replace(/[^\d.\-eE]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v).trim());

function sheetToRows(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
}

function sheetToRowsFlexible(ws: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
  if (!aoa?.length) return [];
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(aoa.length, 25); i++) {
    const row = (aoa[i] || []).map((c) => String(c ?? '').trim());
    const joined = row.join('|').toLowerCase();
    const score =
      (joined.includes('tên') || joined.includes('name') || joined.includes('dầm') || joined.includes('móng') || joined.includes('cột') ? 1 : 0) +
      (joined.includes('b') && (joined.includes('h') || joined.includes('lx')) ? 1 : 0) +
      (joined.includes('m+') || joined.includes('m-') || joined.includes('fz') || joined.includes('|n|') || joined.includes('n (') ? 1 : 0);
    if (score >= 2 || (row.filter(Boolean).length >= 4 && joined.includes('kq'))) {
      headerIdx = i;
      headers = row.map((h, idx) => h || `col${idx}`);
      break;
    }
  }
  if (headerIdx < 0) return sheetToRows(ws);
  const out: Record<string, unknown>[] = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const cells = aoa[i] || [];
    if (!(cells as unknown[]).some((c) => c !== '' && c != null)) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      obj[h] = (cells as unknown[])[j] ?? '';
    });
    out.push(obj);
  }
  return out.length ? out : sheetToRows(ws);
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== '' && row[k] != null) return row[k];
  }
  const lowerMap = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ' ').trim(), v]));
  for (const k of keys) {
    const lk = k.toLowerCase();
    if (lowerMap.has(lk) && lowerMap.get(lk) !== '' && lowerMap.get(lk) != null) return lowerMap.get(lk);
  }
  for (const k of keys) {
    const lk = k.toLowerCase();
    for (const [hk, hv] of lowerMap) {
      if (hk.includes(lk) && hv !== '' && hv != null) return hv;
    }
  }
  return undefined;
}

function splitBH(v: unknown): { b?: number; h?: number } {
  const s = str(v);
  if (!s) return {};
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (m) return { b: num(m[1]), h: num(m[2]) };
  return {};
}

export function importBeamsFromRows(rows: Record<string, unknown>[]): BeamInput[] {
  const out: BeamInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Tên dầm', 'Ten dam', 'Dầm', 'Dam', 'Beam', 'name', 'Name', 'Tên', 'Ten', 'Ký hiệu', 'ID']));
    const hasGeom = pick(row, ['b', 'h', 'b (mm)', 'h (mm)', 'b×h']);
    const hasM = pick(row, ['M+', 'M−', 'M-', 'MPositive', 'MNegative', 'M+ ULS', 'M']);
    if (!name && !hasGeom && !hasM) continue;
    if (/tổng|tong|summary|ghi chú/i.test(name)) continue;
    const beam = createDefaultBeam();
    beam.id = crypto.randomUUID();
    beam.name = name || `Dầm ${out.length + 1}`;
    const bh = splitBH(pick(row, ['b×h', 'b x h', 'bxh', 'Tiết diện']));
    if (bh.b) beam.b = bh.b;
    if (bh.h) beam.h = bh.h;
    beam.b = num(pick(row, ['b', 'b (mm)', 'B']), beam.b);
    beam.h = num(pick(row, ['h', 'h (mm)', 'H']), beam.h);
    beam.L = num(pick(row, ['L (m)', 'L', 'L nhịp', 'Nhịp', 'Span']), beam.L ?? 0);
    beam.MPositive = num(pick(row, ['M+', 'MPositive', 'M+ ULS', 'Mpos', 'M dưới']), beam.MPositive);
    beam.MNegative = num(pick(row, ['M−', 'M-', 'MNegative', 'M- ULS', 'Mneg', 'M trên']), beam.MNegative);
    if (!beam.MPositive && !beam.MNegative) {
      const m = num(pick(row, ['M', 'Mmax', 'M ULS']));
      if (m) beam.MPositive = Math.abs(m);
    }
    beam.Q = num(pick(row, ['Q', 'Q (kN)', 'V', 'Qmax']), beam.Q);
    beam.concrete = str(pick(row, ['Bê tông', 'Concrete', 'BT']), beam.concrete) || beam.concrete;
    beam.steel = str(pick(row, ['Thép dọc', 'Steel', 'Thép']), beam.steel) || beam.steel;
    const barsTop = str(pick(row, ['Thép trên', 'barsTop', 'Cốt trên']));
    const barsBot = str(pick(row, ['Thép dưới', 'barsBottom', 'Cốt dưới']));
    if (barsTop) beam.barsTop = barsTop;
    if (barsBot) beam.barsBottom = barsBot;
    out.push(beam);
  }
  return out;
}

export function importColumnsFromRows(rows: Record<string, unknown>[]): ColumnInput[] {
  const out: ColumnInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Cột', 'Cot', 'Column', 'Tên', 'name', 'Name', 'Ký hiệu']));
    if (!name && !pick(row, ['N', 'b', 'h'])) continue;
    if (/tổng|tong|summary/i.test(name)) continue;
    const col = createDefaultColumn();
    col.id = crypto.randomUUID();
    col.name = name || `Cột ${out.length + 1}`;
    const bh = splitBH(pick(row, ['b×h', 'b x h', 'bxh', 'Tiết diện']));
    if (bh.b) col.b = bh.b;
    if (bh.h) col.h = bh.h;
    col.b = num(pick(row, ['b', 'b (mm)']), col.b);
    col.h = num(pick(row, ['h', 'h (mm)']), col.h);
    col.L0x = num(pick(row, ['L0x', 'L0x (mm)']), col.L0x);
    col.L0y = num(pick(row, ['L0y', 'L0y (mm)']), col.L0y);
    col.N = num(pick(row, ['N', 'N (kN)', 'FZ', 'P']), col.N);
    col.Mx = num(pick(row, ['Mx', 'Mx (kNm)', 'MX']), col.Mx);
    col.My = num(pick(row, ['My', 'My (kNm)', 'MY']), col.My);
    const bars = str(pick(row, ['Thép', 'bars', 'Cốt dọc']));
    if (bars) col.bars = bars;
    out.push(col);
  }
  return out;
}

export function importSlabsFromRows(rows: Record<string, unknown>[]): SlabInput[] {
  const out: SlabInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Sàn', 'San', 'Slab', 'Tên', 'name', 'Ký hiệu']));
    if (!name && !pick(row, ['h', 'Lx', 'Ly'])) continue;
    if (/tổng|tong|summary/i.test(name)) continue;
    const s = createDefaultSlab();
    s.id = crypto.randomUUID();
    s.name = name || `Sàn ${out.length + 1}`;
    s.h = num(pick(row, ['h', 'h (mm)', 'H']), s.h);
    s.Lx = num(pick(row, ['Lx', 'Lx (m)']), s.Lx);
    s.Ly = num(pick(row, ['Ly', 'Ly (m)']), s.Ly);
    s.Mtop = num(pick(row, ['M−', 'M-', 'Mtop', 'Mx trên']), s.Mtop);
    s.Mbot = num(pick(row, ['M+', 'Mbot', 'Mx dưới']), s.Mbot);
    s.MxTop = num(pick(row, ['MxTop', 'Mx trên', 'Mx-']), s.Mtop);
    s.MxBot = num(pick(row, ['MxBot', 'Mx dưới', 'Mx+']), s.Mbot);
    s.MyTop = num(pick(row, ['MyTop', 'My trên', 'My-']), s.MyTop ?? s.Mtop);
    s.MyBot = num(pick(row, ['MyBot', 'My dưới', 'My+']), s.MyBot ?? s.Mbot);
    s.Q = num(pick(row, ['Q', 'Q (kN/m)']), s.Q);
    s.N = num(pick(row, ['N', 'N cột', 'Phản lực']), s.N ?? 0);
    s.colB = num(pick(row, ['colB', 'b cột', 'B cột']), s.colB ?? 0);
    s.colH = num(pick(row, ['colH', 'h cột', 'H cột']), s.colH ?? 0);
    const bt = str(pick(row, ['Thép trên', 'barsTop']));
    const bb = str(pick(row, ['Thép dưới', 'barsBottom']));
    if (bt) s.barsTop = bt;
    if (bb) s.barsBottom = bb;
    const btx = str(pick(row, ['Thép trên X', 'barsTopX']));
    const bty = str(pick(row, ['Thép trên Y', 'barsTopY']));
    const bbx = str(pick(row, ['Thép dưới X', 'barsBotX']));
    const bby = str(pick(row, ['Thép dưới Y', 'barsBotY']));
    if (btx) s.barsTopX = btx;
    if (bty) s.barsTopY = bty;
    if (bbx) s.barsBotX = bbx;
    if (bby) s.barsBotY = bby;
    out.push(s);
  }
  return out;
}

export function importFoundationsFromRows(rows: Record<string, unknown>[]): FoundationInput[] {
  const out: FoundationInput[] = [];
  for (const row of rows) {
    const name = str(pick(row, ['Móng', 'Mong', 'Foundation', 'Tên', 'name', 'Name', 'Ký hiệu', 'Mã']));
    if (!name && !pick(row, ['N', 'Lx', 'Ly', 'FZ', 'Bx', 'By'])) continue;
    if (/tổng|tong|summary|ghi chú/i.test(name)) continue;
    const f = createDefaultFoundation();
    f.id = crypto.randomUUID();
    f.name = name || `Móng ${out.length + 1}`;
    const size = splitBH(pick(row, ['Lx×Ly', 'Lx x Ly', 'Bx×By', 'Kích thước']));
    if (size.b) f.Lx = size.b;
    if (size.h) f.Ly = size.h;
    f.Lx = num(pick(row, ['Lx', 'Bx', 'L']), f.Lx);
    f.Ly = num(pick(row, ['Ly', 'By', 'B']), f.Ly);
    f.Hf = num(pick(row, ['Hf', 'H', 'Chiều cao móng']), f.Hf);
    f.Df = num(pick(row, ['Df', 'Độ sâu']), f.Df);
    f.colB = num(pick(row, ['colB', 'b cột', 'bc']), f.colB);
    f.colH = num(pick(row, ['colH', 'h cột', 'hc']), f.colH);
    f.N = num(pick(row, ['N', 'N (kN)', 'FZ', 'P']), f.N);
    f.Mx = num(pick(row, ['Mx', 'MX']), f.Mx);
    f.My = num(pick(row, ['My', 'MY']), f.My);
    f.Fx = num(pick(row, ['Fx', 'FX']), f.Fx ?? 0);
    f.Fy = num(pick(row, ['Fy', 'FY']), f.Fy ?? 0);
    f.ex = num(pick(row, ['ex']), f.ex ?? 0);
    f.ey = num(pick(row, ['ey']), f.ey ?? 0);
    f.Rtc = num(pick(row, ['Rtc', 'R', 'R0']), f.Rtc);
    const bx = str(pick(row, ['Thép X', 'barsX', 'Asx']));
    const by = str(pick(row, ['Thép Y', 'barsY', 'Asy']));
    if (bx) f.barsX = bx;
    if (by) f.barsY = by;
    out.push(f);
  }
  return out;
}

function importTongHopMixed(rows: Record<string, unknown>[]): ImportResult {
  const beams: BeamInput[] = [];
  const columns: ColumnInput[] = [];
  const slabs: SlabInput[] = [];
  const foundations: FoundationInput[] = [];
  const messages: string[] = [];
  const beamRows: Record<string, unknown>[] = [];
  const colRows: Record<string, unknown>[] = [];
  const slabRows: Record<string, unknown>[] = [];
  const fndRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const loai = str(pick(row, ['Loại', 'Loai', 'Type', 'Module', 'CK'])).toLowerCase();
    if (/dầm|dam|beam/.test(loai)) beamRows.push(row);
    else if (/cột|cot|column/.test(loai)) colRows.push(row);
    else if (/sàn|san|slab/.test(loai)) slabRows.push(row);
    else if (/móng|mong|found/.test(loai)) fndRows.push(row);
    else if (pick(row, ['M+', 'M−', 'M-', 'Q']) && pick(row, ['b', 'h', 'b×h'])) beamRows.push(row);
    else if (pick(row, ['N', 'FZ']) && (pick(row, ['Lx', 'Bx']) || pick(row, ['Rtc']))) fndRows.push(row);
    else if (pick(row, ['N']) && pick(row, ['Mx', 'My'])) colRows.push(row);
    else if (pick(row, ['Lx', 'Ly', 'h'])) slabRows.push(row);
  }
  beams.push(...importBeamsFromRows(beamRows));
  columns.push(...importColumnsFromRows(colRows));
  slabs.push(...importSlabsFromRows(slabRows));
  foundations.push(...importFoundationsFromRows(fndRows));
  if (!beams.length && !columns.length && !slabs.length && !foundations.length && rows.length) {
    beams.push(...importBeamsFromRows(rows));
    foundations.push(...importFoundationsFromRows(rows));
    columns.push(...importColumnsFromRows(rows));
  }
  if (beams.length) messages.push(`TongHop: ${beams.length} dầm`);
  if (columns.length) messages.push(`TongHop: ${columns.length} cột`);
  if (slabs.length) messages.push(`TongHop: ${slabs.length} sàn`);
  if (foundations.length) messages.push(`TongHop: ${foundations.length} móng`);
  return { beams, columns, slabs, foundations, messages };
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

function classifySheet(name: string, headers: string): 'beam' | 'column' | 'slab' | 'foundation' | 'tonghop' | 'unknown' {
  const lower = name.toLowerCase();
  const h = headers.toLowerCase();
  if (lower.includes('tonghop') || lower.includes('tổng hợp') || lower.includes('summary')) return 'tonghop';
  if (lower.includes('dam') || lower.includes('beam') || lower.includes('dầm') || lower.includes('kiemtrauon')) return 'beam';
  if (lower.includes('cot') || lower.includes('column') || lower.includes('cột')) return 'column';
  if (lower.includes('san') || lower.includes('slab') || lower.includes('sàn')) return 'slab';
  if (lower.includes('mong') || lower.includes('found') || lower.includes('móng') || lower.includes('design_mong')) return 'foundation';
  if (lower.includes('design') && (h.includes('fz') || h.includes('rtc'))) return 'foundation';
  if (lower.includes('design') && (h.includes('m+') || h.includes('q'))) return 'beam';
  if (h.includes('loại') || h.includes('loai')) return 'tonghop';
  if (h.includes('dầm') || h.includes('m+')) return 'beam';
  if (h.includes('móng') || h.includes('rtc') || h.includes('fz')) return 'foundation';
  return 'unknown';
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
  const sheetMaps: SheetMapPreview[] = [];
  const ordered = [...wb.SheetNames].sort((a, b) => {
    const score = (n: string) => {
      const l = n.toLowerCase();
      if (l.includes('tonghop') || l.includes('tổng')) return 0;
      if (l.includes('design')) return 1;
      if (l.includes('dam') || l.includes('beam') || l.includes('mong')) return 2;
      return 5;
    };
    return score(a) - score(b);
  });
  for (const sheetName of ordered) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = sheetToRowsFlexible(ws);
    const headerList = rows.length ? Object.keys(rows[0] || {}) : [];
    const headers = headerList.join('|');
    const kind = classifySheet(sheetName, headers);
    if (!rows.length) {
      messages.push(`Sheet «${sheetName}»: trống — bỏ qua`);
      sheetMaps.push({ sheet: sheetName, kind, headers: headerList, rowCount: 0, emptyCells: [] });
      continue;
    }
    const emptyCells: string[] = [];
    for (let ri = 0; ri < Math.min(rows.length, 30); ri++) {
      const row = rows[ri];
      for (const h of headerList.slice(0, 12)) {
        const v = row[h];
        if (v === '' || v == null) emptyCells.push(`Hàng ${ri + 2} · cột «${h}» trống`);
      }
    }
    const emptyPreview = emptyCells.slice(0, 8);
    sheetMaps.push({
      sheet: sheetName,
      kind,
      headers: headerList.slice(0, 12),
      rowCount: rows.length,
      emptyCells: emptyPreview,
    });
    if (emptyPreview.length) {
      messages.push(`«${sheetName}»: ${emptyPreview.length} ô trống (mẫu) — ${emptyPreview.slice(0, 3).join('; ')}`);
    }
    if (kind === 'tonghop') {
      const mixed = importTongHopMixed(rows);
      beams = beams.concat(mixed.beams);
      columns = columns.concat(mixed.columns);
      slabs = slabs.concat(mixed.slabs);
      foundations = foundations.concat(mixed.foundations);
      messages.push(...mixed.messages.map((m) => `«${sheetName}» ${m}`));
      continue;
    }
    if (kind === 'beam') {
      const list = importBeamsFromRows(rows);
      if (list.length) {
        beams = beams.concat(list);
        messages.push(`Sheet «${sheetName}»: ${list.length} dầm`);
      }
      continue;
    }
    if (kind === 'column') {
      const list = importColumnsFromRows(rows);
      if (list.length) {
        columns = columns.concat(list);
        messages.push(`Sheet «${sheetName}»: ${list.length} cột`);
      }
      continue;
    }
    if (kind === 'slab') {
      const list = importSlabsFromRows(rows);
      if (list.length) {
        slabs = slabs.concat(list);
        messages.push(`Sheet «${sheetName}»: ${list.length} sàn`);
      }
      continue;
    }
    if (kind === 'foundation') {
      const list = importFoundationsFromRows(rows);
      if (list.length) {
        foundations = foundations.concat(list);
        messages.push(`Sheet «${sheetName}»: ${list.length} móng`);
      }
      continue;
    }
    const mixed = importTongHopMixed(rows);
    if (mixed.beams.length || mixed.foundations.length || mixed.columns.length || mixed.slabs.length) {
      beams = beams.concat(mixed.beams);
      columns = columns.concat(mixed.columns);
      slabs = slabs.concat(mixed.slabs);
      foundations = foundations.concat(mixed.foundations);
      messages.push(...mixed.messages.map((m) => `«${sheetName}» ${m}`));
    } else {
      messages.push(`Sheet «${sheetName}»: không map được (kind=${kind}) — headers: ${headerList.slice(0, 8).join(', ')}`);
    }
  }
  if (!beams.length && !columns.length && !slabs.length && !foundations.length) {
    messages.push('Không nhận diện được hàng dữ liệu — kiểm tra sheet TongHop/Design có header Tên, b, h, M+/M− hoặc FZ, Lx, Ly.');
  }
  return { beams, columns, slabs, foundations, messages, sheetMaps };
}
