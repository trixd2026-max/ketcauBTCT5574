# Kết cấu BTCT 5574

Web app hỗ trợ tính toán kết cấu bê tông cốt thép theo kiến trúc module, lấy workbook Excel làm nguồn đối chiếu.

**Live:** [tinhketcaubtct2018.vercel.app](https://tinhketcaubtct2018.vercel.app)

## Dầm BTCT V1.1

Đã có luồng thực dụng cho nhiều dầm:

- Nhập tiết diện, B15–B60, thép dọc/đai, M−, M+, Q, lớp bảo vệ, thép dọc và đai.
- Tính riêng uốn M− (thép trên) và M+ (thép dưới): `ho`, `αm`, `ξ`, `ξR`, As yêu cầu, As bố trí, hàm lượng min/max và `Mu` giới hạn.
- Kiểm tra cắt: `Q ≤ Qbt`, `Q ≤ Qb + Qsw` và khoảng cách đai lớn nhất.
- **Cấu tạo cơ bản V1.1:** lớp bảo vệ tối thiểu, số thanh tối thiểu (≥2), khoảng cách thép dọc, quy tắc đai.
- Kết luận ĐẠT/KHÔNG ĐẠT, cảnh báo, bảng tổng hợp, lưu dự án bằng localStorage.
- Xuất JSON / CSV / XLSX. **Import JSON** (file xuất từ app). Nút In dùng hộp in trình duyệt để lưu PDF (CSS print tối ưu).
- **10 golden cases** regression (trong `src/engine/beam.test.ts`), trong đó 1 case đối chiếu trực tiếp từ `Beam.xlsm/KiemTraUonCat`.

Các bảng vật liệu và công thức uốn/cắt V1 được chép từ các vùng đã đọc được trong `Beam.xlsm`, không phải một chứng nhận tiêu chuẩn.

### Chưa được đối chiếu hoặc chưa có trong kết luận V1.1

- Kiểm tra nứt và võng đầy đủ (có sheet tham chiếu trong workbook nhưng chưa port).
- Neo, nối, giới hạn chi tiết theo mọi trường hợp, dầm T/I, cốt thép nén.
- Tải trọng, tổ hợp nội lực, khung phẳng/không gian.
- Xác nhận độc lập đầy đủ theo TCVN 5574:2018 (hiện dựa trên workbook + công thức công khai).

## Lộ trình

- [x] Engine tính toán dùng chung
- [x] Dầm BTCT (V1 uốn/cắt + V1.1 cấu tạo)
- [x] Golden Cases (10 cases) + regression tests
- [ ] Kiểm tra nứt + võng
- [ ] Cột BTCT
- [ ] Sàn BTCT
- [ ] Móng BTCT
- [ ] Nhập/xuất Excel workbook phức tạp hơn
- [ ] Báo cáo PDF chuyên nghiệp hơn (jsPDF / server)

> Đây là công cụ hỗ trợ tính toán. Dầm V1.1 chưa được đánh dấu là phù hợp đầy đủ với TCVN 5574:2018 và không thay thế kiểm tra của kỹ sư chịu trách nhiệm.

## Chạy local

```bash
npm install
npm run dev
npm test   # chạy 10 golden cases
```

## Changelog V1.1

- Thêm 10 golden cases (GC01–GC10).
- Thêm module kiểm tra cấu tạo cơ bản.
- Hỗ trợ Import JSON.
- Cải thiện bảng tổng hợp và notice giới hạn.
