export const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'electricity_bill', label: 'Hóa đơn điện' },
  { value: 'fuel_receipt', label: 'Hóa đơn nhiên liệu' },
  { value: 'bom', label: 'BOM' },
  { value: 'material_invoice', label: 'Hóa đơn nguyên liệu' },
  { value: 'warehouse_receipt', label: 'Phiếu kho' },
  { value: 'supplier_certificate', label: 'Chứng chỉ nhà cung ứng' },
  { value: 'supplier_declaration', label: 'Tờ khai nhà cung ứng' },
  { value: 'logistics_invoice', label: 'Hóa đơn vận chuyển' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'air_waybill', label: 'Air Waybill' },
  { value: 'export_invoice', label: 'Hóa đơn xuất khẩu' },
  { value: 'packing_list', label: 'Packing list' },
  { value: 'emission_factor_source', label: 'Nguồn hệ số phát thải' },
  { value: 'methodology', label: 'Tài liệu phương pháp tính' },
  { value: 'pcf_source', label: 'Nguồn PCF bao quát hoạt động + hệ số' },
  { value: 'other', label: 'Khác' },
];

export const DOC_TEMPLATES: Record<string, { sheet: string; rows: (string | number)[][] }> = {
  electricity_bill: {
    sheet: 'Hoa_don_dien',
    rows: [
      ['Kỳ thanh toán', 'Cơ sở / Nhà máy', 'Lượng điện (kWh)', 'Hệ số phát thải (kg CO₂e/kWh)', 'Nguồn hệ số phát thải', 'CO₂e (kg) = kWh × EF'],
      ['2024-Q2', 'Nhà máy Bình Dương', 12500, 0.4290, 'VN Ministry of Natural Resources 2024', 5362.5],
      ['2024-Q3', 'Nhà máy Bình Dương', 11800, 0.4290, 'VN Ministry of Natural Resources 2024', 5062.2],
      ['* Ghi chú: Kỳ có thể là 2024-Q1, 2024-01, hoặc tháng cụ thể. CO₂e được tính tự động bởi hệ thống.', '', '', '', '', ''],
    ],
  },
  fuel_receipt: {
    sheet: 'Hoa_don_nhien_lieu',
    rows: [
      ['Kỳ thanh toán', 'Loại nhiên liệu', 'Lượng (lít)', 'Hệ số phát thải (kg CO₂e/lít)', 'CO₂e (kg) = lít × EF', 'Ghi chú'],
      ['2024-Q2', 'diesel', 500, 2.688, 1344, 'Máy phát điện dự phòng'],
      ['2024-Q2', 'lpg', 200, 1.629, 325.8, 'Lò hơi'],
      ['* Loại NL hợp lệ: diesel | petrol | lpg | cng | coal | biomass | other', '', '', '', '', ''],
      ['* EF mặc định: diesel=2.688, petrol=2.352, lpg=1.629, cng=2.740, coal=2.420, biomass=0', '', '', '', '', ''],
    ],
  },
  bom: {
    sheet: 'BOM',
    rows: [
      ['SKU sản phẩm', 'Tên nguyên liệu', 'Thành phần / Mô tả', 'Tỷ lệ (%)', 'Khối lượng (kg/sản phẩm)', 'Nhà cung ứng', 'Xuất xứ', 'Chứng chỉ (nếu có)'],
      ['SKU-SHIRT-001', 'Cotton 100%', 'Vải cotton chải kỹ', 60, 0.18, 'Công ty Bông Việt', 'VN', 'GOTS'],
      ['SKU-SHIRT-001', 'Polyester tái chế', 'Sợi tái chế GRS', 30, 0.09, 'Toray VN', 'JP', 'GRS'],
      ['SKU-SHIRT-001', 'Chỉ may + Phụ liệu', 'Nút, nhãn, bao bì', 10, 0.03, 'Nhiều NCC', 'VN', ''],
    ],
  },
  material_invoice: {
    sheet: 'Hoa_don_nguyen_lieu',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Nhà cung ứng', 'Mã hàng', 'Tên nguyên liệu', 'Số lượng', 'Đơn vị', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)', 'Ghi chú'],
      ['HD-2024-001', '2024-04-15', 'Bông Việt JSC', 'BV-COT-001', 'Vải cotton 32/1 OE', 500, 'kg', 85000, 42500000, ''],
      ['HD-2024-002', '2024-04-20', 'Toray VN', 'TR-PET-002', 'Sợi Polyester DTY 150D', 300, 'kg', 62000, 18600000, 'GRS certified'],
    ],
  },
  warehouse_receipt: {
    sheet: 'Phieu_kho',
    rows: [
      ['Số phiếu', 'Ngày', 'Loại (Nhập/Xuất)', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Đơn vị', 'Kho', 'Lô/Batch', 'Ghi chú'],
      ['PNK-2024-001', '2024-04-15', 'Nhập', 'BV-COT-001', 'Vải cotton', 500, 'kg', 'Kho A - Nguyên liệu', 'LOT-240415', ''],
      ['PXK-2024-010', '2024-04-25', 'Xuất', 'SKU-SHIRT-001', 'Áo thun SKU-SHIRT-001', 1000, 'cái', 'Kho B - Thành phẩm', 'LOT-240425', 'Xuất cho đơn ORD-001'],
    ],
  },
  supplier_certificate: {
    sheet: 'Chung_chi_NCC',
    rows: [
      ['Tên nhà cung ứng', 'Loại chứng chỉ', 'Số chứng chỉ', 'Ngày cấp', 'Ngày hết hạn', 'Phạm vi / Sản phẩm', 'Cơ quan cấp', 'Link xác minh'],
      ['Nhà cung ứng mẫu A', 'GOTS', 'SAMPLE-GOTS-001', '2024-01-15', '2025-01-14', 'Cotton yarn & fabric', 'Tổ chức chứng nhận mẫu', 'https://example.invalid/verify'],
      ['Nhà cung ứng mẫu B', 'GRS', 'SAMPLE-GRS-002', '2024-03-01', '2025-02-28', 'Recycled polyester fiber', 'Tổ chức chứng nhận mẫu', 'https://example.invalid/verify'],
    ],
  },
  supplier_declaration: {
    sheet: 'To_khai_NCC',
    rows: [
      ['Tên nhà cung ứng', 'Nguyên liệu / Sản phẩm', 'CO₂e (kg/đơn vị)', 'Đơn vị', 'Phương pháp tính', 'Kỳ tính', 'Người khai', 'Ngày khai', 'Ghi chú'],
      ['Bông Việt JSC', 'Cotton yarn 32/1', 3.2, 'kg CO₂e/kg', 'Cradle-to-gate (LCA)', '2023', 'Nguyễn Văn A - GĐ KT', '2024-03-15', 'ISO 14067:2018'],
      ['Toray VN', 'Recycled polyester DTY 150D', 1.8, 'kg CO₂e/kg', 'Mass balance, GRS', '2023', 'Tran Thi B - Env Manager', '2024-03-20', 'GRS certified'],
    ],
  },
  logistics_invoice: {
    sheet: 'Hoa_don_van_chuyen',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Đơn vị vận chuyển', 'Loại vận tải', 'Điểm đi', 'Điểm đến', 'Trọng lượng (kg)', 'Khoảng cách (km)', 'CO₂e (kg)', 'Ghi chú'],
      ['VC-2024-001', '2024-05-10', 'Gemadept Logistics', 'Đường bộ', 'Bình Dương', 'Cảng Cát Lái', 5000, 45, 18.5, ''],
      ['VC-2024-002', '2024-05-12', 'Maersk VN', 'Đường biển', 'Cảng Cát Lái', 'Hamburg DE', 8000, 10800, 1080, 'FCL 40HC'],
      ['* EF tham khảo: Xe tải 0.09–0.15 kg/tấn.km | Đường biển 0.012 kg/tấn.km | Hàng không 0.602 kg/tấn.km', '', '', '', '', '', '', '', '', ''],
    ],
  },
  bill_of_lading: {
    sheet: 'Bill_of_Lading',
    rows: [
      ['Số B/L', 'Ngày phát hành', 'Hãng tàu', 'Tàu / Chuyến', 'Cảng xếp hàng', 'Cảng dỡ hàng', 'Hàng hóa (mô tả)', 'Số container', 'Loại cont', 'Trọng lượng (kg)', 'Số kiện'],
      ['MAEU2024123456', '2024-05-15', 'Maersk', 'MSC MAYA / V.024W', 'Cat Lai, HCMC, VN', 'Hamburg, DE', 'Woven garments - 100% Cotton', 'MSKU1234567', '40HC', 18500, 850],
      ['COSCO20240789', '2024-05-20', 'COSCO', 'COSCO GLORY / E.018', 'Hai Phong, VN', 'Rotterdam, NL', 'Knitted apparel - Mixed fabric', 'CSNU9876543', '20GP', 12000, 600],
    ],
  },
  air_waybill: {
    sheet: 'Air_Waybill',
    rows: [
      ['Số AWB', 'Ngày', 'Hãng bay', 'Sân bay xuất (IATA)', 'Sân bay đến (IATA)', 'Mô tả hàng hóa', 'Trọng lượng (kg)', 'Số kiện', 'Ghi chú'],
      ['125-12345678', '2024-05-18', 'Vietnam Airlines', 'SGN', 'FRA', 'Garment samples - urgency', 250, 10, 'DDP Incoterms'],
      ['618-98765432', '2024-05-22', 'Singapore Airlines Cargo', 'SGN', 'CDG', 'Fashion accessories - NVD', 180, 8, 'CIP Incoterms'],
      ['* EF hàng không ≈ 0.602 kg CO₂e / tấn.km (ICAO 2023). Cần tránh tối đa vận chuyển hàng không.', '', '', '', '', '', '', '', ''],
    ],
  },
  export_invoice: {
    sheet: 'Hoa_don_xuat_khau',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Người bán', 'Người mua', 'Nước nhập khẩu', 'Điều kiện TM (Incoterms)', 'Mã HS', 'Mô tả hàng', 'Số lượng', 'Đơn vị', 'Đơn giá (USD)', 'Tổng (USD)', 'Trọng lượng (kg)'],
      ['EXP-2024-001', '2024-05-20', 'WeaveCarbon Co., Ltd', 'Fashion GmbH', 'DE', 'FOB HCMC', '6109.10.90', "Men's T-shirt 100% Cotton", 5000, 'pcs', 4.5, 22500, 1250],
      ['EXP-2024-002', '2024-05-22', 'WeaveCarbon Co., Ltd', 'Moda SRL', 'IT', 'CIF Genova', '6104.43.00', "Women's knitted dress Polyester", 2000, 'pcs', 12.8, 25600, 1400],
    ],
  },
  packing_list: {
    sheet: 'Packing_List',
    rows: [
      ['Số kiện', 'Loại kiện', 'Mã hàng (SKU)', 'Mô tả hàng', 'Số lượng/kiện', 'Đơn vị', 'Trọng lượng cả bì (kg)', 'Trọng lượng tịnh (kg)', 'Kích thước D×R×C (cm)', 'Ghi chú'],
      [1, 'Carton', 'SKU-SHIRT-001', "Men's T-shirt S/M/L - Cotton", 120, 'pcs', 8.5, 7.8, '60×40×50', 'PO#2024-EU-001'],
      [2, 'Carton', 'SKU-SHIRT-001', "Men's T-shirt S/M/L - Cotton", 120, 'pcs', 8.5, 7.8, '60×40×50', 'PO#2024-EU-001'],
      ['...', '', '', '', '', '', '', '', '', ''],
      ['Tổng cộng', '', '', '', 10000, 'pcs', 710, 650, '', '850 cartons'],
    ],
  },
  other: {
    sheet: 'Chung_tu_khac',
    rows: [
      ['Tên tài liệu', 'Ngày', 'Người phát hành', 'Mô tả nội dung', 'Số tham chiếu', 'Ghi chú'],
      ['Biên bản kiểm định lò hơi', '2024-03-10', 'Trung tâm Đo lường Chất lượng', 'Kiểm định an toàn lò hơi 2 tấn/h', 'KD-2024-BD-0021', 'Hiệu lực 12 tháng'],
      ['Báo cáo LCA nội bộ', '2024-04-01', 'WeaveCarbon R&D', 'LCA tóm tắt SKU-SHIRT-001 theo ISO 14067', 'LCA-2024-001', 'Draft, chưa kiểm toán'],
    ],
  },
};

