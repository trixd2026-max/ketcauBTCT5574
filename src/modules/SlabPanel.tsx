import { useMemo, useState } from 'react';
import { calcSlab, createDefaultSlab, parseSlabBars, type SlabInput } from '../engine/slab';
import { concretes, steels } from '../engine/materials';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

export default function SlabPanel() {
  const [slab, setSlab] = useState<SlabInput>(() => createDefaultSlab('s1'));
  const result = useMemo(() => calcSlab(slab), [slab]);
  const asTop = parseSlabBars(slab.barsTop ?? '', slab.b);
  const asBot = parseSlabBars(slab.barsBottom ?? '', slab.b);

  const setNum = (key: keyof SlabInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    setSlab((s) => ({ ...s, [key]: Number.isFinite(n) ? n : 0 }));
  };
  const setStr = (key: keyof SlabInput, value: string) => setSlab((s) => ({ ...s, [key]: value }));

  return (
    <>
      <header>
        <div>
          <h1>Sàn BTCT V1.1</h1>
          <p>Strip 1m · Uốn · Cắt · Nứt · Võng (theo Slab.xlsm)</p>
        </div>
      </header>

      <section className="notice">
        <b>Sàn V1.1:</b> thiết kế theo dải 1 m (Slab_Design). μmin = 0.1% · γbt = 0.9.
        Thép <code>d10a200</code> hoặc <code>d12@150</code> → As/m tự tính.
        Chưa chọc thủng / 2 phương đầy đủ — chưa khóa chuẩn TCVN.
      </section>

      <div className="workspace" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="input card">
          <div className="card-title">
            <h2>Đầu vào: {slab.name}</h2>
          </div>
          <fieldset>
            <legend>Khai báo ô sàn</legend>
            <div className="form">
              <label>
                Tên
                <input value={slab.name} onChange={(e) => setStr('name', e.target.value)} />
              </label>
              <label>
                h (mm)
                <input type="number" step="1" value={slab.h} onChange={(e) => setNum('h', e.target.value)} />
              </label>
              <label>
                Lx (m)
                <input type="number" step="0.01" value={slab.Lx} onChange={(e) => setNum('Lx', e.target.value)} />
              </label>
              <label>
                Ly (m)
                <input type="number" step="0.01" value={slab.Ly} onChange={(e) => setNum('Ly', e.target.value)} />
              </label>
              <label>
                L võng (m)
                <input type="number" step="0.01" value={slab.L ?? 0} onChange={(e) => setNum('L', e.target.value)} />
              </label>
              <label>
                Bề rộng strip b (mm)
                <input type="number" step="1" value={slab.b} onChange={(e) => setNum('b', e.target.value)} />
              </label>
              <label>
                Gối tựa
                <select value={slab.support ?? 'continuous'} onChange={(e) => setStr('support', e.target.value)}>
                  <option value="simple">Đơn giản</option>
                  <option value="continuous">Liên tục</option>
                  <option value="cantilever">Console</option>
                </select>
              </label>
              <label>
                Độ ẩm
                <select value={slab.humidity ?? 'mid'} onChange={(e) => setStr('humidity', e.target.value)}>
                  <option value="high">&gt;75%</option>
                  <option value="mid">40–75%</option>
                  <option value="low">&lt;40%</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Vật liệu</legend>
            <div className="form">
              <label>
                Bê tông
                <select value={slab.concrete} onChange={(e) => setStr('concrete', e.target.value)}>
                  {concretes.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Thép
                <select value={slab.steel} onChange={(e) => setStr('steel', e.target.value)}>
                  {steels.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Nội lực (trên 1 m strip)</legend>
            <div className="form">
              <label>
                M− gối (kNm/m)
                <input type="number" step="0.01" value={slab.Mtop} onChange={(e) => setNum('Mtop', e.target.value)} />
              </label>
              <label>
                M+ nhịp (kNm/m)
                <input type="number" step="0.01" value={slab.Mbot} onChange={(e) => setNum('Mbot', e.target.value)} />
              </label>
              <label>
                Q (kN/m)
                <input type="number" step="0.01" value={slab.Q} onChange={(e) => setNum('Q', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Cốt thép</legend>
            <div className="form">
              <label>
                a trên (mm)
                <input type="number" step="1" value={slab.aTop} onChange={(e) => setNum('aTop', e.target.value)} />
              </label>
              <label>
                Thép trên (vd d10a200)
                <input
                  value={slab.barsTop ?? ''}
                  placeholder="d10a200"
                  onChange={(e) => setStr('barsTop', e.target.value)}
                />
              </label>
              <label>
                As trên (mm²/m)
                <input
                  type="number"
                  readOnly
                  value={asTop.ok ? asTop.As : 0}
                  style={{ background: '#f3f4f6', cursor: 'default' }}
                />
              </label>
              <label>
                a dưới (mm)
                <input type="number" step="1" value={slab.aBottom} onChange={(e) => setNum('aBottom', e.target.value)} />
              </label>
              <label>
                Thép dưới (vd d12a150)
                <input
                  value={slab.barsBottom ?? ''}
                  placeholder="d12a150"
                  onChange={(e) => setStr('barsBottom', e.target.value)}
                />
              </label>
              <label>
                As dưới (mm²/m)
                <input
                  type="number"
                  readOnly
                  value={asBot.ok ? asBot.As : 0}
                  style={{ background: '#f3f4f6', cursor: 'default' }}
                />
              </label>
            </div>
          </fieldset>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Nguồn: Slab.xlsm · KiemTraUonCat · KiemTraNut
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
              <h3>Uốn M− (gối)</h3>
              <span className={`status ${result.flexureTop.pass ? 'pass' : 'fail'}`}>
                {result.flexureTop.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>As yc / bố trí</span>
              <strong>
                {fmt(result.AsTopReq, 0)} / {fmt(result.AsTopProv, 0)} mm²/m
              </strong>
            </div>
            <div className="result">
              <span>μ / Mu</span>
              <strong>
                {fmt(result.muTop, 3)}% / {fmt(result.MuTop, 1)} kNm/m
              </strong>
            </div>
            <div className="checks">
              <div className={result.flexureTop.pass ? 'text-pass' : 'text-fail'}>
                {result.flexureTop.pass ? '✓' : '×'} {result.flexureTop.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Uốn M+ (nhịp)</h3>
              <span className={`status ${result.flexureBot.pass ? 'pass' : 'fail'}`}>
                {result.flexureBot.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>As yc / bố trí</span>
              <strong>
                {fmt(result.AsBotReq, 0)} / {fmt(result.AsBotProv, 0)} mm²/m
              </strong>
            </div>
            <div className="result">
              <span>μ / Mu</span>
              <strong>
                {fmt(result.muBot, 3)}% / {fmt(result.MuBot, 1)} kNm/m
              </strong>
            </div>
            <div className="checks">
              <div className={result.flexureBot.pass ? 'text-pass' : 'text-fail'}>
                {result.flexureBot.pass ? '✓' : '×'} {result.flexureBot.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Cắt</h3>
              <span className={`status ${result.shear.pass ? 'pass' : 'fail'}`}>
                {result.shear.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="checks">
              <div className={result.shear.pass ? 'text-pass' : 'text-fail'}>
                {result.shear.pass ? '✓' : '×'} {result.shear.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Nứt · Võng</h3>
            </div>
            <div className="result">
              <span>Mcrc</span>
              <strong>{fmt(result.crack.Mcrc ?? 0, 2)} kNm/m</strong>
            </div>
            <div className="result">
              <span>acrc ngắn / dài</span>
              <strong>
                {result.crack.acrcShort != null ? fmt(result.crack.acrcShort, 3) : '—'} /{' '}
                {result.crack.acrcLong != null ? fmt(result.crack.acrcLong, 3) : '—'} mm
              </strong>
            </div>
            <div className="result">
              <span>δ ngắn / dài / [δ]</span>
              <strong>
                {fmt(result.deflection.deltaShort ?? 0, 1)} / {fmt(result.deflection.deltaLong ?? 0, 1)} /{' '}
                {fmt(result.deflection.limit ?? 0, 1)} mm
              </strong>
            </div>
            <div className="checks">
              <div className={result.crack.pass ? 'text-pass' : 'text-fail'}>
                {result.crack.pass ? '✓' : '×'} {result.crack.message}
              </div>
              <div className={result.deflection.pass ? 'text-pass' : 'text-fail'}>
                {result.deflection.pass ? '✓' : '×'} {result.deflection.message}
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
