import React from 'react';
import {
  Box,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Globe,
  Layers,
  Leaf,
  Package,
  ShieldCheck,
  Ship,
  Tag
} from 'lucide-react';

export interface RItemDef {
  code: string;
  title: string;
  subtitle: string;
  tag: string;
  badgeTone: string;
  icon: React.ElementType;
}

export const R_ITEMS: RItemDef[] = [
  {
    code: 'R01',
    title: 'Commercial Invoice & Hợp đồng (Hóa đơn thương mại)',
    subtitle: 'Hóa đơn xuất khẩu, số PO, đơn giá, cước phí, bảo hiểm & thông tin đối tác',
    tag: 'Thương mại & CBAM',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: FileSpreadsheet
  },
  {
    code: 'R02',
    title: 'Packing List & Danh mục Đóng gói (Phiếu đóng gói)',
    subtitle: 'Container, seal, dãy carton/pallet, trọng lượng Net/Gross, thể tích CBM',
    tag: 'Kho vận & Đóng gói',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    icon: Package
  },
  {
    code: 'R03',
    title: 'Carrier Documents & Vận đơn Hãng tàu (B/L / AWB)',
    subtitle: 'Vận đơn đường biển/hàng không, booking confirmation, số container & seal do carrier cấp',
    tag: 'Hãng tàu & Vận tải',
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-800',
    icon: Ship
  },
  {
    code: 'R04',
    title: 'Dữ liệu Bàn giao Broker / VNACCS (Hải quan Việt Nam)',
    subtitle: 'Tờ khai hải quan xuất khẩu, giấy phép xuất khẩu, kiểm tra chuyên ngành & đối soát R01/R02/R03',
    tag: 'Hải quan VN (VNACCS)',
    badgeTone: 'border-slate-300 bg-slate-50 text-slate-800',
    icon: FileText
  },
  {
    code: 'R05',
    title: 'Bàn giao Khai báo Nhập khẩu EU (EUCDM Handoff)',
    subtitle: 'Gói dữ liệu điện tử bàn giao cho đơn vị thông quan tại cảng đến theo chuẩn EU Customs Data Model',
    tag: 'EU Import Declarant',
    badgeTone: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    icon: Globe
  },
  {
    code: 'R06',
    title: 'Dữ liệu An ninh Vận tải ICS2 / ENS Filer Handoff',
    subtitle: 'Dữ liệu an ninh khai trước (Entry Summary Declaration - ENS) chuyển giao cho hãng vận tải',
    tag: 'ICS2 · An ninh EU',
    badgeTone: 'border-purple-300 bg-purple-50 text-purple-800',
    icon: Box
  },
  {
    code: 'R07',
    title: 'Hồ sơ Hỗ trợ Quy tắc Xuất xứ EVFTA (Rules of Origin)',
    subtitle: 'Bảng tính giá trị gia tăng nội khối RVC, chuyển đổi mã số hàng hóa CTC phục vụ cấp C/O EUR.1',
    tag: 'Quy tắc xuất xứ',
    badgeTone: 'border-orange-300 bg-orange-50 text-orange-800',
    icon: Compass
  },
  {
    code: 'R08',
    title: 'Ghi nhãn Thành phần Xơ sợi Dệt may (Textile Fibre Label)',
    subtitle: 'Đối soát tỷ lệ xơ sợi, nguồn gốc tái chế và nhãn chăm sóc đa ngôn ngữ theo Quy định EU 1007/2011',
    tag: 'Ghi nhãn dệt may',
    badgeTone: 'border-sky-300 bg-sky-50 text-sky-800',
    icon: Tag
  },
  {
    code: 'R09',
    title: 'Đăng ký Công bố Môi trường (Environmental Claims)',
    subtitle: 'Đăng ký và xác minh tính pháp lý của công bố bền vững (Recycled, Eco-friendly) theo ISO 14021',
    tag: 'Green Claims',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    icon: CheckCircle2
  },
  {
    code: 'R10',
    title: 'Hồ sơ Kỹ thuật An toàn Sản phẩm EU (GPSR Technical File)',
    subtitle: 'Hồ sơ kỹ thuật an toàn sản phẩm chung EU 2023/988, người đại diện EU (Responsible Person)',
    tag: 'GPSR · EU 2024',
    badgeTone: 'border-amber-300 bg-amber-50 text-amber-800',
    icon: ShieldCheck
  },
  {
    code: 'R11',
    title: 'Hồ sơ Chất cấm & Nguy hại REACH / SVHC (REACH Article Dossier)',
    subtitle: 'Sàng lọc nồng độ chất nguy hại SVHC > 0.1% w/w theo danh mục 253 chất của ECHA Candidate List',
    tag: 'REACH · Bắt buộc EU',
    badgeTone: 'border-red-300 bg-red-50 text-red-800',
    icon: FlaskConical
  },
  {
    code: 'R12',
    title: 'Nghiên cứu Dấu chân Carbon Sản phẩm (Product Carbon Footprint - PCF)',
    subtitle: 'Báo cáo tính toán dấu chân carbon sản phẩm theo chuẩn ISO 14067:2018 phục vụ kiểm toán',
    tag: 'ISO 14067 · PCF',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: Leaf
  },
  {
    code: 'R13',
    title: 'Sàng lọc Mức độ Áp dụng Quy chuẩn (Compliance Applicability)',
    subtitle: 'Ma trận đối soát tự động các quy chuẩn bắt buộc theo danh mục thị trường xuất khẩu mục tiêu',
    tag: 'Sàng lọc quy định',
    badgeTone: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    icon: Layers
  }
];
