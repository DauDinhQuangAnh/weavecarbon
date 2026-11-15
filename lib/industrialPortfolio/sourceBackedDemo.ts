/* eslint-disable @typescript-eslint/no-explicit-any -- ported 1:1 from the Lovable demo data layer (schemaless snapshot rows); typed at the module boundary. */
export type DemoUseCase = {
  industry: string;
  primary_problem: string;
  domestic_output: string;
  export_output: string;
  input_groups: string[];
  standards: string[];
  demo_path: string;
  notes: string | null;
};

export type DemoPublicInput = {
  id: string;
  industry: string;
  metric: string;
  value: number;
  unit: string;
  reporting_period: string;
  source_key: string;
  source_entity: string | null;
  source_granularity: string;
  use_case: string;
  accounting_scope: string | null;
  confidence: string;
  notes: string | null;
};

export type DemoSource = {
  source_key: string;
  title: string;
  publisher: string;
  source_url: string;
  reporting_period: string | null;
  source_type: string;
};

export const FALLBACK_USE_CASES: DemoUseCase[] = [
  { industry:'Aluminium', primary_problem:'Electricity/production route and product CN code materially change export-carbon treatment.', domestic_output:'Facility inventory and process energy allocation.', export_output:'EU CBAM for covered aluminium CN codes and buyer PCF.', input_groups:['electricity','billet/input metal','fuel','production route','output','CN code'], standards:['GHG Protocol','ISO 14064-1','EU CBAM'], demo_path:'/dashboard/cbam-report', notes:'Official EU CBAM reference data is used where public plant activity data is not asserted.' },
  { industry:'Cement', primary_problem:'Process emissions from calcination and kiln fuel require process-specific data, not only energy bills.', domestic_output:'Vietnam GHG inventory/MRV and kiln/clinker intensity.', export_output:'EU CBAM for covered cement goods; ISO/GHG evidence package.', input_groups:['limestone/raw meal','clinker output','kiln fuel','electricity','clinker factor'], standards:['Vietnam GHG/MRV','ISO 14064-1','EU CBAM'], demo_path:'/dashboard/processes', notes:'Siam City Cement Vietnam public metrics provide source-backed intensity and energy inputs.' },
  { industry:'Construction Materials', primary_problem:'Product carbon and electricity-heavy processing need evidence-backed corporate and product allocation.', domestic_output:'Corporate inventory and energy hotspot.', export_output:'Buyer PCF / ISO 14067 for exported engineered-stone/building products.', input_groups:['electricity','fuel','raw material','production','waste','logistics'], standards:['GHG Protocol','ISO 14064-1','ISO 14067'], demo_path:'/dashboard/products', notes:'Vicostone public GHG figures are used as source-backed input examples.' },
  { industry:'Fertilisers & Chemicals', primary_problem:'Natural gas can be both fuel and feedstock, so source classification and process boundaries matter.', domestic_output:'Vietnam GHG inventory/MRV and Scope 1/2/3 source separation.', export_output:'EU CBAM for covered fertilisers plus buyer/ISO evidence.', input_groups:['natural gas fuel','natural gas feedstock','electricity','production','nitrogen content'], standards:['GHG Protocol','ISO 14064-1','EU CBAM'], demo_path:'/dashboard/activity-data', notes:'PVCFC public indicators demonstrate source-backed company inputs.' },
  { industry:'Mining & Minerals', primary_problem:'Diesel/electricity-intensive extraction and processing create dispersed source data and evidence gaps.', domestic_output:'Facility inventory, energy/resource intensity and mitigation tracking.', export_output:'Supplier evidence / buyer PCF upstream data.', input_groups:['diesel','electricity','blasting','haulage','ore processed','waste'], standards:['GHG Protocol','ISO 14064-1'], demo_path:'/dashboard/facilities', notes:'Masan High-Tech Materials public disclosures are used as source-backed input examples.' },
  { industry:'Steel', primary_problem:'High Scope 1/process emissions plus MRV/quota pressure and EU CBAM for covered goods.', domestic_output:'Vietnam GHG inventory/MRV, process intensity, energy recovery evidence.', export_output:'EU CBAM installation/goods package + verifier evidence.', input_groups:['coke/coal','ore/scrap','electricity','waste heat power','production route','output'], standards:['Vietnam GHG/MRV','ISO 14064-1','EU CBAM'], demo_path:'/dashboard/cbam-report', notes:'Hoa Phat public electricity-generation figures demonstrate source-backed operational evidence inputs.' },
  { industry:'Agriculture', primary_problem:'EU buyers require product-level carbon plus EUDR geolocation/deforestation-free evidence while farm and cooperative data is fragmented.', domestic_output:'Facility GHG inventory for processing plants, drying-fuel hotspot and evidence completeness.', export_output:'Buyer PCF, ISO 14067 package and EUDR due-diligence readiness.', input_groups:['fertiliser','electricity','fuel','water','wastewater','farm/plot','production','cooperative','logistics'], standards:['GHG Protocol','ISO 14064-1','ISO 14067'], demo_path:'/dashboard/products', notes:'Farm-input and processing data are synthetic demo values; product-specific allocation remains a demo calculation.' },
];

