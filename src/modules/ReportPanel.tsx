/**
 * Tab Báo cáo — Excel / PDF / Word + Import workbook + đồng bộ localStorage.
 */
import { useEffect, useMemo, useState } from 'react';
import { calcBeam, createDefaultBeam, type BeamInput } from '../engine/beam';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from '../engine/column';
import { calcSlab, createDefaultSlab, type SlabInput } from '../engine/slab';
import { calcFoundation, createDefaultFoundation, type FoundationInput } from '../engine/foundation';
import { exportBeamExcel, exportGenericExcel, type ProjectMeta } from '../report/excelReport';
import { openReportPdf } from '../report/reportPdf';
import { exportProjectExcel, openProjectReportPdf } from '../report/projectExport';
import { exportReportWord, exportProjectWord } from '../report/wordReport';
import { beamThuyetMinhDoc } from '../report/thuyetMinhBeam';
import { columnThuyetMinhDoc, slabThuyetMinhDoc, foundationThuyetMinhDoc } from '../report/thuyetMinhMulti';
import { importWorkbookFile } from '../report/excelImport';
import { subscribeStorage, saveList, STORAGE_KEYS } from '../report/storageSync';

const KEYS = STORAGE_KEYS;

type Scope = { beams: boolean; columns: boolean; slabs: boolean; foundations: boolean };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadBeams(): BeamInput[] {
  const raw = loadJson<unknown[]>(KEYS.beams, []);
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((b) => ({ ...createDefaultBeam(), ...(b as BeamInput) }));
}
function loadColumns(): ColumnInput[] {
  const raw = loadJson<unknown[]>(KEYS.columns, []);
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((c) => ({ ...createDefaultColumn(), ...(c as ColumnInput) }));
}
function loadSlabs(): SlabInput[] {
  const raw = loadJson<unknown[]>(KEYS.slabs, []);
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((s) => ({ ...createDefaultSlab(), ...(s as SlabInput) }));
}
function loadFoundations(): FoundationInput[] {
  const raw = loadJson<unknown[]>(KEYS.foundations, []);
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw.map((f) => ({ ...createDefaultFoundation(), ...(f as FoundationInput) }));
}
function loadMeta(): ProjectMeta {
  return loadJson<ProjectMeta>(KEYS.meta, {
    projectName: 'Dự án mẫu',
    designer: 'KS. Thiết kế',
    date: new Date().toLocaleDateString('vi-VN'),
    standard: 'TCVN 5574:2018',
  });
}

