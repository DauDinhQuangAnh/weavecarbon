export type ReportingIndustry =
  | 'Agriculture'
  | 'Steel'
  | 'Cement'
  | 'Construction Materials'
  | 'Aluminium'
  | 'Chemicals'
  | 'Mining & Minerals';

export type MarketGroup = 'Vietnam' | 'European Union' | 'Global' | 'Buyer / Contract';
export type LegalNature = 'regulatory' | 'standard' | 'contractual' | 'readiness';

export interface AuthoritativeReference {
  label: string;
  url: string;
  statusVi: string;
  statusEn: string;
}

export interface LegalMarketProfile {
  code: string;
  reportProfileCode: string;
  market: MarketGroup;
  nature: LegalNature;
  titleVi: string;
  titleEn: string;
  shortVi: string;
  shortEn: string;
  legalStatusVi: string;
  legalStatusEn: string;
  scopeVi: string;
  scopeEn: string;
  applicableIndustries: ReportingIndustry[];
  industryNoteVi?: string;
  industryNoteEn?: string;
  requiredDataGroups: string[];
  reportSectionsVi: string[];
  reportSectionsEn: string[];
  officialSubmissionVi: string;
  officialSubmissionEn: string;
  verificationVi: string;
  verificationEn: string;
  references: AuthoritativeReference[];
}

export const REPORTING_REGISTRY_REVIEW_DATE = '2026-09-13';

const allIndustries: ReportingIndustry[] = [
  'Agriculture',
  'Steel',
  'Cement',
  'Construction Materials',
  'Aluminium',
  'Chemicals',
  'Mining & Minerals',
];

const commonOrgSectionsVi = [
  'Thông tin đơn vị và kỳ báo cáo',
  'Ranh giới tổ chức và ranh giới báo cáo',
  'Nguồn phát thải và dữ liệu hoạt động',
  'Phương pháp định lượng, hệ số và GWP',
  'Kết quả phát thải theo Scope / nguồn',
  'QA/QC, khoảng trống dữ liệu và bất định',
  'Bằng chứng, phiên bản tính và lịch sử rà soát',
  'Tuyên bố giới hạn và trạng thái xác minh',
];

const commonOrgSectionsEn = [
  'Entity and reporting period',
  'Organisational and reporting boundaries',
  'Emission sources and activity data',
  'Quantification methodology, factors and GWP basis',
  'Emissions by scope / source',
  'QA/QC, data gaps and uncertainty',
  'Evidence, calculation version and review history',
  'Limitations and verification status',
];

const commonProductSectionsVi = [
  'Nhận diện sản phẩm / SKU và đơn vị chức năng',
  'Ranh giới hệ thống và vòng đời áp dụng',
  'BOM, quy trình, năng lượng và logistics',
  'Quy tắc phân bổ và phương pháp tính',
  'Hệ số phát thải và snapshot phiên bản',
  'Kết quả PCF / cường độ carbon',
  'Chất lượng dữ liệu và bằng chứng',
  'Tuyên bố giới hạn, giả định và trạng thái xác minh',
];

const commonProductSectionsEn = [
  'Product / SKU identity and functional unit',
  'System boundary and lifecycle coverage',
  'BOM, process, energy and logistics data',
  'Allocation rules and calculation method',
  'Emission factors and immutable factor snapshot',
  'PCF / carbon intensity result',
  'Data quality and evidence',
  'Limitations, assumptions and verification status',
];