const rawInputs: any[][] = [
  ['REAL-AL-01','Aluminium','CBAM Vietnam default direct emissions - CN 7604 29 90 reference',2.04,'tCO2e/t product','2026','SRC-EU-CBAM-2026','EU CBAM Vietnam default table','regulatory_reference','EU CBAM default-value workflow','CBAM','regulatory_reference'],
  ['REAL-CEM-01','Cement','Gross direct GHG emissions',1.28,'million tCO2','2024','SRC-SCCC-VN-2024','Siam City Cement Vietnam','country_operation','Vietnam GHG / ISO / CBAM preparation','Scope 1','public_disclosure'],
  ['REAL-CEM-02','Cement','Specific net CO2 emissions',375,'kgCO2/t cementitious material','2024','SRC-SCCC-VN-2024','Siam City Cement Vietnam','country_operation','Process/product intensity','Product','public_disclosure'],
  ['REAL-CEM-03','Cement','Total energy consumption',3457.1,'MJ/t clinker','2024','SRC-SCCC-VN-2024','Siam City Cement Vietnam','country_operation','Kiln energy intensity','Process','public_disclosure'],
  ['REAL-CEM-04','Cement','Electricity consumption',72.43,'kWh/t cement','2024','SRC-SCCC-VN-2024','Siam City Cement Vietnam','country_operation','Scope 2 and process intensity','Scope 2','public_disclosure'],
  ['REAL-MAT-01','Construction Materials','Direct GHG emissions',847.53,'tCO2e','2023','SRC-VICOSTONE-2023','Vicostone','company','Corporate inventory','Scope 1','public_disclosure'],
  ['REAL-MAT-02','Construction Materials','Indirect electricity emissions',8726.92,'tCO2e','2023','SRC-VICOSTONE-2023','Vicostone','company','Scope 2 reconciliation','Scope 2','public_disclosure'],
  ['REAL-MAT-03','Construction Materials','Total GHG emissions',9574.45,'tCO2e','2023','SRC-VICOSTONE-2023','Vicostone','company','Inventory reconciliation','Scope 1+2','public_disclosure'],
  ['REAL-REF-01','Cross-industry','Vietnam grid emission factor',0.6592,'tCO2/MWh','2023','SRC-VN-GRID-2023','Vietnam national grid','national_factor','Vietnam Scope 2 calculation','Scope 2','official_factor'],
  ['REAL-REF-02','Cross-industry','Natural gas factor - gross CV',0.18231,'kgCO2e/kWh','2026','SRC-UK-EF-2026','UK Government conversion factors','official_factor','Transparent factor-library example','Scope 1','official_factor'],
  ['REAL-REF-03','Cross-industry','Diesel average biofuel blend factor',2.58354,'kgCO2e/litre','2026','SRC-UK-EF-2026','UK Government conversion factors','official_factor','Transparent factor-library example','Scope 1','official_factor'],
  ['REAL-CH-01','Fertilisers & Chemicals','Natural gas consumption',561.76,'million m3/year','2024','SRC-PVCFC-2024','PVCFC consolidated units','group_aggregate','Fuel/feedstock activity-data mapping','Scope 1 / Scope 3','public_disclosure'],
  ['REAL-CH-02','Fertilisers & Chemicals','Electricity consumption',212.86,'million kWh/year','2024','SRC-PVCFC-2024','PVCFC consolidated units','group_aggregate','Scope 2 / production allocation','Scope 2','public_disclosure'],
  ['REAL-CH-03','Fertilisers & Chemicals','Scope 1 emissions',397890.54,'tCO2e/year','2024','SRC-PVCFC-2024','PVCFC parent company','company','Inventory reconciliation','Scope 1','public_disclosure'],
  ['REAL-CH-04','Fertilisers & Chemicals','Scope 2 emissions',129614.89,'tCO2e/year','2024','SRC-PVCFC-2024','PVCFC parent company','company','Inventory reconciliation','Scope 2','public_disclosure'],
  ['REAL-MIN-01','Mining & Minerals','NPMC and MTC energy consumption',827407,'GJ','2024','SRC-MHT-2024','Nui Phao Mining Company + MTC','operations','Energy/activity data ingestion','Energy','public_disclosure'],
  ['REAL-MIN-02','Mining & Minerals','Direct GHG emissions',20413,'tCO2e','2024','SRC-MHT-2024','NPMC and MTC','operations','Corporate/facility inventory','Scope 1','public_disclosure'],
  ['REAL-STL-01','Steel','Waste-heat self-generated electricity',3180000000,'kWh','2024','SRC-HPG-2024','Hoa Phat steel complexes','multi_facility','Energy provenance / avoided purchased electricity dependency','Energy','public_disclosure'],
  ['REAL-STL-02','Steel','Dung Quat self-generated electricity',2390000000,'kWh','2024','SRC-HPG-2024','Hoa Phat Dung Quat Steel Complex','facility_public_disclosure','Facility energy evidence','Energy','public_disclosure'],
  ['REAL-STL-03','Steel','Hai Duong self-generated electricity',788000000,'kWh','2024','SRC-HPG-2024','Hoa Phat Hai Duong Steel Complex','facility_public_disclosure','Facility energy evidence','Energy','public_disclosure'],
];

