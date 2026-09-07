import { useMemo, useState } from 'react';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from '../engine/column';
import { concretes, steels } from '../engine/materials';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

export default function ColumnPanel() {
  const [col, setCol] = useState<ColumnInput>(() => createDefaultColumn('c1'));
  const parsed = parseColumnBars(col.bars ?? '');
  const result = useMemo(
    () =>
      calcColumn({
        ...col,
        ...(parsed.ok ? { As: parsed.As, nBars: parsed.n, barDia: parsed.dia } : {}),
      }),
    [col, parsed.As, parsed.n, parsed.dia, parsed.ok]
  );

  const setNum = (key: keyof ColumnInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    setCol((c) => ({ ...c, [key]: Number.isFinite(n) ? n : 0 }));
  };
  const setStr = (key: keyof ColumnInput, value: string) => setCol((c) => ({ ...c, [key]: value }));

  return (
    <>
      <header>
        <div>
          <h1>Cột BTCT V1.1</h1>
          <p>Nén · Lệch tâm · Độ mảnh · Đai · Tương tác N–M (gần đúng)</p>
        </div>
      </header>

      <section className="notice">
        <b>Cột V1.1:</b> theo Column.xlsm (Data_Column, ThepDai). vd ≤ 0.65 · λ ≤ 100 · μ min 1%.
        Biểu đồ N–M <b>gần đúng</b> (Excel FS từ macro) — chưa khóa chuẩn TCVN.
        Thép dạng <code>12d20</code> hoặc <code>8d18+4d16</code> → As tự tính (khóa).
      </section>

      <div className="workspace" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="input card">
          <div className="card-title">
            <h2>Đầu vào: {col.name}</h2>
          </div>
          <fieldset>
            <legend>Vật liệu & nhận diện</legend>
            <div className="form">
              <label>
                Tên
                <input value={col.name} onChange={(e) => setStr('name', e.target.value)} />
              </label>
              <label>
                Bê tông
                <select value={col.concrete} onChange={(e) => setStr('concrete', e.target.value)}>
                  {concretes.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Thép dọc
                <select value={col.steel} onChange={(e) => setStr('steel', e.target.value)}>
                  {steels.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Thép đai
                <select value={col.stirrupSteel} onChange={(e) => setStr('stirrupSteel', e.target.value)}>
                  {steels.map((x) => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Tiết diện & chiều dài tính toán</legend>
            <div className="form">
              <label>
                b (mm)
                <input type="number" step="1" value={col.b} onChange={(e) => setNum('b', e.target.value)} />
              </label>
              <label>
                h (mm)
                <input type="number" step="1" value={col.h} onChange={(e) => setNum('h', e.target.value)} />
              </label>
              <label>
                L0x (mm)
                <input type="number" step="1" value={col.L0x} onChange={(e) => setNum('L0x', e.target.value)} />
              </label>
              <label>
                L0y (mm)
                <input type="number" step="1" value={col.L0y} onChange={(e) => setNum('L0y', e.target.value)} />
              </label>
              <label>
                Cover (mm)
                <input type="number" step="1" value={col.cover} onChange={(e) => setNum('cover', e.target.value)} />
              </label>
              <label>
                γb
                <input type="number" step="0.01" value={col.gammaB ?? 0.85} onChange={(e) => setNum('gammaB', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Nội lực ULS</legend>
            <div className="form">
              <label>
                N (kN)
                <input type="number" step="0.1" value={col.N} onChange={(e) => setNum('N', e.target.value)} />
              </label>
              <label>
                Mx (kNm)
                <input type="number" step="0.1" value={col.Mx} onChange={(e) => setNum('Mx', e.target.value)} />
              </label>
              <label>
                My (kNm)
                <input type="number" step="0.1" value={col.My} onChange={(e) => setNum('My', e.target.value)} />
              </label>
              <label>
                Qx (kN)
                <input type="number" step="0.1" value={col.Qx ?? 0} onChange={(e) => setNum('Qx', e.target.value)} />
              </label>
              <label>
                Qy (kN)
                <input type="number" step="0.1" value={col.Qy ?? 0} onChange={(e) => setNum('Qy', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Cốt thép</legend>
            <div className="form">
              <label>
                Thép dọc (vd 12d20)
                <input
                  value={col.bars ?? ''}
                  placeholder="12d20 hoặc 8d18+4d16"
                  onChange={(e) => setStr('bars', e.target.value)}
                />
              </label>
              <label>
                As (mm²) — tự tính
                <input
                  type="number"
                  readOnly
                  value={parsed.ok ? parsed.As : col.As ?? 0}
                  title="As tính từ bố trí thép"
                  style={{ background: '#f3f4f6', cursor: 'default' }}
                />
              </label>
              <label>
                Ø đai (mm)
                <input type="number" step="1" value={col.stirrupDia} onChange={(e) => setNum('stirrupDia', e.target.value)} />
              </label>
              <label>
                s đai (mm)
                <input type="number" step="1" value={col.stirrupSpacing} onChange={(e) => setNum('stirrupSpacing', e.target.value)} />
              </label>
              <label>
                Nhánh đai X
                <input type="number" step="1" value={col.stirrupLegsX} onChange={(e) => setNum('stirrupLegsX', e.target.value)} />
              </label>
              <label>
                Nhánh đai Y
                <input type="number" step="1" value={col.stirrupLegsY} onChange={(e) => setNum('stirrupLegsY', e.target.value)} />
              </label>
            </div>
          </fieldset>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Nguồn: Column.xlsm · ThepDai · Data_Column
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
              <h3>Thép & hàm lượng</h3>
              <span className={`status ${result.checks.mu.pass ? 'pass' : 'fail'}`}>
                {result.checks.mu.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>As bố trí</span>
              <strong>{fmt(result.As, 0)} mm²</strong>
            </div>
            <div className="result">
              <span>μ / giới hạn</span>
              <strong>
                {fmt(result.mu, 2)}% / {result.muMin}–{result.muMax}%
              </strong>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Độ mảnh</h3>
              <span className={`status ${result.checks.slenderness.pass ? 'pass' : 'fail'}`}>
                {result.checks.slenderness.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>λx / λy / λmax</span>
              <strong>
                {fmt(result.lambdaX, 1)} / {fmt(result.lambdaY, 1)} / {fmt(result.lambdaMax, 1)}
              </strong>
            </div>
            <div className="result">
              <span>[λ]</span>
              <strong>{result.lambdaLimit}</strong>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>N–M (gần đúng)</h3>
              <span className={`status ${result.checks.interaction.pass ? 'pass' : 'fail'}`}>
                {result.checks.interaction.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="result">
              <span>N0</span>
              <strong>{fmt(result.N0, 0)} kN</strong>
            </div>
            <div className="result">
              <span>Mx0 / My0</span>
              <strong>
                {fmt(result.Mx0, 1)} / {fmt(result.My0, 1)} kNm
              </strong>
            </div>
            <div className="result">
              <span>Tương tác (α={result.alpha})</span>
              <strong>{fmt(result.interaction, 3)}</strong>
            </div>
            <div className="result">
              <span>vd / [vd]</span>
              <strong>
                {fmt(result.vd, 3)} / {result.vdLimit}
              </strong>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Cắt (ThepDai)</h3>
            </div>
            <div className="result">
              <span>Qx / Qbt / Qb+Qsw</span>
              <strong>
                {fmt(result.shearX.qDemand)} / {fmt(result.shearX.qbt)} / {fmt(result.shearX.qRes)}
              </strong>
            </div>
            <div className="result">
              <span>Qy / Qbt / Qb+Qsw</span>
              <strong>
                {fmt(result.shearY.qDemand)} / {fmt(result.shearY.qbt)} / {fmt(result.shearY.qRes)}
              </strong>
            </div>
            <div className="checks">
              <div className={result.shearX.check.pass ? 'text-pass' : 'text-fail'}>
                {result.shearX.check.pass ? '✓' : '×'} X: {result.shearX.check.message}
              </div>
              <div className={result.shearY.check.pass ? 'text-pass' : 'text-fail'}>
                {result.shearY.check.pass ? '✓' : '×'} Y: {result.shearY.check.message}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-heading">
              <h3>Cấu tạo</h3>
              <span className={`status ${result.checks.detailing.pass ? 'pass' : 'fail'}`}>
                {result.checks.detailing.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <div className="checks">
              {Object.values(result.checks).map((c) => (
                <div key={c.message} className={c.pass ? 'text-pass' : 'text-fail'}>
                  {c.pass ? '✓' : '×'} {c.message}
                </div>
              ))}
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
