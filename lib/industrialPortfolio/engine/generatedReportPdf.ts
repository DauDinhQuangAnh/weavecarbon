import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { GeneratedIndustryReport, ReportSection } from './aiMonthlyReportEngine';

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char] || char));

const sectionById = (report: GeneratedIndustryReport, id: string) => report.sections.find((section) => section.id === id);

function factsHtml(section?: ReportSection) {
  if (!section?.facts?.length) return '';
  return `<table class="wc-facts"><tbody>${section.facts.map((fact) => `<tr><th>${esc(fact.label)}</th><td>${esc(fact.value)}</td></tr>`).join('')}</tbody></table>`;
}

function sectionHtml(section?: ReportSection) {
  if (!section) return '';
  return `<div class="wc-pdf-block wc-section">
    <h2>${esc(section.title)}</h2>
    <div class="wc-section-body">${section.body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}</div>
    ${factsHtml(section)}
  </div>`;
}

function partHtml(index: string, title: string, subtitle: string) {
  return `<div class="wc-pdf-block wc-part">
    <div class="wc-part-index">${esc(index)}</div>
    <div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
  </div>`;
}

function blockHtml(report: GeneratedIndustryReport, vi: boolean) {
  const statusLabel = report.demo ? 'DEMO - NOT FOR FILING' : (vi ? 'DRAFT - CẦN HUMAN REVIEW' : 'DRAFT - HUMAN REVIEW REQUIRED');
  const executive = sectionById(report, 'executive');
  const passCount = report.checks.filter((check) => check.level === 'pass').length;
  const warningCount = report.checks.filter((check) => check.level === 'warning').length;
  const blockerCount = report.checks.filter((check) => check.level === 'blocker').length;
  const infoCount = report.checks.filter((check) => check.level === 'info').length;
  const toc = report.sections.map((section) => `<div><span>${esc(section.title)}</span></div>`).join('');

  const partA = ['scope', 'basis', 'inventory', 'method'];
  const partB = ['results', 'quality', 'industry'];
  const partC = ['findings', 'verification', 'conclusion'];

  return `
    <div class="wc-pdf-block wc-cover" data-cover="true">
      <div class="wc-cover-topline"></div>
      <div class="wc-brand">WeaveCarbon</div>
      <div class="wc-kicker">INDUSTRIAL CARBON & CLIMATE DATA INFRASTRUCTURE</div>
      <div class="wc-demo">${statusLabel}</div>
      <h1>${esc(report.title)}</h1>
      <p class="wc-subtitle">${esc(report.subtitle)}</p>
      <div class="wc-cover-rule"></div>
      <div class="wc-meta-grid">
        <div><span>Report ID</span><strong>${esc(report.id)}</strong></div>
        <div><span>${vi ? 'Kỳ báo cáo' : 'Reporting period'}</span><strong>${esc(report.period)}</strong></div>
        <div><span>${vi ? 'Ngành' : 'Industry'}</span><strong>${esc(report.industry)}</strong></div>
        <div><span>${vi ? 'Thị trường' : 'Market'}</span><strong>${esc(report.market)}</strong></div>
        <div><span>${vi ? 'Trạng thái phát hành' : 'Issue status'}</span><strong>${esc(report.status)}</strong></div>
        <div><span>${vi ? 'Thời điểm tạo' : 'Generated at'}</span><strong>${esc(new Date(report.generatedAt).toLocaleString())}</strong></div>
      </div>
      <div class="wc-metrics">
        <div><span>${vi ? 'Phát thải kỳ' : 'Period emissions'}</span><strong>${report.metrics.emissionsTco2e.toLocaleString('en-US',{maximumFractionDigits:1})}</strong><small>tCO₂e</small></div>
        <div><span>${vi ? 'Chất lượng dữ liệu' : 'Data quality'}</span><strong>${report.metrics.dataQualityPct}%</strong></div>
        <div><span>${vi ? 'Độ phủ bằng chứng' : 'Evidence coverage'}</span><strong>${report.metrics.evidenceCoveragePct}%</strong></div>
        <div><span>${vi ? 'Finding mở' : 'Open findings'}</span><strong>${report.metrics.openFindings}</strong></div>
      </div>
      <div class="wc-cover-note">
        <strong>${vi ? 'Mục đích tài liệu' : 'Document purpose'}</strong>
        <p>${vi
          ? 'Báo cáo được dựng từ snapshot dữ liệu đã quản trị của WeaveCarbon. AI hỗ trợ tổng hợp, đối chiếu và viết narrative; activity data, emission factors, calculation results và verification status không được AI tự tạo hoặc tự sửa.'
          : 'This report is assembled from a governed WeaveCarbon data snapshot. AI assists aggregation, cross-checking and narrative drafting; activity data, emission factors, calculation results and verification status are never invented or altered by AI.'}</p>
      </div>
    </div>

    <div class="wc-pdf-block wc-overview">
      <div class="wc-eyebrow">REPORT OVERVIEW</div>
      <h2>${vi ? 'Tóm tắt báo cáo & kiểm soát tài liệu' : 'Report summary & document control'}</h2>
      <div class="wc-summary-grid">
        <div class="wc-summary-main">
          ${(executive?.body || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
          ${factsHtml(executive)}
        </div>
        <div class="wc-control-card">
          <div><span>Report ID</span><strong>${esc(report.id)}</strong></div>
          <div><span>Profile</span><strong>${esc(report.profileTitle)}</strong></div>
          <div><span>${vi ? 'Kỳ' : 'Period'}</span><strong>${esc(report.period)}</strong></div>
          <div><span>${vi ? 'Trạng thái' : 'Status'}</span><strong>${esc(report.status)}</strong></div>
          <div><span>${vi ? 'Phân loại' : 'Classification'}</span><strong>${report.demo ? 'DEMO' : 'DRAFT'}</strong></div>
        </div>
      </div>
      <div class="wc-check-summary">
        <div class="pass"><strong>${passCount}</strong><span>PASS</span></div>
        <div class="warning"><strong>${warningCount}</strong><span>WARNING</span></div>
        <div class="blocker"><strong>${blockerCount}</strong><span>BLOCKER</span></div>
        <div class="info"><strong>${infoCount}</strong><span>INFO</span></div>
      </div>
      <div class="wc-toc"><h3>${vi ? 'Cấu trúc báo cáo' : 'Report structure'}</h3>${toc}</div>
    </div>

    <div class="wc-pdf-block wc-section wc-checks">
      <div class="wc-eyebrow">ISSUE READINESS</div>
      <h2>${vi ? 'Kiểm tra trước khi phát hành' : 'Pre-issue checks'}</h2>
      <p class="wc-intro">${vi
        ? 'Các kiểm tra dưới đây không thay đổi dữ liệu nguồn. Blocker giữ report ở trạng thái Draft; warning yêu cầu rà soát trước khi nâng trạng thái.'
        : 'The checks below never mutate source data. A blocker keeps the report in Draft; warnings require review before status can be upgraded.'}</p>
      <table><thead><tr><th>${vi ? 'Kiểm tra' : 'Check'}</th><th>Status</th><th>${vi ? 'Chi tiết' : 'Detail'}</th></tr></thead><tbody>
        ${report.checks.map((check) => `<tr><td>${esc(check.label)}</td><td><span class="wc-status wc-status-${esc(check.level)}">${esc(check.level.toUpperCase())}</span></td><td>${esc(check.detail)}</td></tr>`).join('')}
      </tbody></table>
    </div>

    ${partHtml('A', vi ? 'Phạm vi, căn cứ & phương pháp' : 'Scope, basis & methodology', vi ? 'Xác định đúng đối tượng báo cáo trước khi đọc kết quả.' : 'Establish the correct reporting object before interpreting results.')}
    ${partA.map((id) => sectionHtml(sectionById(report, id))).join('')}

    ${partHtml('B', vi ? 'Kết quả, chất lượng dữ liệu & yêu cầu thị trường' : 'Results, data quality & market requirements', vi ? 'Kết quả carbon luôn đi kèm chất lượng dữ liệu, evidence và điều kiện áp dụng theo ngành/thị trường.' : 'Carbon results are presented together with data quality, evidence and industry/market applicability.')}
    ${partB.map((id) => sectionHtml(sectionById(report, id))).join('')}

    ${partHtml('C', vi ? 'Findings, verification & kết luận' : 'Findings, verification & conclusion', vi ? 'Chuyển kết quả đo lường thành hành động review và trạng thái phát hành rõ ràng.' : 'Turn measured results into review actions and a clear issue status.')}
    ${partC.map((id) => sectionHtml(sectionById(report, id))).join('')}

    ${partHtml('D', vi ? 'Phụ lục & truy vết' : 'Annex & traceability', vi ? 'Giữ đường dẫn từ kết quả về activity data, factor, evidence và căn cứ áp dụng.' : 'Preserve lineage from reported results back to activity data, factors, evidence and applicability basis.')}
    ${sectionHtml(sectionById(report, 'annex'))}

    <div class="wc-pdf-block wc-section wc-references">
      <div class="wc-eyebrow">AUTHORITATIVE BASIS</div>
      <h2>${vi ? 'Nguồn pháp lý / tiêu chuẩn' : 'Legal / standard references'}</h2>
      <p class="wc-intro">${vi
        ? 'Các nguồn dưới đây xác định cấu trúc/khả năng áp dụng của report profile. Dữ liệu doanh nghiệp bên trong vẫn phải được review theo kỳ và phạm vi thực tế.'
        : 'These references define the structure/applicability of the selected report profile. Internal company data must still be reviewed for the actual period and scope.'}</p>
      ${report.references.map((ref) => `<div class="wc-ref"><strong>${esc(ref.label)}</strong><span>${esc(ref.status)}</span><small>${esc(ref.url)}</small></div>`).join('') || `<p>${vi ? 'Theo profile buyer/hợp đồng được cấu hình.' : 'According to the configured buyer/contract profile.'}</p>`}
      <div class="wc-signoff">
        <div><span>${vi ? 'Trạng thái hệ thống' : 'System status'}</span><strong>${esc(report.status)}</strong></div>
        <div><span>${vi ? 'Yêu cầu tiếp theo' : 'Next gate'}</span><strong>${vi ? 'Human review / external verification khi áp dụng' : 'Human review / external verification where applicable'}</strong></div>
      </div>
    </div>
  `;
}

