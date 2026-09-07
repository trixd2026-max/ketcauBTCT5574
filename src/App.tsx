import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { BeamInput, BeamResult, calcBeam, createDefaultBeam } from './engine/beam';
import { concretes, steels } from './engine/materials';

const STORAGE_KEY = 'ketcau-btct-5574-beams-v1';
const numberKeys = new Set<string>([
  'b', 'h', 'aTop', 'aBottom', 'MNegative', 'MPositive', 'Q',
  'AsTop', 'AsBottom', 'stirrupLegs', 'stirrupDia', 'stirrupSpacing',
  'nBarsTop', 'nBarsBottom', 'barDiaTop', 'barDiaBottom',
  'MserShortNeg', 'MserShortPos', 'MserLongNeg', 'MserLongPos', 'L', 'limitRatio',
]);
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';

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
  const [beams, setBeams] = useState<BeamInput[]>(getSaved);
  const [selectedId, setSelectedId] = useState(beams[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = beams.find((b) => b.id === selectedId) ?? beams[0];
  const result = useMemo(() => calcBeam(selected), [selected]);
  const results = useMemo(() => beams.map((beam) => ({ beam, result: calcBeam(beam) })), [beams]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(beams));
  }, [beams]);

  const update = (key: keyof BeamInput, value: string) =>
    setBeams((items) =>
      items.map((beam) =>
        beam.id === selected.id
          ? { ...beam, [key]: numberKeys.has(key as string) ? Number(value) || 0 : value }
          : beam
      )
    );

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
    'M-/M+': `${beam.MNegative}/${beam.MPositive}`,
    'Uốn': result.negative.check.pass && result.positive.check.pass ? 'ĐẠT' : 'KĐ',
    'Cắt': result.shear.check.pass ? 'ĐẠT' : 'KĐ',
    'Cấu tạo': result.detailing.pass ? 'ĐẠT' : 'KĐ',
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

  return (
    <div className="app">
      <aside>
        <div className="brand">BTCT <span>5574</span></div>
        <p className="muted">DẦM V1.2 · UỐN · CẮT · NỨT · VÕNG</p>
        <button className="nav active">▣&nbsp; Dầm BTCT</button>
        <button className="nav disabled">▣&nbsp; Cột BTCT</button>
        <button className="nav disabled">▣&nbsp; Sàn BTCT</button>
        <button className="nav disabled">▣&nbsp; Móng BTCT</button>
        <div className="sidefoot">
          V1.2 thực dụng<br />
          Nứt + võng ước lượng<br />
          Chưa khóa chuẩn đầy đủ
        </div>
      </aside>
      <main>
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
          <b>V1.2:</b> thêm kiểm tra <b>nứt</b> (tiết diện quy đổi, Mcrc, acrc ngắn/dài hạn) và <b>võng ước lượng</b> (cần nhập L).
          Moment SLS mặc định ≈ M<sub>ULS</sub>/1.4 (có thể sửa). Võng chưa tích phân độ cong theo sơ đồ moment đầy đủ.
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
              <NumberField label="b (mm)" value={selected.b} onChange={(v) => update('b', v)} />
              <NumberField label="h (mm)" value={selected.h} onChange={(v) => update('h', v)} />
              <NumberField label="M− ULS (kNm)" value={selected.MNegative} onChange={(v) => update('MNegative', v)} />
              <NumberField label="M+ ULS (kNm)" value={selected.MPositive} onChange={(v) => update('MPositive', v)} />
              <NumberField label="Q (kN)" value={selected.Q} onChange={(v) => update('Q', v)} />
            </Group>
            <Group title="Cốt thép">
              <NumberField label="a trên" value={selected.aTop} onChange={(v) => update('aTop', v)} />
              <NumberField label="As trên" value={selected.AsTop} onChange={(v) => update('AsTop', v)} />
              <NumberField label="a dưới" value={selected.aBottom} onChange={(v) => update('aBottom', v)} />
              <NumberField label="As dưới" value={selected.AsBottom} onChange={(v) => update('AsBottom', v)} />
              <NumberField label="Nhánh đai" value={selected.stirrupLegs} onChange={(v) => update('stirrupLegs', v)} />
              <NumberField label="Ø đai" value={selected.stirrupDia} onChange={(v) => update('stirrupDia', v)} />
              <NumberField label="s đai" value={selected.stirrupSpacing} onChange={(v) => update('stirrupSpacing', v)} />
            </Group>
            <Group title="SLS · Nứt · Võng">
              <NumberField label="L nhịp (m)" value={selected.L ?? 0} onChange={(v) => update('L', v)} />
              <NumberField label="Mser− ngắn (kNm)" value={selected.MserShortNeg ?? 0} onChange={(v) => update('MserShortNeg', v)} />
              <NumberField label="Mser+ ngắn (kNm)" value={selected.MserShortPos ?? 0} onChange={(v) => update('MserShortPos', v)} />
              <NumberField label="Mser− dài (kNm)" value={selected.MserLongNeg ?? 0} onChange={(v) => update('MserLongNeg', v)} />
              <NumberField label="Mser+ dài (kNm)" value={selected.MserLongPos ?? 0} onChange={(v) => update('MserLongPos', v)} />
              <Field label="Độ ẩm">
                <select value={selected.humidity ?? 'mid'} onChange={(e) => update('humidity', e.target.value)}>
                  <option value="high">&gt;75%</option>
                  <option value="mid">40–75%</option>
                  <option value="low">&lt;40%</option>
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
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return <Field label={label}><input type="number" value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
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
