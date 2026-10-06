// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";
import { parseFile } from "./validation";

describe("product file import", () => {
  it.each(["xlsx", "biff8"] as const)(
    "reads %s files and selects the data sheet after an instruction sheet",
    async (bookType) => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([["Instructions"], ["Fill in the Products sheet"]]),
        "Instructions"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          ["SKU", "Product Name", "Quantity"],
          ["000123", "Áo thun", 2]
        ]),
        "Products"
      );
      const bytes = XLSX.write(workbook, { bookType, type: "array" }) as ArrayBuffer;
      const file = new File([bytes], bookType === "xlsx" ? "products.xlsx" : "products.xls");

      await expect(parseFile(file)).resolves.toEqual([
        { SKU: "000123", "Product Name": "Áo thun", Quantity: "2" }
      ]);
    }
  );

  it("continues to read CSV files", async () => {
    const file = new File(["SKU,Product Name,Quantity\nABC,T-shirt,3\n"], "products.csv");
    await expect(parseFile(file)).resolves.toEqual([
      { SKU: "ABC", "Product Name": "T-shirt", Quantity: "3" }
    ]);
  });

  it("rejects a workbook without a usable data sheet", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    await expect(parseFile(new File([bytes], "empty.xlsx"))).rejects.toThrow(
      "Không tìm thấy sheet dữ liệu hợp lệ trong file import."
    );
  });
});
