import { useEffect, useMemo, useRef, useState } from 'react';
import { calcSlab, createDefaultSlab, parseSlabBars, type SlabInput } from '../engine/slab';
import { concretes, steels } from '../engine/materials';

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
  const asTop = parseSlabBars(selected.barsTop ?? '', selected.b);
  const asBot = parseSlabBars(selected.barsBottom ?? '', selected.b);

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
      'san-btct-v1.json',
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
        const normalized = list.map((s) => ({ ...createDefaultSlab(), ...s, id: s.id || crypto.randomUUID() }));
        setItems(normalized);
        setSelectedId(normalized[0].id);
      } catch {
        alert('Không đọc được file JSON sàn.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <header>
        <div>
          <h1>Sàn BTCT V1.1</h1>
          <p>Strip 1m · Uốn · Cắt · Nứt · Võng</p>
        </div>
        <div className="actions">
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button type="button" onClick={exportJson}>JSON</button>
          <button type="button" className="primary" onClick={() => window.print()}>In / PDF</button>
        </div>
      </header>

      <section className="notice">
        <b>Sàn V1.1:</b> dải 1 m · μmin=0.1% · thép <code>d10a200</code>. Danh sách + localStorage + JSON.
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
              <span>
                <b>{slab.name}</b>
                <small>h={slab.h} · Lx={slab.Lx}×Ly={slab.Ly}</small>
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
            <legend>Khai báo</legend>
            <div className="form">
              <label>Tên<input value={selected.name} onChange={(e) => setStr('name', e.target.value)} /></label>
              <label>h (mm)<input type="number" step="1" value={selected.h} onChange={(e) => setNum('h', e.target.value)} /></label>
              <label>Lx (m)<input type="number" step="0.01" value={selected.Lx} onChange={(e) => setNum('Lx', e.target.value)} /></label>
              <label>Ly (m)<input type="number" step="0.01" value={selected.Ly} onChange={(e) => setNum('Ly', e.target.value)} /></label>
              <label>L võng (m)<input type="number" step="0.01" value={selected.L ?? 0} onChange={(e) => setNum('L', e.target.value)} /></label>
              <label>b strip (mm)<input type="number" step="1" value={selected.b} onChange={(e) => setNum('b', e.target.value)} /></label>
              <label>Bê tông<select value={selected.concrete} onChange={(e) => setStr('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
              <label>Thép<select value={selected.steel} onChange={(e) => setStr('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Nội lực / thép</legend>
            <div className="form">
              <label>M− (kNm/m)<input type="number" step="0.01" value={selected.Mtop} onChange={(e) => setNum('Mtop', e.target.value)} /></label>
              <label>M+ (kNm/m)<input type="number" step="0.01" value={selected.Mbot} onChange={(e) => setNum('Mbot', e.target.value)} /></label>
              <label>Q (kN/m)<input type="number" step="0.01" value={selected.Q} onChange={(e) => setNum('Q', e.target.value)} /></label>
              <label>a trên (mm)<input type="number" step="1" value={selected.aTop} onChange={(e) => setNum('aTop', e.target.value)} /></label>
              <label>Thép trên<input value={selected.barsTop ?? ''} placeholder="d10a200" onChange={(e) => setStr('barsTop', e.target.value)} /></label>
              <label>As trên<input type="number" readOnly value={asTop.ok ? asTop.As : 0} style={{ background: '#f3f4f6' }} /></label>
              <label>a dưới (mm)<input type="number" step="1" value={selected.aBottom} onChange={(e) => setNum('aBottom', e.target.value)} /></label>
              <label>Thép dưới<input value={selected.barsBottom ?? ''} placeholder="d12a150" onChange={(e) => setStr('barsBottom', e.target.value)} /></label>
              <label>As dưới<input type="number" readOnly value={asBot.ok ? asBot.As : 0} style={{ background: '#f3f4f6' }} /></label>
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Kết quả</h2>
            <span className={`status ${result.pass ? 'pass' : 'fail'} large`}>{result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
          </div>
          <section className="result-section">
            <div className="result"><span>As− yc / bố trí</span><strong>{fmt(result.AsTopReq, 0)} / {fmt(result.AsTopProv, 0)}</strong></div>
            <div className="result"><span>As+ yc / bố trí</span><strong>{fmt(result.AsBotReq, 0)} / {fmt(result.AsBotProv, 0)}</strong></div>
            <div className="checks">
              <div className={result.flexureTop.pass ? 'text-pass' : 'text-fail'}>{result.flexureTop.pass ? '✓' : '×'} {result.flexureTop.message}</div>
              <div className={result.flexureBot.pass ? 'text-pass' : 'text-fail'}>{result.flexureBot.pass ? '✓' : '×'} {result.flexureBot.message}</div>
              <div className={result.shear.pass ? 'text-pass' : 'text-fail'}>{result.shear.pass ? '✓' : '×'} {result.shear.message}</div>
              <div className={result.crack.pass ? 'text-pass' : 'text-fail'}>{result.crack.pass ? '✓' : '×'} {result.crack.message}</div>
              <div className={result.deflection.pass ? 'text-pass' : 'text-fail'}>{result.deflection.pass ? '✓' : '×'} {result.deflection.message}</div>
            </div>
          </section>
        </section>
      </div>

      <section className="summary card">
        <div className="card-title">
          <h2>Bảng tổng hợp sàn</h2>
          <small>localStorage · Import/Export JSON</small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Sàn</th><th>h</th><th>Uốn−</th><th>Uốn+</th><th>Cắt</th><th>Nứt</th><th>Võng</th><th>Tổng</th></tr>
            </thead>
            <tbody>
              {results.map(({ slab, result: r }) => (
                <tr key={slab.id}>
                  <td>{slab.name}</td>
                  <td>{slab.h}</td>
                  <td><span className={`status ${r.flexureTop.pass ? 'pass' : 'fail'}`}>{r.flexureTop.pass ? 'ĐẠT' : 'KĐ'}</span></td>
                  <td><span className={`status ${r.flexureBot.pass ? 'pass' : 'fail'}`}>{r.flexureBot.pass ? 'ĐẠT' : 'KĐ'}</span></td>
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
