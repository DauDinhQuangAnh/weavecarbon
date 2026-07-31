import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    // The report tests build real xlsx/pdf documents; the first exceljs/jspdf
    // import per file is a cold start that can exceed the 5s default under CI load.
    testTimeout: 20000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