export async function downloadTemplate(kind: string, label: string) {
  const tpl = DOC_TEMPLATES[kind] ?? DOC_TEMPLATES['other'];
  const headers = (tpl.rows[0] ?? []).map((h) => String(h));
  const dataRows = tpl.rows.slice(1);
  const isNote = (r: (string | number)[]) => String(r[0] ?? '').trim().startsWith('*');
  const notes = dataRows.filter(isNote).map((r) => String(r[0]));
  const sampleRows = dataRows.filter((r) => !isNote(r));
  const columns = headers.map((h) => ({ header: h, width: Math.max(h.length + 4, 16) }));

  const { downloadFormTemplate } = await import('@/lib/reports/formTemplate');
  await downloadFormTemplate(
    {
      sheets: [
        {
          name: tpl.sheet,
          title: `Mẫu chứng từ — ${label}`,
          subtitle: 'Điền dữ liệu thực vào các dòng bên dưới',
          columns,
          sampleRows,
          notes,
        },
      ],
      info: [
        {
          name: 'Huong_dan',
          title: 'Hướng dẫn sử dụng file mẫu',
          rows: [
            ['Loại chứng từ', label],
            ['Mục đích', 'Cung cấp dữ liệu có cấu trúc để hệ thống AI đọc và tính carbon chính xác hơn.'],
            ['Định dạng tải lên', 'PDF, XML, JPG, PNG, XLSX, CSV (tối đa 20 MB)'],
            'Dòng đầu tiên trong sheet dữ liệu là tiêu đề cột — không đổi thứ tự.',
            'Xoá các dòng mẫu (nền nhạt) và điền dữ liệu thật.',
            'Xoá các dòng ghi chú (bắt đầu bằng *) trước khi tải lên.',
            'Tải file này lên cùng chứng từ gốc (PDF/XML) để tăng độ chính xác.',
            ['Hỗ trợ', 'support@weavecarbon.com'],
          ],
        },
      ],
    },
    `WeaveCarbon_Mau_${kind}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
