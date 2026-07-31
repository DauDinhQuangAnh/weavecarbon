import { describe, it, expect } from "vitest";
import { buildFormWorkbook } from "./formTemplate";
import { THEME } from "./excelTheme";

describe("buildFormWorkbook", () => {
  it("builds styled form sheets plus info sheets", async () => {
    const wb = await buildFormWorkbook({
      sheets: [
        {
          name: "Data",
          title: "Mẫu chứng từ",
          subtitle: "phụ đề",
          columns: [
            { header: "SKU *", width: 18 },
            { header: "Tên sản phẩm", width: 24 },
          ],
          sampleRows: [
            ["A-1", "Áo thun"],
            ["A-2", "Quần jeans"],
          ],
          notes: ["* Ghi chú: xoá trước khi tải lên"],
        },
      ],
      info: [{ name: "Guide", title: "Hướng dẫn", rows: ["Dòng hướng dẫn 1", ["Hỗ trợ", "support@weavecarbon.com"]] }],
    });

    expect(wb.worksheets.map((w) => w.name)).toEqual(["Data", "Guide"]);

    const data = wb.getWorksheet("Data")!;
    const header = data.getRow(5).getCell(1);
    expect(String(header.value)).toBe("SKU *");
    expect((header.fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe(THEME.brand);

    // Sample rows are muted italic so they read as "example, replace me".
    const sample = data.getRow(6).getCell(1);
    expect((sample.font as { italic?: boolean }).italic).toBe(true);
    expect(sample.value).toBe("A-1");

    const buf = await wb.xlsx.writeBuffer();
    expect(Buffer.from(buf.slice(0, 2)).toString("latin1")).toBe("PK");
  });
});