export const FALLBACK_INPUTS: DemoPublicInput[] = rawInputs.map(([id,industry,metric,value,unit,reporting_period,source_key,source_entity,source_granularity,use_case,accounting_scope,confidence]) => ({
  id, industry, metric, value, unit, reporting_period, source_key, source_entity, source_granularity, use_case, accounting_scope, confidence, notes:null,
}));

const rawSources: any[][] = [
  ['SRC-VN-GRID-2023','Công bố hệ số phát thải lưới điện Việt Nam năm 2023','Cục Biến đổi khí hậu','https://thuvienphapluat.vn/cong-van/Tai-nguyen-Moi-truong/Cong-van-1726-BDKH-PTCBT-2024-cong-bo-ket-qua-tinh-toan-he-so-phat-thai-luoi-dien-2023-697510.aspx','2023','official_factor'],
  ['SRC-EU-CBAM-2026','EU CBAM definitive regime and 2026 default values','European Commission','https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/cbam-definitive-regime_en','2026','regulatory_reference'],
  ['SRC-HPG-2024','Hoa Phat Annual Report 2024 - waste heat electricity generation','Hoa Phat Group','https://file.hoaphat.com.vn/hoaphat-com-vn/2025/04/hpg-annual-report-2024.pdf','2024','company_public_disclosure'],
  ['SRC-MHT-2024','Masan High-Tech Materials Sustainability Report 2024','Masan High-Tech Materials','https://masanhightechmaterials.com/investor_center/2024-sustainability-report/','2024','company_public_disclosure'],
  ['SRC-VN-IIP-2026','Vietnam Index of Industrial Production, Jan-Aug 2026','National Statistics Office of Vietnam','https://www.nso.gov.vn/en/iip/','Jan-Aug 2026','official_statistics'],
  ['SRC-PVCFC-2024','PVCFC Sustainability Report 2024 - energy and GHG data','Petrovietnam Ca Mau Fertilizer JSC','https://www.pvcfc.com.vn/Data/Sites/1/media/ptbv/20250527---dcm---sr-2024---en.pdf','2024','company_public_disclosure'],
  ['SRC-SCCC-VN-2024','Siam City Cement Sustainability Report 2024 - Vietnam environmental performance','Siam City Cement','https://www.siamcitycement.com/ckeditor/upload/files/id113/SD_Report_2024_15_09.2025.pdf','2024','company_public_disclosure'],
  ['SRC-UK-EF-2026','Greenhouse gas reporting: conversion factors 2026','UK Department for Energy Security and Net Zero','https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026','2026','official_factor'],
  ['SRC-VICOSTONE-2023','Vicostone Annual Report 2023 - GHG emissions','Vicostone','https://vicostone.com/-/media/ng-files/tin-tuc-co-dong/2024/06/vcs_annual-report-2023_signed.pdf','2023','company_public_disclosure'],
];

