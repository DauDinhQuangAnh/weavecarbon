export type DomainContextKey =
  | 'facility'
  | 'process'
  | 'activity'
  | 'supplier'
  | 'mitigation'
  | 'vn_mrv'
  | 'data_gap'
  | 'climate_location'
  | 'export_invoice'
  | 'export_packing_list'
  | 'export_bol'
  | 'export_customs'
  | 'factor_proposal'
  | 'iot_meter'
  | 'supplier_carbon'
  | 'production_batch'
  | 'allowance_quota';

export interface FieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select';
  description: string;
  options?: { label: string; value: string }[];
}

export interface SamplePreset {
  id: string;
  label: string;
  description: string;
  data: Record<string, unknown>;
}

export interface DocumentContextConfig {
  key: DomainContextKey;
  title: string;
  subtitle: string;
  hintKind: string;
  badgeLabel: string;
  badgeTone: string;
  acceptedMimeTypes: string[];
  expectedFields: FieldDefinition[];
  systemInstruction: string;
  samplePresets: SamplePreset[];
}

export const DOCUMENT_CONTEXTS: Record<DomainContextKey, DocumentContextConfig> = {
  facility: {
    key: 'facility',
    title: 'Quét Hồ sơ Cơ sở Sản xuất (Facility AI)',
    subtitle: 'Tải lên Giấy phép xây dựng, Giấy chứng nhận đầu tư, Báo cáo ranh giới nhà máy hoặc ĐTM để AI trích xuất thông tin cơ sở.',
    hintKind: 'facility_boundary',
    badgeLabel: 'Cơ sở & Ranh giới',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'reference', label: 'Mã cơ sở (Facility Ref)', type: 'string', description: 'Mã định danh duy nhất của cơ sở' },
      { key: 'name', label: 'Tên cơ sở / Nhà máy', type: 'string', description: 'Tên pháp lý hoặc tên thương mại của cơ sở' },
      { key: 'timezone', label: 'Múi giờ IANA', type: 'string', description: 'Múi giờ vận hành (vd: Asia/Ho_Chi_Minh)' },
      { key: 'boundary', label: 'Ranh giới vận hành', type: 'string', description: 'Mô tả phạm vi ranh giới kiểm kê khí nhà kính' },
    ],
    systemInstruction: 'Hãy trích xuất thông tin cơ sở sản xuất bao gồm mã định danh cơ sở, tên nhà máy, múi giờ và ranh giới vận hành từ tài liệu.',
    samplePresets: [
      {
        id: 'fac-tan-binh',
        label: '🏭 Nhà máy Dệt May Tân Bình (Hồ sơ kiểm kê)',
        description: 'Cơ sở sản xuất may mặc quy mô 15.000m² tại KCN Tân Bình, TP.HCM',
        data: {
          reference: 'FAC-SGN-TB01',
          name: 'Nhà máy May Mặc WeaveCarbon Tân Bình',
          timezone: 'Asia/Ho_Chi_Minh',
          boundary: 'Toàn bộ khuôn viên 15.000m² bao gồm xưởng cắt, xưởng may, kho thành phẩm và trạm biến áp nội bộ.',
        },
      },
      {
        id: 'fac-song-than',
        label: '⚡ Xưởng Nhuộm & Hoàn tất Sóng Thần',
        description: 'Cơ sở nhuộm vải công suất cao tại KCN Sóng Thần, Bình Dương',
        data: {
          reference: 'FAC-BDG-ST02',
          name: 'Xưởng Nhuộm & Giặt Tẩy WeaveCarbon Sóng Thần',
          timezone: 'Asia/Ho_Chi_Minh',
          boundary: 'Khu phức hợp xưởng nhuộm cao áp, hệ thống lò hơi đốt sinh khối và trạm xử lý nước thải 2.000m³/ngày.',
        },
      },
    ],
  },

  process: {
    key: 'process',
    title: 'Quét Quy trình Công nghiệp (Process AI)',
    subtitle: 'Tải lên Sơ đồ công nghệ, Quy trình vận hành chuẩn (SOP), Danh mục thiết bị hoặc Báo cáo kiểm toán năng lượng.',
    hintKind: 'industrial_process',
    badgeLabel: 'Quy trình Công nghệ',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'reference', label: 'Mã quy trình (Process Ref)', type: 'string', description: 'Mã định danh quy trình sản xuất' },
      { key: 'name', label: 'Tên quy trình', type: 'string', description: 'Tên đầy đủ của công đoạn / quy trình' },
      {
        key: 'processType',
        label: 'Loại quy trình',
        type: 'select',
        description: 'Phân loại công nghiệp',
        options: [
          { label: 'Sản xuất chính', value: 'production' },
          { label: 'Nhuộm & Giặt tẩy', value: 'dyeing_washing' },
          { label: 'Cắt & May hoàn tất', value: 'cutting_sewing' },
          { label: 'Lò hơi & Hơi nước', value: 'boiler_steam' },
          { label: 'Xử lý nước thải', value: 'wastewater_treatment' },
          { label: 'Đóng gói & Hoàn thiện', value: 'packaging_finishing' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất mã quy trình, tên công đoạn và phân loại loại quy trình công nghiệp tương ứng.',
    samplePresets: [
      {
        id: 'proc-dyeing',
        label: '🧵 Công đoạn Nhuộm & Xử lý ướt vải',
        description: 'Quy trình nhuộm hoạt tính sử dụng máy nhuộm cao áp',
        data: {
          reference: 'PROC-DYE-COTTON-01',
          name: 'Quy trình Nhuộm Hoạt tính Vải Cotton dệt kim',
          processType: 'dyeing_washing',
        },
      },
      {
        id: 'proc-boiler',
        label: '🔥 Quy trình Cấp hơi Lò hơi Sinh khối',
        description: 'Hệ thống nồi hơi tầng sôi đốt viên nén mùn cưa cấp nhiệt xưởng nhuộm',
        data: {
          reference: 'PROC-STM-BOILER-02',
          name: 'Vận hành Lò hơi Sinh khối Tầng sôi 10 Tấn/h',
          processType: 'boiler_steam',
        },
      },
      {
        id: 'proc-sewing',
        label: '✂️ Dây chuyền Cắt & May tự động',
        description: 'Dây chuyền trải vải và may áo Polo xuất khẩu EU',
        data: {
          reference: 'PROC-SEW-POLO-03',
          name: 'Dây chuyền May Áo Polo Nam Xuất khẩu',
          processType: 'cutting_sewing',
        },
      },
    ],
  },

  activity: {
    key: 'activity',
    title: 'Quét Hoạt động Phát thải (Activity AI)',
    subtitle: 'Tải lên Hóa đơn tiền điện EVN, Hóa đơn xăng dầu Petrolimex, Phiếu giao gas/than hoặc Biên bản chỉ số công tơ.',
    hintKind: 'emission_activity',
    badgeLabel: 'Dữ liệu Hoạt động',
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'activityReference', label: 'Mã hoạt động', type: 'string', description: 'Mã tham chiếu đợt ghi nhận' },
      {
        key: 'activityType',
        label: 'Loại phát thải',
        type: 'select',
        description: 'Nguồn phát thải Scope 1/2',
        options: [
          { label: 'Điện lưới (Scope 2)', value: 'electricity' },
          { label: 'Nhiên liệu đốt cố định/di động (Scope 1)', value: 'fuel' },
          { label: 'Hơi nước thương phẩm (Scope 2)', value: 'steam' },
          { label: 'Xử lý nước thải (Scope 1)', value: 'wastewater' },
          { label: 'Vận tải hàng hóa (Scope 3/Scope 1)', value: 'transport' },
        ],
      },
      { key: 'periodStart', label: 'Bắt đầu chu kỳ', type: 'date', description: 'Ngày bắt đầu tính chỉ số (YYYY-MM-DD)' },
      { key: 'periodEnd', label: 'Kết thúc chu kỳ', type: 'date', description: 'Ngày chốt chỉ số (YYYY-MM-DD)' },
      { key: 'quantity', label: 'Sản lượng tiêu thụ', type: 'number', description: 'Số lượng đo đếm' },
      { key: 'canonicalUnit', label: 'Đơn vị tính', type: 'string', description: 'kWh, L, kg, m³' },
      {
        key: 'sourceKind',
        label: 'Nguồn chứng từ',
        type: 'select',
        description: 'Loại nguồn gốc',
        options: [
          { label: 'Hóa đơn tài chính (Invoice)', value: 'invoice' },
          { label: 'Đồng hồ công tơ (Meter)', value: 'meter' },
          { label: 'Cảm biến IoT (Sensor)', value: 'sensor' },
          { label: 'Nhập tay có đối soát', value: 'manual' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất các thông số tiêu thụ điện (kWh), xăng dầu (Lít/kg), ngày bắt đầu/kết thúc chu kỳ và nguồn dữ liệu từ hóa đơn.',
    samplePresets: [
      {
        id: 'act-evn',
        label: '⚡ Hóa đơn điện EVN (38.500 kWh - Tháng 6/2026)',
        description: 'Hóa đơn điện lực TP.HCM cấp cho trạm biến áp xưởng may',
        data: {
          activityReference: 'ACT-EVN-2026-06',
          activityType: 'electricity',
          periodStart: '2026-06-01',
          periodEnd: '2026-06-30',
          quantity: 38500,
          canonicalUnit: 'kWh',
          sourceKind: 'invoice',
        },
      },
      {
        id: 'act-diesel',
        label: '⛽ Hóa đơn Dầu Diesel Petrolimex (1.250 Lít)',
        description: 'Hóa đơn cấp dầu DO 0.05S vận hành máy phát điện dự phòng',
        data: {
          activityReference: 'ACT-DSL-2026-06',
          activityType: 'fuel',
          periodStart: '2026-06-10',
          periodEnd: '2026-06-10',
          quantity: 1250,
          canonicalUnit: 'L',
          sourceKind: 'invoice',
        },
      },
    ],
  },

  supplier: {
    key: 'supplier',
    title: 'Quét Hồ sơ Nhà Cung Ứng (Supplier AI)',
    subtitle: 'Tải lên Giấy chứng nhận đăng ký kinh doanh, Hợp đồng nguyên tắc, Chứng nhận chuỗi cung ứng (GOTS/GRS/ISO).',
    hintKind: 'supplier_profile',
    badgeLabel: 'Mạng lưới NCC',
    badgeTone: 'border-violet-300 bg-violet-50 text-violet-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'supplierReference', label: 'Mã nhà cung ứng', type: 'string', description: 'Mã tham chiếu nhà cung cấp' },
      { key: 'legalName', label: 'Tên pháp lý công ty', type: 'string', description: 'Tên công ty trên đăng ký kinh doanh' },
      { key: 'tradingName', label: 'Tên thương mại', type: 'string', description: 'Tên giao dịch quốc tế' },
      { key: 'countryCode', label: 'Quốc gia', type: 'string', description: 'Mã quốc gia ISO (vd: VN, CN, IN)' },
      { key: 'sector', label: 'Phân ngành cung ứng', type: 'string', description: 'Lĩnh vực sản phẩm/dịch vụ' },
      {
        key: 'supplierTier',
        label: 'Cấp độ chuỗi cung ứng',
        type: 'select',
        description: 'Tier 1, Tier 2 hoặc Tier 3',
        options: [
          { label: 'Tier 1 (Nhà cung cấp trực tiếp)', value: '1' },
          { label: 'Tier 2 (Nhà cung cấp nguyên liệu thô)', value: '2' },
          { label: 'Tier 3 (Nhà khai thác nông nghiệp/hóa chất)', value: '3' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất mã số doanh nghiệp, tên công ty, tên thương mại, quốc gia, phân ngành sản xuất và cấp độ cung ứng.',
    samplePresets: [
      {
        id: 'sup-cotton',
        label: '🏢 Công ty Cổ phần Sợi Dệt Việt Thắng (Tier 1)',
        description: 'Nhà cung cấp sợi cotton hữu cơ chứng nhận GOTS tại Đồng Nai',
        data: {
          supplierReference: 'SUP-VT-TEX-01',
          legalName: 'Công ty Cổ phần Dệt May Thắng Lợi & Việt Thắng',
          tradingName: 'VietThang Textile Corporation',
          countryCode: 'VN',
          sector: 'Dệt & Kéo sợi Cotton',
          supplierTier: '1',
        },
      },
      {
        id: 'sup-chemical',
        label: '🧪 Hóa chất Dệt Nhuộm Archroma VN (Tier 2)',
        description: 'Nhà cung cấp thuốc nhuộm thân thiện môi trường ZDHC',
        data: {
          supplierReference: 'SUP-ARCH-VN-02',
          legalName: 'Công ty TNHH Hóa Chất Dệt May Archroma Việt Nam',
          tradingName: 'Archroma Textiles VN',
          countryCode: 'VN',
          sector: 'Hóa chất trợ nhuộm sinh học',
          supplierTier: '2',
        },
      },
    ],
  },

  export_invoice: {
    key: 'export_invoice',
    title: 'Quét Commercial Invoice & Hợp đồng (R01 AI)',
    subtitle: 'Tải lên Hóa đơn thương mại, Hợp đồng ngoại thương (PO/Sales Contract) dạng PDF hoặc ảnh chụp.',
    hintKind: 'commercial_invoice',
    badgeLabel: 'Thương mại & Hợp đồng',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'invoiceNumber', label: 'Số Commercial Invoice', type: 'string', description: 'Số hóa đơn thương mại' },
      { key: 'invoiceDate', label: 'Ngày lập hóa đơn', type: 'date', description: 'Ngày phát hành' },
      { key: 'poContractId', label: 'PO / Contract ID', type: 'string', description: 'Số đơn hàng mua' },
      { key: 'currency', label: 'Đồng tiền thanh toán', type: 'string', description: 'USD, EUR, VND' },
      { key: 'incotermCode', label: 'Điều kiện Incoterm', type: 'string', description: 'FOB, CIF, CFR, DDP' },
      { key: 'incotermLocation', label: 'Địa điểm Incoterm', type: 'string', description: 'Cảng hoặc cửa khẩu giao hàng' },
    ],
    systemInstruction: 'Hãy trích xuất số hóa đơn thương mại, ngày phát hành, PO ID, đồng tiền, điều kiện Incoterm và các bên tham gia.',
    samplePresets: [
      {
        id: 'inv-eu',
        label: '📄 Commercial Invoice Xuất khẩu Dệt may EU (Rotterdam)',
        description: 'Hóa đơn xuất 24.000 áo thun cotton đi Cảng Rotterdam theo điều kiện FOB Cát Lái',
        data: {
          invoiceNumber: 'INV-2026-EU-089',
          invoiceDate: '2026-06-15',
          poContractId: 'PO-EU-2026-009',
          currency: 'USD',
          paymentTerms: 'T/T 60 days after B/L date',
          incotermCode: 'FOB',
          incotermLocation: 'Cat Lai Port, Ho Chi Minh City',
          exporterTaxId: '0108927461',
          portOfLoading: 'Cat Lai, Vietnam (VNSGN)',
          portOfDischarge: 'Rotterdam, Netherlands (NLRTM)',
        },
      },
    ],
  },

  export_packing_list: {
    key: 'export_packing_list',
    title: 'Quét Packing List & Chi tiết Đóng gói (R02 AI)',
    subtitle: 'Tải lên Phiếu đóng gói hàng hóa, Danh mục kiện hàng, Bảng kê quy cách đóng gói (PDF/Ảnh).',
    hintKind: 'packing_list',
    badgeLabel: 'Phiếu đóng gói R02',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'packingListNumber', label: 'Số Packing List', type: 'string', description: 'Số phiếu đóng gói' },
      { key: 'packingListDate', label: 'Ngày lập PKL', type: 'date', description: 'Ngày lập bảng kê' },
      { key: 'containerNo', label: 'Số Container', type: 'string', description: 'Mã số container (vd: TCLU8294012)' },
      { key: 'sealNo', label: 'Số Seal niêm phong', type: 'string', description: 'Mã số seal hãng tàu' },
    ],
    systemInstruction: 'Hãy trích xuất số packing list, số container, số seal và tổng trọng lượng net/gross từ phiếu đóng gói.',
    samplePresets: [
      {
        id: 'pkl-eu',
        label: '📦 Packing List 1x40HC Container 1.200 Thùng Carton',
        description: 'Bảng kê chi tiết 1.200 thùng carton xuất khẩu đi Châu Âu',
        data: {
          packingListNumber: 'PKL-2026-EU-089',
          packingListDate: '2026-06-15',
          containerNo: 'TCLU8294012',
          sealNo: 'ONE-SEAL-9921',
        },
      },
    ],
  },

  export_bol: {
    key: 'export_bol',
    title: 'Quét Vận đơn Đường biển / Hàng không (R03 AI)',
    subtitle: 'Tải lên Vận đơn Bill of Lading (B/L) hoặc Vận đơn Hàng không (AWB) do hãng tàu / freight forwarder phát hành.',
    hintKind: 'transport_bol',
    badgeLabel: 'Vận đơn B/L R03',
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'billOfLadingNo', label: 'Số Vận đơn (B/L No)', type: 'string', description: 'Mã số vận đơn' },
      { key: 'carrierName', label: 'Hãng tàu / Hãng vận chuyển', type: 'string', description: 'Tên hãng vận tải' },
      { key: 'vesselName', label: 'Tên tàu vận chuyển', type: 'string', description: 'Tên tàu mẹ' },
      { key: 'voyageNumber', label: 'Số hiệu chuyến tàu', type: 'string', description: 'Mã chuyến voyage' },
      { key: 'portOfLoading', label: 'Cảng bốc hàng', type: 'string', description: 'Port of Loading' },
      { key: 'portOfDischarge', label: 'Cảng dỡ hàng', type: 'string', description: 'Port of Discharge' },
    ],
    systemInstruction: 'Hãy trích xuất số vận đơn B/L, tên hãng tàu, tên tàu, số chuyến và cảng bốc/dỡ hàng.',
    samplePresets: [
      {
        id: 'bol-maersk',
        label: '🚢 Ocean Bill of Lading Hãng tàu Maersk Line',
        description: 'Vận đơn vận chuyển đường biển Cát Lái ➔ Rotterdam',
        data: {
          billOfLadingNo: 'MSK-VNSGN-2026-88',
          carrierName: 'Maersk Line A/S',
          vesselName: 'MAERSK MC-KINNEY MOLLER',
          voyageNumber: '2604W',
          portOfLoading: 'Cat Lai, Vietnam (VNSGN)',
          portOfDischarge: 'Rotterdam, Netherlands (NLRTM)',
        },
      },
    ],
  },

  export_customs: {
    key: 'export_customs',
    title: 'Quét Tờ khai Hải quan VNACCS (R04 AI)',
    subtitle: 'Tải lên Tờ khai hải quan điện tử xuất khẩu thông quan luồng xanh/vàng từ hệ thống VNACCS/VCIS.',
    hintKind: 'customs_declaration',
    badgeLabel: 'Hải quan R04',
    badgeTone: 'border-slate-300 bg-slate-50 text-slate-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'customsDeclarationNo', label: 'Số tờ khai Hải quan', type: 'string', description: '12 chữ số tờ khai VNACCS' },
      { key: 'exporterTaxId', label: 'Mã số thuế doanh nghiệp XK', type: 'string', description: 'MST doanh nghiệp' },
      { key: 'importerEori', label: 'Mã EORI nhà nhập khẩu EU', type: 'string', description: 'Mã số định danh EORI' },
    ],
    systemInstruction: 'Hãy trích xuất số tờ khai hải quan 12 số, mã số thuế người xuất khẩu và mã số EORI của đối tác nhập khẩu.',
    samplePresets: [
      {
        id: 'vnaccs-green',
        label: '📋 Tờ khai Hải quan Thông quan Luồng Xanh VNACCS',
        description: 'Tờ khai hàng dệt may xuất khẩu khẩu phần EU đã thông quan',
        data: {
          customsDeclarationNo: '104829384720',
          exporterTaxId: '0108927461',
          importerEori: 'NL820491823',
        },
      },
    ],
  },

  mitigation: {
    key: 'mitigation',
    title: 'Quét Sáng kiến Giảm phát thải (Mitigation AI)',
    subtitle: 'Tải lên Báo cáo kiểm toán năng lượng, Đề án tiết kiệm điện, Dự án năng lượng tái tạo hoặc Đề xuất thay thế thiết bị.',
    hintKind: 'mitigation_initiative',
    badgeLabel: 'Sáng kiến Giảm phát thải',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'initiativeReference', label: 'Mã sáng kiến', type: 'string', description: 'Mã tham chiếu đề án' },
      { key: 'title', label: 'Tên sáng kiến', type: 'string', description: 'Tên đầy đủ của giải pháp giảm phát thải' },
      { key: 'ownerName', label: 'Người phụ trách', type: 'string', description: 'Kỹ sư trưởng hoặc Quản lý dự án' },
      { key: 'targetReductionTco2e', label: 'Mục tiêu giảm (tCO₂e/năm)', type: 'number', description: 'Lượng phát thải dự kiến cắt giảm' },
    ],
    systemInstruction: 'Hãy trích xuất mã sáng kiến, tên dự án tiết kiệm năng lượng, người phụ trách và sản lượng giảm phát thải dự kiến (tCO2e) từ tài liệu.',
    samplePresets: [
      {
        id: 'mit-solar',
        label: '☀️ Đề án Điện mặt trời Mái nhà 1.2 MWp',
        description: 'Đề án lắp đặt điện mặt trời áp mái tự dùng cho xưởng may và xưởng dệt Tân Bình',
        data: {
          initiativeReference: 'MIT-SOLAR-2026-TB',
          title: 'Dự án Điện mặt trời Mái nhà 1.2 MWp Tự dùng Xưởng May Tân Bình',
          ownerName: 'Nguyễn Văn Hùng (Trưởng phòng Cơ điện)',
          targetReductionTco2e: 1450,
        },
      },
      {
        id: 'mit-boiler',
        label: '🔄 Chuyển đổi Lò hơi Than sang Sinh khối Trấu ép',
        description: 'Dự án thay thế lò hơi than ghi xích bằng lò hơi tầng sôi đốt viên nén sinh khối',
        data: {
          initiativeReference: 'MIT-BIO-BOILER-02',
          title: 'Chuyển đổi Lò hơi Than sang Lò hơi Tầng sôi Viên nén Sinh khối',
          ownerName: 'Trần Minh Đức (Kỹ sư Năng lượng)',
          targetReductionTco2e: 3820,
        },
      },
    ],
  },

  vn_mrv: {
    key: 'vn_mrv',
    title: 'Quét Hồ sơ Kiểm kê KNK Quốc gia VN-MRV (QĐ 01/2022/QĐ-TTg & QĐ 13/2024/QĐ-TTg)',
    subtitle: 'Tải lên Quyết định giao hạn ngạch, Văn bản thông báo cơ sở kiểm kê bắt buộc, hoặc Báo cáo kiểm kê KNK cấp cơ sở.',
    hintKind: 'vnmrv_case',
    badgeLabel: 'Kiểm kê Quốc gia VN-MRV',
    badgeTone: 'border-amber-300 bg-amber-50 text-amber-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'caseReference', label: 'Mã hồ sơ MRV', type: 'string', description: 'Mã tham chiếu hồ sơ' },
      {
        key: 'applicabilityStatus',
        label: 'Trạng thái bắt buộc',
        type: 'select',
        description: 'Trạng thái áp dụng QĐ 01/2022',
        options: [
          { label: 'Bắt buộc kiểm kê (Listed)', value: 'listed_mandatory' },
          { label: 'Tiềm năng thuộc danh mục (Potentially Listed)', value: 'potentially_listed' },
          { label: 'Tự nguyện kiểm kê (Voluntary)', value: 'voluntary' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất mã hồ sơ kiểm kê khí nhà kính quốc gia và tình trạng áp dụng quy định bắt buộc theo Quyết định của Thủ tướng Chính phủ.',
    samplePresets: [
      {
        id: 'mrv-qd01',
        label: '📜 Quyết định 13/2024/QĐ-TTg Danh mục cơ sở phát thải bắt buộc',
        description: 'Hồ sơ kiểm kê khí nhà kính bắt buộc năm 2026 cơ sở tiêu thụ điện > 1.000 TOE/năm',
        data: {
          caseReference: 'MRV-VN-2026-FAC01',
          applicabilityStatus: 'listed_mandatory',
        },
      },
    ],
  },

  data_gap: {
    key: 'data_gap',
    title: 'Quét Hồ sơ Kiểm toán & Khoảng trống Dữ liệu (Audit Gap AI)',
    subtitle: 'Tải lên Biên bản kiểm kê năng lượng, Báo cáo rà soát nội bộ hoặc Checklist tuân thủ để AI tự động phát hiện khoảng trống dữ liệu.',
    hintKind: 'audit_data_gap',
    badgeLabel: 'Kiểm tra Khoảng trống',
    badgeTone: 'border-amber-300 bg-amber-50 text-amber-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'dataGroup', label: 'Nhóm dữ liệu / Hạng mục', type: 'string', description: 'Tên nhóm dữ liệu carbon cần rà soát' },
      {
        key: 'riskLevel',
        label: 'Mức rủi ro kiểm toán',
        type: 'select',
        description: 'Mức độ rủi ro loại trừ số liệu',
        options: [
          { label: 'Cao (High Risk)', value: 'high' },
          { label: 'Trung bình (Medium Risk)', value: 'medium' },
          { label: 'Thấp (Low Risk)', value: 'low' },
        ],
      },
      {
        key: 'currentStatus',
        label: 'Trạng thái hiện tại',
        type: 'select',
        description: 'Mức độ sẵn sàng dữ liệu',
        options: [
          { label: 'Thiếu (Missing)', value: 'missing' },
          { label: 'Proxy ước tính', value: 'proxy' },
          { label: 'Tự khai báo', value: 'self_declared' },
          { label: 'Đã tải lên', value: 'uploaded' },
          { label: 'Đã xác minh', value: 'verified' },
        ],
      },
      { key: 'requiredAction', label: 'Hành động yêu cầu', type: 'string', description: 'Biện pháp khắc phục cần triển khai' },
      { key: 'owner', label: 'Người phụ trách', type: 'string', description: 'Cá nhân hoặc phòng ban phụ trách' },
      { key: 'deadline', label: 'Hạn chót xử lý', type: 'date', description: 'Ngày hạn hoàn thành' },
      { key: 'regulationTag', label: 'Quy chuẩn áp dụng', type: 'string', description: 'ISO 14064, QĐ 13/2024, CBAM' },
    ],
    systemInstruction: 'Hãy trích xuất nhóm dữ liệu kiểm kê phát thải, đánh giá mức độ rủi ro, trạng thái bằng chứng hiện tại và hành động khắc phục cụ thể từ tài liệu.',
    samplePresets: [
      {
        id: 'gap-elec-q3',
        label: '⚡ Hóa đơn tiền điện trạm biến áp xưởng may Q3',
        description: 'Khoảng trống hóa đơn tiền điện tháng 8 chưa đối soát chỉ số công tơ phụ',
        data: {
          dataGroup: 'Hóa đơn tiền điện EVN trạm biến áp xưởng may Q3',
          riskLevel: 'high',
          currentStatus: 'missing',
          requiredAction: 'Đối soát sản lượng điện 145.000 kWh với EVN portal và liên kết hóa đơn điện tử',
          owner: 'Kế toán chi phí xưởng',
          deadline: '2026-11-15',
          regulationTag: 'ISO 14064-1:2018 Scope 2',
        },
      },
      {
        id: 'gap-boiler-biomass',
        label: '🔥 Biên bản thử nghiệm khí thải & cân sinh khối lò hơi',
        description: 'Chứng từ cân nhập dăm gỗ và kết quả đo nồng độ CO, SO2 ống khói',
        data: {
          dataGroup: 'Chứng từ cân sinh khối dăm gỗ và test khí thải lò hơi',
          riskLevel: 'medium',
          currentStatus: 'self_declared',
          requiredAction: 'Yêu cầu đơn vị quan trắc Quatest cấp kết quả đo kiểm định kỳ',
          owner: 'Kỹ sư trưởng lò hơi',
          deadline: '2026-11-20',
          regulationTag: 'Nghị định 06/2022/NĐ-CP',
        },
      },
      {
        id: 'gap-refrigerant-chiller',
        label: '❄️ Nhật ký bảo dưỡng nạp ga làm lạnh Chiller R410A',
        description: 'Kiểm tra phát thải rò rỉ môi chất lạnh từ hệ thống điều hòa trung tâm',
        data: {
          dataGroup: 'Nhật ký nạp môi chất lạnh Chiller R410A xưởng hoàn tất',
          riskLevel: 'high',
          currentStatus: 'proxy',
          requiredAction: 'Thu thập biên bản nghiệm thu nạp 45kg gas R410A từ nhà thầu cơ điện lạnh',
          owner: 'Quản lý cơ sở vật chất',
          deadline: '2026-11-10',
          regulationTag: 'Quyết định 13/2024/QĐ-TTg',
        },
      },
    ],
  },

  climate_location: {
    key: 'climate_location',
    title: 'Quét Tọa độ & Hồ sơ Địa chính Cơ sở (GIS Location AI)',
    subtitle: 'Tải lên Trích lục bản đồ địa chính, Giấy chứng nhận quyền sử dụng đất, Báo cáo khảo sát GPS hoặc giấy phép xây dựng.',
    hintKind: 'climate_location_evidence',
    badgeLabel: 'Tọa độ GIS & Khí hậu',
    badgeTone: 'border-sky-300 bg-sky-50 text-sky-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'latitude', label: 'Vĩ độ (Latitude)', type: 'number', description: 'Tọa độ thập phân (vd: 10.8231)' },
      { key: 'longitude', label: 'Kinh độ (Longitude)', type: 'number', description: 'Tọa độ thập phân (vd: 106.6297)' },
      { key: 'precisionMeters', label: 'Độ chính xác (mét)', type: 'number', description: 'Sai số định vị tọa độ' },
      { key: 'locationBasis', label: 'Căn cứ xác định vị trí', type: 'string', description: 'Nguồn tài liệu chứng minh tọa độ' },
    ],
    systemInstruction: 'Hãy trích xuất tọa độ GPS (Vĩ độ Latitude, Kinh độ Longitude), độ chính xác định vị và cơ sở xác định vị trí từ trích lục bản đồ hoặc giấy chứng nhận quyền sử dụng đất.',
    samplePresets: [
      {
        id: 'loc-tan-binh',
        label: '📍 Trích lục bản đồ KCN Tân Bình (TP.HCM)',
        description: 'Tọa độ trắc địa nhà máy may công nghiệp Tân Bình',
        data: {
          latitude: 10.8231,
          longitude: 106.6297,
          precisionMeters: 25,
          locationBasis: 'Trích lục bản đồ địa chính Sở TN&MT TP.HCM tỷ lệ 1/2000',
        },
      },
      {
        id: 'loc-song-than',
        label: '📍 Tọa độ GPS KCN Sóng Thần 2 (Bình Dương)',
        description: 'Tọa độ trạm quan trắc xưởng nhuộm Sóng Thần',
        data: {
          latitude: 10.9025,
          longitude: 106.7456,
          precisionMeters: 15,
          locationBasis: 'Biên bản định vị mốc ranh giới đất công nghiệp KCN Sóng Thần 2',
        },
      },
      {
        id: 'loc-nam-dinh',
        label: '📍 Tọa độ KCN Dệt May Rạng Đông (Nam Định)',
        description: 'Tọa độ nhà máy dệt ven biển Đồng bằng sông Hồng',
        data: {
          latitude: 20.0125,
          longitude: 106.1852,
          precisionMeters: 50,
          locationBasis: 'Hồ sơ thiết kế kỹ thuật tổng mặt bằng nhà máy dệt Aurora IP',
        },
      },
    ],
  },

  factor_proposal: {
    key: 'factor_proposal',
    title: 'Quét Đề xuất Hệ số Phát thải KNK (Factor AI)',
    subtitle: 'Tải lên Quyết định của Bộ TN&MT, Báo cáo kiểm nghiệm Quatest/Eurofins, hoặc Dữ liệu hệ số phát thải cơ sở.',
    hintKind: 'emission_factor_evidence',
    badgeLabel: 'Hệ số KNK & Thử nghiệm',
    badgeTone: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'proposalReference', label: 'Mã đề xuất (Proposal Ref)', type: 'string', description: 'Mã định danh đề xuất hệ số' },
      { key: 'factorId', label: 'Mã hệ số định danh', type: 'string', description: 'Mã chuẩn hóa (vd: EF-BIOMASS-SAWDUST-VN)' },
      { key: 'label', label: 'Tên hệ số KNK', type: 'string', description: 'Tên diễn giải chi tiết' },
      { key: 'factorValue', label: 'Giá trị hệ số', type: 'number', description: 'Giá trị số của hệ số phát thải' },
      { key: 'unit', label: 'Đơn vị tính', type: 'string', description: 'kgCO2e/kg, kgCO2e/kWh, tCO2e/TJ' },
      { key: 'sourceName', label: 'Nguồn trích dẫn', type: 'string', description: 'Tổ chức hoặc quyết định ban hành' },
      { key: 'sourceYear', label: 'Năm công bố', type: 'string', description: 'Năm phát hành dữ liệu' },
      { key: 'geography', label: 'Khu vực áp dụng', type: 'string', description: 'VN, Quốc tế, hoặc theo tỉnh thành' },
      { key: 'boundary', label: 'Ranh giới phát thải', type: 'string', description: 'Cradle-to-gate, direct combustion, etc.' },
      { key: 'gwpBasis', label: 'Chuẩn GWP', type: 'string', description: 'IPCC AR6 100-year hoặc AR5' },
    ],
    systemInstruction: 'Hãy trích xuất mã đề xuất, giá trị hệ số phát thải, đơn vị, nguồn công bố, năm công bố và khu vực áp dụng từ tài liệu quyết định hoặc phiếu kết quả thử nghiệm.',
    samplePresets: [
      {
        id: 'ef-biomass-pellet',
        label: '🪵 Phiếu thử nghiệm Hệ số phát thải Viên nén Mùn cưa (Quatest 3)',
        description: 'Kết quả đo nhiệt trị và hàm lượng carbon sinh khối lò hơi công nghiệp',
        data: {
          proposalReference: 'EF-PROP-2026-BIO01',
          factorId: 'EF-BIOMASS-SAWDUST-VN',
          label: 'Hệ số phát thải viên nén mùn cưa lò hơi công nghiệp',
          factorValue: '0.0152',
          unit: 'kgCO2e/kg',
          sourceName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3 (Quatest 3)',
          sourceYear: '2025',
          geography: 'VN',
          boundary: 'Cradle-to-Gate Scope 1 Đốt trực tiếp',
          gwpBasis: 'IPCC AR6 100-year',
        },
      },
      {
        id: 'ef-grid-evn-2025',
        label: '⚡ Hệ số phát thải Lưới điện Việt Nam 2025 (Cục BĐKH / Bộ TN&MT)',
        description: 'Công bố chính thức hệ số phát thải lưới điện phục vụ kiểm kê KNK',
        data: {
          proposalReference: 'EF-PROP-2026-GRID-VN',
          factorId: 'EF-GRID-EVN-2025',
          label: 'Hệ số phát thải điện lưới quốc gia Việt Nam công bố năm 2025',
          factorValue: '0.7221',
          unit: 'kgCO2e/kWh',
          sourceName: 'Cục Biến đổi khí hậu (Bộ Tài nguyên & Môi trường)',
          sourceYear: '2025',
          geography: 'VN',
          boundary: 'Phát thải gián tiếp Scope 2 (Location-based)',
          gwpBasis: 'IPCC AR6 100-year',
        },
      },
    ],
  },

  iot_meter: {
    key: 'iot_meter',
    title: 'Quét Thiết bị Đo & Công tơ Phụ (Weavenode IoT AI)',
    subtitle: 'Tải lên Sơ đồ một sợi (SLD), Biên bản nghiệm thu kiểm định đồng hồ hoặc Nhãn mác công tơ điện tử.',
    hintKind: 'iot_meter_nameplate',
    badgeLabel: 'Đồng hồ & Cảm biến IoT',
    badgeTone: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'hierarchyReference', label: 'Mã phả hệ đồng hồ', type: 'string', description: 'Mã định danh liên kết phân bổ' },
      {
        key: 'relationKind',
        label: 'Loại quan hệ phân bổ',
        type: 'select',
        description: 'Vị trí đồng hồ trong mạng lưới',
        options: [
          { label: 'Đồng hồ nhánh (Sub-meter)', value: 'sub_meter' },
          { label: 'Phân bổ theo quy trình (Process Allocator)', value: 'process_allocator' },
          { label: 'Đồng hồ đối soát kiểm tra (Check Meter)', value: 'check_meter' },
        ],
      },
      { key: 'tolerancePercent', label: 'Ngưỡng sai số cho phép (%)', type: 'number', description: 'Thường từ 1% đến 2%' },
      { key: 'effectiveFrom', label: 'Ngày hiệu lực', type: 'date', description: 'Ngày bắt đầu kích hoạt đồng hồ' },
      { key: 'meterModel', label: 'Model thiết bị đo', type: 'string', description: 'Tên model thiết bị' },
      { key: 'ctRatio', label: 'Tỷ số biến dòng CT', type: 'string', description: 'Tỷ số CT (vd: 200/5A)' },
    ],
    systemInstruction: 'Hãy trích xuất mã thiết bị, loại đồng hồ, tỷ số biến dòng, dung sai cho phép và ngày lắp đặt từ nhãn mác công tơ hoặc sơ đồ một sợi SLD.',
    samplePresets: [
      {
        id: 'meter-sub-dyeing',
        label: '⚡ Đồng hồ phụ Schneider PM5350 Xưởng Nhuộm Cao áp',
        description: 'Công tơ điện tử đa năng giám sát điện năng dàn máy nhuộm vải',
        data: {
          hierarchyReference: 'HIER-MTR-DYE-01',
          relationKind: 'sub_meter',
          tolerancePercent: '2',
          effectiveFrom: '2026-01-01',
          meterModel: 'Schneider Electric PowerLogic PM5350',
          ctRatio: '400/5A',
        },
      },
      {
        id: 'meter-sub-sewing',
        label: '✂️ Công tơ phụ Elster A1800 Dây chuyền May hoàn tất',
        description: 'Đồng hồ đo điện 3 pha xưởng may áo Polo xuất khẩu',
        data: {
          hierarchyReference: 'HIER-MTR-SEW-02',
          relationKind: 'process_allocator',
          tolerancePercent: '1.5',
          effectiveFrom: '2026-03-01',
          meterModel: 'Elster Honeywell A1800 ALPHA',
          ctRatio: '200/5A',
        },
      },
    ],
  },

  supplier_carbon: {
    key: 'supplier_carbon',
    title: 'Quét Báo cáo KNK & Dấu chân Carbon Nhà Cung Ứng (Supplier Carbon AI)',
    subtitle: 'Tải lên Báo cáo kiểm kê phát thải của NCC, Chứng chỉ PCF, Báo cáo Higg FEM hoặc Báo cáo CDP Supplier.',
    hintKind: 'supplier_carbon_report',
    badgeLabel: 'Phát thải NCC Scope 3',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'reportingPeriodStart', label: 'Bắt đầu chu kỳ', type: 'date', description: 'Ngày bắt đầu tính phát thải' },
      { key: 'reportingPeriodEnd', label: 'Kết thúc chu kỳ', type: 'date', description: 'Ngày chốt tính phát thải' },
      { key: 'grossKgCo2e', label: 'Tổng phát thải (kgCO₂e)', type: 'number', description: 'Phát thải tổng thể của nhà cung cấp' },
      { key: 'activityQuantity', label: 'Sản lượng cung ứng', type: 'number', description: 'Khối lượng hàng hóa cung ứng' },
      { key: 'activityUnit', label: 'Đơn vị sản lượng', type: 'string', description: 'kg, tấn, mét vải, sản phẩm' },
      { key: 'intensityKgCo2e', label: 'Cường độ phát thải (kgCO₂e/đơn vị)', type: 'number', description: 'Phát thải trên 1 đơn vị sản phẩm' },
      { key: 'boundary', label: 'Ranh giới kiểm kê', type: 'string', description: 'Cradle-to-gate hoặc Gate-to-gate' },
      { key: 'methodologyReference', label: 'Phương pháp luận', type: 'string', description: 'ISO 14067, GHG Protocol Scope 3, Higg FEM' },
      {
        key: 'dataQualityLevel',
        label: 'Cấp chất lượng DQL',
        type: 'select',
        description: 'Bậc chất lượng dữ liệu',
        options: [
          { label: 'L3 · Có chứng từ bảo chứng', value: 'L3' },
          { label: 'L4 · Đã đối soát chéo', value: 'L4' },
          { label: 'L5 · Thẩm tra độc lập bên thứ 3', value: 'L5' },
          { label: 'L2 · Tự khai báo', value: 'L2' },
          { label: 'L1 · Dữ liệu proxy', value: 'L1' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất ngày bắt đầu, ngày kết thúc, tổng phát thải kgCO2e, sản lượng, đơn vị, cường độ phát thải và phương pháp kiểm kê từ báo cáo nhà cung cấp.',
    samplePresets: [
      {
        id: 'sup-pcf-organic-yarn',
        label: '🧵 Báo cáo Dấu chân Carbon Sợi Cotton Hữu cơ (Thắng Lợi)',
        description: 'Chứng thư PCF ISO 14067 xác nhận cường độ phát thải 2.45 kgCO2e/kg sợi',
        data: {
          reportingPeriodStart: '2025-01-01',
          reportingPeriodEnd: '2025-12-31',
          grossKgCo2e: 490000,
          activityQuantity: 200000,
          activityUnit: 'kg',
          intensityKgCo2e: 2.45,
          boundary: 'Cradle-to-Gate (từ nông trại trồng bông đến sợi xuất xưởng)',
          methodologyReference: 'ISO 14067:2018 & WBCSD PACT Framework v2.0',
          dataQualityLevel: 'L4',
        },
      },
      {
        id: 'sup-ghg-dye-aux',
        label: '🧪 Chứng nhận Phát thải Hóa chất Nhuộm Sinh học (Archroma)',
        description: 'Báo cáo kiểm kê carbon dòng trợ chất nhuộm thân thiện môi trường',
        data: {
          reportingPeriodStart: '2025-01-01',
          reportingPeriodEnd: '2025-12-31',
          grossKgCo2e: 115000,
          activityQuantity: 100000,
          activityUnit: 'kg',
          intensityKgCo2e: 1.15,
          boundary: 'Gate-to-Gate nhà máy hóa chất',
          methodologyReference: 'GHG Protocol Corporate Standard & ZDHC MRSL',
          dataQualityLevel: 'L3',
        },
      },
    ],
  },

  production_batch: {
    key: 'production_batch',
    title: 'Quét Lệnh Sản xuất & Nhật ký Lô hàng (Batch AI)',
    subtitle: 'Tải lên Lệnh sản xuất (Production Order), Phiếu theo dõi chuyền may, hoặc Nhật ký cân nguyên liệu thô.',
    hintKind: 'production_order_sheet',
    badgeLabel: 'Lô Sản xuất & Batching',
    badgeTone: 'border-amber-300 bg-amber-50 text-amber-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'orderReference', label: 'Mã lệnh sản xuất', type: 'string', description: 'Mã PO / Job Order' },
      { key: 'productCode', label: 'Mã SKU sản phẩm', type: 'string', description: 'Mã sản phẩm hoàn thiện' },
      { key: 'batchSize', label: 'Quy mô lô sản xuất', type: 'number', description: 'Số lượng sản phẩm trong lô' },
      { key: 'batchUnit', label: 'Đơn vị tính', type: 'string', description: 'pcs, cái, mét, bộ' },
      { key: 'facilityName', label: 'Cơ sở sản xuất', type: 'string', description: 'Nhà máy đảm nhiệm lô hàng' },
      { key: 'processName', label: 'Công đoạn chính', type: 'string', description: 'Cắt may, nhuộm, hoàn tất' },
      { key: 'startDate', label: 'Ngày bắt đầu', type: 'date', description: 'Ngày phát lệnh sản xuất' },
      { key: 'endDate', label: 'Ngày hoàn tất dự kiến', type: 'date', description: 'Ngày kết thúc đợt sản xuất' },
    ],
    systemInstruction: 'Hãy trích xuất mã lệnh sản xuất, mã sản phẩm, quy mô lô, đơn vị tính, nhà máy và ngày bắt đầu/kết thúc từ lệnh sản xuất.',
    samplePresets: [
      {
        id: 'batch-polo-eu',
        label: '👕 Lệnh sản xuất Lô 10.000 Áo Polo Recycled Cotton xuất khẩu EU',
        description: 'Job Order xưởng may Tân Bình chuyền may số 4',
        data: {
          orderReference: 'PO-BATCH-2026-POLO-01',
          productCode: 'SKU-POLO-M-RECYCLED',
          batchSize: 10000,
          batchUnit: 'cái',
          facilityName: 'Nhà máy May Mặc WeaveCarbon Tân Bình',
          processName: 'May hoàn tất áo Polo',
          startDate: '2026-06-01',
          endDate: '2026-06-25',
        },
      },
      {
        id: 'batch-denim-weave',
        label: '👖 Lệnh dệt nhuộm 5.000m Vải Denim Cotton hữu cơ',
        description: 'Lệnh sản xuất xưởng dệt nhuộm Sóng Thần',
        data: {
          orderReference: 'PO-BATCH-2026-DENIM-02',
          productCode: 'SKU-FABRIC-DENIM-ORG',
          batchSize: 5000,
          batchUnit: 'mét',
          facilityName: 'Xưởng Nhuộm WeaveCarbon Sóng Thần',
          processName: 'Nhuộm chàm & Giặt mềm vải Denim',
          startDate: '2026-06-05',
          endDate: '2026-06-18',
        },
      },
    ],
  },

  allowance_quota: {
    key: 'allowance_quota',
    title: 'Quét Quyết định Phân bổ Hạn ngạch KNK (ETS Quota AI)',
    subtitle: 'Tải lên Quyết định giao hạn ngạch phát thải từ Bộ TN&MT hoặc Văn bản thông báo cơ quan quản lý.',
    hintKind: 'government_quota_notice',
    badgeLabel: 'Hạn ngạch KNK',
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-800',
    acceptedMimeTypes: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
    expectedFields: [
      { key: 'allocationReference', label: 'Mã phân bổ hạn ngạch', type: 'string', description: 'Mã số văn bản giao hạn ngạch' },
      { key: 'reportingYear', label: 'Năm kiểm kê', type: 'number', description: 'Năm áp dụng hạn ngạch' },
      { key: 'quantityTco2e', label: 'Lượng hạn ngạch giao (tCO₂e)', type: 'number', description: 'Số tấn CO2 tương đương' },
      { key: 'vintageYear', label: 'Năm Vintage', type: 'number', description: 'Năm phát hành quyền phát thải' },
      {
        key: 'instrumentType',
        label: 'Loại công cụ hạn ngạch',
        type: 'select',
        description: 'Phân loại công cụ thị trường carbon',
        options: [
          { label: 'Hạn ngạch phát thải nhà nước giao (Authority Quota)', value: 'authority_quota' },
          { label: 'Tín chỉ carbon bù trừ (Carbon Offset Credit)', value: 'credit_offset' },
          { label: 'Tín chỉ hành động sớm (Early Action Credit)', value: 'early_action_credit' },
        ],
      },
    ],
    systemInstruction: 'Hãy trích xuất số hiệu quyết định phân bổ hạn ngạch, năm áp dụng, số lượng tCO2e được giao và loại công cụ từ văn bản quản lý nhà nước.',
    samplePresets: [
      {
        id: 'quota-monre-2026',
        label: '📜 Quyết định giao Hạn ngạch KNK 2026 (Bộ TN&MT) - 45.000 tCO₂e',
        description: 'Văn bản giao hạn ngạch phát thải cho ngành dệt may giai đoạn thí điểm sàn giao dịch carbon',
        data: {
          allocationReference: 'QD-BTNMT-HN-2026-88',
          reportingYear: 2026,
          quantityTco2e: 45000,
          vintageYear: 2026,
          instrumentType: 'authority_quota',
        },
      },
    ],
  },
};

