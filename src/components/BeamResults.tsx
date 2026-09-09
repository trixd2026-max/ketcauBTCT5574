import type { ReactNode } from 'react';
import type { BeamResult } from '../engine/beam';
import { suggestBeamBars } from '../engine/beam';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '—';

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="form">{children}</div>
    </fieldset>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export function DecimalField({
  label,
  value,
  step = '1',
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function Status({ pass, large }: { pass: boolean; large?: boolean }) {
  return <span className={`status ${pass ? 'pass' : 'fail'}${large ? ' large' : ''}`}>{pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>;
}

export function Flexure({
  title, r, b, a, onApplyBars,
}: {
  title: string;
  r: BeamResult['negative'];
  b?: number;
  a?: number;
  onApplyBars?: (spec: string, As: number, n: number, dia: number) => void;
}) {
  const suggestions = b && r.AsRequired > 0 ? suggestBeamBars(r.AsRequired, b, a ?? 50, 4) : [];
  return (
    <section className="result-section">
      <div className="section-heading"><h3>{title}</h3><Status pass={r.check.pass} /></div>
      <div className="result"><span>ho</span><strong>{fmt(r.ho, 0)} mm</strong></div>
      <div className="result"><span>αm / ξ / ξR</span><strong>{fmt(r.alphaM, 3)} / {fmt(r.xi, 3)} / {fmt(r.xiR, 3)}</strong></div>
      <div className="result"><span>As yc / bố trí</span><strong>{fmt(r.AsRequired, 0)} / {fmt(r.AsProvided, 0)} mm²</strong></div>
      <div className={r.check.pass ? 'text-pass' : 'text-fail'}>{r.check.pass ? '✓' : '×'} {r.check.message}</div>
      {suggestions.length > 0 && (
        <div className="suggest-block">
          <small>Gợi ý bố trí (As ≥ {fmt(r.AsRequired, 0)} mm²)</small>
          <div className="suggest-chips">
            {suggestions.map((s) => (
              <button
                key={s.spec}
                type="button"
                className="suggest-chip"
                title={`As = ${fmt(s.As, 0)} mm² · n=${s.n} · Ø${s.dia}`}
                onClick={() => onApplyBars?.(s.spec, s.As, s.n, s.dia)}
              >
                {s.spec}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function Shear({ r, spacing, onApplyS }: { r: BeamResult; spacing: number; onApplyS?: (s: number) => void }) {
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
      <div className="result"><span>s / s gợi ý</span><strong>{fmt(spacing, 0)} / {fmt(suggested ?? 0, 0)} mm</strong></div>
      {suggested != null && suggested > 0 && suggested < spacing && onApplyS && (
        <button type="button" className="primary" style={{ marginTop: 4, fontSize: 12, padding: '4px 10px' }}
          onClick={() => onApplyS(Math.round(suggested))}>
          Áp dụng s = {fmt(suggested, 0)} mm
        </button>
      )}
      <div className={s.check.pass ? 'text-pass' : 'text-fail'}>{s.check.pass ? '✓' : '×'} {s.check.message}</div>
    </section>
  );
}

export function Detailing({ d }: { d: BeamResult['detailing'] }) {
  const items = Object.values(d).filter((x): x is { pass: boolean; message: string } => !!x && typeof x === 'object' && 'pass' in x);
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Cấu tạo</h3></div>
      <div className="checks">
        {items.map((c, i) => (
          <div key={i} className={c.pass ? 'text-pass' : 'text-fail'}>{c.pass ? '✓' : '×'} {c.message}</div>
        ))}
      </div>
    </section>
  );
}

export function CrackPanel({ c }: { c: BeamResult['crack'] }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Nứt</h3><Status pass={c.pass} /></div>
      <div className="result"><span>Mcrc</span><strong>{fmt(c.Mcrc ?? 0, 1)} kNm</strong></div>
      <div className="result"><span>acrc ngắn / dài</span><strong>{fmt(c.acrcShort ?? 0, 2)} / {fmt(c.acrcLong ?? 0, 2)} mm</strong></div>
      <div className={c.pass ? 'text-pass' : 'text-fail'}>{c.pass ? '✓' : '×'} {(c as { message?: string }).message ?? (c.pass ? 'Nứt đạt' : 'Nứt không đạt')}</div>
    </section>
  );
}

export function DeflectionPanel({ d, hasL }: { d: BeamResult['deflection']; hasL: boolean }) {
  return (
    <section className="result-section">
      <div className="section-heading"><h3>Võng (ước lượng)</h3>{hasL ? <Status pass={d.pass} /> : <span className="status">cần L</span>}</div>
      {hasL ? (
        <>
          <div className="result"><span>δ ngắn / giới hạn</span><strong>{fmt(d.deltaShort ?? 0)} / {fmt(d.limit ?? 0)} mm</strong></div>
          <div className="result"><span>δ dài / giới hạn</span><strong>{fmt(d.deltaLong ?? 0)} / {fmt(d.limit ?? 0)} mm</strong></div>
          <div className={d.pass ? 'text-pass' : 'text-fail'}>{d.pass ? '✓' : '×'} {(d as { message?: string }).message ?? (d.pass ? 'Võng đạt' : 'Võng không đạt')}</div>
        </>
      ) : (
        <small className="text-fail">Nhập nhịp L để kiểm võng</small>
      )}
    </section>
  );
}
