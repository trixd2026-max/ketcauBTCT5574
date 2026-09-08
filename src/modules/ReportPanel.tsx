/**
 * Tab Báo cáo — xuất Excel / PDF thuyết minh tập trung cho Dầm · Cột · Sàn · Móng.
 */
import { useMemo, useState } from 'react';
import { calcBeam, createDefaultBeam, type BeamInput } from '../engine/beam';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from '../engine/column';
import { calcSlab, createDefaultSlab, type SlabInput } from '../engine/slab';
import { calcFoundation, createDefaultFoundation, type FoundationInput } from '../engine/foundation';
import { exportBeamExcel, exportGenericExcel, type ProjectMeta } from '../report/excelReport';
import { openReportPdf } from '../report/reportPdf';
import { exportProjectExcel, openProjectReportPdf } from '../report/projectExport';
import { beamThuyetMinhDoc } from '../report/thuyetMinhBeam';
import { columnThuyetMinhDoc, slabThuyetMinhDoc, foundationThuyetMinhDoc } from '../report/thuyetMinhMulti';
import { importWorkbookFile } from '../report/excelImport';

const KEYS = {
  beams: 'ketcau-btct-5574-beams-v1',
  columns: 'ketcau-btct-5574-columns-v1',
  slabs: 'ketcau-btct-5574-slabs-v1',
  foundations: 'ketcau-btct-5574-foundations-v1',
  meta: 'ketcau-btct-5574-report-meta-v1',
};

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
    standard: 'TCVN 5574:2018 (tham chiếu)',
  });
}

