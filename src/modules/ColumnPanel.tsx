import { useEffect, useMemo, useRef, useState } from 'react';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from '../engine/column';
import { concretes, steels } from '../engine/materials';
import { openReportPdf, columnReportDoc } from '../report/reportPdf';
import { columnThuyetMinhDoc } from '../report/thuyetMinhMulti';
import * as XLSX from 'xlsx';
import { exportGenericExcel } from '../report/excelReport';
import { exportReportWord } from '../report/wordReport';

const STORAGE = 'ketcau-btct-5574-columns-v1';
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

function loadList(): ColumnInput[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    if (Array.isArray(raw) && raw.length) return raw.map((c) => ({ ...createDefaultColumn(), ...c }));
  } catch { /* ignore */ }
  return [createDefaultColumn('c1')];
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ColumnPanel() {
  const [items, setItems] = useState<ColumnInput[]>(loadList);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = items.find((c) => c.id === selectedId) ?? items[0];

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(items));
  }, [items]);

  const results = useMemo(
    () =>
      items.map((col) => {
        const p = parseColumnBars(col.bars ?? '');
        const input = { ...col, ...(p.ok ? { As: p.As, nBars: p.n, barDia: p.dia } : {}) };
        return { col: input, result: calcColumn(input) };
      }),
    [items]
  );
  const current = results.find((r) => r.col.id === selected.id) ?? results[0];
  const result = current.result;
  const parsed = parseColumnBars(selected.bars ?? '');

  const patch = (p: Partial<ColumnInput>) =>
    setItems((list) => list.map((c) => (c.id === selected.id ? { ...c, ...p } : c)));
  const setNum = (key: keyof ColumnInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    patch({ [key]: Number.isFinite(n) ? n : 0 } as Partial<ColumnInput>);
  };
  const setStr = (key: keyof ColumnInput, value: string) => patch({ [key]: value } as Partial<ColumnInput>);

  const add = () => {
    const c = createDefaultColumn();
    c.name = `Cột ${items.length + 1}`;
    setItems((list) => [...list, c]);
    setSelectedId(c.id);
  };
  const remove = () => {
    if (items.length === 1) return;
    const rest = items.filter((c) => c.id !== selected.id);
    setItems(rest);
    setSelectedId(rest[0].id);
  };

  const exportJson = () =>
    download(
      'cot-btct.json',
      JSON.stringify({ version: 'column-v1.2', exportedAt: new Date().toISOString(), columns: items }, null, 2),
      'application/json'
    );

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const list: ColumnInput[] = Array.isArray(data) ? data : data.columns;
        if (!Array.isArray(list) || !list.length) throw new Error('empty');
        const normalized = list.map((c) => ({
          ...createDefaultColumn(),
          ...c,
          id: c.id || crypto.randomUUID(),
        }));
        setItems(normalized);
        setSelectedId(normalized[0].id);
      } catch {
        alert('Không đọc được file JSON cột.');
      }
    };
    reader.readAsText(file);
  };

  const exportExcel = () => {
    const summary = results.map(({ col, result: r }) => ({
      Cột: col.name,
      'b×h (mm)': `${col.b}×${col.h}`,
      'L0x / L0y': `${col.L0x}/${col.L0y}`,
      N: col.N,
      Mx: col.Mx,
      My: col.My,
      Thép: col.bars || '',
      'μ (%)': Number(r.mu.toFixed(3)),
      λmax: Number(r.lambdaMax.toFixed(1)),
      vd: Number(r.vd.toFixed(3)),
      'N–M': Number(r.interaction.toFixed(3)),
      'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    }));
    exportGenericExcel('THUYẾT MINH TÍNH TOÁN CỘT BÊ TÔNG CỐT THÉP', 'ThuyetMinh-Cot-BTCT', [
      { name: 'TongHop', rows: summary },
    ]);
  };

  const exportCsv = () => {
    const summary = results.map(({ col, result: r }) => ({
      Cột: col.name,
      'b×h': `${col.b}×${col.h}`,
      N: col.N,
      Mx: col.Mx,
      My: col.My,
      'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    }));
    const csv = '\ufeff' + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(summary));
    download('tong-hop-cot-btct.csv', csv, 'text/csv;charset=utf-8');
  };
  const exportTmPdf = () => openReportPdf(columnThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }));
  const exportTmWord = () => void exportReportWord(columnThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }), 'ThuyetMinh-Cot.docx');

  return (
    <>
      <header>
        <div>
          <h1>Cột BTCT</h1>
          <p>Độ mảnh · N–M · Đai · vd≤0.65</p>
        </div>
        <div className="actions">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = '';
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={exportJson}>JSON</button>
          <button type="button" onClick={exportCsv}>CSV</button>
          <button type="button" onClick={exportExcel}>Excel báo cáo</button>
          <button type="button" onClick={() => openReportPdf(columnReportDoc(selected, result))}>PDF cột</button>
          <button type="button" onClick={exportTmPdf}>TM PDF</button>
          <button type="button" className="primary" onClick={exportTmWord}>TM Word</button>
        </div>
      </header>

      <section className="notice">
        <b>Cột:</b> N–M gần đúng. Thép <code>8d20</code> → As khóa. Toolbar: Import JSON · JSON · CSV · Excel · PDF · TM PDF · TM Word.
      </section>

      <div className="workspace">
        <section className="beam-list card">
          <div className="card-title">
            <h2>Danh sách cột</h2>
            <button type="button" className="primary" onClick={add}>+ Thêm</button>
          </div>
          {results.map(({ col, result: r }) => (
            <button
              key={col.id}
              type="button"
              className={`beam-item ${col.id === selected.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(col.id)}
            >
              <span>
                <b>{col.name}</b>
                <small>{col.b}×{col.h} · N={fmt(col.N, 0)}</small>
              </span>
              <span className={`status ${r.pass ? 'pass' : 'fail'}`}>{r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
            </button>
          ))}
        </section>

        <section className="input card">
          <div className="card-title">
            <h2>Đầu vào: {selected.name}</h2>
            <button type="button" className="danger" onClick={remove} disabled={items.length === 1}>Xóa</button>
          </div>
          <fieldset>
            <legend>Kích thước & tải</legend>
            <div className="form">
              <label>Tên<input value={selected.name} onChange={(e) => setStr('name', e.target.value)} /></label>
              <label>b (mm)<input type="number" step="1" value={selected.b} onChange={(e) => setNum('b', e.target.value)} /></label>
              <label>h (mm)<input type="number" step="1" value={selected.h} onChange={(e) => setNum('h', e.target.value)} /></label>
              <label>L0x (mm)<input type="number" step="1" value={selected.L0x} onChange={(e) => setNum('L0x', e.target.value)} /></label>
              <label>L0y (mm)<input type="number" step="1" value={selected.L0y} onChange={(e) => setNum('L0y', e.target.value)} /></label>
              <label>N (kN)<input type="number" step="0.1" value={selected.N} onChange={(e) => setNum('N', e.target.value)} /></label>
              <label>Mx (kNm)<input type="number" step="0.1" value={selected.Mx} onChange={(e) => setNum('Mx', e.target.value)} /></label>
              <label>My (kNm)<input type="number" step="0.1" value={selected.My} onChange={(e) => setNum('My', e.target.value)} /></label>
              <label>Qx (kN)<input type="number" step="0.1" value={selected.Qx ?? 0} onChange={(e) => setNum('Qx', e.target.value)} /></label>
              <label>Qy (kN)<input type="number" step="0.1" value={selected.Qy ?? 0} onChange={(e) => setNum('Qy', e.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Vật liệu & thép</legend>
            <div className="form">
              <label>Bê tông<select value={selected.concrete} onChange={(e) => setStr('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép dọc<select value={selected.steel} onChange={(e) => setStr('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép đai<select value={selected.stirrupSteel} onChange={(e) => setStr('stirrupSteel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Cốt dọc<input value={selected.bars ?? ''} placeholder="12d20" onChange={(e) => setStr('bars', e.target.value)} /></label>
              <label>As (mm²)<input type="number" readOnly value={parsed.ok ? parsed.As : 0} style={{ background: '#f3f4f6' }} /></label>
              <label>Cover (mm)<input type="number" step="1" value={selected.cover} onChange={(e) => setNum('cover', e.target.value)} /></label>
              <label>Đai Ø<input type="number" step="1" value={selected.stirrupDia} onChange={(e) => setNum('stirrupDia', e.target.value)} /></label>
              <label>a đai<input type="number" step="1" value={selected.stirrupSpacing} onChange={(e) => setNum('stirrupSpacing', e.target.value)} /></label>
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>{result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
          </div>
          <section className="result-section">
            <div className="result"><span>μ / λmax / vd</span><strong>{fmt(result.mu, 3)}% / {fmt(result.lambdaMax, 1)} / {fmt(result.vd, 3)}</strong></div>
            <div className="result"><span>N–M (gần đúng)</span><strong>{fmt(result.interaction, 3)}</strong></div>
            <NMDiagram N={selected.N} Mx={selected.Mx} My={selected.My} N0={result.N0} Mx0={result.Mx0} My0={result.My0} interaction={result.interaction} />
            <div className="checks">
              {Object.values(result.checks).map((c, i) => (
                <div key={i} className={c.pass ? 'text-pass' : 'text-fail'}>{c.pass ? '✓' : '×'} {c.message}</div>
              ))}
              <div className={result.shearX.check.pass ? 'text-pass' : 'text-fail'}>{result.shearX.check.pass ? '✓' : '×'} Qx: {result.shearX.check.message}</div>
              <div className={result.shearY.check.pass ? 'text-pass' : 'text-fail'}>{result.shearY.check.pass ? '✓' : '×'} Qy: {result.shearY.check.message}</div>
            </div>
          </section>
        </section>
      </div>

      <section className="summary card">
        <div className="card-title"><h2>Bảng tổng hợp cột</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cột</th><th>b×h</th><th>N–M</th><th>vd</th><th>Tổng</th></tr>
            </thead>
            <tbody>
              {results.map(({ col, result: r }) => (
                <tr key={col.id}>
                  <td>{col.name}</td>
                  <td>{col.b}×{col.h}</td>
                  <td><span className={`status ${r.checks.interaction.pass ? 'pass' : 'fail'}`}>{r.checks.interaction.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.checks.compressionRatio.pass ? 'pass' : 'fail'}`}>{r.checks.compressionRatio.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.pass ? 'pass' : 'fail'}`}>{r.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function NMDiagram({
  N, Mx, My, N0, Mx0, My0, interaction,
}: {
  N: number; Mx: number; My: number; N0: number; Mx0: number; My0: number; interaction: number;
}) {
  const W = 280, H = 180, pad = 32;
  const nMax = Math.max(Math.abs(N0), Math.abs(N), 1);
  const mMax = Math.max(Math.abs(Mx0), Math.abs(My0), Math.abs(Mx), Math.abs(My), 1);
  const cx = pad + 10, cy = H - pad;
  const sx = (W - 2 * pad - 20) / nMax;
  const sy = (H - 2 * pad) / mMax;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * (Math.PI / 2);
    const n = N0 * Math.cos(t);
    const m = Mx0 * Math.sin(t);
    pts.push(`${cx + Math.abs(n) * sx},${cy - Math.abs(m) * sy}`);
  }
  const px = cx + Math.abs(N) * sx;
  const py = cy - Math.hypot(Mx, My) * sy;
  const ok = interaction <= 1;
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sơ đồ tương tác N-M gần đúng">
        <line x1={cx} y1={pad / 2} x2={cx} y2={cy} stroke="#90a1aa" strokeWidth="1" />
        <line x1={cx} y1={cy} x2={W - pad / 2} y2={cy} stroke="#90a1aa" strokeWidth="1" />
        <polyline points={pts.join(' ')} fill="none" stroke="#166f55" strokeWidth="1.8" />
        <circle cx={px} cy={Math.max(pad, Math.min(cy, py))} r="5" fill={ok ? '#166f55' : '#c22d2d'} />
        <text x={cx + 6} y={pad + 8} fontSize="10" fill="#677680">M</text>
        <text x={W - pad} y={cy - 6} fontSize="10" fill="#677680">N</text>
        <text x={px + 8} y={Math.max(pad, Math.min(cy, py)) + 4} fontSize="10" fill={ok ? '#166f55' : '#c22d2d'}>
          {interaction.toFixed(2)}
        </text>
      </svg>
      <div className="diagram-caption">Đường bao gần đúng N/N₀–M/M₀ · điểm = tổ hợp thiết kế</div>
    </div>
  );
}
