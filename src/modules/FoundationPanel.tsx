import { useMemo, useState } from 'react';
import {
  calcFoundation,
  createDefaultFoundation,
  parseFoundationBars,
  type FoundationInput,
} from '../engine/foundation';
import { concretes, steels } from '../engine/materials';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

export default function FoundationPanel() {
  const [f, setF] = useState<FoundationInput>(() => createDefaultFoundation('f1'));
  const result = useMemo(() => calcFoundation(f), [f]);
  const asX = parseFoundationBars(f.barsX ?? '');
  const asY = parseFoundationBars(f.barsY ?? '');

  const setNum = (key: keyof FoundationInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    setF((s) => ({ ...s, [key]: Number.isFinite(n) ? n : 0 }));
  };
  const setStr = (key: keyof FoundationInput, value: string) => setF((s) => ({ ...s, [key]: value }));

  return (
    <>
      <header>
        <div>
          <h1>Móng đơn BTCT V1.0</h1>
          <p>Nền · Lệch tâm · Chọc thủng · Uốn console (MongDon.xlsm)</p>
        </div>
      </header>

      <section className="notice">
        <b>Móng V1.0:</b> p_tb ≤ Rtc · p_max ≤ 1.2Rtc · p_min ≥ 0 · chọc thủng Nct ≤ 0.75·Rbt·um·h0 ·
        As = M/(0.9·Rs·h0), μmin=0.1%. Thép <code>d12a150</code>. Chưa khóa chuẩn TCVN.
      </section>

      <div className="workspace" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="input card">
          <div className="card-title">
            <h2>Đầu vào: {f.name}</h2>
          </div>
          <fieldset>
            <legend>Kích thước móng & cột</legend>
            <div className="form">
              <label>
                Tên
                <input value={f.name} onChange={(e) => setStr('name', e.target.value)} />
              </label>
              <label>
                Lx (m)
                <input type="number" step="0.01" value={f.Lx} onChange={(e) => setNum('Lx', e.target.value)} />
              </label>
              <label>
                Ly (m)
                <input type="number" step="0.01" value={f.Ly} onChange={(e) => setNum('Ly', e.target.value)} />
              </label>
              <label>
                Hf chiều dày (m)
                <input type="number" step="0.01" value={f.Hf} onChange={(e) => setNum('Hf', e.target.value)} />
              </label>
              <label>
                Df chôn (m)
                <input type="number" step="0.01" value={f.Df} onChange={(e) => setNum('Df', e.target.value)} />
              </label>
              <label>
                Cột b (m)
                <input type="number" step="0.01" value={f.colB} onChange={(e) => setNum('colB', e.target.value)} />
              </label>
              <label>
                Cột h (m)
                <input type="number" step="0.01" value={f.colH} onChange={(e) => setNum('colH', e.target.value)} />
              </label>
              <label>
                a thép (mm)
                <input type="number" step="1" value={f.a} onChange={(e) => setNum('a', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Tải trọng tại chân cột (ULS)</legend>
            <div className="form">
              <label>
                N (kN)
                <input type="number" step="0.1" value={f.N} onChange={(e) => setNum('N', e.target.value)} />
              </label>
              <label>
                Mx (kNm)
                <input type="number" step="0.1" value={f.Mx} onChange={(e) => setNum('Mx', e.target.value)} />
              </label>
              <label>
                My (kNm)
                <input type="number" step="0.1" value={f.My} onChange={(e) => setNum('My', e.target.value)} />
              </label>
              <label>
                Qx (kN)
                <input type="number" step="0.1" value={f.Qx ?? 0} onChange={(e) => setNum('Qx', e.target.value)} />
              </label>
              <label>
                Qy (kN)
                <input type="number" step="0.1" value={f.Qy ?? 0} onChange={(e) => setNum('Qy', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Nền & vật liệu</legend>
            <div className="form">
              <label>
                Rtc (kN/m²)
                <input type="number" step="1" value={f.Rtc} onChange={(e) => setNum('Rtc', e.target.value)} />
              </label>
              <label>
                γ đất (kN/m³)
                <input
                  type="number"
                  step="0.1"
                  value={f.gammaSoil ?? 18}
                  onChange={(e) => setNum('gammaSoil', e.target.value)}
                />
              </label>
              <label>
                htn tôn nền (m)
                <input type="number" step="0.01" value={f.htn ?? 0} onChange={(e) => setNum('htn', e.target.value)} />
              </label>
              <label>
                Bê tông
                <select value={f.concrete} onChange={(e) => setStr('concrete', e.target.value)}>
                  {concretes.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Thép
                <select value={f.steel} onChange={(e) => setStr('steel', e.target.value)}>
                  {steels.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Cốt thép đáy</legend>
            <div className="form">
              <label>
                Thép phương X (vd d12a150)
                <input
                  value={f.barsX ?? ''}
                  placeholder="d12a150"
                  onChange={(e) => setStr('barsX', e.target.value)}
                />
              </label>
              <label>
                Asx (mm²/m)
                <input type="number" readOnly value={asX.ok ? asX.As : 0} style={{ background: '#f3f4f6' }} />
              </label>
              <label>
                Thép phương Y (vd d12a150)
                <input
                  value={f.barsY ?? ''}
                  placeholder="d12a150"
                  onChange={(e) => setStr('barsY', e.target.value)}
                />
              </label>
              <label>
                Asy (mm²/m)
                <input type="number" readOnly value={asY.ok ? asY.As : 0} style={{ background: '#f3f4f6' }} />
              </label>
            </div>
          </fieldset>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Nguồn: MongDon.xlsm · ThuyetMinh
          </p>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>
              {result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
            </span>
          </div>

          <section className="result-section">
            <div className="section-heading">
              <h3>Áp lực nền</h3>
            </div>
            <div className="result">
              <span>Af / Wx / Wy</span>
              <strong>
                {fmt(result.Af, 2)} m² · {fmt(result.Wx, 2)} · {fmt(result.Wy, 2)}
              </strong>
            </div>
            <div className="result">
              <span>p_tb / p_max / p_min</span>
              <strong>
                {fmt(result.pAvg, 1)} / {fmt(result.pMax, 1)} / {fmt(result.pMin, 1)} kN/m²
              </strong>
            </div>
            <div className="result">
              <span>e_x / e_y</span>
              <strong>
                {fmt(result.eccX, 3)} / {fmt(result.eccY, 3)} m
              </strong>
            </div>
            <div className="checks">
              <div className={result.soilAvg.pass ? 'text-pass' : 'text-fail'}>
                {result.soilAvg.pass ? '✓' : '×'} {result.soilAvg.message}
              </div>
              <div className={result.soilMax.pass ? 'text-pass' : 'text-fail'}>
                {result.soilMax.pass ? '✓' : '×'} {result.soilMax.message}
              </div>
              <div className={result.soilMin.pass ? 'text-pass' : 'text-fail'}>
                {result.soilMin.pass ? '✓' : '×'} {result.soilMin.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Chọc thủng</h3>
              <span className={`status ${result.punching.pass ? 'pass' : 'fail'}`}>
                {result.punching.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>Nct / Nkt</span>
              <strong>
                {fmt(result.punching.Nct, 1)} / {fmt(result.punching.Nkt, 1)} kN
              </strong>
            </div>
            <div className="result">
              <span>um</span>
              <strong>{fmt(result.punching.um, 3)} m</strong>
            </div>
            <div className="checks">
              <div className={result.punching.pass ? 'text-pass' : 'text-fail'}>
                {result.punching.pass ? '✓' : '×'} {result.punching.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Uốn console · Thép đáy</h3>
            </div>
            <div className="result">
              <span>Asx yc / min / bố trí</span>
              <strong>
                {fmt(result.AsXReq, 0)} / {fmt(result.AsXMin, 0)} / {fmt(result.AsXProv, 0)} mm²/m
              </strong>
            </div>
            <div className="result">
              <span>Asy yc / min / bố trí</span>
              <strong>
                {fmt(result.AsYReq, 0)} / {fmt(result.AsYMin, 0)} / {fmt(result.AsYProv, 0)} mm²/m
              </strong>
            </div>
            <div className="checks">
              <div className={result.flexureX.pass ? 'text-pass' : 'text-fail'}>
                {result.flexureX.pass ? '✓' : '×'} {result.flexureX.message}
              </div>
              <div className={result.flexureY.pass ? 'text-pass' : 'text-fail'}>
                {result.flexureY.pass ? '✓' : '×'} {result.flexureY.message}
              </div>
            </div>
          </section>

          {result.warnings.length > 0 && (
            <div className="warnings">
              <b>Cảnh báo</b>
              {result.warnings.map((w) => (
                <div key={w}>• {w}</div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
