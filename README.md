# Kết cấu BTCT 5574

Web app hỗ trợ tính toán kết cấu bê tông cốt thép theo kiến trúc module.

**Live:** [tinhketcaubtct2018.vercel.app](https://tinhketcaubtct2018.vercel.app)

## Dầm BTCT V1.2

- **Uốn** M− / M+ (αm, ξ, ξR, As, μ, Mu)
- **Cắt** Q ≤ Qbt, Q ≤ Qb+Qsw, smax
- **Cấu tạo** lớp bảo vệ, số thanh, khoảng cách, đai
- **Nứt (SLS)** tiết diện quy đổi, Mcrc, acrc ngắn hạn / dài hạn (TCVN 5574 style, từ KiemTraNut)
- **Võng ước lượng** cần nhập L; δ ≈ k·M·L²/EI_eff; giới hạn L/250 mặc định
- 10+ golden cases, Import/Export JSON, CSV, XLSX, In

Moment SLS mặc định ≈ MULS/1.4 (có thể nhập tay). Võng chưa phải tích phân độ cong đầy đủ theo sơ đồ moment.

## Chạy local

```bash
npm install
npm run dev
npm test
```

## Lộ trình

- [x] Uốn + cắt + cấu tạo
- [x] Golden cases
- [x] Nứt (section check)
- [x] Võng ước lượng
- [ ] Võng tích phân đầy đủ (nhiều mặt cắt)
- [ ] Cột / Sàn / Móng
- [ ] PDF chuyên nghiệp

> Công cụ hỗ trợ — không thay thế kiểm tra của kỹ sư chịu trách nhiệm.