export const legalMarketProfiles: LegalMarketProfile[] = [
  {
    code: 'VN_GHG_CURRENT',
    reportProfileCode: 'VN_GHG_INVENTORY',
    market: 'Vietnam',
    nature: 'regulatory',
    titleVi: 'Kiểm kê GHG cấp cơ sở — Việt Nam',
    titleEn: 'Vietnam facility GHG inventory',
    shortVi: 'Hồ sơ kiểm kê/MRV cho cơ sở thuộc phạm vi pháp lý tại Việt Nam.',
    shortEn: 'Inventory/MRV package for facilities legally in scope in Vietnam.',
    legalStatusVi: 'Bắt buộc khi cơ sở thuộc danh mục áp dụng. Tại ngày 13/09/2026, Quyết định 13/2024/QĐ-TTg vẫn là danh mục đang có hiệu lực; Quyết định 42/2026/QĐ-TTg có hiệu lực từ 25/09/2026.',
    legalStatusEn: 'Mandatory when the facility is legally in scope. As of 13 Sep 2026, Decision 13/2024/QD-TTg remains the effective list; Decision 42/2026/QD-TTg takes effect on 25 Sep 2026.',
    scopeVi: 'Cấp cơ sở / tổ chức; ranh giới, nguồn phát thải, activity data, hệ số, tính toán, QA/QC và bằng chứng.',
    scopeEn: 'Facility / organisation level; boundary, sources, activity data, factors, calculations, QA/QC and evidence.',
    applicableIndustries: allIndustries,
    industryNoteVi: 'Phải kiểm tra từng cơ sở theo danh mục có hiệu lực và không suy diễn chỉ từ tên ngành.',
    industryNoteEn: 'Applicability must be checked facility-by-facility against the effective list, not inferred from the industry name alone.',
    requiredDataGroups: ['boundary','activity_data','factor_registry','calculation','evidence','QA_QC','review_history'],
    reportSectionsVi: commonOrgSectionsVi,
    reportSectionsEn: commonOrgSectionsEn,
    officialSubmissionVi: 'WeaveCarbon chuẩn bị hồ sơ dữ liệu/MRV. Việc nộp chính thức thực hiện theo cơ quan/hệ thống có thẩm quyền; WeaveCarbon không phải cơ quan tiếp nhận.',
    officialSubmissionEn: 'WeaveCarbon prepares the data/MRV package. Official filing remains with the competent authority/system; WeaveCarbon is not the filing authority.',
    verificationVi: 'Trạng thái verification-ready; xác minh độc lập chỉ được ghi nhận khi có đơn vị xác minh đủ thẩm quyền.',
    verificationEn: 'Verification-ready status only; independent verification is recorded only when performed by an authorised external verifier.',
    references: [
      { label: 'Decision 13/2024/QD-TTg', url: 'https://vanban.chinhphu.vn/?docid=210939&pageid=27160', statusVi: 'Đang có hiệu lực tại 13/09/2026', statusEn: 'Effective as of 13 Sep 2026' },
      { label: 'Decision 42/2026/QD-TTg', url: 'https://vanban.chinhphu.vn/?classid=0&docid=219154&pageid=27160', statusVi: 'Có hiệu lực 25/09/2026', statusEn: 'Effective 25 Sep 2026' },
      { label: 'Decree 06/2022/ND-CP', url: 'https://vanban.chinhphu.vn/?docid=205039&pageid=27160', statusVi: 'Khung giảm nhẹ phát thải/MRV', statusEn: 'GHG mitigation/MRV framework' },
      { label: 'Decree 119/2025/ND-CP', url: 'https://vanban.chinhphu.vn/?classid=1&docid=213875&orggroupid=2&pageid=27160', statusVi: 'Sửa đổi NĐ 06/2022', statusEn: 'Amends Decree 06/2022' },
      { label: 'Decree 83/2026/ND-CP', url: 'https://vanban.chinhphu.vn/?classid=0&docid=217277&pageid=27160', statusVi: 'Sửa đổi tiếp khung hiện hành', statusEn: 'Further amendment to the current framework' },
    ],
  },
  {
    code: 'VN_ALLOWANCE_PILOT',
    reportProfileCode: 'VN_GHG_INVENTORY',
    market: 'Vietnam',
    nature: 'regulatory',
    titleVi: 'MRV & đối soát hạn ngạch — giai đoạn thí điểm Việt Nam',
    titleEn: 'Vietnam pilot allowance MRV & reconciliation',
    shortVi: 'Theo dõi hạn ngạch được cơ quan có thẩm quyền phân bổ và phát thải đã rà soát.',
    shortEn: 'Tracks authority-allocated allowances against reviewed emissions.',
    legalStatusVi: 'Chỉ áp dụng cho cơ sở thuộc danh sách thí điểm; không phải mọi cơ sở trong ngành đều có hạn ngạch.',
    legalStatusEn: 'Applies only to facilities included in the pilot allocation; not every facility in these sectors receives an allowance.',
    scopeVi: 'Hạn ngạch tham chiếu, phát thải đã rà soát/xác minh, kỳ/vintage, trạng thái nộp trả và lịch sử thay đổi.',
    scopeEn: 'Allocation reference, reviewed/verified emissions, period/vintage, surrender status and change history.',
    applicableIndustries: ['Steel','Cement'],
    industryNoteVi: 'Quyết định 699/QĐ-BNNMT áp dụng cho 110 cơ sở thuộc nhiệt điện, xi măng và sắt thép; demo WeaveCarbon hiện có xi măng và thép.',
    industryNoteEn: 'Decision 699/QD-BNNMT covers 110 facilities in thermal power, cement and iron/steel; the current WeaveCarbon demo includes cement and steel.',
    requiredDataGroups: ['facility_emissions','allocation_reference','verification_status','registry_reference','surrender_status','evidence'],
    reportSectionsVi: ['Nhận diện cơ sở và kỳ hạn ngạch','Tham chiếu quyết định phân bổ','Phát thải đối soát','Chênh lệch hạn ngạch/phát thải','Trạng thái xác minh','Bằng chứng và phê duyệt','Trạng thái nộp trả/đăng ký'],
    reportSectionsEn: ['Facility and allowance period','Allocation decision reference','Reconciled emissions','Allowance/emissions variance','Verification status','Evidence and approval','Registry/surrender status'],
    officialSubmissionVi: 'WeaveCarbon không phát hành hạn ngạch, tín chỉ hoặc thực hiện giao dịch thay sàn/registry.',
    officialSubmissionEn: 'WeaveCarbon does not issue allowances/credits or execute registry/exchange transactions.',
    verificationVi: 'Dữ liệu phát thải phải giữ đường dẫn bằng chứng và trạng thái xác minh theo yêu cầu áp dụng.',
    verificationEn: 'Emissions data retains evidence lineage and the applicable verification status.',
    references: [
      { label: 'Decision 699/QD-BNNMT', url: 'https://dcc.mae.gov.vn/Pages/chi-tiet-tin-DCC.aspx?ItemID=3881&cm=0&mn=0', statusVi: 'Thí điểm phân bổ 2025–2026', statusEn: 'Pilot allocation for 2025–2026' },
      { label: 'Decree 29/2026/ND-CP', url: 'https://vanban.chinhphu.vn/?classid=1&docid=216694&pageid=27160&typegroupid=4', statusVi: 'Sàn giao dịch các-bon trong nước', statusEn: 'Domestic carbon exchange framework' },
    ],
  },
  {
    code: 'EU_CBAM_2026',
    reportProfileCode: 'EU_CBAM_2026',
    market: 'European Union',
    nature: 'regulatory',
    titleVi: 'EU CBAM — definitive regime 2026',
    titleEn: 'EU CBAM — definitive regime 2026',
    shortVi: 'Hồ sơ embedded emissions cho hàng hóa thuộc phạm vi CBAM; không áp dụng mặc định cho mọi sản phẩm xuất EU.',
    shortEn: 'Embedded-emissions package for CBAM-covered goods; not a blanket rule for all EU exports.',
    legalStatusVi: 'Quy định bắt buộc đối với hàng hóa/CN code nằm trong phạm vi CBAM và các chủ thể có nghĩa vụ theo quy định EU.',
    legalStatusEn: 'Mandatory for goods/CN codes within CBAM scope and the obligated economic operators under EU rules.',
    scopeVi: 'CN code, lượng hàng, installation, production route, embedded emissions, methodology, verification và carbon price paid khi có.',
    scopeEn: 'CN code, goods quantity, installation, production route, embedded emissions, methodology, verification and carbon price paid where applicable.',
    applicableIndustries: ['Steel','Cement','Aluminium','Chemicals'],
    industryNoteVi: 'CBAM hiện bao phủ cement, iron & steel, aluminium, fertilisers, electricity và hydrogen. Với Chemicals chỉ đánh dấu áp dụng khi sản phẩm thực tế là fertiliser thuộc CN code được bao phủ. Nông sản (cà phê, gạo, cao su) không phải ngành CBAM; áp dụng EUDR cho cà phê/cao su.',
    industryNoteEn: 'CBAM currently covers cement, iron & steel, aluminium, fertilisers, electricity and hydrogen. Chemicals are only marked applicable when the actual good is a covered fertiliser CN code. Agricultural goods (coffee, rice, rubber) are not CBAM sectors; EUDR applies to coffee/rubber.',
    requiredDataGroups: ['CN_code','goods_quantity','installation','production_route','embedded_emissions','factor_method','verification','evidence','carbon_price_paid'],
    reportSectionsVi: ['Thông tin declarant/importer tham chiếu','CN code và mô tả hàng hóa','Installation/operator và production route','Lượng hàng nhập khẩu','Direct/indirect embedded emissions theo quy tắc áp dụng','Methodology và dữ liệu thực tế/default value','Verification status và evidence pack','Carbon price paid (nếu có)','Phụ lục truy vết tính toán'],
    reportSectionsEn: ['Declarant/importer reference','CN code and goods description','Installation/operator and production route','Imported quantity','Direct/indirect embedded emissions under applicable rules','Methodology and actual/default values','Verification status and evidence pack','Carbon price paid where applicable','Calculation lineage annex'],
    officialSubmissionVi: 'WeaveCarbon tạo declaration preparation pack; hồ sơ chính thức thuộc authorised CBAM declarant và EU CBAM Registry.',
    officialSubmissionEn: 'WeaveCarbon creates a declaration preparation pack; official filing belongs to the authorised CBAM declarant via the EU CBAM Registry.',
    verificationVi: 'Không tự gắn verified. Kết quả chỉ chuyển sang verified khi có báo cáo xác minh theo khung CBAM áp dụng.',
    verificationEn: 'No self-declared verified status. Verified is shown only when an applicable CBAM verification report exists.',
    references: [
      { label: 'Regulation (EU) 2023/956', url: 'https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32023R0956', statusVi: 'Quy định CBAM nền tảng', statusEn: 'Core CBAM Regulation' },
      { label: 'EC — CBAM definitive regime', url: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en', statusVi: 'Definitive regime từ 01/01/2026', statusEn: 'Definitive regime from 1 Jan 2026' },
      { label: 'EC — CBAM sectors & 2026 guidance', url: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-sectors_en', statusVi: 'Hướng dẫn theo 6 nhóm ngành', statusEn: 'Sector guidance for the six CBAM sectors' },
      { label: 'EC — legislation & guidance', url: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-legislation-and-guidance_en', statusVi: 'Implementing acts, default values, benchmarks', statusEn: 'Implementing acts, default values and benchmarks' },
    ],
  },
  {
    code: 'GHG_CORPORATE',
    reportProfileCode: 'GHG_CORPORATE',
    market: 'Global',
    nature: 'standard',
    titleVi: 'GHG Protocol Corporate Inventory',
    titleEn: 'GHG Protocol Corporate Inventory',
    shortVi: 'Báo cáo GHG cấp tổ chức/doanh nghiệp; là chuẩn hạch toán, không mặc nhiên là hồ sơ pháp lý nhà nước.',
    shortEn: 'Organisation-level GHG accounting; an accounting standard, not automatically a government filing.',
    legalStatusVi: 'Tiêu chuẩn/hệ quy chiếu thị trường; có thể trở thành yêu cầu theo hợp đồng, buyer, lender hoặc chương trình báo cáo.',
    legalStatusEn: 'Market/accounting standard; may become required through contracts, buyers, lenders or reporting programmes.',
    scopeVi: 'Ranh giới tổ chức, Scope 1, Scope 2, base year, phương pháp, recalculation policy và disclosure.',
    scopeEn: 'Organisational boundary, Scope 1, Scope 2, base year, methodology, recalculation policy and disclosure.',
    applicableIndustries: allIndustries,
    requiredDataGroups: ['boundary','Scope1','Scope2','base_year','methodology','factor_registry','evidence'],
    reportSectionsVi: commonOrgSectionsVi,
    reportSectionsEn: commonOrgSectionsEn,
    officialSubmissionVi: 'WeaveCarbon tạo inventory/reporting package; nơi nộp phụ thuộc chương trình hoặc bên yêu cầu.',
    officialSubmissionEn: 'WeaveCarbon generates an inventory/reporting package; submission destination depends on the requesting programme or counterparty.',
    verificationVi: 'Assurance là lớp độc lập và không được suy ra chỉ từ việc tính toán theo GHG Protocol.',
    verificationEn: 'Assurance is separate and is not implied by using the GHG Protocol accounting framework.',
    references: [
      { label: 'GHG Protocol Corporate Standard', url: 'https://ghgprotocol.org/corporate-standard', statusVi: 'Chuẩn hạch toán cấp tổ chức', statusEn: 'Organisation-level accounting standard' },
    ],
  },
  {
    code: 'ISO_14064_1',
    reportProfileCode: 'ISO_14064_1',
    market: 'Global',
    nature: 'standard',
    titleVi: 'ISO 14064-1:2018 — hồ sơ GHG cấp tổ chức',
    titleEn: 'ISO 14064-1:2018 — organisation GHG package',
    shortVi: 'Hồ sơ định lượng và báo cáo GHG cấp tổ chức theo ISO 14064-1:2018.',
    shortEn: 'Organisation-level GHG quantification and reporting package aligned with ISO 14064-1:2018.',
    legalStatusVi: 'Tiêu chuẩn quốc tế; không thay thế nghĩa vụ của chương trình pháp lý cụ thể.',
    legalStatusEn: 'International standard; does not replace programme-specific legal obligations.',
    scopeVi: 'Thiết kế, quản lý, định lượng, báo cáo và chuẩn bị xác minh kiểm kê GHG cấp tổ chức.',
    scopeEn: 'Design, management, quantification, reporting and verification readiness for an organisation GHG inventory.',
    applicableIndustries: allIndustries,
    requiredDataGroups: ['boundary','sources_sinks','quantification','uncertainty','QA_QC','evidence'],
    reportSectionsVi: commonOrgSectionsVi,
    reportSectionsEn: commonOrgSectionsEn,
    officialSubmissionVi: 'WeaveCarbon tạo gói dữ liệu aligned; chứng nhận/xác minh do bên độc lập thực hiện.',
    officialSubmissionEn: 'WeaveCarbon produces an aligned data package; certification/verification remains external.',
    verificationVi: 'ISO alignment không đồng nghĩa với certification.',
    verificationEn: 'ISO alignment does not imply certification.',
    references: [
      { label: 'ISO 14064-1:2018', url: 'https://www.iso.org/standard/66453.html', statusVi: 'Bản hiện hành; đang có dự thảo sửa đổi', statusEn: 'Current published edition; revision work is underway' },
    ],
  },
  {
    code: 'GHG_SCOPE3',
    reportProfileCode: 'GHG_SCOPE3',
    market: 'Global',
    nature: 'standard',
    titleVi: 'GHG Protocol Scope 3',
    titleEn: 'GHG Protocol Scope 3',
    shortVi: 'Báo cáo chuỗi giá trị và dữ liệu nhà cung cấp cấp doanh nghiệp.',
    shortEn: 'Corporate value-chain and supplier emissions reporting.',
    legalStatusVi: 'Chuẩn hạch toán chuỗi giá trị; thường được buyer/chương trình disclosure sử dụng.',
    legalStatusEn: 'Value-chain accounting standard commonly used by buyers and disclosure programmes.',
    scopeVi: 'Supplier data, purchased goods, transport, waste và category mapping theo bối cảnh doanh nghiệp.',
    scopeEn: 'Supplier data, purchased goods, transport, waste and category mapping in the corporate context.',
    applicableIndustries: allIndustries,
    requiredDataGroups: ['supplier_data','purchased_goods','transport','waste','category_mapping','evidence'],
    reportSectionsVi: commonOrgSectionsVi,
    reportSectionsEn: commonOrgSectionsEn,
    officialSubmissionVi: 'Đầu ra phục vụ báo cáo doanh nghiệp/buyer; không phải giấy phép hoặc tờ khai nhà nước mặc định.',
    officialSubmissionEn: 'Output supports corporate/buyer reporting; it is not a government permit or filing by default.',
    verificationVi: 'Giữ rõ primary/proxy/self-reported/evidence-backed; không biến proxy thành primary data.',
    verificationEn: 'Primary/proxy/self-reported/evidence-backed status remains explicit; proxies are never presented as primary data.',
    references: [
      { label: 'GHG Protocol Scope 3 Standard', url: 'https://ghgprotocol.org/scope-3-calculation-guidance-2', statusVi: 'Chuẩn chuỗi giá trị', statusEn: 'Corporate value-chain standard' },
    ],
  },
  {
    code: 'ISO_14067',
    reportProfileCode: 'ISO_14067',
    market: 'Global',
    nature: 'standard',
    titleVi: 'ISO 14067:2018 — Product Carbon Footprint',
    titleEn: 'ISO 14067:2018 — Product Carbon Footprint',
    shortVi: 'Gói PCF cấp sản phẩm dựa trên nguyên tắc LCA.',
    shortEn: 'Product-level PCF package based on LCA principles.',
    legalStatusVi: 'Tiêu chuẩn quốc tế về định lượng CFP; không tự tạo certification và không thay thế PCR/quy tắc ngành khi chúng được yêu cầu.',
    legalStatusEn: 'International CFP quantification standard; does not itself create certification or replace required PCR/sector rules.',
    scopeVi: 'Functional unit, system boundary, lifecycle activity data, allocation, factors, PCF result và evidence.',
    scopeEn: 'Functional unit, system boundary, lifecycle activity data, allocation, factors, PCF result and evidence.',
    applicableIndustries: allIndustries,
    requiredDataGroups: ['goal_scope','functional_unit','system_boundary','BOM','activity_data','allocation','factor_registry','evidence'],
    reportSectionsVi: commonProductSectionsVi,
    reportSectionsEn: commonProductSectionsEn,
    officialSubmissionVi: 'Đầu ra là PCF preparation/alignment package; buyer/PCR/programme quyết định format cuối.',
    officialSubmissionEn: 'Output is a PCF preparation/alignment package; the buyer/PCR/programme determines the final format.',
    verificationVi: 'Chỉ ghi verified khi có verification statement độc lập phù hợp.',
    verificationEn: 'Verified status is shown only when an appropriate independent verification statement exists.',
    references: [
      { label: 'ISO 14067:2018', url: 'https://www.iso.org/standard/71206.html', statusVi: 'Bản hiện hành, được xác nhận lại năm 2024', statusEn: 'Current published edition, confirmed in 2024' },
      { label: 'GHG Protocol Product Standard', url: 'https://ghgprotocol.org/product-standard', statusVi: 'Tham chiếu PCF bổ sung', statusEn: 'Complementary product-accounting reference' },
    ],
  },
  {
    code: 'EU_DPP_READINESS',
    reportProfileCode: 'DPP_READINESS',
    market: 'European Union',
    nature: 'readiness',
    titleVi: 'EU Digital Product Passport — readiness',
    titleEn: 'EU Digital Product Passport — readiness',
    shortVi: 'Chuẩn bị dữ liệu DPP theo ESPR; không gắn nhãn “đã tuân thủ DPP” nếu delegated act của nhóm sản phẩm chưa áp dụng.',
    shortEn: 'Prepare DPP data under ESPR; do not claim DPP compliance before the relevant product-group delegated act applies.',
    legalStatusVi: 'ESPR tạo khung DPP, còn trường dữ liệu/ngày áp dụng cụ thể phụ thuộc delegated act của từng nhóm sản phẩm.',
    legalStatusEn: 'ESPR establishes the DPP framework; concrete data fields and application dates depend on product-group delegated acts.',
    scopeVi: 'Product identifier, data carrier, manufacturer/operator, facility/product provenance, compliance documents và product-specific fields khi được quy định.',
    scopeEn: 'Product identifier, data carrier, manufacturer/operator, facility/product provenance, compliance documents and product-specific fields when specified.',
    applicableIndustries: ['Steel','Aluminium','Construction Materials'],
    industryNoteVi: 'Đây là readiness layer. Không trình bày thép, nhôm hay vật liệu xây dựng là đã có một DPP template chung bắt buộc cho mọi sản phẩm.',
    industryNoteEn: 'This is a readiness layer. Steel, aluminium and construction materials must not be presented as having one universal mandatory DPP template for every product.',
    requiredDataGroups: ['product_identity','unique_identifier','material_composition','supplier_provenance','facility_identity','compliance_documents','product_specific_fields'],
    reportSectionsVi: ['Nhận diện sản phẩm','Unique product identifier & data carrier','Nhà sản xuất/operator/facility','Thành phần và provenance','Tài liệu tuân thủ liên quan','Trường dữ liệu theo delegated act','Quyền truy cập & thời hạn dữ liệu','Readiness gaps'],
    reportSectionsEn: ['Product identity','Unique product identifier & data carrier','Manufacturer/operator/facility','Composition and provenance','Applicable compliance documents','Delegated-act-specific data fields','Access and data-retention rules','Readiness gaps'],
    officialSubmissionVi: 'WeaveCarbon tạo readiness/data package; không tự tuyên bố sản phẩm đáp ứng DPP khi quy tắc sản phẩm chưa được xác định/áp dụng.',
    officialSubmissionEn: 'WeaveCarbon creates a readiness/data package; it does not self-declare DPP compliance before product rules are defined/applicable.',
    verificationVi: 'Kiểm tra completeness/traceability, không thay thế market surveillance/conformity assessment.',
    verificationEn: 'Checks completeness/traceability; does not replace market surveillance or conformity assessment.',
    references: [
      { label: 'Regulation (EU) 2024/1781 — ESPR', url: 'https://eur-lex.europa.eu/eli/reg/2024/1781/eng', statusVi: 'Khung DPP của EU', statusEn: 'EU DPP framework' },
    ],
  },
  {
    code: 'BUYER_PCF',
    reportProfileCode: 'BUYER_PCF',
    market: 'Buyer / Contract',
    nature: 'contractual',
    titleVi: 'Buyer / supplier carbon evidence package',
    titleEn: 'Buyer / supplier carbon evidence package',
    shortVi: 'Gói dữ liệu theo schema/điều khoản buyer cho sản phẩm hoặc nhà cung cấp.',
    shortEn: 'Data package shaped by the buyer schema/contract for a product or supplier.',
    legalStatusVi: 'Nghĩa vụ theo hợp đồng/yêu cầu thương mại, không phải một luật chung áp dụng cho mọi buyer.',
    legalStatusEn: 'Contractual/commercial requirement, not one universal law applying to every buyer.',
    scopeVi: 'PCF, supplier data, evidence, methodology, product identity, requested schema và review status.',
    scopeEn: 'PCF, supplier data, evidence, methodology, product identity, requested schema and review status.',
    applicableIndustries: allIndustries,
    requiredDataGroups: ['product_intensity','supplier_data','methodology','evidence','requested_schema','review_status'],
    reportSectionsVi: commonProductSectionsVi,
    reportSectionsEn: commonProductSectionsEn,
    officialSubmissionVi: 'Xuất theo schema do buyer/chương trình quy định; không gắn nhãn regulatory filing.',
    officialSubmissionEn: 'Export follows the buyer/programme schema; it is not labelled as a regulatory filing.',
    verificationVi: 'Assurance/verification chỉ hiển thị nếu buyer yêu cầu và có bằng chứng tương ứng.',
    verificationEn: 'Assurance/verification is shown only when required and supported by evidence.',
    references: [],
  },
];

export const reportingIndustries: ReportingIndustry[] = allIndustries;

export function getLegalProfile(code: string) {
  return legalMarketProfiles.find((profile) => profile.reportProfileCode === code || profile.code === code);
}
