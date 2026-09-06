# Kết cấu BTCT 5574

Web app hỗ trợ tính toán kết cấu bê tông cốt thép theo kiến trúc module, lấy workbook Excel làm nguồn đối chiếu.

## Dầm BTCT V1

Đã có luồng thực dụng cho nhiều dầm:

- Nhập tiết diện, B15–B60, thép dọc/đai, M−, M+, Q, lớp bảo vệ, thép dọc và đai.
- Tính riêng uốn M− (thép trên) và M+ (thép dưới): `ho`, `αm`, `ξ`, `ξR`, As yêu cầu, As bố trí, hàm lượng min/max và `Mu` giới hạn.
- Kiểm tra cắt: `Q ≤ Qbt`, `Q ≤ Qb + Qsw` và khoảng cách đai lớn nhất.
- Kết luận ĐẠT/KHÔNG ĐẠT, cảnh báo, bảng tổng hợp, lưu dự án bằng localStorage và xuất JSON/CSV/XLSX. Nút In dùng hộp in của trình duyệt để lưu PDF.
- Có test đối chiếu một case B25 đã trích từ `Beam.xlsm/KiemTraUonCat`.

Các bảng vật liệu và công thức uốn/cắt V1 được chép từ các vùng đã đọc được trong `Beam.xlsm`, không phải một chứng nhận tiêu chuẩn.

### Chưa được đối chiếu hoặc chưa có trong kết luận V1

- Kiểm tra nứt và võng; cấu tạo, neo, nối, giới hạn chi tiết theo mọi trường hợp.
- Tải trọng, tổ hợp nội lực, dầm T/I, cốt thép nén, khung phẳng/không gian và các ngoại lệ của workbook.
- Bộ Golden Cases đầy đủ và xác nhận độc lập theo TCVN 5574:2018.

## Lộ trình
- Engine tính toán dùng chung
- Dầm BTCT (V1 uốn/cắt)
- Cột BTCT
- Sàn BTCT
- Móng BTCT
- Nhập/xuất Excel, JSON
- Báo cáo in/PDF
- Golden Cases và regression tests

> Đây là công cụ hỗ trợ tính toán. Dầm V1 chưa được đánh dấu là phù hợp đầy đủ với TCVN 5574:2018 và không thay thế kiểm tra của kỹ sư chịu trách nhiệm.

## Chạy local
```bash
npm install
npm run dev
```
