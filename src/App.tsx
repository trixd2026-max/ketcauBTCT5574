import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { BeamInput, BeamResult, calcBeam, createDefaultBeam } from './engine/beam';
import { concretes, steels } from './engine/materials';

const STORAGE_KEY = 'ketcau-btct-5574-beams-v1';
const numberKeys = new Set<keyof BeamInput>(['b', 'h', 'aTop', 'aBottom', 'MNegative', 'MPositive', 'Q', 'AsTop', 'AsBottom', 'stirrupLegs', 'stirrupDia', 'stirrupSpacing']);
const fmt = (v: number, d = 1) => Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';

function getSaved(): BeamInput[] {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return Array.isArray(saved) && saved.length ? saved : [createDefaultBeam('beam-1')]; }
  catch { return [createDefaultBeam('beam-1')]; }
}
function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function App() {
  const [beams, setBeams] = useState<BeamInput[]>(getSaved);
  const [selectedId, setSelectedId] = useState(beams[0].id);
  const selected = beams.find((beam) => beam.id === selectedId) ?? beams[0];
  const result = useMemo(() => calcBeam(selected), [selected]);
  const results = useMemo(() => beams.map((beam) => ({ beam, result: calcBeam(beam) })), [beams]);
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(beams)), [beams]);

  const update = (key: keyof BeamInput, value: string) => setBeams((items) => items.map((beam) => beam.id === selected.id ? { ...beam, [key]: numberKeys.has(key) ? Number(value) : value } : beam));
  const add = () => { const beam = createDefaultBeam(); beam.name = `Dầm ${beams.length + 1}`; setBeams((items) => [...items, beam]); setSelectedId(beam.id); };
  const remove = () => { if (beams.length === 1) return; const rest = beams.filter((beam) => beam.id !== selected.id); setBeams(rest); setSelectedId(rest[0].id); };
  const exportJson = () => download('du-an-dam-btct-v1.json', JSON.stringify({ version: 'beam-v1', exportedAt: new Date().toISOString(), beams }, null, 2), 'application/json');
  const rows = results.map(({ beam, result }) => ({ 'Tên dầm': beam.name, 'b (mm)': beam.b, 'h (mm)': beam.h, 'M- (kNm)': beam.MNegative, 'M+ (kNm)': beam.MPositive, 'Q (kN)': beam.Q, 'As trên (mm²)': beam.AsTop, 'As dưới (mm²)': beam.AsBottom, 'Uốn M-': result.negative.check.pass ? 'ĐẠT' : 'KHÔNG ĐẠT', 'Uốn M+': result.positive.check.pass ? 'ĐẠT' : 'KHÔNG ĐẠT', 'Cắt': result.shear.check.pass ? 'ĐẠT' : 'KHÔNG ĐẠT', 'Tổng': result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }));
  const exportCsv = () => download('tong-hop-dam-btct-v1.csv', '\ufeff' + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)), 'text/csv;charset=utf-8');
  const exportXlsx = () => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Tổng hợp'); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([detailRow(selected, result)]), 'Dầm đang chọn'); XLSX.writeFile(wb, 'dam-btct-v1.xlsx'); };

  return <div className="app">
    <aside><div className="brand">BTCT <span>5574</span></div><p className="muted">DẦM V1 · UỐN & CẮT</p>
      <button className="nav active">▣&nbsp; Dầm BTCT</button><button className="nav disabled">▣&nbsp; Cột BTCT</button><button className="nav disabled">▣&nbsp; Sàn BTCT</button><button className="nav disabled">▣&nbsp; Móng BTCT</button>
      <div className="sidefoot">V1 thực dụng<br />Chưa khóa chuẩn TCVN</div>
    </aside>
    <main>
      <header><div><h1>Dầm BTCT V1</h1><p>Nhập → Uốn M−/M+ → Cắt → Tổng hợp PASS/FAIL</p></div><div className="actions"><button onClick={exportJson}>JSON</button><button onClick={exportCsv}>CSV</button><button onClick={exportXlsx}>XLSX</button><button className="primary" onClick={() => window.print()}>In / PDF</button></div></header>
      <section className="notice"><b>Giới hạn phiên bản:</b> kết luận hiện chỉ gồm uốn và cắt theo các công thức đã trích từ <code>Beam.xlsm/KiemTraUonCat</code>. Chưa đối chiếu đầy đủ các kiểm tra cấu tạo, nứt, võng, tải trọng và tất cả tình huống đặc biệt.</section>
      <div className="workspace">
        <section className="beam-list card"><div className="card-title"><h2>Danh sách dầm</h2><button className="primary" onClick={add}>+ Thêm dầm</button></div>{results.map(({ beam, result }) => <button key={beam.id} className={`beam-item ${beam.id === selected.id ? 'selected' : ''}`} onClick={() => setSelectedId(beam.id)}><span><b>{beam.name}</b><small>{beam.b}×{beam.h} mm · M− {beam.MNegative} · M+ {beam.MPositive} kNm</small></span><Status pass={result.pass} /></button>)}</section>
        <section className="input card"><div className="card-title"><h2>Đầu vào: {selected.name}</h2><button className="danger" onClick={remove} disabled={beams.length === 1}>Xóa</button></div>
          <Group title="Nhận diện & vật liệu"><Field label="Tên dầm"><input value={selected.name} onChange={(e) => update('name', e.target.value)} /></Field><Field label="Bê tông"><select value={selected.concrete} onChange={(e) => update('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></Field><Field label="Thép dọc"><select value={selected.steel} onChange={(e) => update('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></Field><Field label="Thép đai"><select value={selected.stirrupSteel} onChange={(e) => update('stirrupSteel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></Field></Group>
          <Group title="Tiết diện & nội lực"><NumberField label="b (mm)" value={selected.b} onChange={(v) => update('b', v)} /><NumberField label="h (mm)" value={selected.h} onChange={(v) => update('h', v)} /><NumberField label="M− (kNm)" value={selected.MNegative} onChange={(v) => update('MNegative', v)} /><NumberField label="M+ (kNm)" value={selected.MPositive} onChange={(v) => update('MPositive', v)} /><NumberField label="Q (kN)" value={selected.Q} onChange={(v) => update('Q', v)} /></Group>
          <Group title="Cốt thép bố trí"><NumberField label="a trên (mm)" value={selected.aTop} onChange={(v) => update('aTop', v)} /><NumberField label="As trên (mm²)" value={selected.AsTop} onChange={(v) => update('AsTop', v)} /><NumberField label="a dưới (mm)" value={selected.aBottom} onChange={(v) => update('aBottom', v)} /><NumberField label="As dưới (mm²)" value={selected.AsBottom} onChange={(v) => update('AsBottom', v)} /><NumberField label="Số nhánh đai" value={selected.stirrupLegs} onChange={(v) => update('stirrupLegs', v)} /><NumberField label="Ø đai (mm)" value={selected.stirrupDia} onChange={(v) => update('stirrupDia', v)} /><NumberField label="s đai (mm)" value={selected.stirrupSpacing} onChange={(v) => update('stirrupSpacing', v)} /></Group>
        </section>
        <section className="result-panel card"><div className="card-title"><h2>Kết quả</h2><Status pass={result.pass} large /></div><Flexure title="Uốn M− · thép trên" r={result.negative} /><Flexure title="Uốn M+ · thép dưới" r={result.positive} /><Shear r={result} />
          {result.warnings.length > 0 && <div className="warnings"><b>Cảnh báo cần xử lý</b>{result.warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div>}</section>
      </div>
      <section className="summary card"><div className="card-title"><h2>Bảng tổng hợp</h2><small>Tự lưu trên trình duyệt này</small></div><div className="table-wrap"><table><thead><tr><th>Dầm</th><th>Tiết diện</th><th>M− / M+</th><th>Uốn M−</th><th>Uốn M+</th><th>Cắt</th><th>Tổng</th></tr></thead><tbody>{results.map(({ beam, result }) => <tr key={beam.id}><td>{beam.name}</td><td>{beam.b} × {beam.h}</td><td>{beam.MNegative} / {beam.MPositive} kNm</td><td><Status pass={result.negative.check.pass} /></td><td><Status pass={result.positive.check.pass} /></td><td><Status pass={result.shear.check.pass} /></td><td><Status pass={result.pass} /></td></tr>)}</tbody></table></div></section>
    </main>
  </div>;
}

function detailRow(beam: BeamInput, result: BeamResult) { return { 'Tên dầm': beam.name, 'ho M- (mm)': result.negative.ho, 'αm M-': result.negative.alphaM, 'ξ / ξR M-': `${result.negative.xi} / ${result.negative.xiR}`, 'As yc M- (mm²)': result.negative.AsRequired, 'As cấp M- (mm²)': beam.AsTop, 'As yc M+ (mm²)': result.positive.AsRequired, 'As cấp M+ (mm²)': beam.AsBottom, 'Q (kN)': result.shear.qDemand, 'Qbt (kN)': result.shear.qbt, 'Qb + Qsw (kN)': result.shear.qResistance, 'Kết quả': result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }; }
function Group({ title, children }: { title: string; children: ReactNode }) { return <fieldset><legend>{title}</legend><div className="form">{children}</div></fieldset>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label>{label}{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <Field label={label}><input type="number" value={value} onChange={(e) => onChange(e.target.value)} /></Field>; }
function Status({ pass, large = false }: { pass: boolean; large?: boolean }) { return <span className={`status ${pass ? 'pass' : 'fail'} ${large ? 'large' : ''}`}>{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>; }
function Flexure({ title, r }: { title: string; r: BeamResult['negative'] }) { return <section className="result-section"><div className="section-heading"><h3>{title}</h3><Status pass={r.check.pass} /></div><Result label="ho" value={`${fmt(r.ho)} mm`} /><Result label="αm" value={fmt(r.alphaM, 4)} /><Result label="ξ / ξR" value={`${fmt(r.xi, 3)} / ${fmt(r.xiR, 3)}`} /><Result label="As yêu cầu / bố trí" value={`${fmt(r.AsRequired, 0)} / ${fmt(r.AsProvided, 0)} mm²`} /><Result label="μ / min / max" value={`${fmt(r.mu, 2)} / ${fmt(r.muMin, 2)} / ${fmt(r.muMax, 2)} %`} /><Result label="Mu giới hạn" value={`${fmt(r.Mu)} kNm`} /><small className={r.check.pass ? 'text-pass' : 'text-fail'}>{r.check.message}</small></section>; }
function Shear({ r }: { r: BeamResult }) { const s = r.shear; return <section className="result-section"><div className="section-heading"><h3>Cắt Q</h3><Status pass={s.check.pass} /></div><Result label="ho kiểm tra" value={`${fmt(s.ho)} mm`} /><Result label="Q / Qbt" value={`${fmt(s.qDemand)} / ${fmt(s.qbt)} kN`} /><Result label="Qb + Qsw" value={`${fmt(s.qB)} + ${fmt(s.qSw)} = ${fmt(s.qResistance)} kN`} /><Result label="Asw / qsw" value={`${fmt(s.stirrupArea, 0)} mm² / ${fmt(s.qsw, 1)} N/mm`} /><Result label="s bố trí / smax" value={`${fmt(s.sMax, 0)} mm giới hạn`} /><Checks checks={[s.compressionCheck, s.resistanceCheck, s.spacingCheck]} /></section>; }
function Checks({ checks }: { checks: { pass: boolean; message: string }[] }) { return <div className="checks">{checks.map((item) => <div key={item.message} className={item.pass ? 'text-pass' : 'text-fail'}>{item.pass ? '✓' : '×'} {item.message}</div>)}</div>; }
function Result({ label, value }: { label: string; value: string }) { return <div className="result"><span>{label}</span><strong>{value}</strong></div>; }
