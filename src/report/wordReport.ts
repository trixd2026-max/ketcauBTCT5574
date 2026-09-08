/**
 * Xuất báo cáo Word (.docx) từ ReportDoc — cùng cấu trúc thuyết minh PDF.
 * Chạy trên trình duyệt (docx + Packer.toBlob).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  Header,
  Footer,
  PageNumber,
  VerticalAlign,
} from 'docx';
import type { ReportDoc, ReportSection } from './reportPdf';

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function cell(text: string, opts?: { bold?: boolean; width?: number; fill?: string; color?: string }) {
  return new TableCell({
    borders,
    width: { size: opts?.width ?? 4500, type: WidthType.DXA },
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            bold: opts?.bold,
            size: 20,
            font: 'Times New Roman',
            color: opts?.color,
          }),
        ],
      }),
    ],
  });
}

function kvTable(rows: { label: string; value: string }[]): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3200, 5800],
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            cell(r.label, { width: 3200, color: '64748B' }),
            cell(r.value, { width: 5800, bold: true }),
          ],
        })
    ),
  });
}

function dataTable(headers: string[], rows: string[][]): Table {
  const colW = Math.floor(9000 / Math.max(headers.length, 1));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: headers.map(() => colW),
    rows: [
      new TableRow({
        children: headers.map((h) => cell(h, { bold: true, width: colW, fill: 'F1F5F9' })),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((c) => cell(c, { width: colW })),
          })
      ),
    ],
  });
}

function sectionBlocks(sec: ReportSection): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: sec.heading,
          bold: true,
          size: 24,
          font: 'Times New Roman',
          color: '0F766E',
        }),
      ],
    }),
  ];
  if (sec.rows?.length) {
    out.push(kvTable(sec.rows));
    out.push(new Paragraph({ children: [] }));
  }
  if (sec.table) {
    out.push(dataTable(sec.table.headers, sec.table.rows));
    out.push(new Paragraph({ children: [] }));
  }
  if (sec.checks?.length) {
    for (const c of sec.checks) {
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `${c.pass ? '✓' : '×'} ${c.message}`,
              size: 20,
              font: 'Times New Roman',
              color: c.pass ? '15803D' : 'B91C1C',
            }),
          ],
        })
      );
    }
  }
  if (sec.note) {
    out.push(
      new Paragraph({
        spacing: { before: 80 },
        children: [
          new TextRun({
            text: sec.note,
            italics: true,
            size: 18,
            font: 'Times New Roman',
            color: '64748B',
          }),
        ],
      })
    );
  }
  return out;
}

function buildChildren(doc: ReportDoc): (Paragraph | Table)[] {
  const now = new Date().toLocaleString('vi-VN');
  const status = doc.overallPass ? 'ĐẠT' : 'KHÔNG ĐẠT';
  const statusColor = doc.overallPass ? '15803D' : 'B91C1C';

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: doc.meta.title,
          bold: true,
          size: 28,
          font: 'Times New Roman',
        }),
      ],
    }),
  ];

  if (doc.meta.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: doc.meta.subtitle,
            size: 20,
            font: 'Times New Roman',
            color: '64748B',
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Hạng mục: ${doc.meta.itemName || '—'}`,
          size: 20,
          font: 'Times New Roman',
        }),
        new TextRun({ text: '   ·   ', size: 20, font: 'Times New Roman', color: '94A3B8' }),
        new TextRun({ text: `Ngày: ${now}`, size: 20, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '   ·   ', size: 20, font: 'Times New Roman', color: '94A3B8' }),
        new TextRun({
          text: status,
          bold: true,
          size: 22,
          font: 'Times New Roman',
          color: statusColor,
        }),
      ],
    })
  );

  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  for (const sec of doc.sections) {
    children.push(...sectionBlocks(sec));
  }

  const warnings = (doc.warnings || []).filter(
    (w) => !/chưa khẳng định|Hỗ trợ thiết kế|full compliance|chứng nhận full/i.test(w)
  );
  if (warnings.length) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: 'Cảnh báo / ghi chú',
            bold: true,
            size: 24,
            font: 'Times New Roman',
            color: '0F766E',
          }),
        ],
      })
    );
    for (const w of warnings) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `• ${w}`,
              size: 18,
              font: 'Times New Roman',
              color: '9A3412',
            }),
          ],
        })
      );
    }
  }

  children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Người lập', size: 20, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '                    ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'Người kiểm tra', size: 20, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '                    ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'Phê duyệt', size: 20, font: 'Times New Roman', color: '64748B' }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
        new TextRun({ text: '          ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
        new TextRun({ text: '          ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
      ],
    })
  );

  return children;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Xuất 1 ReportDoc ra file Word */
export async function exportReportWord(
  doc: ReportDoc,
  filename = 'thuyet-minh-btct.docx'
): Promise<void> {
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: doc.meta.title.slice(0, 60),
                    size: 16,
                    font: 'Times New Roman',
                    color: '94A3B8',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Trang ',
                    size: 16,
                    font: 'Times New Roman',
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Times New Roman',
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children: buildChildren(doc),
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, filename);
}

/** Hồ sơ dự án gộp — bảng tổng hợp nhiều loại cấu kiện */
export async function exportProjectWord(opts: {
  meta: { projectName: string; designer: string; date: string; standard: string };
  sections: { title: string; rows: { name: string; size: string; pass: boolean; detail?: string }[] }[];
}): Promise<void> {
  const { meta, sections } = opts;
  const total = sections.reduce((s, sec) => s + sec.rows.length, 0);
  const nPass = sections.reduce((s, sec) => s + sec.rows.filter((r) => r.pass).length, 0);

  const body: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'THUYẾT MINH TÍNH TOÁN BTCT — HỒ SƠ DỰ ÁN',
          bold: true,
          size: 28,
          font: 'Times New Roman',
        }),
      ],
    }),
    kvTable([
      { label: 'Dự án', value: meta.projectName },
      { label: 'Người thiết kế', value: meta.designer },
      { label: 'Ngày', value: meta.date },
      { label: 'Tiêu chuẩn', value: meta.standard },
      { label: 'Tổng cấu kiện', value: String(total) },
      { label: 'Đạt / Không đạt', value: `${nPass} / ${total - nPass}` },
    ]),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];

  for (const sec of sections) {
    if (!sec.rows.length) continue;
    body.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: sec.title,
            bold: true,
            size: 24,
            font: 'Times New Roman',
            color: '0F766E',
          }),
        ],
      })
    );
    body.push(
      dataTable(
        ['Tên', 'Kích thước', 'Ghi chú', 'KQ'],
        sec.rows.map((r) => [r.name, r.size, r.detail || '', r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'])
      )
    );
  }

  body.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Người lập', size: 20, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '                    ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'Người kiểm tra', size: 20, font: 'Times New Roman', color: '64748B' }),
        new TextRun({ text: '                    ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: 'Phê duyệt', size: 20, font: 'Times New Roman', color: '64748B' }),
      ],
    })
  );
  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
        new TextRun({ text: '          ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
        new TextRun({ text: '          ', size: 20, font: 'Times New Roman' }),
        new TextRun({ text: '…………………', size: 20, font: 'Times New Roman', color: 'CBD5E1' }),
      ],
    })
  );

  const document = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Trang ', size: 16, font: 'Times New Roman', color: '94A3B8' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Times New Roman',
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const safe = (meta.projectName || 'du-an').replace(/\s+/g, '_');
  downloadBlob(blob, `HoSo-BTCT-${safe}.docx`);
}