function buildHost(report: GeneratedIndustryReport, vi: boolean) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#ffffff';
  host.style.color = '#17260d';
  host.innerHTML = `<style>
    *{box-sizing:border-box}
    .wc-report-root{font-family:"Be Vietnam Pro",Arial,sans-serif;background:#fff;color:#17260d;padding:0;line-height:1.55}
    .wc-pdf-block{width:100%;background:#fff}
    .wc-cover{min-height:1080px;padding:64px 48px 52px;background:linear-gradient(145deg,#f8faf5 0%,#eef4e9 58%,#e4eee0 100%);position:relative;overflow:hidden}
    .wc-cover:after{content:"";position:absolute;width:360px;height:360px;border-radius:50%;right:-130px;top:-110px;background:rgba(20,82,51,.08)}
    .wc-cover-topline{height:6px;width:112px;background:#145233;border-radius:999px;margin-bottom:28px}.wc-brand{font-size:31px;font-weight:800;color:#145233}.wc-kicker{margin-top:6px;font-size:10px;letter-spacing:.14em;color:#5b6e58}.wc-demo{display:inline-block;margin-top:40px;padding:7px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:800}
    h1{font-size:39px;line-height:1.08;margin:22px 0 12px;max-width:650px}h2{font-size:21px;line-height:1.28;margin:0 0 12px;color:#163d27}h3{font-size:13px;margin:0 0 9px;color:#28452e}p{font-size:12.5px;margin:7px 0;color:#465641}.wc-subtitle{font-size:16px;color:#5c6b54}.wc-cover-rule{height:1px;background:#cbd9c5;margin:28px 0 0}.wc-cover-note{margin-top:30px;border-left:4px solid #145233;background:rgba(255,255,255,.72);padding:15px 17px;max-width:650px}.wc-cover-note strong{font-size:12px}.wc-cover-note p{margin:5px 0 0}
    .wc-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px;position:relative;z-index:1}.wc-meta-grid div{border:1px solid #dce8d6;border-radius:10px;padding:11px 12px;background:rgba(255,255,255,.88)}.wc-meta-grid span,.wc-metrics span,.wc-control-card span,.wc-signoff span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#6b7665}.wc-meta-grid strong{display:block;margin-top:4px;font-size:12px}
    .wc-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px;position:relative;z-index:1}.wc-metrics div{padding:13px;border-radius:10px;background:#fff;border:1px solid #dce8d6}.wc-metrics strong{display:block;font-size:22px;margin-top:3px}.wc-metrics small{font-size:9px;color:#6b7665}
    .wc-overview,.wc-section{padding:22px 28px}.wc-overview{border-bottom:1px solid #dce8d6}.wc-eyebrow{font-size:9px;font-weight:800;letter-spacing:.14em;color:#3a7859;margin-bottom:7px}.wc-summary-grid{display:grid;grid-template-columns:1.45fr .75fr;gap:18px}.wc-summary-main{padding-right:4px}.wc-control-card{border:1px solid #dce8d6;border-radius:12px;background:#f8faf5;padding:13px}.wc-control-card div+div{margin-top:10px;padding-top:10px;border-top:1px solid #e5ece1}.wc-control-card strong{display:block;margin-top:3px;font-size:11px}
    .wc-check-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.wc-check-summary div{border-radius:10px;padding:10px 12px;border:1px solid #dce8d6}.wc-check-summary strong{display:block;font-size:20px}.wc-check-summary span{font-size:9px;letter-spacing:.08em}.wc-check-summary .pass{background:#ecfdf3;border-color:#b7e6c7}.wc-check-summary .warning{background:#fffbeb;border-color:#f3d78d}.wc-check-summary .blocker{background:#fff1f2;border-color:#f3b8c0}.wc-check-summary .info{background:#eff6ff;border-color:#b9d4f4}
    .wc-toc{border-top:1px solid #dce8d6;padding-top:12px}.wc-toc>div{display:inline-block;width:49%;font-size:10.5px;color:#52644e;padding:3px 8px 3px 0;vertical-align:top}
    .wc-part{display:flex;gap:14px;align-items:center;margin-top:3px;padding:16px 28px;background:#173d27;color:#fff}.wc-part h2{color:#fff;margin:0;font-size:19px}.wc-part p{color:#d7e5d5;margin:3px 0 0;font-size:10.5px}.wc-part-index{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#8fb56f;color:#17260d;font-size:15px;font-weight:800}
    .wc-section{border-bottom:1px solid #e5ece1}.wc-section-body{max-width:690px}.wc-intro{margin-bottom:12px}.wc-checks{padding-top:24px}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dce8d6;padding:7px 8px;text-align:left;vertical-align:top;font-size:10.5px}th{background:#f6f8f2;color:#28452e;font-weight:700}.wc-facts th{width:34%}.wc-status{display:inline-block;padding:3px 6px;border-radius:999px;font-size:8.5px;font-weight:800}.wc-status-pass{background:#dcfce7;color:#166534}.wc-status-warning{background:#fef3c7;color:#92400e}.wc-status-blocker{background:#ffe4e6;color:#9f1239}.wc-status-info{background:#dbeafe;color:#1e40af}
    .wc-ref{padding:9px 0;border-bottom:1px solid #edf2e8}.wc-ref strong,.wc-ref span,.wc-ref small{display:block}.wc-ref strong{font-size:11.5px}.wc-ref span{font-size:10.5px;color:#52644e}.wc-ref small{font-size:8.5px;color:#7b8577;word-break:break-all}.wc-signoff{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.wc-signoff div{border:1px solid #dce8d6;border-radius:10px;background:#f8faf5;padding:11px}.wc-signoff strong{display:block;margin-top:3px;font-size:10.5px}
  </style><div class="wc-report-root">${blockHtml(report, vi)}</div>`;
  document.body.appendChild(host);
  return host;
}

