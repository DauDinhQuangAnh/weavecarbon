import * as XLSX from 'xlsx';

// Template column definitions with Vietnamese headers (28 columns — full B2B brief)
export const TEMPLATE_COLUMNS = [
  // Group A — Basic SKU Info
  { key: 'sku', header: 'Mã SKU *', width: 15, required: true, example: 'SKU-001' },
  { key: 'productName', header: 'Tên sản phẩm *', width: 25, required: true, example: 'Áo T-shirt Cotton' },
  { key: 'productType', header: 'Loại sản phẩm *', width: 15, required: true, example: 'Áo thun', options: 'Áo thun, Quần, Váy/Đầm, Áo khoác, Giày, Túi, Phụ kiện, Khác' },
  { key: 'quantity', header: 'Số lượng *', width: 12, required: true, example: '1000' },
  { key: 'weightPerUnit', header: 'Trọng lượng (gram) *', width: 18, required: true, example: '250' },
  { key: 'season', header: 'Mùa / Bộ sưu tập', width: 18, required: false, example: 'SS25' },
  { key: 'buyerCode', header: 'Mã buyer / khách', width: 18, required: false, example: 'UNIQLO-VN' },

  // Group B — Materials (BOM)
  { key: 'primaryMaterial', header: 'Vải chính *', width: 20, required: true, example: 'Cotton', options: 'Cotton, Polyester, Nylon, Len, Lụa, Linen, Polyester tái chế, Cotton hữu cơ, Bamboo, Hemp, Pha trộn' },
  { key: 'primaryMaterialPercentage', header: 'Tỷ lệ vải chính (%) *', width: 18, required: true, example: '100' },
  { key: 'secondaryMaterial', header: 'Vải phụ', width: 20, required: false, example: 'Polyester' },
  { key: 'secondaryMaterialPercentage', header: 'Tỷ lệ vải phụ (%)', width: 18, required: false, example: '0' },
  { key: 'accessories', header: 'Phụ liệu (BOM trim)', width: 25, required: false, example: 'Nút, Khoá kéo, Nhãn' },
  { key: 'packagingType', header: 'Bao bì', width: 18, required: false, example: 'Túi PE + thùng carton' },
  { key: 'materialSource', header: 'Nguồn nguyên liệu *', width: 18, required: true, example: 'Trong nước', options: 'Trong nước, Nhập khẩu, Không xác định' },
  { key: 'supplierName', header: 'Nhà cung cấp vải chính', width: 22, required: false, example: 'Công ty Dệt ABC' },
  { key: 'supplierCountry', header: 'Quốc gia NCC', width: 15, required: false, example: 'Việt Nam' },

  // Group C — Manufacturing & Energy
  { key: 'processes', header: 'Công đoạn sản xuất *', width: 30, required: true, example: 'Dệt kim, Cắt may, Nhuộm', options: 'Dệt kim, Dệt thoi, Cắt may, Nhuộm, In, Hoàn tất' },
  { key: 'facilityName', header: 'Nhà máy sản xuất', width: 22, required: false, example: 'Xưởng 1 — Bình Dương' },
  { key: 'energySource', header: 'Nguồn năng lượng *', width: 18, required: true, example: 'Điện lưới', options: 'Điện lưới, Điện mặt trời, Than đá, Hỗn hợp' },
  { key: 'electricityKwh', header: 'Điện tiêu thụ (kWh/SKU)', width: 20, required: false, example: '0.85' },
  { key: 'electricityBillRef', header: 'Số hóa đơn điện', width: 20, required: false, example: 'EVN-2024-09-001234' },
  { key: 'waterLiters', header: 'Nước (L/SKU)', width: 14, required: false, example: '12.5' },

  // Group D — Export & Transport
  { key: 'marketType', header: 'Thị trường *', width: 15, required: true, example: 'Xuất khẩu', options: 'Nội địa, Xuất khẩu' },
  { key: 'exportCountry', header: 'Quốc gia xuất khẩu', width: 20, required: false, example: 'EU (Châu Âu)', options: 'EU (Châu Âu), Mỹ, Nhật Bản, Hàn Quốc, Khác' },
  { key: 'transportMode', header: 'Hình thức vận chuyển *', width: 20, required: true, example: 'Đường biển', options: 'Đường bộ, Đường biển, Đường hàng không, Đường sắt, Đa phương thức' },
  { key: 'transportDistanceKm', header: 'Quãng đường (km)', width: 16, required: false, example: '12500' },
  { key: 'incoterm', header: 'Incoterm', width: 12, required: false, example: 'FOB', options: 'EXW, FOB, CIF, DDP, DAP' },

  // Group E — Compliance & batching
  { key: 'batchCode', header: 'Mã lô hàng', width: 18, required: false, example: 'BATCH-2025-Q1-001' },
  { key: 'certification', header: 'Chứng nhận', width: 20, required: false, example: 'GOTS, OEKO-TEX' },
  { key: 'notes', header: 'Ghi chú', width: 25, required: false, example: 'Đơn hàng pilot' },
];

