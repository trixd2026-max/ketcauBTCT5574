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
import { beamThuyetMinhDoc } from '../report/thuyetMinhBeam';
import { columnThuyetMinhDoc, slabThuyetMinhDoc, foundationThuyetMinhDoc } from '../report/thuyetMinhMulti';
import { importWorkbookFile } from '../report/excelImport';

const KEYS = {
  beams: 'ketcau-btct-5574-beams-v1',
  columns: 'ketcau-btct-5574-columns-v1',
  slabs: 'ketcau-btct-5574-slabs-v1',
  foundations: 'ketcau-btct-5574-foundations-v1',
  meta: 'ketcau-btct-5574-report-meta-v1',
} as const;

type Scope = { beams: boolean; columns: boolean; slabs: boolean; foundations: boolean };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null');
    return raw ?? fallback;
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
    standard: 'TCVN 5574:2018 — Kết cấu bê tông và bê tông cốt thép',
  });
}

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d }) : '—';

export default function ReportPanel() {
  const [meta, setMeta] = useState<ProjectMeta>(loadMeta);
  const [scope, setScope] = useState<Scope>({
    beams: true,
    columns: true,
    slabs: true,
    foundations: true,
  });
  const [tick, setTick] = useState(0);

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
    beams: {
      n: data.beamResults.length,
      pass: data.beamResults.filter((x) => x.result.pass).length,
    },
    columns: {
      n: data.columnResults.length,
      pass: data.columnResults.filter((x) => x.result.pass).length,
    },
    slabs: {
      n: data.slabResults.length,
      pass: data.slabResults.filter((x) => x.result.pass).length,
    },
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
    if (scope.beams && data.beamResults.length) {
      exportBeamExcel(data.beamResults, meta);
    }
    if (scope.columns && data.columnResults.length) {
      const summary = data.columnResults.map(({ col, result: r }) => ({
        Cột: col.name,
        'b×h': `${col.b}×${col.h}`,
        N: col.N,
        Mx: col.Mx,
        My: col.My,
        Thép: col.bars || '',
        'μ (%)': Number(r.mu.toFixed(3)),
        λmax: Number(r.lambdaMax.toFixed(1)),
        vd: Number(r.vd.toFixed(3)),
        'N–M': r.checks.interaction.pass ? 'ĐẠT' : 'KĐ',
        Mảnh: r.checks.slenderness.pass ? 'ĐẠT' : 'KĐ',
        Đai: r.shearX.check.pass && r.shearY.check.pass ? 'ĐẠT' : 'KĐ',
        'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
      }));
      exportGenericExcel('THUYẾT MINH TÍNH TOÁN CỘT BÊ TÔNG CỐT THÉP', 'ThuyetMinh-Cot-BTCT', [
        { name: 'TongHop', rows: summary },
      ], meta);
    }
    if (scope.slabs && data.slabResults.length) {
      const summary = data.slabResults.map(({ slab, result: r }) => ({
        Sàn: slab.name,
        h: slab.h,
        'Lx×Ly': `${slab.Lx}×${slab.Ly}`,
        'M−': slab.Mtop,
        'M+': slab.Mbot,
        Q: slab.Q,
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
      ], meta);
    }
    if (scope.foundations && data.foundationResults.length) {
      const summary = data.foundationResults.map(({ f, result: r }) => ({
        Móng: f.name,
        'Lx×Ly×Hf': `${f.Lx}×${f.Ly}×${f.Hf}`,
        N: f.N,
        Mx: f.Mx,
        My: f.My,
        p_tb: Number(r.pAvg.toFixed(1)),
        p_max: Number(r.pMax.toFixed(1)),
        p_min: Number(r.pMin.toFixed(1)),
        Nền: r.soilAvg.pass && r.soilMax.pass && r.soilMin.pass ? 'ĐẠT' : 'KĐ',
        'Chọc thủng': r.punching.pass ? 'ĐẠT' : 'KĐ',
        'Thép X': r.flexureX.pass ? 'ĐẠT' : 'KĐ',
        'Thép Y': r.flexureY.pass ? 'ĐẠT' : 'KĐ',
        'Kết luận': r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
      }));
      exportGenericExcel('THUYẾT MINH TÍNH TOÁN MÓNG ĐƠN BÊ TÔNG CỐT THÉP', 'ThuyetMinh-Mong-BTCT', [
        { name: 'TongHop', rows: summary },
      ], meta);
    }
    if (totalN === 0) alert('Chưa có cấu kiện nào trong phạm vi đã chọn. Nhập dữ liệu ở các tab Dầm/Cột/Sàn/Móng trước.');
  };

  const exportPdfBeams = () => {
    if (!data.beamResults.length) {
      alert('Chưa có dầm trong localStorage.');
      return;
    }
    openReportPdf(beamThuyetMinhDoc(data.beamResults, meta));
  };

  const exportPdfColumns = () => {
    if (!data.columnResults.length) {
      alert('Chưa có cột.');
      return;
    }
    openReportPdf(columnThuyetMinhDoc(data.columnResults, meta));
  };

  const exportPdfSlabs = () => {
    if (!data.slabResults.length) {
      alert('Chưa có sàn.');
      return;
    }
    openReportPdf(slabThuyetMinhDoc(data.slabResults, meta));
  };

  const exportPdfFoundations = () => {
    if (!data.foundationResults.length) {
      alert('Chưa có móng.');
      return;
    }
    openReportPdf(foundationThuyetMinhDoc(data.foundationResults, meta));
  };

  const onImportWorkbook = async (file: File) => {
    try {
      const res = await importWorkbookFile(file);
      if (res.beams.length) localStorage.setItem(KEYS.beams, JSON.stringify(res.beams));
      if (res.columns.length) localStorage.setItem(KEYS.columns, JSON.stringify(res.columns));
      if (res.slabs.length) localStorage.setItem(KEYS.slabs, JSON.stringify(res.slabs));
      if (res.foundations.length) localStorage.setItem(KEYS.foundations, JSON.stringify(res.foundations));
      setTick((x) => x + 1);
      alert(res.messages.join('\n') || 'Import xong.');
    } catch (e) {
      alert('Import thất bại: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <>
      <header>
        <div>
          <h1>Báo cáo / Thuyết minh</h1>
          <p>Xuất Excel · PDF theo mẫu — Dầm · Cột · Sàn · Móng</p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            Làm mới dữ liệu
          </button>
          <button type="button" className="primary" onClick={exportExcelAll}>
            Xuất Excel
          </button>
        </div>
      </header>

      <section className="notice">
        <b>Tab Báo cáo:</b> đọc danh sách cấu kiện từ localStorage (các tab Dầm/Cột/Sàn/Móng).
        Điền thông tin dự án → chọn phạm vi → xuất Excel / PDF TM đa cấu kiện.
        Hỗ trợ Import Excel/JSON (sheet TongHop). Chưa khẳng định tuân thủ đầy đủ TCVN 5574:2018.
      </section>

      <div className="workspace" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="input card">
          <div className="card-title">
            <h2>Thông tin dự án</h2>
          </div>
          <fieldset>
            <legend>Header báo cáo</legend>
            <div className="form">
              <label>
                Tên dự án
                <input
                  value={meta.projectName ?? ''}
                  onChange={(e) => saveMeta({ projectName: e.target.value })}
                  placeholder="Dự án mẫu - Nhà phố 5 tầng"
                />
              </label>
              <label>
                Người thiết kế
                <input
                  value={meta.designer ?? ''}
                  onChange={(e) => saveMeta({ designer: e.target.value })}
                  placeholder="KS. Nguyễn Văn A"
                />
              </label>
              <label>
                Tiêu chuẩn
                <input
                  value={meta.standard ?? ''}
                  onChange={(e) => saveMeta({ standard: e.target.value })}
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Phạm vi xuất</legend>
            <div className="form" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {(
                [
                  ['beams', 'Dầm', counts.beams],
                  ['columns', 'Cột', counts.columns],
                  ['slabs', 'Sàn', counts.slabs],
                  ['foundations', 'Móng', counts.foundations],
                ] as const
              ).map(([key, label, c]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={scope[key]}
                    onChange={(e) => setScope((s) => ({ ...s, [key]: e.target.checked }))}
                  />
                  <span>
                    {label}{' '}
                    <small>
                      ({c.n} · {c.pass}/{c.n} ĐẠT)
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="result-panel card">
          <div className="card-title">
            <h2>Tổng hợp</h2>
            <span className={`status ${totalN > 0 && totalPass === totalN ? 'pass' : totalN === 0 ? '' : 'fail'} large`}>
              {totalN === 0 ? 'CHƯA CÓ DL' : totalPass === totalN ? 'ĐẠT' : 'CÓ HẠNG MỤC KĐ'}
            </span>
          </div>
          <div className="result">
            <span>Cấu kiện trong phạm vi</span>
            <strong>
              {totalPass}/{totalN} ĐẠT
            </strong>
          </div>
          <div className="result">
            <span>Dầm</span>
            <strong>
              {counts.beams.pass}/{counts.beams.n}
            </strong>
          </div>
          <div className="result">
            <span>Cột</span>
            <strong>
              {counts.columns.pass}/{counts.columns.n}
            </strong>
          </div>
          <div className="result">
            <span>Sàn</span>
            <strong>
              {counts.slabs.pass}/{counts.slabs.n}
            </strong>
          </div>
          <div className="result">
            <span>Móng</span>
            <strong>
              {counts.foundations.pass}/{counts.foundations.n}
            </strong>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="primary" onClick={exportExcelAll}>
              Excel (phạm vi đã chọn)
            </button>
            <button type="button" onClick={exportPdfBeams} disabled={!counts.beams.n}>
              PDF thuyết minh Dầm
            </button>
            <button type="button" onClick={exportPdfColumns} disabled={!counts.columns.n}>
              PDF TM Cột
            </button>
            <button type="button" onClick={exportPdfSlabs} disabled={!counts.slabs.n}>
              PDF TM Sàn
            </button>
            <button type="button" onClick={exportPdfFoundations} disabled={!counts.foundations.n}>
              PDF TM Móng
            </button>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <span className="btn-like">Import Excel/JSON</span>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportWorkbook(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </section>
      </div>

      <section className="summary card">
        <div className="card-title">
          <h2>Xem trước danh sách</h2>
          <small>Dữ liệu lấy từ localStorage — bấm «Làm mới» nếu vừa sửa ở tab khác</small>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loại</th>
                <th>Tên</th>
                <th>Thông số</th>
                <th>Kết luận</th>
              </tr>
            </thead>
            <tbody>
              {scope.beams &&
                data.beamResults.map(({ beam, result }) => (
                  <tr key={beam.id}>
                    <td>Dầm</td>
                    <td>{beam.name}</td>
                    <td>
                      {beam.b}×{beam.h} · L={beam.L ?? '—'}m · M+/{fmt(beam.MPositive)} M−/{fmt(beam.MNegative)}
                    </td>
                    <td>
                      <span className={`status ${result.pass ? 'pass' : 'fail'}`}>
                        {result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                      </span>
                    </td>
                  </tr>
                ))}
              {scope.columns &&
                data.columnResults.map(({ col, result }) => (
                  <tr key={col.id}>
                    <td>Cột</td>
                    <td>{col.name}</td>
                    <td>
                      {col.b}×{col.h} · N={fmt(col.N, 0)} · Mx={fmt(col.Mx)} · My={fmt(col.My)}
                    </td>
                    <td>
                      <span className={`status ${result.pass ? 'pass' : 'fail'}`}>
                        {result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                      </span>
                    </td>
                  </tr>
                ))}
              {scope.slabs &&
                data.slabResults.map(({ slab, result }) => (
                  <tr key={slab.id}>
                    <td>Sàn</td>
                    <td>{slab.name}</td>
                    <td>
                      h={slab.h} · {slab.Lx}×{slab.Ly}m
                    </td>
                    <td>
                      <span className={`status ${result.pass ? 'pass' : 'fail'}`}>
                        {result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                      </span>
                    </td>
                  </tr>
                ))}
              {scope.foundations &&
                data.foundationResults.map(({ f, result }) => (
                  <tr key={f.id}>
                    <td>Móng</td>
                    <td>{f.name}</td>
                    <td>
                      {f.Lx}×{f.Ly}×{f.Hf} · N={fmt(f.N, 0)}
                    </td>
                    <td>
                      <span className={`status ${result.pass ? 'pass' : 'fail'}`}>
                        {result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                      </span>
                    </td>
                  </tr>
                ))}
              {totalN === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#666' }}>
                    Chưa có cấu kiện — chuyển sang tab Dầm/Cột/Sàn/Móng để nhập liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
