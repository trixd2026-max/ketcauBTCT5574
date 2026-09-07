import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calcFoundation,
  createDefaultFoundation,
  parseFoundationBars,
  type FoundationInput,
} from '../engine/foundation';
import { concretes, steels } from '../engine/materials';
import { openReportPdf, foundationReportDoc } from '../report/reportPdf';

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
      JSON.stringify({ version: 'foundation-v1.0', exportedAt: new Date().toISOString(), foundations: items }, null, 2),
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

  return (
    <>
      <header>
        <div>
          <h1>Móng đơn BTCT V1.0</h1>
          <p>Nền · Chọc thủng · Uốn console</p>
        </div>
        <div className="actions">
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={exportJson}>JSON</button>
          <button type="button" className="primary" onClick={() => openReportPdf(foundationReportDoc(selected, result))}>Xuất PDF</button>
        </div>
      </header>

      <section className="notice">
        <b>Móng V1.0:</b> p_tb / p_max / p_min · chọc thủng · As console. Danh sách + localStorage + JSON.
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
              <span>
                <b>{f.name}</b>
                <small>{f.Lx}×{f.Ly}×{f.Hf} · N={fmt(f.N, 0)}</small>
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
              <label>Lx (m)<input type="number" step="0.01" value={selected.Lx} onChange={(e) => setNum('Lx', e.target.value)} /></label>
              <label>Ly (m)<input type="number" step="0.01" value={selected.Ly} onChange={(e) => setNum('Ly', e.target.value)} /></label>
              <label>Hf (m)<input type="number" step="0.01" value={selected.Hf} onChange={(e) => setNum('Hf', e.target.value)} /></label>
              <label>Df (m)<input type="number" step="0.01" value={selected.Df} onChange={(e) => setNum('Df', e.target.value)} /></label>
              <label>Cột b (m)<input type="number" step="0.01" value={selected.colB} onChange={(e) => setNum('colB', e.target.value)} /></label>
              <label>Cột h (m)<input type="number" step="0.01" value={selected.colH} onChange={(e) => setNum('colH', e.target.value)} /></label>
              <label>N (kN)<input type="number" step="0.1" value={selected.N} onChange={(e) => setNum('N', e.target.value)} /></label>
              <label>Mx (kNm)<input type="number" step="0.1" value={selected.Mx} onChange={(e) => setNum('Mx', e.target.value)} /></label>
              <label>My (kNm)<input type="number" step="0.1" value={selected.My} onChange={(e) => setNum('My', e.target.value)} /></label>
              <label>Rtc (kN/m²)<input type="number" step="1" value={selected.Rtc} onChange={(e) => setNum('Rtc', e.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Vật liệu & thép</legend>
            <div className="form">
              <label>Bê tông<select value={selected.concrete} onChange={(e) => setStr('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép<select value={selected.steel} onChange={(e) => setStr('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>a (mm)<input type="number" step="1" value={selected.a} onChange={(e) => setNum('a', e.target.value)} /></label>
              <label>Thép X<input value={selected.barsX ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsX', e.target.value)} /></label>
              <label>Asx<input type="number" readOnly value={asX.ok ? asX.As : 0} style={{ background: '#f3f4f6' }} /></label>
              <label>Thép Y<input value={selected.barsY ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsY', e.target.value)} /></label>
              <label>Asy<input type="number" readOnly value={asY.ok ? asY.As : 0} style={{ background: '#f3f4f6' }} /></label>
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>{result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
          </div>
          <section className="result-section">
            <div className="result"><span>p_tb / max / min</span><strong>{fmt(result.pAvg, 1)} / {fmt(result.pMax, 1)} / {fmt(result.pMin, 1)}</strong></div>
            <div className="result"><span>Nct / Nkt</span><strong>{fmt(result.punching.Nct, 1)} / {fmt(result.punching.Nkt, 1)}</strong></div>
            <div className="checks">
              <div className={result.soilAvg.pass ? 'text-pass' : 'text-fail'}>{result.soilAvg.pass ? '✓' : '×'} {result.soilAvg.message}</div>
              <div className={result.soilMax.pass ? 'text-pass' : 'text-fail'}>{result.soilMax.pass ? '✓' : '×'} {result.soilMax.message}</div>
              <div className={result.soilMin.pass ? 'text-pass' : 'text-fail'}>{result.soilMin.pass ? '✓' : '×'} {result.soilMin.message}</div>
              <div className={result.punching.pass ? 'text-pass' : 'text-fail'}>{result.punching.pass ? '✓' : '×'} {result.punching.message}</div>
              <div className={result.flexureX.pass ? 'text-pass' : 'text-fail'}>{result.flexureX.pass ? '✓' : '×'} {result.flexureX.message}</div>
              <div className={result.flexureY.pass ? 'text-pass' : 'text-fail'}>{result.flexureY.pass ? '✓' : '×'} {result.flexureY.message}</div>
            </div>
          </section>
        </section>
      </div>

      <section className="summary card">
        <div className="card-title">
          <h2>Bảng tổng hợp móng</h2>
          <small>localStorage · Import/Export JSON</small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Móng</th><th>Lx×Ly</th><th>Nền</th><th>Chọc thủng</th><th>Thép X</th><th>Thép Y</th><th>Tổng</th></tr>
            </thead>
            <tbody>
              {results.map(({ f, result: r }) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.Lx}×{f.Ly}</td>
                  <td><span className={`status ${r.soilAvg.pass && r.soilMax.pass && r.soilMin.pass ? 'pass' : 'fail'}`}>{r.soilAvg.pass && r.soilMax.pass && r.soilMin.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.punching.pass ? 'pass' : 'fail'}`}>{r.punching.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.flexureX.pass ? 'pass' : 'fail'}`}>{r.flexureX.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.flexureY.pass ? 'pass' : 'fail'}`}>{r.flexureY.pass ? 'ĐẠT' : 'KĐ'}</span></td>
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