const SAMPLE_DATA = [
  {
    sku: 'SKU-001', productName: 'Áo T-shirt Organic Cotton', productType: 'Áo thun',
    quantity: 1000, weightPerUnit: 250, season: 'SS25', buyerCode: 'UNIQLO-VN',
    primaryMaterial: 'Cotton hữu cơ', primaryMaterialPercentage: 100,
    secondaryMaterial: '', secondaryMaterialPercentage: 0,
    accessories: 'Nhãn, Chỉ may', packagingType: 'Túi PE + thùng carton',
    materialSource: 'Trong nước', supplierName: 'Công ty Dệt ABC', supplierCountry: 'Việt Nam',
    processes: 'Dệt kim, Cắt may', facilityName: 'Xưởng 1 — Bình Dương',
    energySource: 'Điện lưới', electricityKwh: 0.85, electricityBillRef: 'EVN-2024-09-001234', waterLiters: 12.5,
    marketType: 'Xuất khẩu', exportCountry: 'EU (Châu Âu)', transportMode: 'Đường biển',
    transportDistanceKm: 12500, incoterm: 'FOB',
    batchCode: 'BATCH-2025-Q1-001', certification: 'GOTS, OEKO-TEX', notes: 'Đơn hàng pilot',
  },
  {
    sku: 'SKU-002', productName: 'Quần Jeans Recycled Denim', productType: 'Quần',
    quantity: 500, weightPerUnit: 450, season: 'FW25', buyerCode: 'H&M-EU',
    primaryMaterial: 'Polyester tái chế', primaryMaterialPercentage: 80,
    secondaryMaterial: 'Cotton', secondaryMaterialPercentage: 20,
    accessories: 'Nút, Khoá kéo, Rivets', packagingType: 'Túi PE',
    materialSource: 'Nhập khẩu', supplierName: 'Recycle Textile Co.', supplierCountry: 'Trung Quốc',
    processes: 'Dệt thoi, Cắt may, Nhuộm', facilityName: 'Xưởng 2 — Đồng Nai',
    energySource: 'Hỗn hợp', electricityKwh: 1.6, electricityBillRef: 'EVN-2024-10-002211', waterLiters: 45,
    marketType: 'Xuất khẩu', exportCountry: 'Mỹ', transportMode: 'Đường biển',
    transportDistanceKm: 16800, incoterm: 'CIF',
    batchCode: 'BATCH-2025-Q1-002', certification: 'GRS', notes: '',
  },
  {
    sku: 'SKU-003', productName: 'Túi Tote Canvas', productType: 'Túi',
    quantity: 2000, weightPerUnit: 180, season: 'SS25', buyerCode: '',
    primaryMaterial: 'Cotton', primaryMaterialPercentage: 100,
    secondaryMaterial: '', secondaryMaterialPercentage: 0,
    accessories: 'Quai, Khoá', packagingType: 'Không bao bì',
    materialSource: 'Trong nước', supplierName: 'Vinatex', supplierCountry: 'Việt Nam',
    processes: 'Cắt may, In', facilityName: 'Xưởng 1 — Bình Dương',
    energySource: 'Điện mặt trời', electricityKwh: 0.4, electricityBillRef: '', waterLiters: 8,
    marketType: 'Nội địa', exportCountry: '', transportMode: 'Đường bộ',
    transportDistanceKm: 60, incoterm: 'EXW',
    batchCode: 'BATCH-2025-Q1-003', certification: 'OEKO-TEX', notes: '',
  },
];

