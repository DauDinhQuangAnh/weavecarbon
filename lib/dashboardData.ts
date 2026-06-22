/**
 * Shared static data for Overview/Dashboard pages.
 * Port từ Lovable src/lib/dashboardData.ts — chỉ phần local FE cần.
 */

export interface ReductionScenario {
  id: number;
  title: string;
  description: string;
  rangeLabel: string;
  requiredCondition: string;
  dataSourceStatus: 'verified' | 'proxy' | 'pending';
  disclaimer: string;
}

export const reductionScenarios: ReductionScenario[] = [
  {
    id: 1,
    title: 'Chuyển sang cotton hữu cơ đã chứng nhận',
    description: 'Thay thế cotton thường bằng cotton hữu cơ GOTS cho dòng áo thun.',
    rangeLabel: '-10% đến -18% Scope 3 vật liệu',
    requiredCondition:
      'Hợp đồng cung ứng GOTS ≥ 12 tháng, không tăng tỉ trọng polyester.',
    dataSourceStatus: 'proxy',
    disclaimer: 'Ước tính dựa trên Ecoinvent v3.10; cần thẩm tra với hóa đơn thực tế.',
  },
  {
    id: 2,
    title: 'Tối ưu tuyến vận chuyển (đa phương thức)',
    description: 'Kết hợp đường biển + đường bộ thay vì hàng không cho tuyến EU.',
    rangeLabel: '-5% đến -12% Scope 3 logistics',
    requiredCondition: 'Thời gian giao hàng tăng tối thiểu 14 ngày so với hiện tại.',
    dataSourceStatus: 'pending',
    disclaimer: 'Phụ thuộc vận đơn thực và DEFRA 2025; kết quả cần xác minh.',
  },
  {
    id: 3,
    title: 'Bao bì giấy tái chế thay nhựa',
    description: 'Đổi polybag sang bao bì giấy FSC có thể tái chế.',
    rangeLabel: '-2% đến -4% phát thải bao bì',
    requiredCondition:
      'Đảm bảo bao bì giấy chịu được tiêu chuẩn vận chuyển của buyer.',
    dataSourceStatus: 'proxy',
    disclaimer: 'Tác động phụ thuộc khối lượng bao bì/đơn vị SKU.',
  },
];

export interface PriorityAction {
  id: number;
  title: string;
  description: string;
  impactLabel: string;
  priority: 'high' | 'medium' | 'low';
  link?: string;
}

export const priorityActions: PriorityAction[] = [
  {
    id: 1,
    title: 'Bổ sung dữ liệu nhà cung ứng nhuộm',
    description:
      'Giảm proxy Scope 3 và tăng confidence cho sản phẩm SHIRT-WOVEN-002.',
    impactLabel: 'Giảm rủi ro dữ liệu',
    priority: 'high',
    link: '/suppliers',
  },
  {
    id: 2,
    title: 'Upload vận đơn cho lô LOT-EU-2026-001',
    description:
      'Tăng độ tin cậy cho phát thải logistics và route mapping.',
    impactLabel: 'Tăng logistics confidence',
    priority: 'medium',
    link: '/logistics',
  },
  {
    id: 3,
    title: 'Xác nhận hệ số phát thải điện đang dùng',
    description:
      'Ghi rõ nguồn emission factor và kỳ áp dụng trong Audit Trail.',
    impactLabel: 'Tăng audit trail score',
    priority: 'medium',
    link: '/evidence',
  },
  {
    id: 4,
    title: 'Rà soát BOM cho sản phẩm POLO-BLEND-006',
    description:
      'Đảm bảo tổng tỷ lệ vật liệu bằng 100% và giảm sai lệch Scope 3.',
    impactLabel: 'Giảm proxy vật liệu',
    priority: 'high',
    link: '/products',
  },
];