export default function ReportPanel() {
  const [meta, setMeta] = useState<ProjectMeta>(loadMeta);
  const [scope, setScope] = useState<Scope>({
    beams: true,
    columns: true,
    slabs: true,
    foundations: true,
  });
  const [tick, setTick] = useState(0);
  const [importMsg, setImportMsg] = useState('');

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
    localStorage.setItem(KEYS.meta, JSON.stringify(next));
  };

  const counts = {
    beams: { n: data.beamResults.length, pass: data.beamResults.filter((x) => x.result.pass).length },
    columns: { n: data.columnResults.length, pass: data.columnResults.filter((x) => x.result.pass).length },
    slabs: { n: data.slabResults.length, pass: data.slabResults.filter((x) => x.result.pass).length },
    foundations: {
      n: data.foundationResults.length,
      pass: data.foundationResults.filter((x) => x.result.pass).length,
    },
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

  const exportExcelAll = () => {
    if (scope.beams && data.beamResults.length) exportBeamExcel(data.beamResults, meta);
    if (scope.columns && data.columnResults.length) {
      const summary = data.columnResults.map(({ col, result: r }) => ({
        Cột: col.name,
        'b×h': `${col.b}×${col.h}`,
        N: col.N,
        'N-M': r.interaction.toFixed(3),
        KQ: r.pass ? 'ĐẠT' : 'KĐ',
      }));
      exportGenericExcel('THUYẾT MINH TÍNH TOÁN CỘT BÊ TÔNG CỐT THÉP', 'ThuyetMinh-Cot-BTCT', [
        { name: 'TongHop', rows: summary },
      ], meta);
    }
    if (scope.slabs && data.slabResults.length) {
      const summary = data.slabResults.map(({ slab, result: r }) => ({
        Sàn: slab.name,
        h: slab.h,
        KQ: r.pass ? 'ĐẠT' : 'KĐ',
      }));
      exportGenericExcel('THUYẾT MINH TÍNH TOÁN SÀN BÊ TÔNG CỐT THÉP', 'ThuyetMinh-San-BTCT', [
        { name: 'TongHop', rows: summary },
      ], meta);
    }
    if (scope.foundations && data.foundationResults.length) {
      const summary = data.foundationResults.map(({ f, result: r }) => ({
        Móng: f.name,
        'Lx×Ly': `${f.Lx}×${f.Ly}`,
        KQ: r.pass ? 'ĐẠT' : 'KĐ',
      }));
      exportGenericExcel('THUYẾT MINH TÍNH TOÁN MÓNG ĐƠN BÊ TÔNG CỐT THÉP', 'ThuyetMinh-Mong-BTCT', [
        { name: 'TongHop', rows: summary },
      ], meta);
    }
  };

  const exportProjectAllExcel = () => {
    const d = data;
    exportProjectExcel({
      meta,
      beams: scope.beams ? d.beamResults : [],
      columns: scope.columns
        ? d.columnResults.map((x) => ({
            col: x.col,
            result: x.result,
            asLabel: x.col.bars || '',
          }))
        : [],
      slabs: scope.slabs ? d.slabResults : [],
      foundations: scope.foundations ? d.foundationResults : [],
    });
  };

  const exportProjectAllPdf = () => {
    const d = data;
    const sections: { title: string; rows: { name: string; size: string; pass: boolean; detail?: string }[] }[] = [];
    if (scope.beams) {
      sections.push({
        title: 'Dầm BTCT',
        rows: d.beamResults.map(({ beam, result }) => ({
          name: beam.name,
          size: `${beam.b}×${beam.h} mm` + (beam.L ? ` · L=${beam.L}m` : ''),
          pass: result.pass,
          detail: result.pass ? '' : 'KĐ',
        })),
      });
    }
    if (scope.columns) {
      sections.push({
        title: 'Cột BTCT (N–M gần đúng)',
        rows: d.columnResults.map(({ col, result }) => ({
          name: col.name,
          size: `${col.b}×${col.h} mm`,
          pass: result.pass,
          detail: `N–M≈${result.interaction.toFixed(3)} · vd=${result.vd.toFixed(3)}`,
        })),
      });
    }
    if (scope.slabs) {
      sections.push({
        title: 'Sàn BTCT',
        rows: d.slabResults.map(({ slab, result }) => ({
          name: slab.name,
          size: `h=${slab.h} · ${slab.Lx}×${slab.Ly} m`,
          pass: result.pass,
        })),
      });
    }
    if (scope.foundations) {
      sections.push({
        title: 'Móng đơn BTCT',
        rows: d.foundationResults.map(({ f, result }) => ({
          name: f.name,
          size: `${f.Lx}×${f.Ly}×${f.Hf} m`,
          pass: result.pass,
          detail: `p_max=${result.pMax.toFixed(0)} · Nct=${result.punching.Nct.toFixed(0)}`,
        })),
      });
    }
    openProjectReportPdf({
      meta: {
        projectName: meta.projectName || 'Dự án',
        designer: meta.designer || '',
        date: meta.date || new Date().toLocaleDateString('vi-VN'),
        standard: meta.standard || 'TCVN 5574:2018 (tham chiếu)',
      },
      sections,
    });
  };

  const exportPdfBeams = () => {
    if (!data.beamResults.length) return;
    openReportPdf(beamThuyetMinhDoc(data.beamResults, meta));
  };
  const exportPdfColumns = () => {
    if (!data.columnResults.length) return;
    openReportPdf(columnThuyetMinhDoc(data.columnResults, meta));
  };
  const exportPdfSlabs = () => {
    if (!data.slabResults.length) return;
    openReportPdf(slabThuyetMinhDoc(data.slabResults, meta));
  };
  const exportPdfFoundations = () => {
    if (!data.foundationResults.length) return;
    openReportPdf(foundationThuyetMinhDoc(data.foundationResults, meta));
  };

  const onImport = async (file: File) => {
    try {
      const res = await importWorkbookFile(file);
      if (res.beams.length) localStorage.setItem(KEYS.beams, JSON.stringify(res.beams));
      if (res.columns.length) localStorage.setItem(KEYS.columns, JSON.stringify(res.columns));
      if (res.slabs.length) localStorage.setItem(KEYS.slabs, JSON.stringify(res.slabs));
      if (res.foundations.length) localStorage.setItem(KEYS.foundations, JSON.stringify(res.foundations));
      setImportMsg(res.messages.join(' · ') || `Import OK: ${res.beams.length} dầm, ${res.columns.length} cột, ${res.slabs.length} sàn, ${res.foundations.length} móng`);
      setTick((t) => t + 1);
    } catch (e) {
      setImportMsg('Import lỗi: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <>
      <header>
        <div>
          <h1>Báo cáo · Hồ sơ dự án</h1>
          <p>Excel/PDF hồ sơ dự án gộp · Import TongHop · Dầm · Cột · Sàn · Móng</p>
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
          <button type="button" className="primary" onClick={exportProjectAllExcel}>
            Excel hồ sơ dự án
          </button>
          <button type="button" className="primary" onClick={exportProjectAllPdf}>
            PDF hồ sơ dự án
          </button>
        </div>
      </header>

      <section className="notice">
        Điền thông tin dự án → chọn phạm vi → xuất Excel / PDF hồ sơ gộp hoặc TM từng module.
        Hỗ trợ Import Excel/JSON (sheet TongHop). Cột N–M gần đúng. Chưa full compliance TCVN 5574:2018.
        {importMsg ? <div style={{ marginTop: 8 }}>{importMsg}</div> : null}
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
          <button type="button" className="primary" onClick={exportProjectAllExcel}>Excel hồ sơ dự án</button>
          <button type="button" className="primary" onClick={exportProjectAllPdf}>PDF hồ sơ dự án</button>
          <button type="button" onClick={exportExcelAll}>Excel từng module</button>
          <button type="button" onClick={exportPdfBeams} disabled={!counts.beams.n}>PDF TM Dầm</button>
          <button type="button" onClick={exportPdfColumns} disabled={!counts.columns.n}>PDF TM Cột</button>
          <button type="button" onClick={exportPdfSlabs} disabled={!counts.slabs.n}>PDF TM Sàn</button>
          <button type="button" onClick={exportPdfFoundations} disabled={!counts.foundations.n}>PDF TM Móng</button>
          <button type="button" onClick={() => setTick((t) => t + 1)}>Làm mới từ localStorage</button>
        </div>
      </section>

      <section className="summary card">
        <div className="card-title"><h2>Tổng hợp nhanh</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Loại</th><th>Tên</th><th>KQ</th></tr></thead>
            <tbody>
              {scope.beams &&
                data.beamResults.map(({ beam, result }) => (
                  <tr key={beam.id}><td>Dầm</td><td>{beam.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
                ))}
              {scope.columns &&
                data.columnResults.map(({ col, result }) => (
                  <tr key={col.id}><td>Cột</td><td>{col.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
                ))}
              {scope.slabs &&
                data.slabResults.map(({ slab, result }) => (
                  <tr key={slab.id}><td>Sàn</td><td>{slab.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
                ))}
              {scope.foundations &&
                data.foundationResults.map(({ f, result }) => (
                  <tr key={f.id}><td>Móng</td><td>{f.name}</td><td><span className={`status ${result.pass ? 'pass' : 'fail'}`}>{result.pass ? 'ĐẠT' : 'KĐ'}</span></td></tr>
                ))}
              {!totalN && (
                <tr><td colSpan={3}>Chưa có cấu kiện trong localStorage — nhập ở các tab Dầm/Cột/Sàn/Móng hoặc Import Excel.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
