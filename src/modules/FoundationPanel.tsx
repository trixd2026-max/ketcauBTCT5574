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

  return (
    <>
      <header>
        <div>
          <h1>Móng đơn BTCT 5574:2018</h1>
          <p>ΣN · ΣM (FX/FY/ex/ey) · Rtc MongDon · Chọc thủng</p>
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
        ΣN = FZ+Htn·γ·Af · ΣMx = MX−FY·Hf−FZ·ey · ΣMy = MY+FX·Hf+FZ·ex · Rtc (φ,c,m1,m2).
        Tham chiếu TCVN 5574:2018 (đối chiếu MongDon) — chưa chứng nhận full compliance.
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
                <small>{f.Lx}×{f.Ly}×{f.Hf} · FZ={fmt(f.N, 0)}</small>
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
              <label>FZ cột (kN)<input type="number" step="0.1" value={selected.N} onChange={(e) => setNum('N', e.target.value)} /></label>
              <label>Htn (m)<input type="number" step="0.01" value={selected.Htn ?? 0} onChange={(e) => setNum('Htn', e.target.value)} /></label>
              <label>γ' (kN/m³)<input type="number" step="0.1" value={selected.gammaPrime ?? selected.gammaFill ?? 20} onChange={(e) => setNum('gammaPrime', e.target.value)} /></label>
              <label>MX (kNm)<input type="number" step="0.1" value={selected.Mx} onChange={(e) => setNum('Mx', e.target.value)} /></label>
              <label>MY (kNm)<input type="number" step="0.1" value={selected.My} onChange={(e) => setNum('My', e.target.value)} /></label>
              <label>FX (kN)<input type="number" step="0.1" value={selected.Fx ?? 0} onChange={(e) => setNum('Fx', e.target.value)} /></label>
              <label>FY (kN)<input type="number" step="0.1" value={selected.Fy ?? 0} onChange={(e) => setNum('Fy', e.target.value)} /></label>
              <label>ex (m)<input type="number" step="0.01" value={selected.ex ?? 0} onChange={(e) => setNum('ex', e.target.value)} /></label>
              <label>ey (m)<input type="number" step="0.01" value={selected.ey ?? 0} onChange={(e) => setNum('ey', e.target.value)} /></label>
              <label>pg (kN/m²)<input type="number" step="0.1" value={selected.pg ?? 0} onChange={(e) => setNum('pg', e.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Đất nền · Rtc</legend>
            <div className="form">
              <label>Rtc mode
                <select value={selected.rtcMode ?? 'manual'} onChange={(e) => setStr('rtcMode', e.target.value)}>
                  <option value="manual">Nhập tay</option>
                  <option value="calc">Tính (MongDon)</option>
                </select>
              </label>
              <label>Rtc nhập (kN/m²)<input type="number" step="1" value={selected.Rtc} onChange={(e) => setNum('Rtc', e.target.value)} disabled={(selected.rtcMode ?? 'manual') === 'calc'} /></label>
              <label>φ (°)<input type="number" step="0.1" value={selected.phi ?? 12} onChange={(e) => setNum('phi', e.target.value)} /></label>
              <label>cII (kN/m²)<input type="number" step="0.1" value={selected.cII ?? 19.5} onChange={(e) => setNum('cII', e.target.value)} /></label>
              <label>γII (kN/m³)<input type="number" step="0.1" value={selected.gammaII ?? 19.1} onChange={(e) => setNum('gammaII', e.target.value)} /></label>
              <label>m1<input type="number" step="0.01" value={selected.m1 ?? 1.1} onChange={(e) => setNum('m1', e.target.value)} /></label>
              <label>m2<input type="number" step="0.01" value={selected.m2 ?? 1} onChange={(e) => setNum('m2', e.target.value)} /></label>
              <label>k<input type="number" step="0.01" value={selected.k ?? 1.1} onChange={(e) => setNum('k', e.target.value)} /></label>
              <label>ZWT (m)<input type="number" step="0.1" value={selected.zwt ?? 1} onChange={(e) => setNum('zwt', e.target.value)} /></label>
              <label>h0 hầm (m)<input type="number" step="0.1" value={selected.h0Basement ?? 0} onChange={(e) => setNum('h0Basement', e.target.value)} /></label>
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
            <div className="result"><span>ΣN (dùng tính p)</span><strong>{fmt(result.sigmaN, 1)} kN</strong></div>
            <div className="result"><span>ΣMx / ΣMy đáy</span><strong>{fmt(result.sigmaMx, 2)} / {fmt(result.sigmaMy, 2)} kNm</strong></div>
            <div className="result"><span>Rtc dùng</span><strong>{fmt(result.rtcUsed, 1)} kN/m²{result.bearing ? ` (A=${result.bearing.A}, B=${result.bearing.B}, D=${result.bearing.D})` : ''}</strong></div>
            <div className="result"><span>p_tb / max / min</span><strong>{fmt(result.pAvg, 1)} / {fmt(result.pMax, 1)} / {fmt(result.pMin, 1)}</strong></div>
            <div className="result"><span>Nct / Nkt</span><strong>{fmt(result.punching.Nct, 1)} / {fmt(result.punching.Nkt, 1)}</strong></div>
            <PressureDiagram pMax={result.pMax} pMin={result.pMin} pAvg={result.pAvg} rtc={result.rtcUsed} />
            {result.pMin < 0 && (
              <div className="text-fail" style={{ marginTop: 8 }}>⚠ p_min < 0 — nguy cơ nhổ góc móng</div>
            )}
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
          <small>localStorage · Import/Export JSON · Tham chiếu TCVN 5574:2018</small>
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

function PressureDiagram({ pMax, pMin, pAvg, rtc }: { pMax: number; pMin: number; pAvg: number; rtc: number }) {
  const W = 280, H = 120, pad = 28;
  const vals = [pMax, pMin, pAvg, rtc, 0].filter((v) => Number.isFinite(v));
  const vmax = Math.max(...vals.map(Math.abs), 1);
  const y0 = H - pad;
  const scale = (H - 2 * pad) / (2 * vmax);
  const yOf = (p: number) => y0 - p * scale;
  const x1 = pad, x2 = W - pad;
  const yMax = yOf(pMax), yMin = yOf(pMin), yRtc = yOf(rtc), yZero = yOf(0);
  return (
    <div className="diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Sơ đồ áp lực đáy móng">
        <line x1={pad} y1={yZero} x2={W - pad} y2={yZero} stroke="#90a1aa" strokeWidth="1" />
        <line x1={pad} y1={pad / 2} x2={pad} y2={H - pad / 2} stroke="#90a1aa" strokeWidth="1" />
        <polygon
          points={`${x1},${yZero} ${x1},${yMax} ${x2},${yMin} ${x2},${yZero}`}
          fill={pMin < 0 ? 'rgba(192,60,60,0.25)' : 'rgba(22,111,85,0.2)'}
          stroke="#166f55"
          strokeWidth="1.5"
        />
        {rtc > 0 && (
          <line x1={x1} y1={yRtc} x2={x2} y2={yRtc} stroke="#c45c12" strokeDasharray="4 3" strokeWidth="1.2" />
        )}
        <text x={x1 + 4} y={yMax - 4} fontSize="10" fill="#166f55">pmax {pMax.toFixed(1)}</text>
        <text x={x2 - 70} y={yMin - 4} fontSize="10" fill={pMin < 0 ? '#c22d2d' : '#166f55'}>pmin {pMin.toFixed(1)}</text>
        {rtc > 0 && <text x={x1 + 4} y={yRtc + 12} fontSize="10" fill="#c45c12">Rtc {rtc.toFixed(0)}</text>}
      </svg>
      <div className="diagram-caption">Áp lực đáy móng (kN/m²) · nét đứt = Rtc · tô đỏ nếu pmin < 0 (nhổ góc)</div>
    </div>
  );
}
