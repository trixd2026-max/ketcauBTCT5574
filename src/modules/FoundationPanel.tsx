import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calcFoundation,
  createDefaultFoundation,
  parseFoundationBars,
  suggestFoundationSize,
  type FoundationInput,
} from '../engine/foundation';
import { concretes, steels } from '../engine/materials';
import { openReportPdf, foundationReportDoc } from '../report/reportPdf';
import * as XLSX from 'xlsx';
import { exportGenericExcel } from '../report/excelReport';
import { exportReportWord } from '../report/wordReport';
import { foundationThuyetMinhDoc } from '../report/thuyetMinhMulti';

const STORAGE = 'ketcau-btct-5574-foundations-v1';
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

function loadList(): FoundationInput[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    if (Array.isArray(raw) && raw.length) return raw.map((f) => ({ ...createDefaultFoundation(), ...f }));
  } catch { /* ignore */ }
  return [createDefaultFoundation('f1')];
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FoundationPanel() {
  const [items, setItems] = useState<FoundationInput[]>(loadList);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = items.find((f) => f.id === selectedId) ?? items[0];

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(items));
  }, [items]);

  const results = useMemo(() => items.map((f) => ({ f, result: calcFoundation(f) })), [items]);
  const current = results.find((r) => r.f.id === selected.id) ?? results[0];
  const result = current.result;
  const sizeSuggest = useMemo(
    () =>
      suggestFoundationSize({
        N: selected.N,
        Mx: selected.Mx,
        My: selected.My,
        Rtc: selected.Rtc,
        gammaFill: selected.gammaFill,
        Df: selected.Df,
        pg: selected.pg,
      }),
    [selected.N, selected.Mx, selected.My, selected.Rtc, selected.gammaFill, selected.Df, selected.pg]
  );
  const asX = parseFoundationBars(selected.barsX ?? '');
  const asY = parseFoundationBars(selected.barsY ?? '');

  const patch = (p: Partial<FoundationInput>) =>
    setItems((list) => list.map((f) => (f.id === selected.id ? { ...f, ...p } : f)));
  const setNum = (key: keyof FoundationInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    patch({ [key]: Number.isFinite(n) ? n : 0 } as Partial<FoundationInput>);
  };
  const setStr = (key: keyof FoundationInput, value: string) =>
    patch({ [key]: value } as Partial<FoundationInput>);

  const add = () => {
    const f = createDefaultFoundation();
    f.name = `Móng ${items.length + 1}`;
    setItems((list) => [...list, f]);
    setSelectedId(f.id);
  };
  const remove = () => {
    if (items.length === 1) return;
    const rest = items.filter((f) => f.id !== selected.id);
    setItems(rest);
    setSelectedId(rest[0].id);
  };

  const exportJson = () =>
    download(
      'mong-btct-v1.json',
      JSON.stringify({ version: 'foundation-v1.2', exportedAt: new Date().toISOString(), foundations: items }, null, 2),
      'application/json'
    );
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const list: FoundationInput[] = Array.isArray(data) ? data : data.foundations;
        if (!Array.isArray(list) || !list.length) throw new Error('empty');
        const normalized = list.map((f) => ({
          ...createDefaultFoundation(),
          ...f,
          id: f.id || crypto.randomUUID(),
        }));
        setItems(normalized);
        setSelectedId(normalized[0].id);
      } catch {
        alert('Không đọc được file JSON móng.');
      }
    };
    reader.readAsText(file);
  };

  const exportCsv = () => {
    const summary = results.map(({ f, result: r }) => ({
      Móng: f.name,
      'Lx×Ly': `${f.Lx}×${f.Ly}`,
      FZ: f.N,
      'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    }));
    download('tong-hop-mong-btct.csv', '\ufeff' + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(summary)), 'text/csv;charset=utf-8');
  };
  const exportExcel = () => {
    const summary = results.map(({ f, result: r }) => ({
      Móng: f.name, Lx: f.Lx, Ly: f.Ly, Hf: f.Hf, FZ: f.N,
      pmax: r.pMax, pmin: r.pMin, 'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    }));
    exportGenericExcel('THUYẾT MINH TÍNH TOÁN MÓNG ĐƠN BTCT', 'ThuyetMinh-Mong-BTCT', [
      { name: 'TongHop', rows: summary },
    ]);
  };
  const exportTmPdf = () => openReportPdf(foundationThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }));
  const exportTmWord = () => void exportReportWord(foundationThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }), 'ThuyetMinh-Mong.docx');

  return (
    <>
      <header>
        <div>
          <h1>Móng đơn BTCT 5574:2018</h1>
          <p>ΣN · ΣM · Rtc · Chọc thủng</p>
        </div>
        <div className="actions">
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={exportJson}>JSON</button>
          <button type="button" onClick={exportCsv}>CSV</button>
          <button type="button" onClick={exportExcel}>Excel báo cáo</button>
          <button type="button" onClick={() => openReportPdf(foundationReportDoc(selected, result))}>PDF móng</button>
          <button type="button" onClick={exportTmPdf}>TM PDF</button>
          <button type="button" className="primary" onClick={exportTmWord}>TM Word</button>
        </div>
      </header>

      <section className="notice">
        Toolbar: Import JSON · JSON · CSV · Excel báo cáo · PDF móng · TM PDF · TM Word. Tham chiếu TCVN 5574:2018.
      </section>

      <div className="workspace">
        <section className="beam-list card">
          <div className="card-title">
            <h2>Danh sách móng</h2>
            <button type="button" className="primary" onClick={add}>+ Thêm</button>
          </div>
          {results.map(({ f, result: r }) => (
            <button key={f.id} type="button" className={`beam-item ${f.id === selected.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(f.id)}>
              <span><b>{f.name}</b><small>{f.Lx}×{f.Ly}×{f.Hf} · FZ={fmt(f.N, 0)}</small></span>
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
              <label>Lx (m)<input type="number" step="0.01" value={selected.Lx} onChange={(e) => setNum('Lx', e.target.value)} /></label>
              <label>Ly (m)<input type="number" step="0.01" value={selected.Ly} onChange={(e) => setNum('Ly', e.target.value)} /></label>
              <label>Hf (m)<input type="number" step="0.01" value={selected.Hf} onChange={(e) => setNum('Hf', e.target.value)} /></label>
              <label>Df (m)<input type="number" step="0.01" value={selected.Df} onChange={(e) => setNum('Df', e.target.value)} /></label>
              <label>Cột b (m)<input type="number" step="0.01" value={selected.colB} onChange={(e) => setNum('colB', e.target.value)} /></label>
              <label>Cột h (m)<input type="number" step="0.01" value={selected.colH} onChange={(e) => setNum('colH', e.target.value)} /></label>
              <label>FZ cột (kN)<input type="number" step="0.1" value={selected.N} onChange={(e) => setNum('N', e.target.value)} /></label>
              <label>MX (kNm)<input type="number" step="0.1" value={selected.Mx} onChange={(e) => setNum('Mx', e.target.value)} /></label>
              <label>MY (kNm)<input type="number" step="0.1" value={selected.My} onChange={(e) => setNum('My', e.target.value)} /></label>
              <label>Rtc (kN/m²)<input type="number" step="1" value={selected.Rtc} onChange={(e) => setNum('Rtc', e.target.value)} /></label>
              <label>a (mm)<input type="number" step="1" value={selected.a} onChange={(e) => setNum('a', e.target.value)} /></label>
              <label>Thép X<input value={selected.barsX ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsX', e.target.value)} /></label>
              <label>Thép Y<input value={selected.barsY ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsY', e.target.value)} /></label>
              <label>Bê tông<select value={selected.concrete} onChange={(e) => setStr('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép<select value={selected.steel} onChange={(e) => setStr('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>{result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
          </div>
          <section className="result-section">
            <div className="section-heading"><h3>Gợi ý kích thước</h3></div>
            <div className="result"><span>Lx × Ly gợi ý</span><strong>{fmt(sizeSuggest.Lx, 2)} × {fmt(sizeSuggest.Ly, 2)} m</strong></div>
            <div className="result"><span>Af / p_avg ước</span><strong>{fmt(sizeSuggest.Af, 2)} m² · {fmt(sizeSuggest.pAvgEst, 1)} kN/m²</strong></div>
            <button type="button" className="primary" style={{ marginTop: 4, fontSize: 12, padding: '4px 10px' }}
              onClick={() => patch({ Lx: sizeSuggest.Lx, Ly: sizeSuggest.Ly })}>Áp dụng Lx×Ly</button>
            <small style={{ display: 'block', marginTop: 6, color: '#687881' }}>{sizeSuggest.note}</small>
          </section>
          <section className="result-section">
            <div className="result"><span>ΣN</span><strong>{fmt(result.sigmaN, 1)} kN</strong></div>
            <div className="result"><span>p_tb / max / min</span><strong>{fmt(result.pAvg, 1)} / {fmt(result.pMax, 1)} / {fmt(result.pMin, 1)}</strong></div>
            <div className="result"><span>Nct / Nkt</span><strong>{fmt(result.punching.Nct, 1)} / {fmt(result.punching.Nkt, 1)}</strong></div>
            <div className="checks">
              <div className={result.soilAvg.pass ? 'text-pass' : 'text-fail'}>{result.soilAvg.pass ? '✓' : '×'} {result.soilAvg.message}</div>
              <div className={result.soilMax.pass ? 'text-pass' : 'text-fail'}>{result.soilMax.pass ? '✓' : '×'} {result.soilMax.message}</div>
              <div className={result.punching.pass ? 'text-pass' : 'text-fail'}>{result.punching.pass ? '✓' : '×'} {result.punching.message}</div>
              <div className={result.flexureX.pass ? 'text-pass' : 'text-fail'}>{result.flexureX.pass ? '✓' : '×'} {result.flexureX.message}</div>
              <div className={result.flexureY.pass ? 'text-pass' : 'text-fail'}>{result.flexureY.pass ? '✓' : '×'} {result.flexureY.message}</div>
            </div>
          </section>
        </section>
      </div>
    </>
  );
}
