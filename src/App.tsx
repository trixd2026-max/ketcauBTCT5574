import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { BeamInput, BeamResult, calcBeam, createDefaultBeam } from './engine/beam';
import { concretes, steels } from './engine/materials';
import ColumnPanel from './modules/ColumnPanel';

type ModuleId = 'beam' | 'column' | 'slab' | 'foundation';

const STORAGE_KEY = 'ketcau-btct-5574-beams-v1';
const numberKeys = new Set<string>([
  'b', 'h', 'aTop', 'aBottom', 'MNegative', 'MPositive', 'Q',
  'AsTop', 'AsBottom', 'stirrupLegs', 'stirrupDia', 'stirrupSpacing',
  'nBarsTop', 'nBarsBottom', 'barDiaTop', 'barDiaBottom',
  'MserShortNeg', 'MserShortPos', 'MserLongNeg', 'MserLongPos', 'L', 'limitRatio',
]);
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

/** Parse bar layout like "5d18", "3d22+2d16", "3Ø20;2Ø16" → As, n, maxDia */
function parseBars(spec: string): { As: number; n: number; dia: number; ok: boolean } {
  const s = spec.trim().toLowerCase().replace(/ø|ф/g, 'd').replace(/,/g, '.');
  if (!s) return { As: 0, n: 0, dia: 0, ok: false };
  const re = /([0-9]+)[ x*×+;]*d([0-9]+(?:[.][0-9]+)?)/gi;
  let m: RegExpExecArray | null;
  let As = 0;
  let n = 0;
  let maxDia = 0;
  let found = false;
  while ((m = re.exec(s)) !== null) {
    found = true;
    const count = Number(m[1]);
    const dia = Number(m[2]);
    if (!count || !dia) continue;
    As += (count * (Math.PI * dia * dia)) / 4;
    n += count;
    if (dia > maxDia) maxDia = dia;
  }
  return { As: Math.round(As * 10) / 10, n, dia: maxDia, ok: found && As > 0 };
}

