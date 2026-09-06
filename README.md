# Kết cấu BTCT 5574

Web app hỗ trợ tính toán kết cấu bê tông cốt thép theo kiến trúc module, lấy workbook Excel làm nguồn đối chiếu.

## Lộ trình
- Engine tính toán dùng chung
- Dầm BTCT
- Cột BTCT
- Sàn BTCT
- Móng BTCT
- Nhập/xuất Excel, JSON
- Báo cáo in/PDF
- Golden Cases và regression tests

> Đây là công cụ hỗ trợ tính toán. Các công thức chỉ được đánh dấu đã kiểm chứng sau khi đối chiếu với workbook và các case chuẩn; không mặc định tuyên bố phù hợp đầy đủ với TCVN 5574:2018.

## Chạy local
```bash
npm install
npm run dev
```