export const FALLBACK_SOURCES: DemoSource[] = rawSources.map(([source_key,title,publisher,source_url,reporting_period,source_type]) => ({ source_key,title,publisher,source_url,reporting_period,source_type }));

export const VI_DATA_TEXT: Record<string,string> = {
  'Gross direct GHG emissions':'Tổng phát thải GHG trực tiếp',
  'Specific net CO2 emissions':'Phát thải CO₂ ròng riêng',
  'Total energy consumption':'Tổng tiêu thụ năng lượng',
  'Electricity consumption':'Tiêu thụ điện',
  'Direct GHG emissions':'Phát thải GHG trực tiếp',
  'Indirect electricity emissions':'Phát thải gián tiếp từ điện',
  'Total GHG emissions':'Tổng phát thải GHG',
  'Vietnam grid emission factor':'Hệ số phát thải lưới điện Việt Nam',
  'Natural gas factor - gross CV':'Hệ số khí tự nhiên - nhiệt trị toàn phần',
  'Diesel average biofuel blend factor':'Hệ số diesel pha nhiên liệu sinh học trung bình',
  'Natural gas consumption':'Tiêu thụ khí tự nhiên',
  'Scope 1 emissions':'Phát thải Scope 1',
  'Scope 2 emissions':'Phát thải Scope 2',
  'NPMC and MTC energy consumption':'Tiêu thụ năng lượng của NPMC và MTC',
  'Waste-heat self-generated electricity':'Điện tự phát từ thu hồi nhiệt thải',
  'Dung Quat self-generated electricity':'Điện tự phát tại Dung Quất',
  'Hai Duong self-generated electricity':'Điện tự phát tại Hải Dương',
  'Purchased electricity consumption':'Điện mua từ lưới',
  'Rooftop solar electricity integrated into production':'Điện mặt trời mái nhà đưa vào sản xuất',
  'Yarn electricity intensity':'Cường độ điện của sợi',
  'CBAM Vietnam default direct emissions - CN 7604 29 90 reference':'Tham chiếu phát thải trực tiếp mặc định CBAM Việt Nam - CN 7604 29 90',
  'EU CBAM default-value workflow':'Quy trình giá trị mặc định EU CBAM',
  'Vietnam GHG / ISO / CBAM preparation':'Chuẩn bị hồ sơ GHG Việt Nam / ISO / CBAM',
  'Process/product intensity':'Cường độ theo quá trình/sản phẩm',
  'Kiln energy intensity':'Cường độ năng lượng lò nung',
  'Scope 2 and process intensity':'Scope 2 và cường độ quá trình',
  'Corporate inventory':'Kiểm kê cấp doanh nghiệp',
  'Scope 2 reconciliation':'Đối soát Scope 2',
  'Inventory reconciliation':'Đối soát kiểm kê',
  'Vietnam Scope 2 calculation':'Tính Scope 2 tại Việt Nam',
  'Transparent factor-library example':'Ví dụ thư viện hệ số minh bạch',
  'Fuel/feedstock activity-data mapping':'Ánh xạ dữ liệu hoạt động nhiên liệu/feedstock',
  'Scope 2 / production allocation':'Phân bổ Scope 2 / sản xuất',
  'Energy/activity data ingestion':'Thu nhận dữ liệu năng lượng/hoạt động',
  'Corporate/facility inventory':'Kiểm kê doanh nghiệp/cơ sở',
  'Facility energy evidence':'Bằng chứng năng lượng cấp cơ sở',
  'Activity-data intake / Scope 2 / product allocation':'Thu nhận dữ liệu hoạt động / Scope 2 / phân bổ sản phẩm',
  'Renewable electricity evidence':'Bằng chứng điện tái tạo',
  'Product/process intensity benchmark':'Benchmark cường độ sản phẩm/quá trình',
  'Corporate inventory reconciliation':'Đối soát kiểm kê doanh nghiệp',
  'regulatory reference':'tham chiếu pháp quy', 'country operation':'hoạt động cấp quốc gia', 'company':'doanh nghiệp',
  'national factor':'hệ số quốc gia', 'official factor':'hệ số chính thức', 'group aggregate':'tổng hợp cấp tập đoàn',
  'operations':'hoạt động', 'multi facility':'nhiều cơ sở', 'facility public disclosure':'công bố công khai cấp cơ sở',
  'Vietnam national grid':'Lưới điện quốc gia Việt Nam', 'UK Government conversion factors':'Bộ hệ số chuyển đổi của Chính phủ Anh',
  'PVCFC consolidated units':'Các đơn vị hợp nhất của PVCFC', 'PVCFC parent company':'Công ty mẹ PVCFC',
  'Hoa Phat steel complexes':'Các khu liên hợp thép Hòa Phát',
  'electricity':'điện', 'fuel':'nhiên liệu', 'production':'sản xuất', 'supplier':'nhà cung cấp', 'logistics':'logistics',
  'water':'nước', 'wastewater':'nước thải', 'waste':'chất thải', 'production route':'tuyến công nghệ', 'output':'sản lượng',
  'raw material':'nguyên liệu', 'kiln fuel':'nhiên liệu lò nung', 'clinker output':'sản lượng clinker', 'clinker factor':'hệ số clinker',
  'limestone/raw meal':'đá vôi/phối liệu', 'natural gas fuel':'khí tự nhiên làm nhiên liệu', 'natural gas feedstock':'khí tự nhiên làm feedstock',
  'nitrogen content':'hàm lượng nitơ', 'diesel':'diesel', 'blasting':'nổ mìn', 'haulage':'vận chuyển mỏ', 'ore processed':'quặng xử lý',
  'coke/coal':'coke/than', 'ore/scrap':'quặng/phế liệu', 'waste heat power':'điện thu hồi nhiệt thải', 'BOM/material':'BOM/vật liệu',
};

export const translateDemoText = (value: string | null | undefined, vi: boolean) => {
  if (!value || !vi) return value || '';
  const normalized = value.replaceAll('_',' ');
  return VI_DATA_TEXT[value] || VI_DATA_TEXT[normalized] || normalized;
};