function getSaved(): BeamInput[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved) && saved.length ? saved : [createDefaultBeam('beam-1')];
  } catch {
    return [createDefaultBeam('beam-1')];
  }
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [module, setModule] = useState<ModuleId>('beam');
  const [beams, setBeams] = useState<BeamInput[]>(getSaved);
  const [selectedId, setSelectedId] = useState(beams[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRaw = beams.find((b) => b.id === selectedId) ?? beams[0];
  /** Đồng bộ As từ chuỗi thép trước khi tính */
  const syncAs = (beam: BeamInput): BeamInput => {
    const top = parseBars(beam.barsTop ?? '');
    const bot = parseBars(beam.barsBottom ?? '');
    return {
      ...beam,
      ...(top.ok ? { AsTop: top.As, nBarsTop: top.n, barDiaTop: top.dia } : {}),
      ...(bot.ok ? { AsBottom: bot.As, nBarsBottom: bot.n, barDiaBottom: bot.dia } : {}),
    };
  };
  const selected = syncAs(selectedRaw);
  const result = useMemo(() => calcBeam(selected), [selected]);
  const results = useMemo(() => beams.map((beam) => {
    const b = syncAs(beam);
    return { beam: b, result: calcBeam(b) };
  }), [beams]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(beams));
  }, [beams]);

  const patchSelected = (patch: Partial<BeamInput>) =>
    setBeams((items) => items.map((beam) => (beam.id === selected.id ? { ...beam, ...patch } : beam)));

  const update = (key: keyof BeamInput, value: string) => {
    if (numberKeys.has(key as string)) {
      const n = value === '' || value === '-' ? 0 : Number(value);
      patchSelected({ [key]: Number.isFinite(n) ? n : 0 } as Partial<BeamInput>);
    } else {
      patchSelected({ [key]: value } as Partial<BeamInput>);
    }
  };

  const updateBars = (side: 'Top' | 'Bottom', spec: string) => {
    const parsed = parseBars(spec);
    if (side === 'Top') {
      if (parsed.ok) {
        patchSelected({ barsTop: spec, AsTop: parsed.As, nBarsTop: parsed.n, barDiaTop: parsed.dia });
      } else {
        patchSelected({ barsTop: spec });
      }
    } else {
      if (parsed.ok) {
        patchSelected({ barsBottom: spec, AsBottom: parsed.As, nBarsBottom: parsed.n, barDiaBottom: parsed.dia });
      } else {
        patchSelected({ barsBottom: spec });
      }
    }
  };

  const add = () => {
    const beam = createDefaultBeam();
    beam.name = `Dầm ${beams.length + 1}`;
    setBeams((items) => [...items, beam]);
    setSelectedId(beam.id);
  };

  const remove = () => {
    if (beams.length === 1) return;
    const rest = beams.filter((b) => b.id !== selected.id);
    setBeams(rest);
    setSelectedId(rest[0].id);
  };

  const exportJson = () =>
    download(
      'du-an-dam-btct-v1.json',
      JSON.stringify({ version: 'beam-v1.2', exportedAt: new Date().toISOString(), beams }, null, 2),
      'application/json'
    );

  const rows = results.map(({ beam, result }) => ({
    'Tên dầm': beam.name,
    'b×h': `${beam.b}×${beam.h}`,
    'L (m)': beam.L ?? '',
    'Thép trên': beam.barsTop || `${beam.AsTop} mm²`,
    'Thép dưới': beam.barsBottom || `${beam.AsBottom} mm²`,
    'Uốn': result.negative.check.pass && result.positive.check.pass ? 'ĐẠT' : 'KĐ',
    'Cắt': result.shear.check.pass ? 'ĐẠT' : 'KĐ',
    'Nứt': result.crack.pass ? 'ĐẠT' : 'KĐ',
    'Võng': (beam.L ?? 0) > 0 ? (result.deflection.pass ? 'ĐẠT' : 'KĐ') : '—',
    'Tổng': result.pass ? 'ĐẠT' : 'KĐ',
  }));

  const exportCsv = () =>
    download('tong-hop-dam-btct-v1.csv', '\ufeff' + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)), 'text/csv;charset=utf-8');

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tổng hợp');
    XLSX.writeFile(wb, 'dam-btct-v1.xlsx');
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const list: BeamInput[] = Array.isArray(data) ? data : data.beams;
        if (!Array.isArray(list) || !list.length) throw new Error('empty');
        const normalized = list.map((b) => ({ ...createDefaultBeam(), ...b, id: b.id || crypto.randomUUID() }));
        setBeams(normalized);
        setSelectedId(normalized[0].id);
      } catch {
        alert('Không đọc được file JSON.');
      }
    };
    reader.readAsText(file);
  };

  const barsTop = selected.barsTop ?? (selected.nBarsTop && selected.barDiaTop ? `${selected.nBarsTop}d${selected.barDiaTop}` : '');
  const barsBottom = selected.barsBottom ?? (selected.nBarsBottom && selected.barDiaBottom ? `${selected.nBarsBottom}d${selected.barDiaBottom}` : '');
  const parsedTop = parseBars(barsTop);
  const parsedBot = parseBars(barsBottom);
  const displayAsTop = parsedTop.ok ? parsedTop.As : selected.AsTop;
  const displayAsBot = parsedBot.ok ? parsedBot.As : selected.AsBottom;

  return (
    <div className="app">
      <aside>
        <div className="brand">BTCT <span>5574</span></div>
        <p className="muted">V1.3 · DẦM · CỘT · (SÀN/MÓNG)</p>
        <button type="button" className={`nav ${module === 'beam' ? 'active' : ''}`} onClick={() => setModule('beam')}>▣&nbsp; Dầm BTCT</button>
        <button type="button" className={`nav ${module === 'column' ? 'active' : ''}`} onClick={() => setModule('column')}>▣&nbsp; Cột BTCT</button>
        <button type="button" className="nav disabled" title="Sắp tới">▣&nbsp; Sàn BTCT</button>
        <button type="button" className="nav disabled" title="Sắp tới">▣&nbsp; Móng BTCT</button>
        <div className="sidefoot">
          V1.3 · Dầm + Cột<br />
          N–M gần đúng<br />
          Chưa khóa chuẩn TCVN
        </div>
      </aside>
      <main>
        {module === 'column' && <ColumnPanel />}
        {module === 'beam' && (
        <>
        <header>
          <div>
            <h1>Dầm BTCT V1.2</h1>
            <p>Uốn · Cắt · Cấu tạo · Nứt · Võng (ước lượng)</p>
          </div>
          <div className="actions">
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}>Import JSON</button>
            <button onClick={exportJson}>JSON</button>
            <button onClick={exportCsv}>CSV</button>
            <button onClick={exportXlsx}>XLSX</button>
            <button className="primary" onClick={() => window.print()}>In / PDF</button>
          </div>
        </header>

        <section className="notice">
          <b>V1.2:</b> L nhịp hỗ trợ 2 chữ số thập phân (vd 4.25). Cốt thép nhập dạng <code>5d18</code> hoặc <code>3d22+2d16</code> → tự tính As (ô As khóa).
          Moment SLS mặc định ≈ M<sub>ULS</sub>/1.4 nếu để 0.
        </section>

        <div className="workspace">
          <section className="beam-list card">
            <div className="card-title">
              <h2>Danh sách dầm</h2>
              <button className="primary" onClick={add}>+ Thêm</button>
            </div>
            {results.map(({ beam, result }) => (
              <button key={beam.id} className={`beam-item ${beam.id === selected.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(beam.id)}>
                <span>
                  <b>{beam.name}</b>
                  <small>{beam.b}×{beam.h} · L={beam.L ?? '—'}m</small>
                </span>
                <Status pass={result.pass} />
              </button>
            ))}
          </section>

          <section className="input card">
            <div className="card-title">
              <h2>Đầu vào: {selected.name}</h2>
              <button className="danger" onClick={remove} disabled={beams.length === 1}>Xóa</button>
            </div>
            <Group title="Vật liệu & nhận diện">
              <Field label="Tên"><input value={selected.name} onChange={(e) => update('name', e.target.value)} /></Field>
              <Field label="Bê tông">
                <select value={selected.concrete} onChange={(e) => update('concrete', e.target.value)}>
                  {concretes.map((x) => <option key={x.name}>{x.name}</option>)}
                </select>
              </Field>
              <Field label="Thép dọc">
                <select value={selected.steel} onChange={(e) => update('steel', e.target.value)}>
                  {steels.map((x) => <option key={x.name}>{x.name}</option>)}
                </select>
              </Field>
              <Field label="Thép đai">
                <select value={selected.stirrupSteel} onChange={(e) => update('stirrupSteel', e.target.value)}>
                  {steels.map((x) => <option key={x.name}>{x.name}</option>)}
                </select>
              </Field>
            </Group>
            <Group title="Tiết diện & ULS">
              <DecimalField label="b (mm)" value={selected.b} step="1" onChange={(v) => update('b', v)} />
              <DecimalField label="h (mm)" value={selected.h} step="1" onChange={(v) => update('h', v)} />
              <DecimalField label="M− ULS (kNm)" value={selected.MNegative} step="0.01" onChange={(v) => update('MNegative', v)} />
              <DecimalField label="M+ ULS (kNm)" value={selected.MPositive} step="0.01" onChange={(v) => update('MPositive', v)} />
              <DecimalField label="Q (kN)" value={selected.Q} step="0.01" onChange={(v) => update('Q', v)} />
            </Group>
            <Group title="Cốt thép">
              <DecimalField label="a trên (mm)" value={selected.aTop} step="1" onChange={(v) => update('aTop', v)} />
              <Field label="Thép trên (vd 5d18)">
                <input value={barsTop} placeholder="5d18 hoặc 3d22+2d16" onChange={(e) => updateBars('Top', e.target.value)} />
              </Field>
              <Field label="As trên (mm²) — tự tính">
                <input type="number" step="0.1" value={displayAsTop} readOnly title="As tính từ bố trí thép trên" style={{ background: '#f3f4f6', cursor: 'default' }} />
              </Field>
              <DecimalField label="a dưới (mm)" value={selected.aBottom} step="1" onChange={(v) => update('aBottom', v)} />
              <Field label="Thép dưới (vd 4d20)">
                <input value={barsBottom} placeholder="4d20 hoặc 3d22+2d16" onChange={(e) => updateBars('Bottom', e.target.value)} />
              </Field>
              <Field label="As dưới (mm²) — tự tính">
                <input type="number" step="0.1" value={displayAsBot} readOnly title="As tính từ bố trí thép dưới" style={{ background: '#f3f4f6', cursor: 'default' }} />
              </Field>
              <DecimalField label="Nhánh đai" value={selected.stirrupLegs} step="1" onChange={(v) => update('stirrupLegs', v)} />
              <DecimalField label="Ø đai (mm)" value={selected.stirrupDia} step="1" onChange={(v) => update('stirrupDia', v)} />
              <DecimalField label="s đai (mm)" value={selected.stirrupSpacing} step="1" onChange={(v) => update('stirrupSpacing', v)} />
            </Group>
            <Group title="SLS · Nứt · Võng">
              <DecimalField label="L nhịp (m)" value={selected.L ?? 0} step="0.01" onChange={(v) => update('L', v)} />
              <DecimalField label="Mser− ngắn (kNm)" value={selected.MserShortNeg ?? 0} step="0.01" onChange={(v) => update('MserShortNeg', v)} />
              <DecimalField label="Mser+ ngắn (kNm)" value={selected.MserShortPos ?? 0} step="0.01" onChange={(v) => update('MserShortPos', v)} />
              <DecimalField label="Mser− dài (kNm)" value={selected.MserLongNeg ?? 0} step="0.01" onChange={(v) => update('MserLongNeg', v)} />
              <DecimalField label="Mser+ dài (kNm)" value={selected.MserLongPos ?? 0} step="0.01" onChange={(v) => update('MserLongPos', v)} />
              <Field label="Độ ẩm">
                <select value={selected.humidity ?? 'mid'} onChange={(e) => update('humidity', e.target.value)}>
                  <option value="high">>75%</option>
                  <option value="mid">40–75%</option>
                  <option value="low"><40%</option>
                </select>
              </Field>
              <Field label="Gối tựa">
                <select value={selected.support ?? 'simple'} onChange={(e) => update('support', e.target.value)}>
                  <option value="simple">Đơn giản</option>
                  <option value="continuous">Liên tục</option>
                  <option value="cantilever">Console</option>
                </select>
              </Field>
            </Group>
          </section>

          <section className="result-panel card">
            <div className="card-title">
              <h2>Kết quả</h2>
              <Status pass={result.pass} large />
            </div>
            <Flexure title="Uốn M−" r={result.negative} />
            <Flexure title="Uốn M+" r={result.positive} />
            <Shear r={result} />
            <Detailing d={result.detailing} />
            <CrackPanel c={result.crack} />
            <DeflectionPanel d={result.deflection} hasL={(selected.L ?? 0) > 0} />
            {result.warnings.length > 0 && (
              <div className="warnings">
                <b>Cảnh báo</b>
                {result.warnings.slice(0, 12).map((w) => <div key={w}>• {w}</div>)}
              </div>
            )}
          </section>
        </div>

        <section className="summary card">
          <div className="card-title">
            <h2>Bảng tổng hợp</h2>
            <small>localStorage · Import/Export JSON</small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dầm</th><th>Tiết diện</th><th>Uốn</th><th>Cắt</th><th>Cấu tạo</th><th>Nứt</th><th>Võng</th><th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ beam, result }) => (
                  <tr key={beam.id}>
                    <td>{beam.name}</td>
                    <td>{beam.b}×{beam.h}</td>
                    <td><Status pass={result.negative.check.pass && result.positive.check.pass} /></td>
                    <td><Status pass={result.shear.check.pass} /></td>
                    <td><Status pass={result.detailing.pass} /></td>
                    <td><Status pass={result.crack.pass} /></td>
                    <td>{(beam.L ?? 0) > 0 ? <Status pass={result.deflection.pass} /> : '—'}</td>
                    <td><Status pass={result.pass} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
        )}
      </main>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset><legend>{title}</legend><div className="form">{children}</div></fieldset>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label>{label}{children}</label>;
}
function DecimalField({ label, value, step = '0.01', onChange }: { label: string; value: number; step?: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
function Status({ pass, large = false }: { pass: boolean; large?: boolean }) {
  return <span className={`status ${pass ? 'pass' : 'fail'} ${large ? 'large' : ''}`}>{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>;
}
function Flexure({ title, r }: { title: string; r: BeamResult['negative'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>{title}</h3><Status pass={r.check.pass} /></div>
      <Result label="ho" value={`${fmt(r.ho)} mm`} />
      <Result label="αm / ξ / ξR" value={`${fmt(r.alphaM, 3)} / ${fmt(r.xi, 3)} / ${fmt(r.xiR, 3)}`} />
      <Result label="As yc / bố trí" value={`${fmt(r.AsRequired, 0)} / ${fmt(r.AsProvided, 0)} mm²`} />
      <small className={r.check.pass ? 'text-pass' : 'text-fail'}>{r.check.message}</small>
    </section>
  );
}
function Shear({ r }: { r: BeamResult }) {
  const s = r.shear;
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Cắt</h3><Status pass={s.check.pass} /></div>
      <Result label="Q / Qbt" value={`${fmt(s.qDemand)} / ${fmt(s.qbt)} kN`} />
      <Result label="Qb+Qsw" value={`${fmt(s.qResistance)} kN`} />
      <Checks checks={[s.compressionCheck, s.resistanceCheck, s.spacingCheck]} />
    </section>
  );
}
function Detailing({ d }: { d: BeamResult['detailing'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Cấu tạo</h3><Status pass={d.pass} /></div>
      <Checks checks={d.checks} />
    </section>
  );
}
function CrackPanel({ c }: { c: BeamResult['crack'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Nứt (SLS)</h3><Status pass={c.pass} /></div>
      <Result label="Mcrc" value={`${fmt(c.Mcrc)} kNm`} />
      <Result label="Trạng thái" value={c.cracked ? 'Có nứt' : 'Không nứt'} />
      <Result label="acrc ngắn / giới hạn" value={c.acrcShort != null ? `${fmt(c.acrcShort, 3)} / ${c.limitShort} mm` : '—'} />
      <Result label="acrc dài / giới hạn" value={c.acrcLong != null ? `${fmt(c.acrcLong, 3)} / ${c.limitLong} mm` : '—'} />
      <Checks checks={[c.checkShort, c.checkLong]} />
    </section>
  );
}
function DeflectionPanel({ d, hasL }: { d: BeamResult['deflection']; hasL: boolean }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Võng (ước lượng)</h3>{hasL ? <Status pass={d.pass} /> : <span className="status">cần L</span>}</div>
      {hasL ? (
        <>
          <Result label="δ ngắn / giới hạn" value={`${fmt(d.deltaShort)} / ${fmt(d.limit)} mm`} />
          <Result label="δ dài / giới hạn" value={`${fmt(d.deltaLong)} / ${fmt(d.limit)} mm`} />
          <Result label="L/δ" value={`L/${d.limitRatio}`} />
          <Checks checks={[d.checkShort, d.checkLong]} />
        </>
      ) : (
        <small>Nhập chiều dài nhịp L (m) để tính võng gần đúng.</small>
      )}
    </section>
  );
}
function Checks({ checks }: { checks: { pass: boolean; message: string }[] }) {
  return (
    <div className="checks">
      {checks.map((item) => (
        <div key={item.message} className={item.pass ? 'text-pass' : 'text-fail'}>
          {item.pass ? '✓' : '×'} {item.message}
        </div>
      ))}
    </div>
  );
}
function Result({ label, value }: { label: string; value: string }) {
  return <div className="result"><span>{label}</span><strong>{value}</strong></div>;
}
