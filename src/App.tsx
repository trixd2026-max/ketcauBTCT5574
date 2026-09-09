import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { BeamInput, BeamResult, calcBeam, createDefaultBeam } from './engine/beam';
import { concretes, steels } from './engine/materials';
import ColumnPanel from './modules/ColumnPanel';
import SlabPanel from './modules/SlabPanel';
import FoundationPanel from './modules/FoundationPanel';
import ReportPanel from './modules/ReportPanel';
import { openReportPdf, beamReportDoc } from './report/reportPdf';
import { beamThuyetMinhDoc } from './report/thuyetMinhBeam';
import { exportBeamExcel } from './report/excelReport';

type ModuleId = 'beam' | 'column' | 'slab' | 'foundation' | 'report';

const STORAGE_KEY = 'ketcau-btct-5574-beams-v1';
const numberKeys = new Set<string>([
  'b', 'h', 'aTop', 'aBottom', 'MNegative', 'MPositive', 'Q',
  'AsTop', 'AsBottom', 'stirrupLegs', 'stirrupDia', 'stirrupSpacing',
  'nBarsTop', 'nBarsBottom', 'barDiaTop', 'barDiaBottom',
  'MserShortNeg', 'MserShortPos', 'MserLongNeg', 'MserLongPos', 'L', 'limitRatio',
]);
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

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
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('ketcau-theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('ketcau-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRaw = beams.find((b) => b.id === selectedId) ?? beams[0];
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
    exportBeamExcel(results, {
      projectName: 'Dự án mẫu',
      designer: 'KS. Thiết kế',
    });
  };

  const exportThuyetMinhPdf = () => {
    openReportPdf(beamThuyetMinhDoc(results, {
      projectName: 'Dự án mẫu',
      designer: 'KS. Thiết kế',
    }));
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
        <div className="brand">BTCT <span>5574:2018</span></div>
        <p className="muted">DẦM · CỘT · SÀN · MÓNG · BÁO CÁO</p>
        <button type="button" className={`nav ${module === 'beam' ? 'active' : ''}`} onClick={() => setModule('beam')}>▣&nbsp; Dầm BTCT</button>
        <button type="button" className={`nav ${module === 'column' ? 'active' : ''}`} onClick={() => setModule('column')}>▣&nbsp; Cột BTCT</button>
        <button type="button" className={`nav ${module === 'slab' ? 'active' : ''}`} onClick={() => setModule('slab')}>▣&nbsp; Sàn BTCT</button>
        <button type="button" className={`nav ${module === 'foundation' ? 'active' : ''}`} onClick={() => setModule('foundation')}>▣&nbsp; Móng BTCT</button>
        <button type="button" className={`nav ${module === 'report' ? 'active' : ''}`} onClick={() => setModule('report')}>▣&nbsp; Báo cáo</button>
        <div className="sidefoot">
          <button type="button" className="theme-toggle" onClick={() => setDark((d) => !d)}>
            {dark ? '☀ Sáng' : '🌙 Tối'}
          </button>
          <div style={{ marginTop: 10 }}>TCVN 5574:2018</div>
        </div>
      </aside>
      <main>
        {module === 'column' && <ColumnPanel />}
        {module === 'slab' && <SlabPanel />}
        {module === 'foundation' && <FoundationPanel />}
        {module === 'report' && <ReportPanel />}
        {module === 'beam' && (
        <>
        <header>
          <div>
            <h1>Dầm BTCT 5574:2018</h1>
            <p>Uốn · Cắt · Cấu tạo · Nứt · Võng (ước lượng)</p>
          </div>
          <div className="actions">
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()}>Import JSON</button>
            <button onClick={exportJson}>JSON</button>
            <button onClick={exportCsv}>CSV</button>
            <button onClick={exportXlsx}>Excel báo cáo</button>
            <button onClick={() => openReportPdf(beamReportDoc(selected, result))}>PDF dầm</button>
            <button className="primary" onClick={exportThuyetMinhPdf}>Thuyết minh PDF</button>
          </div>
        </header>

        <section className="notice">
          L nhịp hỗ trợ 2 chữ số thập phân (vd 4.25). Cốt thép nhập dạng <code>5d18</code> hoặc <code>3d22+2d16</code> → tự tính As (ô As khóa).
          Moment SLS mặc định ≈ M<sub>ULS</sub>/1.4 nếu để 0. Nút <b>Excel báo cáo</b> / <b>Thuyết minh PDF</b> xuất toàn bộ danh sách dầm theo mẫu.
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
                  <option value="high">{'">75%'}</option>
                  <option value="mid">40–75%</option>
                  <option value="low">{'<'}40%</option>
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
            <Shear
              r={result}
              spacing={selected.stirrupSpacing}
              onApplyS={(s) => update('stirrupSpacing', String(s))}
            />
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
            <h2>So sánh nhanh nhiều dầm</h2>
            <small>As yc / bố trí · Q / Qb+Qsw · s / s gợi ý</small>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dầm</th>
                  <th>b×h</th>
                  <th>As− yc/bố trí</th>
                  <th>As+ yc/bố trí</th>
                  <th>Q / Qb+Qsw</th>
                  <th>s / s gợi ý</th>
                  <th>Uốn</th>
                  <th>Cắt</th>
                  <th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ beam, result: r }) => {
                  const asNegOk = r.negative.AsProvided >= r.negative.AsRequired;
                  const asPosOk = r.positive.AsProvided >= r.positive.AsRequired;
                  const qOk = r.shear.qDemand <= r.shear.qResistance;
                  return (
                    <tr
                      key={beam.id}
                      className={beam.id === selected.id ? 'row-selected' : undefined}
                      onClick={() => setSelectedId(beam.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><b>{beam.name}</b></td>
                      <td>{beam.b}×{beam.h}</td>
                      <td className={asNegOk ? 'text-pass' : 'text-fail'}>
                        {fmt(r.negative.AsRequired, 0)} / {fmt(r.negative.AsProvided, 0)}
                      </td>
                      <td className={asPosOk ? 'text-pass' : 'text-fail'}>
                        {fmt(r.positive.AsRequired, 0)} / {fmt(r.positive.AsProvided, 0)}
                      </td>
                      <td className={qOk ? 'text-pass' : 'text-fail'}>
                        {fmt(r.shear.qDemand, 1)} / {fmt(r.shear.qResistance, 1)}
                      </td>
                      <td>{fmt(r.shear.stirrupSpacing, 0)} / {fmt(r.shear.sSuggested ?? r.shear.sRequired ?? 0, 0)}</td>
                      <td><Status pass={r.negative.check.pass && r.positive.check.pass} /></td>
                      <td><Status pass={r.shear.check.pass} /></td>
                      <td><Status pass={r.pass} /></td>
                    </tr>
                  );
                })}
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
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="form">{children}</div>
    </fieldset>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label>{label}{children}</label>;
}
function DecimalField({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
function Status({ pass, large }: { pass: boolean; large?: boolean }) {
  return <span className={`status ${pass ? 'pass' : 'fail'}${large ? ' large' : ''}`}>{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>;
}
function Flexure({ title, r }: { title: string; r: BeamResult['negative'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>{title}</h3><Status pass={r.check.pass} /></div>
      <div className="result"><span>ho</span><strong>{fmt(r.ho, 0)} mm</strong></div>
      <div className="result"><span>αm / ξ / ξR</span><strong>{fmt(r.alphaM, 3)} / {fmt(r.xi, 3)} / {fmt(r.xiR, 3)}</strong></div>
      <div className="result"><span>As yc / bố trí</span><strong>{fmt(r.AsRequired, 0)} / {fmt(r.AsProvided, 0)} mm²</strong></div>
      <div className={r.check.pass ? 'text-pass' : 'text-fail'}>{r.check.pass ? '✓' : '×'} {r.check.message}</div>
    </section>
  );
}
function Shear({ r, spacing, onApplyS }: { r: BeamResult; spacing: number; onApplyS: (s: number) => void }) {
  const s = r.shear;
  const suggested = s.sSuggested ?? s.sRequired;
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Cắt</h3><Status pass={s.check.pass} /></div>
      <div className="result"><span>ho</span><strong>{fmt(s.ho, 0)} mm</strong></div>
      <div className="result"><span>Q / Qbt</span><strong>{fmt(s.qDemand, 1)} / {fmt(s.qbt, 1)} kN</strong></div>
      <div className="result"><span>Qb</span><strong>{fmt(s.qB, 1)} kN</strong></div>
      <div className="result"><span>Qsw</span><strong>{fmt(s.qSw, 1)} kN</strong></div>
      <div className="result"><span>Qb + Qsw</span><strong>{fmt(s.qResistance, 1)} kN</strong></div>
      <div className="result"><span>Asw</span><strong>{fmt(s.stirrupArea, 1)} mm²</strong></div>
      <div className="result"><span>qsw</span><strong>{fmt(s.qsw, 2)} N/mm</strong></div>
      <div className="result"><span>s / s,max</span><strong>{fmt(spacing, 0)} / {fmt(s.sMax, 0)} mm</strong></div>
      {suggested != null && Number.isFinite(suggested) && (
        <div className="result">
          <span>s gợi ý (từ Q−Qb)</span>
          <strong>
            {fmt(suggested, 0)} mm{' '}
            <button type="button" className="primary" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
              onClick={() => onApplyS(Math.round(suggested))}>
              Áp dụng s
            </button>
          </strong>
        </div>
      )}
      <div className={s.compressionCheck.pass ? 'text-pass' : 'text-fail'}>{s.compressionCheck.pass ? '✓' : '×'} {s.compressionCheck.message}</div>
      <div className={s.resistanceCheck.pass ? 'text-pass' : 'text-fail'}>{s.resistanceCheck.pass ? '✓' : '×'} {s.resistanceCheck.message}</div>
      <div className={s.spacingCheck.pass ? 'text-pass' : 'text-fail'}>{s.spacingCheck.pass ? '✓' : '×'} {s.spacingCheck.message}</div>
    </section>
  );
}
function Detailing({ d }: { d: BeamResult['detailing'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Cấu tạo</h3></div>
      <div className="checks">
        {Object.values(d).map((c, i) => (
          <div key={i} className={c.pass ? 'text-pass' : 'text-fail'}>{c.pass ? '✓' : '×'} {c.message}</div>
        ))}
      </div>
    </section>
  );
}
function CrackPanel({ c }: { c: BeamResult['crack'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Nứt</h3><Status pass={c.pass} /></div>
      <div className="result"><span>Mcrc</span><strong>{fmt(c.Mcrc ?? 0, 1)} kNm</strong></div>
      <div className="result"><span>acrc ngắn / dài</span><strong>{fmt(c.acrcShort ?? 0, 2)} / {fmt(c.acrcLong ?? 0, 2)} mm</strong></div>
      <div className={c.pass ? 'text-pass' : 'text-fail'}>{c.pass ? '✓' : '×'} {c.message}</div>
    </section>
  );
}
function DeflectionPanel({ d, hasL }: { d: BeamResult['deflection']; hasL: boolean }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Võng</h3>{hasL ? <Status pass={d.pass} /> : <span className="status">—</span>}</div>
      <div className="result"><span>δ ngắn / dài</span><strong>{fmt(d.deltaShort ?? 0, 2)} / {fmt(d.deltaLong ?? 0, 2)} mm</strong></div>
      <div className="result"><span>Giới hạn</span><strong>{fmt(d.limit ?? 0, 1)} mm</strong></div>
      <div className={d.pass ? 'text-pass' : 'text-fail'}>{hasL ? (d.pass ? '✓' : '×') : '·'} {d.message}</div>
    </section>
  );
}