export const generateTemplate = (format: 'xlsx' | 'csv' = 'xlsx'): void => {
  const wb = XLSX.utils.book_new();

  const headers = TEMPLATE_COLUMNS.map((col) => col.header);
  const sampleRows = SAMPLE_DATA.map((row) =>
    TEMPLATE_COLUMNS.map(
      (col) => (row as Record<string, unknown>)[col.key] ?? ''
    )
  );

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = TEMPLATE_COLUMNS.map((col) => ({ wch: col.width }));
  XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu sản phẩm');

  const instructionsData = [
    ['HƯỚNG DẪN SỬ DỤNG FILE MẪU'],
    [''],
    ['1. NHÓM A - THÔNG TIN SKU CƠ BẢN'],
    ['   - Mã SKU: Mã duy nhất cho sản phẩm (bắt buộc)'],
    ['   - Tên sản phẩm: Tên đầy đủ của sản phẩm (bắt buộc)'],
    ['   - Loại sản phẩm: Chọn từ danh sách có sẵn (bắt buộc)'],
    ['   - Số lượng: Số lượng sản xuất (bắt buộc)'],
    ['   - Trọng lượng: Trọng lượng trung bình mỗi sản phẩm tính bằng gram (bắt buộc)'],
    [''],
    ['2. NHÓM B - NGUYÊN VẬT LIỆU'],
    ['   - Vải chính: Loại vải/nguyên liệu chính (bắt buộc)'],
    ['   - Tỷ lệ vải chính: Phần trăm vải chính trong sản phẩm (bắt buộc)'],
    ['   - Nguồn nguyên liệu: Trong nước / Nhập khẩu / Không xác định (bắt buộc)'],
    [''],
    ['3. NHÓM C - QUY TRÌNH SẢN XUẤT'],
    ['   - Công đoạn: Liệt kê các công đoạn, cách nhau bằng dấu phẩy (bắt buộc)'],
    ['   - Nguồn năng lượng: Điện lưới / Điện mặt trời / Than đá / Hỗn hợp (bắt buộc)'],
    [''],
    ['4. NHÓM D - XUẤT KHẨU & VẬN CHUYỂN'],
    ['   - Thị trường: Nội địa hoặc Xuất khẩu (bắt buộc)'],
    ['   - Hình thức vận chuyển: Đường bộ / biển / hàng không / sắt (bắt buộc)'],
    [''],
    ['LƯU Ý: Các trường có dấu * là bắt buộc. File mẫu có 3 dòng ví dụ, hãy xóa trước khi nhập liệu.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Hướng dẫn');

  const optionsData = [
    ['DANH SÁCH GIÁ TRỊ HỢP LỆ'],
    [''],
    ['Loại sản phẩm:', 'Áo thun, Quần, Váy/Đầm, Áo khoác, Giày, Túi, Phụ kiện, Khác'],
    [''],
    ['Loại vải:', 'Cotton, Polyester, Nylon, Len, Lụa, Linen, Polyester tái chế, Cotton hữu cơ, Bamboo, Hemp, Pha trộn'],
    [''],
    ['Nguồn nguyên liệu:', 'Trong nước, Nhập khẩu, Không xác định'],
    [''],
    ['Công đoạn sản xuất:', 'Dệt kim, Dệt thoi, Cắt may, Nhuộm, In, Hoàn tất'],
    [''],
    ['Nguồn năng lượng:', 'Điện lưới, Điện mặt trời, Than đá, Hỗn hợp'],
    [''],
    ['Thị trường:', 'Nội địa, Xuất khẩu'],
    [''],
    ['Quốc gia xuất khẩu:', 'EU (Châu Âu), Mỹ, Nhật Bản, Hàn Quốc, Khác'],
    [''],
    ['Hình thức vận chuyển:', 'Đường bộ, Đường biển, Đường hàng không, Đường sắt, Đa phương thức'],
  ];

  const wsOptions = XLSX.utils.aoa_to_sheet(optionsData);
  wsOptions['!cols'] = [{ wch: 25 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsOptions, 'Danh sách lựa chọn');

  const fileName = `WeaveCarbon_Template_${new Date().toISOString().split('T')[0]}`;

  if (format === 'xlsx') {
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } else {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
};