function sliceCanvas(source: HTMLCanvasElement, startY: number, height: number) {
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = height;
  const ctx = slice.getContext('2d');
  ctx?.drawImage(source, 0, startY, source.width, height, 0, 0, source.width, height);
  return slice;
}

export async function exportGeneratedReportPdf(report: GeneratedIndustryReport, vi: boolean) {
  const host = buildHost(report, vi);
  const blocks = Array.from(host.querySelectorAll<HTMLElement>('.wc-pdf-block'));
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const top = 15;
  const bottom = 14;
  const usableWidth = pageWidth - marginX * 2;
  const usableHeight = pageHeight - top - bottom;
  const gap = 4;
  let y = top;

  const newPage = () => {
    pdf.addPage();
    y = top;
  };

  try {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const isCover = block.dataset.cover === 'true';
      const canvas = await html2canvas(block, { scale: 1.7, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.94);
      const ratio = usableWidth / canvas.width;
      const renderedHeight = canvas.height * ratio;

      if (isCover) {
        const coverWidth = pageWidth - 20;
        const coverRatio = coverWidth / canvas.width;
        const coverHeight = Math.min(canvas.height * coverRatio, pageHeight - 20);
        pdf.addImage(img, 'JPEG', 10, 10, coverWidth, coverHeight, undefined, 'FAST');
        if (index < blocks.length - 1) newPage();
        continue;
      }

      if (renderedHeight <= usableHeight) {
        if (y + renderedHeight > pageHeight - bottom) newPage();
        pdf.addImage(img, 'JPEG', marginX, y, usableWidth, renderedHeight, undefined, 'FAST');
        y += renderedHeight + gap;
        continue;
      }

      if (y > top + 1) newPage();
      const sliceHeightPx = Math.floor(usableHeight / ratio);
      let offset = 0;
      let lastRenderedHeight = 0;
      while (offset < canvas.height) {
        const currentHeight = Math.min(sliceHeightPx, canvas.height - offset);
        const slice = sliceCanvas(canvas, offset, currentHeight);
        const sliceImg = slice.toDataURL('image/jpeg', 0.94);
        lastRenderedHeight = currentHeight * ratio;
        pdf.addImage(sliceImg, 'JPEG', marginX, top, usableWidth, lastRenderedHeight, undefined, 'FAST');
        offset += currentHeight;
        if (offset < canvas.height) newPage();
      }
      y = top + lastRenderedHeight + gap;
      if (y > pageHeight - bottom - 20) newPage();
    }

    const totalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(220, 232, 214);
      pdf.setLineWidth(0.2);
      if (page > 1) {
        pdf.line(marginX, 9.5, pageWidth - marginX, 9.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(20, 82, 51);
        pdf.text('WEAVECARBON | INDUSTRIAL CARBON REPORT', marginX, 7);
      }
      pdf.line(marginX, pageHeight - 9, pageWidth - marginX, pageHeight - 9);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(100, 110, 96);
      pdf.text(report.id.slice(0, 70), marginX, pageHeight - 5.5);
      pdf.text(`Page ${page}/${totalPages}`, pageWidth - marginX, pageHeight - 5.5, { align: 'right' });
    }

    pdf.save(`${report.id}.pdf`);
  } finally {
    host.remove();
  }
}
