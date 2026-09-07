# Kết cấu BTCT 5574

Web app hỗ trợ tính toán kết cấu bê tông cốt thép (Dầm · Cột · Sàn · Móng).

**Live:** [tinhketcaubtct2018.vercel.app](https://tinhketcaubtct2018.vercel.app)

## V1.3 Modules

| Module | Nguồn Excel | Trạng thái |
|--------|-------------|------------|
| **Dầm** | Beam.xlsm | V1.2 uốn/cắt/cấu tạo/nứt/võng |
| **Cột** | Column.xlsm | V1 độ mảnh, N–M gần đúng, đai, μ |
| **Sàn** | Slab.xlsm | V1 strip 1m uốn/cắt/nứt/võng |
| **Móng đơn** | MongDon.xlsm | V1 áp lực nền, lệch tâm, uốn, chọc thủng |

> **Chưa đánh dấu TCVN 5574:2018 compliant** — công thức V1 gần đúng theo workbook, cần golden cases đối chiếu đầy đủ trước khi khóa chuẩn.

## Cột V1 (Column.xlsm)

- Nhập: b, h, L0x/L0y, N, Mx, My, Qx/Qy, thép `12d20`
- Độ mảnh λ ≤ 100 (Data_Column)
- μ min 1% (cột), ≥ 4 thanh
- Tương tác N–M: (Mx/Mx0)^α + (My/My0)^α ≤ 1
- Đai theo ThepDai (Q ≤ Qbt, Qb+Qsw)
- γb = 0.85

## Sàn V1 (Slab.xlsm)

- Strip 1m: M−/M+, Q, thép `d10a200`
- Uốn như dầm, μmin = 0.1%
- Nứt/võng tái sử dụng engine dầm

## Móng đơn V1 (MongDon.xlsm)

- σmax/σmin, lệch tâm e ≤ L/6
- Uốn console đáy, chọc thủng sơ bộ
- Thép đáy 2 phương `d16a150`

## Chạy local

```bash
npm install && npm run dev && npm test
```
