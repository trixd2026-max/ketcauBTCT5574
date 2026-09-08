import { describe, expect, it } from 'vitest';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from './column';
import { ALL_COLUMN_GOLDEN, runColumnGolden } from './column.golden';

const base = (p: Partial<ColumnInput>): ColumnInput => ({ ...createDefaultColumn('t'), ...p });

describe('parseColumnBars', () => {
  it('12d20', () => {
    const p = parseColumnBars('12d20');
    expect(p.ok).toBe(true);
    expect(p.n).toBe(12);
    expect(p.dia).toBe(20);
  });
});

describe('Column golden CG1–CG7', () => {
  for (const g of ALL_COLUMN_GOLDEN) {
    it(`${g.id}: ${g.note}`, () => {
      const { ok, errors, result } = runColumnGolden(g);
      expect(errors, errors.join(' | ')).toEqual([]);
      expect(ok).toBe(true);
      expect(result.interactionApprox).toBe(true);
    });
  }
});

describe('N–M warning always present', () => {
  it('default has warning', () => {
    const r = calcColumn(base({}));
    expect(r.warnings.some((w) => /N–M|gần đúng|VBA/i.test(w))).toBe(true);
    expect(r.checks.interaction.message).toMatch(/GẦN ĐÚNG/i);
  });
});

describe('vd limit 0.65', () => {
  it('limit', () => {
    expect(calcColumn(base({})).vdLimit).toBe(0.65);
  });
});
