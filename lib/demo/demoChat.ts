/**
 * Scripted Weavey answers for demo mode (no AI call). The previous demo
 * returned one generic paragraph for every question; this picks an answer from
 * the demo dataset (Scope 1/2/3 totals, a named product, top products) and
 * always labels itself as a sample answer.
 */
import { formatFixed, formatNumber } from "@/lib/format/number";

type DemoChatProduct = {
  productCode?: string;
  productName?: string;
  quantity?: number;
  carbonResults?: {
    perProduct?: { total?: number };
    totalBatch?: { total?: number };
    scope1?: number;
    scope2?: number;
    scope3?: number;
  };
};

export const DEMO_CHAT_NOTICE =
  "_Câu trả lời mẫu trong chế độ demo (không gọi AI), tính từ dữ liệu demo._";

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const scopeTotals = (products: DemoChatProduct[]) =>
  products.reduce(
    (acc, product) => {
      const quantity = Number(product.quantity || 0) || 0;
      const cr = product.carbonResults || {};
      acc.scope1 += (Number(cr.scope1) || 0) * quantity;
      acc.scope2 += (Number(cr.scope2) || 0) * quantity;
      acc.scope3 += (Number(cr.scope3) || 0) * quantity;
      return acc;
    },
    { scope1: 0, scope2: 0, scope3: 0 }
  );

const tonnes = (kg: number) => `${formatNumber(kg / 1000, 1)} tCO₂e`;

export const buildDemoChatAnswer = (rawQuery: string, products: DemoChatProduct[]): string => {
  const query = stripDiacritics(rawQuery || "");
  const withCarbon = products.filter((p) => typeof p.carbonResults?.perProduct?.total === "number");

  const named = withCarbon.find((p) => {
    const name = stripDiacritics(p.productName || "");
    const code = stripDiacritics(p.productCode || "");
    return (code && query.includes(code)) || (name.length > 3 && query.includes(name));
  });
  if (named) {
    const cr = named.carbonResults!;
    return [
      `**${named.productName} (${named.productCode})**`,
      `- Cường độ: ${formatFixed(cr.perProduct!.total!, 1)} kg CO₂e / đơn vị`,
      `- Scope 1: ${formatFixed(cr.scope1 ?? 0, 1)} · Scope 2: ${formatFixed(cr.scope2 ?? 0, 1)} · Scope 3: ${formatFixed(cr.scope3 ?? 0, 1)} kg CO₂e / đơn vị`,
      `- Tổng theo lô (${formatNumber(named.quantity ?? 0, 0)} đơn vị): ${tonnes(cr.totalBatch?.total ?? 0)}`,
      "",
      DEMO_CHAT_NOTICE
    ].join("\n");
  }

  const scopeMatch = query.match(/scope\s*([123])/);
  if (scopeMatch || query.includes("pham vi")) {
    const totals = scopeTotals(withCarbon);
    const lines = [
      "**Phát thải theo phạm vi, toàn bộ lô SKU trong demo:**",
      `- Scope 1: ${tonnes(totals.scope1)}`,
      `- Scope 2: ${tonnes(totals.scope2)}`,
      `- Scope 3: ${tonnes(totals.scope3)}`
    ];
    if (scopeMatch) lines.unshift(`Bạn hỏi về Scope ${scopeMatch[1]}:`);
    return [...lines, "", DEMO_CHAT_NOTICE].join("\n");
  }

  const top = [...withCarbon]
    .sort((a, b) => (b.carbonResults?.totalBatch?.total ?? 0) - (a.carbonResults?.totalBatch?.total ?? 0))
    .slice(0, 3);
  return [
    "Mình chưa hiểu rõ câu hỏi trong chế độ demo. Bạn có thể hỏi về **Scope 1/2/3** hoặc nêu tên / mã một sản phẩm (ví dụ: STL-HRC-002).",
    "",
    "**3 sản phẩm phát thải lớn nhất (theo lô):**",
    ...top.map((p) => `- ${p.productName} (${p.productCode}): ${tonnes(p.carbonResults?.totalBatch?.total ?? 0)}`),
    "",
    DEMO_CHAT_NOTICE
  ].join("\n");
};
