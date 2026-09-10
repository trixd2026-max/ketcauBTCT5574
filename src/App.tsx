import { useEffect, useMemo, useRef, useState } from 'react';
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
import { exportReportWord } from './report/wordReport';
import { Group, Field, DecimalField, Status, Flexure, Shear, Detailing, CrackPanel, DeflectionPanel } from './components/BeamResults';

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
      if (parsed.ok) patchSelected({ barsTop: spec, AsTop: parsed.As, nBarsTop: parsed.n, barDiaTop: parsed.dia });
      else patchSelected({ barsTop: spec });
    } else {
      if (parsed.ok) patchSelected({ barsBottom: spec, AsBottom: parsed.As, nBarsBottom: parsed.n, barDiaBottom: parsed.dia });
      else patchSelected({ barsBottom: spec });
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
    exportBeamExcel(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' });
  };

  const exportThuyetMinhPdf = () => {
    openReportPdf(beamThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }));
  };

  const exportThuyetMinhWord = () => {
    void exportReportWord(
      beamThuyetMinhDoc(results, { projectName: 'Dự án mẫu', designer: 'KS. Thiết kế' }),
      'ThuyetMinh-Dam.docx',
    );
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
        <button type="button" className={`nav ${module === 'beam' ? 'active' : ''}`} onClick={() => setModule('beam')}>▣ Dầm BTCT</button>
        <button type="button" className={`nav ${module === 'column' ? 'active' : ''}`} onClick={() => setModule('column')}>▣ Cột BTCT</button>
        <button type="button" className={`nav ${module === 'slab' ? 'active' : ''}`} onClick={() => setModule('slab')}>▣ Sàn BTCT</button>
        <button type="button" className={`nav ${module === 'foundation' ? 'active' : ''}`} onClick={() => setModule('foundation')}>▣ Móng BTCT</button>
        <button type="button" className={`nav ${module === 'report' ? 'active' : ''}`} onClick={() => setModule('report')}>▣ Báo cáo</button>
        <div className="sidefoot">
          <button type="button" className="theme-toggle" onClick={() => setDark((d) => !d)}>{dark ? '☀ Sáng' : '🌙 Tối'}</button>
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
            <button onClick={exportThuyetMinhPdf}>TM PDF</button>
            <button className="primary" onClick={exportThuyetMinhWord}>TM Word</button>
          </div>
        </header>

        <section className="notice">
          Toolbar thống nhất: Import JSON · JSON · CSV · Excel báo cáo · PDF dầm · TM PDF · TM Word. Cốt thép dạng <code>5d18</code>.
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
                <span><b>{beam.name}</b><small>{beam.b}×{beam.h} · L={beam.L ?? '—'}m</small></span>
                <Status pass={result.pass} />
              </button>
            ))}
          </section>

          <section className="input card">
            <div className="card-title">
              <h2>Đầu vào: {selected.name}</h2>
              <button className="danger" onClick={remove} disabled={beams.length === 1}>Xóa</button>
            </div>
            <Group title="Vật liệu">
              <Field label="Tên"><input value={selected.name} onChange={(e) => update('name', e.target.value)} /></Field>
              <Field label="Bê tông"><select value={selected.concrete} onChange={(e) => update('concrete', e.target.value)}>{concretes.map((x) => <option key={x.name}>{x.name}</option>)}</select></Field>
              <Field label="Thép"><select value={selected.steel} onChange={(e) => update('steel', e.target.value)}>{steels.map((x) => <option key={x.name}>{x.name}</option>)}</select></Field>
            </Group>
            <Group title="Tiết diện & ULS">
              <DecimalField label="b (mm)" value={selected.b} onChange={(v) => update('b', v)} />
              <DecimalField label="h (mm)" value={selected.h} onChange={(v) => update('h', v)} />
              <DecimalField label="M− (kNm)" value={selected.MNegative} step="0.01" onChange={(v) => update('MNegative', v)} />
              <DecimalField label="M+ (kNm)" value={selected.MPositive} step="0.01" onChange={(v) => update('MPositive', v)} />
              <DecimalField label="Q (kN)" value={selected.Q} step="0.01" onChange={(v) => update('Q', v)} />
            </Group>
            <Group title="Cốt thép">
              <Field label="Thép trên"><input value={barsTop} placeholder="5d18" onChange={(e) => updateBars('Top', e.target.value)} /></Field>
              <Field label="As trên"><input type="number" value={displayAsTop} readOnly style={{ background: '#f3f4f6' }} /></Field>
              <Field label="Thép dưới"><input value={barsBottom} placeholder="4d20" onChange={(e) => updateBars('Bottom', e.target.value)} /></Field>
              <Field label="As dưới"><input type="number" value={displayAsBot} readOnly style={{ background: '#f3f4f6' }} /></Field>
              <DecimalField label="s đai" value={selected.stirrupSpacing} onChange={(v) => update('stirrupSpacing', v)} />
              <DecimalField label="L (m)" value={selected.L ?? 0} step="0.01" onChange={(v) => update('L', v)} />
            </Group>
          </section>

          <section className="result-panel card">
            <div className="card-title"><h2>Kết quả</h2><Status pass={result.pass} large /></div>
            <Flexure title="Uốn M−" r={result.negative} b={selected.b} a={selected.aTop}
              onApplyBars={(spec, As, n, dia) => patchSelected({ barsTop: spec, AsTop: As, nBarsTop: n, barDiaTop: dia })} />
            <Flexure title="Uốn M+" r={result.positive} b={selected.b} a={selected.aBottom}
              onApplyBars={(spec, As, n, dia) => patchSelected({ barsBottom: spec, AsBottom: As, nBarsBottom: n, barDiaBottom: dia })} />
            <Shear r={result} spacing={selected.stirrupSpacing} onApplyS={(s) => update('stirrupSpacing', String(s))} />
            <Detailing d={result.detailing} />
            <CrackPanel c={result.crack} />
            <DeflectionPanel d={result.deflection} hasL={(selected.L ?? 0) > 0} />
          </section>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