export default function ReportPanel() {
  const [meta, setMeta] = useState<ProjectMeta>(loadMeta);
  const [scope, setScope] = useState<Scope>({ beams: true, columns: true, slabs: true, foundations: true });
  const [tick, setTick] = useState(0);
  const [importMsg, setImportMsg] = useState('');

  useEffect(() => subscribeStorage(() => setTick((x) => x + 1)), []);

  const data = useMemo(() => {
    void tick;
    const beams = loadBeams();
    const columns = loadColumns();
    const slabs = loadSlabs();
    const foundations = loadFoundations();
    const beamResults = beams.map((beam) => ({ beam, result: calcBeam(beam) }));
    const columnResults = columns.map((col) => {
      const p = parseColumnBars(col.bars ?? '');
      const input = { ...col, ...(p.ok ? { As: p.As, nBars: p.n, barDia: p.dia } : {}) };
      return { col: input, result: calcColumn(input) };
    });
    const slabResults = slabs.map((slab) => ({ slab, result: calcSlab(slab) }));
    const foundationResults = foundations.map((f) => ({ f, result: calcFoundation(f) }));
    return { beamResults, columnResults, slabResults, foundationResults };
  }, [tick]);

  const saveMeta = (patch: Partial<ProjectMeta>) => {
    const next = { ...meta, ...patch };
    setMeta(next);
    saveList(KEYS.meta, next);
  };

  const counts = {
    beams: { n: data.beamResults.length, pass: data.beamResults.filter((x) => x.result.pass).length },
    columns: { n: data.columnResults.length, pass: data.columnResults.filter((x) => x.result.pass).length },
    slabs: { n: data.slabResults.length, pass: data.slabResults.filter((x) => x.result.pass).length },
    foundations: { n: data.foundationResults.length, pass: data.foundationResults.filter((x) => x.result.pass).length },
  };
  const totalN =
    (scope.beams ? counts.beams.n : 0) +
    (scope.columns ? counts.columns.n : 0) +
    (scope.slabs ? counts.slabs.n : 0) +
    (scope.foundations ? counts.foundations.n : 0);
  const totalPass =
    (scope.beams ? counts.beams.pass : 0) +
    (scope.columns ? counts.columns.pass : 0) +
    (scope.slabs ? counts.slabs.pass : 0) +
    (scope.foundations ? counts.foundations.pass : 0);

  const onImport = async (file: File) => {
    try {
      const res = await importWorkbookFile(file);
      if (res.beams.length) saveList(KEYS.beams, res.beams);
      if (res.columns.length) saveList(KEYS.columns, res.columns);
      if (res.slabs.length) saveList(KEYS.slabs, res.slabs);
      if (res.foundations.length) saveList(KEYS.foundations, res.foundations);
      const mapLines = (res.sheetMaps || []).map(
        (m) => `${m.sheet} [${m.kind}] ${m.rowCount} hàng · headers: ${m.headers.slice(0, 5).join(', ')}`,
      );
      setImportMsg(
        [
          `Import: ${res.beams.length} dầm · ${res.columns.length} cột · ${res.slabs.length} sàn · ${res.foundations.length} móng`,
          ...mapLines.slice(0, 6),
          ...res.messages.slice(0, 8),
        ].join('\n') || 'Import OK',
      );
      setTick((t) => t + 1);
    } catch (e) {
      setImportMsg('Import lỗi: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const exportProjectTemplate = () => {
    const payload = {
      version: 'project-template-v1',
      exportedAt: new Date().toISOString(),
      meta,
      beams: data.beamResults.map((x) => x.beam),
      columns: data.columnResults.map((x) => x.col),
      slabs: data.slabResults.map((x) => x.slab),
      foundations: data.foundationResults.map((x) => x.f),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BoMau-DuAn-${meta.projectName || 'BTCT'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportProjectAllExcel = () => {
    exportProjectExcel({
      meta,
      beams: scope.beams ? data.beamResults : [],
      columns: scope.columns ? data.columnResults.map((x) => ({ col: x.col, result: x.result, asLabel: x.col.bars || '' })) : [],
      slabs: scope.slabs ? data.slabResults : [],
      foundations: scope.foundations ? data.foundationResults : [],
    });
  };

  const exportProjectAllPdf = () => {
    const sections: { title: string; rows: { name: string; size: string; pass: boolean; detail?: string }[] }[] = [];
    if (scope.beams)
      sections.push({
        title: 'Dầm BTCT',
        rows: data.beamResults.map(({ beam, result }) => ({
          name: beam.name,
          size: `${beam.b}×${beam.h} mm`,
          pass: result.pass,
        })),
      });
    if (scope.columns)
      sections.push({
        title: 'Cột BTCT',
        rows: data.columnResults.map(({ col, result }) => ({
          name: col.name,
          size: `${col.b}×${col.h} mm`,
          pass: result.pass,
          detail: `N–M≈${result.interaction.toFixed(3)}`,
        })),
      });
    if (scope.slabs)
      sections.push({
        title: 'Sàn BTCT',
        rows: data.slabResults.map(({ slab, result }) => ({
          name: slab.name,
          size: `h=${slab.h}`,
          pass: result.pass,
        })),
      });
    if (scope.foundations)
      sections.push({
        title: 'Móng đơn BTCT',
        rows: data.foundationResults.map(({ f, result }) => ({
          name: f.name,
          size: `${f.Lx}×${f.Ly}`,
          pass: result.pass,
        })),
      });
    openProjectReportPdf({
      meta: {
        projectName: meta.projectName || 'Dự án',
        designer: meta.designer || '',
        date: meta.date || new Date().toLocaleDateString('vi-VN'),
        standard: meta.standard || 'TCVN 5574:2018',
      },
      sections,
    });
  };

  const exportProjectAllWord = () => {
    const sections: { title: string; rows: { name: string; size: string; pass: boolean; detail?: string }[] }[] = [];
    if (scope.beams)
      sections.push({
        title: 'Dầm',
        rows: data.beamResults.map(({ beam, result }) => ({ name: beam.name, size: `${beam.b}×${beam.h}`, pass: result.pass })),
      });
    if (scope.columns)
      sections.push({
        title: 'Cột',
        rows: data.columnResults.map(({ col, result }) => ({ name: col.name, size: `${col.b}×${col.h}`, pass: result.pass })),
      });
    if (scope.slabs)
      sections.push({
        title: 'Sàn',
        rows: data.slabResults.map(({ slab, result }) => ({ name: slab.name, size: `h=${slab.h}`, pass: result.pass })),
      });
    if (scope.foundations)
      sections.push({
        title: 'Móng',
        rows: data.foundationResults.map(({ f, result }) => ({ name: f.name, size: `${f.Lx}×${f.Ly}`, pass: result.pass })),
      });
    void exportProjectWord({
      meta: {
        projectName: meta.projectName || 'Dự án',
        designer: meta.designer || '',
        date: meta.date || new Date().toLocaleDateString('vi-VN'),
        standard: meta.standard || 'TCVN 5574:2018',
      },
      sections,
    });
  };

  return (
    <>
      <header>
        <div>
          <h1>Báo cáo · Hồ sơ dự án</h1>
          <p>Excel / PDF / Word · Import TongHop/Design · Đồng bộ localStorage</p>
        </div>
        <div className="actions">
          <label className="btn">
            Import Excel/JSON
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="primary" onClick={exportProjectAllExcel}>Excel hồ sơ</button>
          <button type="button" className="primary" onClick={exportProjectAllPdf}>PDF hồ sơ</button>
          <button type="button" className="primary" onClick={exportProjectAllWord}>Word hồ sơ</button>
          <button type="button" onClick={exportProjectTemplate}>Bộ mẫu dự án (JSON)</button>
        </div>
      </header>

      <section className="notice">
        Import Excel (TongHop/Design · Beam / MongDon) — preview map cột + báo ô trống. Đồng bộ localStorage.
        {importMsg ? <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>{importMsg}</div> : null}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><h2>Thông tin dự án</h2></div>
        <div className="form">
          <label>Tên dự án<input value={meta.projectName ?? ''} onChange={(e) => saveMeta({ projectName: e.target.value })} /></label>
          <label>Người thiết kế<input value={meta.designer ?? ''} onChange={(e) => saveMeta({ designer: e.target.value })} /></label>
          <label>Ngày<input value={meta.date ?? ''} onChange={(e) => saveMeta({ date: e.target.value })} /></label>
          <label>Tiêu chuẩn<input value={meta.standard ?? ''} onChange={(e) => saveMeta({ standard: e.target.value })} /></label>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><h2>Phạm vi xuất</h2><small>Tổng {totalN} CK · Đạt {totalPass}</small></div>
        <div className="form">
          <label><input type="checkbox" checked={scope.beams} onChange={(e) => setScope((s) => ({ ...s, beams: e.target.checked }))} /> Dầm ({counts.beams.n})</label>
          <label><input type="checkbox" checked={scope.columns} onChange={(e) => setScope((s) => ({ ...s, columns: e.target.checked }))} /> Cột ({counts.columns.n})</label>
          <label><input type="checkbox" checked={scope.slabs} onChange={(e) => setScope((s) => ({ ...s, slabs: e.target.checked }))} /> Sàn ({counts.slabs.n})</label>
          <label><input type="checkbox" checked={scope.foundations} onChange={(e) => setScope((s) => ({ ...s, foundations: e.target.checked }))} /> Móng ({counts.foundations.n})</label>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={exportProjectAllExcel}>Excel hồ sơ</button>
          <button type="button" className="primary" onClick={exportProjectAllPdf}>PDF hồ sơ</button>
          <button type="button" className="primary" onClick={exportProjectAllWord}>Word hồ sơ</button>
          <button type="button" onClick={() => data.beamResults.length && openReportPdf(beamThuyetMinhDoc(data.beamResults, meta))} disabled={!counts.beams.n}>PDF TM Dầm</button>
          <button type="button" onClick={() => data.columnResults.length && openReportPdf(columnThuyetMinhDoc(data.columnResults, meta))} disabled={!counts.columns.n}>PDF TM Cột</button>
          <button type="button" onClick={() => data.slabResults.length && openReportPdf(slabThuyetMinhDoc(data.slabResults, meta))} disabled={!counts.slabs.n}>PDF TM Sàn</button>
          <button type="button" onClick={() => data.foundationResults.length && openReportPdf(foundationThuyetMinhDoc(data.foundationResults, meta))} disabled={!counts.foundations.n}>PDF TM Móng</button>
          <button type="button" onClick={() => data.beamResults.length && void exportReportWord(beamThuyetMinhDoc(data.beamResults, meta), 'ThuyetMinh-Dam.docx')} disabled={!counts.beams.n}>Word TM Dầm</button>
          <button type="button" onClick={() => data.columnResults.length && void exportReportWord(columnThuyetMinhDoc(data.columnResults, meta), 'ThuyetMinh-Cot.docx')} disabled={!counts.columns.n}>Word TM Cột</button>
          <button type="button" onClick={() => data.slabResults.length && void exportReportWord(slabThuyetMinhDoc(data.slabResults, meta), 'ThuyetMinh-San.docx')} disabled={!counts.slabs.n}>Word TM Sàn</button>
          <button type="button" onClick={() => data.foundationResults.length && void exportReportWord(foundationThuyetMinhDoc(data.foundationResults, meta), 'ThuyetMinh-Mong.docx')} disabled={!counts.foundations.n}>Word TM Móng</button>
          <button type="button" onClick={() => setTick((t) => t + 1)}>Làm mới</button>
        </div>
      </section>

      <section className="summary card">
        <div className="card-title"><h2>Tổng hợp nhanh</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Loại</th><th>Tên</th><th>KQ</th></tr></thead>
            <tbody>
              {scope.beams && data.beamResults.map(({ beam, result }) => (
                <tr key={beam.id}><td>Dầm</td><td>{beam.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
              ))}
              {scope.columns && data.columnResults.map(({ col, result }) => (
                <tr key={col.id}><td>Cột</td><td>{col.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
              ))}
              {scope.slabs && data.slabResults.map(({ slab, result }) => (
                <tr key={slab.id}><td>Sàn</td><td>{slab.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
              ))}
              {scope.foundations && data.foundationResults.map(({ f, result }) => (
                <tr key={f.id}><td>Móng</td><td>{f.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
              ))}
              {!totalN && (
                <tr><td colSpan={3}>Chưa có cấu kiện — nhập ở tab Dầm/Cột/Sàn/Móng hoặc Import Excel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
