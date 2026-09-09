import { useEffect, useMemo, useRef, useState } from 'react';
import { calcSlab, createDefaultSlab, parseSlabBars, type SlabInput } from '../engine/slab';
import { concretes, steels } from '../engine/materials';
import { openReportPdf, slabReportDoc } from '../report/reportPdf';
import { exportGenericExcel } from '../report/excelReport';

const STORAGE = 'ketcau-btct-5574-slabs-v1';
const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

function loadList(): SlabInput[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    if (Array.isArray(raw) && raw.length) return raw.map((s) => ({ ...createDefaultSlab(), ...s }));
  } catch { /* ignore */ }
  return [createDefaultSlab('s1')];
}

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SlabPanel() {
  const [items, setItems] = useState<SlabInput[]>(loadList);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = items.find((s) => s.id === selectedId) ?? items[0];

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(items));
  }, [items]);

  const results = useMemo(() => items.map((slab) => ({ slab, result: calcSlab(slab) })), [items]);
  const current = results.find((r) => r.slab.id === selected.id) ?? results[0];
  const result = current.result;
  const top = parseSlabBars(selected.barsTop ?? '');
  const bot = parseSlabBars(selected.barsBottom ?? '');

  const patch = (p: Partial<SlabInput>) =>
    setItems((list) => list.map((s) => (s.id === selected.id ? { ...s, ...p } : s)));
  const setNum = (key: keyof SlabInput, raw: string) => {
    const n = raw === '' || raw === '-' ? 0 : Number(raw);
    patch({ [key]: Number.isFinite(n) ? n : 0 } as Partial<SlabInput>);
  };
  const setStr = (key: keyof SlabInput, value: string) => patch({ [key]: value } as Partial<SlabInput>);

  const add = () => {
    const s = createDefaultSlab();
    s.name = `Sàn ${items.length + 1}`;
    setItems((list) => [...list, s]);
    setSelectedId(s.id);
  };
  const remove = () => {
    if (items.length === 1) return;
    const rest = items.filter((s) => s.id !== selected.id);
    setItems(rest);
    setSelectedId(rest[0].id);
  };

  const exportJson = () =>
    download(
      'san-btct.json',
      JSON.stringify({ version: 'slab-v1.1', exportedAt: new Date().toISOString(), slabs: items }, null, 2),
      'application/json'
    );

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const list: SlabInput[] = Array.isArray(data) ? data : data.slabs;
        if (!Array.isArray(list) || !list.length) throw new Error('empty');
        const normalized = list.map((s) => ({
          ...createDefaultSlab(),
          ...s,
          id: s.id || crypto.randomUUID(),
        }));
        setItems(normalized);
        setSelectedId(normalized[0].id);
      } catch {
        alert('Không đọc được file JSON sàn.');
      }
    };
    reader.readAsText(file);
  };

  const exportExcel = () => {
    const summary = results.map(({ slab, result: r }) => ({
      Sàn: slab.name,
      h: slab.h,
      Lx: slab.Lx,
      Ly: slab.Ly,
      'Thép trên': slab.barsTop || '',
      'Thép dưới': slab.barsBottom || '',
      Uốn: r.flexureTop.pass && r.flexureBot.pass ? 'ĐẠT' : 'KĐ',
      Cắt: r.shear.pass ? 'ĐẠT' : 'KĐ',
      Nứt: r.crack.pass ? 'ĐẠT' : 'KĐ',
      Võng: r.deflection.pass ? 'ĐẠT' : 'KĐ',
      'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    }));
    exportGenericExcel('THUYẾT MINH TÍNH TOÁN SÀN BÊ TÔNG CỐT THÉP', 'ThuyetMinh-San-BTCT', [
      { name: 'TongHop', rows: summary },
    ]);
  };

  return (
    <>
      <header>
        <div>
          <h1>Sàn BTCT</h1>
          <p>Dải 1 m · Uốn · Cắt · Nứt · Võng</p>
        </div>
        <div className="actions">
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={exportJson}>JSON</button>
          <button type="button" onClick={exportExcel}>Excel</button>
          <button type="button" className="primary" onClick={() => openReportPdf(slabReportDoc(selected, result))}>Xuất PDF</button>
        </div>
      </header>

      <section className="notice">
        <b>Sàn:</b> Dải 1 m · <b>a bảo vệ</b> → ho = h − a (uốn / cắt / chọc thủng). Thép 2 phương X/Y · Excel / PDF.
      </section>

      <div className="workspace">
        <section className="beam-list card">
          <div className="card-title">
            <h2>Danh sách sàn</h2>
            <button type="button" className="primary" onClick={add}>+ Thêm</button>
          </div>
          {results.map(({ slab, result: r }) => (
            <button key={slab.id} type="button" className={`beam-item ${slab.id === selected.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(slab.id)}>
              <span><b>{slab.name}</b><small>h={slab.h} · Lx={slab.Lx}×Ly={slab.Ly}</small></span>
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
              <label>h (mm)<input type="number" step="1" value={selected.h} onChange={(e) => setNum('h', e.target.value)} /></label>
              <label>a bảo vệ trên (mm)<input type="number" step="1" value={selected.aTop} onChange={(e) => setNum('aTop', e.target.value)} /></label>
              <label>a bảo vệ dưới (mm)<input type="number" step="1" value={selected.aBottom} onChange={(e) => setNum('aBottom', e.target.value)} /></label>
              <label>Lx (m)<input type="number" step="0.01" value={selected.Lx} onChange={(e) => setNum('Lx', e.target.value)} /></label>
              <label>Ly (m)<input type="number" step="0.01" value={selected.Ly} onChange={(e) => setNum('Ly', e.target.value)} /></label>
              <label>Mx trên<input type="number" step="0.1" value={selected.MxTop ?? selected.Mtop} onChange={(e) => setNum('MxTop', e.target.value)} /></label>
              <label>Mx dưới<input type="number" step="0.1" value={selected.MxBot ?? selected.Mbot} onChange={(e) => setNum('MxBot', e.target.value)} /></label>
              <label>My trên<input type="number" step="0.1" value={selected.MyTop ?? 0} onChange={(e) => setNum('MyTop', e.target.value)} /></label>
              <label>My dưới<input type="number" step="0.1" value={selected.MyBot ?? 0} onChange={(e) => setNum('MyBot', e.target.value)} /></label>
              <label>Q (kN/m)<input type="number" step="0.1" value={selected.Q} onChange={(e) => setNum('Q', e.target.value)} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Thép 2 phương + chọc thủng</legend>
            <div className="form">
              <label>Bê tông<select value={selected.concrete} onChange={(e) => setStr('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép<select value={selected.steel} onChange={(e) => setStr('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép trên X<input value={selected.barsTopX ?? selected.barsTop ?? ''} placeholder="d10a200" onChange={(e) => setStr('barsTopX', e.target.value)} /></label>
              <label>Thép trên Y<input value={selected.barsTopY ?? ''} placeholder="d10a200" onChange={(e) => setStr('barsTopY', e.target.value)} /></label>
              <label>Thép dưới X<input value={selected.barsBotX ?? selected.barsBottom ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsBotX', e.target.value)} /></label>
              <label>Thép dưới Y<input value={selected.barsBotY ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsBotY', e.target.value)} /></label>
              <label>N cột (kN)<input type="number" step="0.1" value={selected.N ?? 0} onChange={(e) => setNum('N', e.target.value)} /></label>
              <label>Cột b×h (mm)
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" step="1" value={selected.colB ?? 0} onChange={(e) => setNum('colB', e.target.value)} placeholder="b" />
                  <input type="number" step="1" value={selected.colH ?? 0} onChange={(e) => setNum('colH', e.target.value)} placeholder="h" />
                </div>
              </label>
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>{result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
          </div>
          <section className="result-section">
            <div className="section-heading"><h3>Uốn 2 phương</h3></div>
            <div className="result"><span>a bảo vệ trên / dưới</span><strong>{fmt(result.aTop ?? selected.aTop, 0)} / {fmt(result.aBottom ?? selected.aBottom, 0)} mm</strong></div>
            <div className="result"><span>ho trên / dưới (h−a)</span><strong>{fmt(result.hoTop ?? selected.h - selected.aTop, 0)} / {fmt(result.hoBot ?? selected.h - selected.aBottom, 0)} mm</strong></div>
            <div className="result"><span>AsX trên yc / bố trí</span><strong>{fmt(result.AsTopXReq, 0)} / {fmt(result.AsTopXProv, 0)} mm²/m</strong></div>
            <div className="result"><span>AsY trên yc / bố trí</span><strong>{fmt(result.AsTopYReq, 0)} / {fmt(result.AsTopYProv, 0)} mm²/m</strong></div>
            <div className="result"><span>AsX dưới yc / bố trí</span><strong>{fmt(result.AsBotXReq, 0)} / {fmt(result.AsBotXProv, 0)} mm²/m</strong></div>
            <div className="result"><span>AsY dưới yc / bố trí</span><strong>{fmt(result.AsBotYReq, 0)} / {fmt(result.AsBotYProv, 0)} mm²/m</strong></div>
            <div className={result.flexureX.pass ? 'text-pass' : 'text-fail'}>{result.flexureX.pass ? '✓' : '×'} {result.flexureX.message}</div>
            <div className={result.flexureY.pass ? 'text-pass' : 'text-fail'}>{result.flexureY.pass ? '✓' : '×'} {result.flexureY.message}</div>
          </section>
          <section className="result-section">
            <div className="section-heading"><h3>Chọc thủng</h3>
              <span className={`status ${result.punching.pass ? 'pass' : 'fail'}`}>{result.punching.pass ? 'ĐẠT' : 'KĐ'}</span>
            </div>
            <div className="result"><span>Nct / Nkt</span><strong>{fmt(result.punching.Nct, 1)} / {fmt(result.punching.Nkt, 1)} kN</strong></div>
            <div className="result"><span>um / ho</span><strong>{fmt(result.punching.um, 0)} mm / {fmt(result.punching.ho, 0)} mm</strong></div>
            <div className={result.punching.pass ? 'text-pass' : 'text-fail'}>{result.punching.pass ? '✓' : '×'} {result.punching.message}</div>
          </section>
          <section className="result-section">
            <div className="checks">
              <div className={result.shear.pass ? 'text-pass' : 'text-fail'}>{result.shear.pass ? '✓' : '×'} {result.shear.message}</div>
              <div className={result.crack.pass ? 'text-pass' : 'text-fail'}>{result.crack.pass ? '✓' : '×'} {result.crack.message}</div>
              <div className={result.deflection.pass ? 'text-pass' : 'text-fail'}>{result.deflection.pass ? '✓' : '×'} {result.deflection.message}</div>
            </div>
          </section>
        </section>
      </div>

      <section className="summary card">
        <div className="card-title"><h2>Bảng tổng hợp sàn</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sàn</th><th>h</th><th>Uốn</th><th>Cắt</th><th>Nứt</th><th>Võng</th><th>Tổng</th></tr></thead>
            <tbody>
              {results.map(({ slab, result: r }) => (
                <tr key={slab.id}>
                  <td>{slab.name}</td>
                  <td>{slab.h}</td>
                  <td><span className={`status ${r.flexureTop.pass && r.flexureBot.pass ? 'pass' : 'fail'}`}>{r.flexureTop.pass && r.flexureBot.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.shear.pass ? 'pass' : 'fail'}`}>{r.shear.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.crack.pass ? 'pass' : 'fail'}`}>{r.crack.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.deflection.pass ? 'pass' : 'fail'}`}>{r.deflection.pass ? 'ĐẠT' : 'KĐ'}</span></td>
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
