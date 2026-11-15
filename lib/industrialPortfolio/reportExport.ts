/* eslint-disable @typescript-eslint/no-explicit-any -- ported from the Lovable demo export helper */
import { createWorkbook } from '@/lib/reports/excelRuntime';

import type { IndustrialDatasetState } from '@/lib/industrialPortfolio/dataset';
import type { IndustrialReportingState, ReportProfileRow } from '@/lib/industrialPortfolio/reporting';
import { getLegalProfile, REPORTING_REGISTRY_REVIEW_DATE } from '@/lib/industrialPortfolio/legalMarketRegistry';

// Bảng tính tối giản (mảng 2 chiều) → ghi ra file bằng exceljs (thư viện sẵn có của FE).
type SheetData = { rows: unknown[][]; widths?: number[] };
const aoaToSheet = (rows: unknown[][]): SheetData => ({ rows });
const jsonToSheet = (items: Record<string, unknown>[]): SheetData => {
  const keys = items.length ? Object.keys(items[0]) : ['(trống)'];
  return { rows: [keys, ...items.map((item) => keys.map((key) => item[key] ?? ''))] };
};
function styleSheet(ws: SheetData, widths: number[]) {
  ws.widths = widths;
}

async function writeWorkbook(sheets: { name: string; ws: SheetData }[], fileName: string) {
  const wb = await createWorkbook();
  for (const { name, ws } of sheets) {
    const sheet = wb.addWorksheet(name.slice(0, 31));
    ws.rows.forEach((row) => sheet.addRow(row.map((value) => (value === null || value === undefined ? '' : value))));
    sheet.columns.forEach((column, index) => { column.width = ws.widths?.[index] ?? 18; });
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF145233' } };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function relevantProducts(profile: ReportProfileRow, reporting: IndustrialReportingState) {
  if (profile.profileCode === 'GHG_CORPORATE' || profile.profileCode === 'ISO_14064_1' || profile.profileCode === 'VN_GHG_INVENTORY' || profile.profileCode === 'GHG_SCOPE3') {
    return reporting.products;
  }
  return reporting.products.filter((p) => p.reportTargets.includes(profile.profileCode));
}

function relevantEvidence(profile: ReportProfileRow, reporting: IndustrialReportingState) {
  if (profile.profileCode === 'GHG_CORPORATE' || profile.profileCode === 'ISO_14064_1' || profile.profileCode === 'GHG_SCOPE3') return reporting.evidence;
  return reporting.evidence.filter((e) => e.linkedReportTargets.includes(profile.profileCode));
}

export function exportIndustrialReportProfile(
  profile: ReportProfileRow,
  dataset: IndustrialDatasetState,
  reporting: IndustrialReportingState,
) {
  const products = relevantProducts(profile, reporting);
  const evidence = relevantEvidence(profile, reporting);
  const legal = getLegalProfile(profile.profileCode);
  const sheets: { name: string; ws: SheetData }[] = [];

  const summary = aoaToSheet([
    ['Field', 'Value'],
    ['Profile code', profile.profileCode],
    ['Profile name', profile.profileName],
    ['Market group', profile.marketGroup],
    ['Framework family', profile.frameworkFamily],
    ['Scope level', profile.scopeLevel],
    ['Output', profile.outputName],
    ['Dataset', dataset.organization.name],
    ['Reporting period', dataset.organization.period],
    ['Engine version', dataset.organization.engineVersion],
    ['Portfolio emissions (tCO2e)', Number(dataset.emissionsSummary.totalTonnes.toFixed(3))],
    ['Scope 1 (tCO2e)', Number(dataset.emissionsSummary.scope1.toFixed(3))],
    ['Scope 2 (tCO2e)', Number(dataset.emissionsSummary.scope2.toFixed(3))],
    ['Scope 3 (tCO2e)', Number(dataset.emissionsSummary.scope3.toFixed(3))],
    ['Products mapped', products.length],
    ['Evidence records linked', evidence.length],
    ['Required data groups', profile.requiredDataGroups.join(', ')],
    ['Reference', profile.reference || ''],
    ['Market registry reviewed', REPORTING_REGISTRY_REVIEW_DATE],
    ['DATA STATUS', 'DEMO / SYNTHETIC BUSINESS DATA — NOT FOR OFFICIAL FILING'],
    ['Important', 'External legal/standard references are source-backed market metadata. Internal company, production, emissions, intensity and evidence values in this workbook are demonstration data. This export is a preparation/alignment package and is not an official government filing, certification, allowance, carbon credit or independent verification statement.'],
  ]);
  styleSheet(summary, [34, 110]);
  sheets.push({ name: 'Report Summary', ws: summary });

  if (legal) {
    const legalBasis = aoaToSheet([
      ['Field', 'Value'],
      ['Registry code', legal.code],
      ['Market', legal.market],
      ['Nature', legal.nature],
      ['Legal / market status', legal.legalStatusEn],
      ['Scope', legal.scopeEn],
      ['Applicable industries', legal.applicableIndustries.join(', ')],
      ['Industry applicability note', legal.industryNoteEn || ''],
      ['Official submission boundary', legal.officialSubmissionEn],
      ['Verification boundary', legal.verificationEn],
      ['Registry review date', REPORTING_REGISTRY_REVIEW_DATE],
      ...legal.references.flatMap((ref, index) => [
        [`Reference ${index + 1}`, ref.label],
        [`Reference ${index + 1} status`, ref.statusEn],
        [`Reference ${index + 1} URL`, ref.url],
      ]),
    ]);
    styleSheet(legalBasis, [36, 115]);
    sheets.push({ name: 'Legal Market Basis', ws: legalBasis });

    const reportStructure = jsonToSheet(legal.reportSectionsEn.map((section, index) => ({
      'Section no.': index + 1,
      'Required report section': section,
      'Data source in WeaveCarbon': 'Governed demo dataset / evidence graph',
      'Current status': 'DEMO — preparation/readiness only',
    })));
    styleSheet(reportStructure, [14, 54, 46, 36]);
    sheets.push({ name: 'Report Structure', ws: reportStructure });
  }

  const facilities = jsonToSheet(dataset.facilities.map((f: any) => ({
    'Facility ID': f.id,
    Facility: f.name,
    Industry: f.industry,
    'Emissions (tCO2e)': f.tonnes,
    'Data completeness (%)': f.completeness,
    'Open gaps': f.openGaps,
    Latitude: f.lat,
    Longitude: f.lng,
    'Data status': 'DEMO',
  })));
  styleSheet(facilities, [18, 34, 24, 20, 22, 14, 14, 14, 14]);
  sheets.push({ name: 'Facilities', ws: facilities });

  const activity = jsonToSheet(dataset.activityData.map((r: any) => ({
    'Activity ID': r.id,
    Activity: r.activity,
    Facility: r.facility,
    Process: r.process,
    Source: r.source,
    Value: r.value,
    Unit: r.unit,
    Period: r.period,
    'Data quality': r.quality,
    Evidence: r.evidence,
    Status: r.status,
    'Factor key': r.factorKey || '',
    'Biogenic fraction': r.biogenicFraction ?? 0,
    'Biogenic evidence': r.biogenicEvidenceStatus || '',
    'Data status': 'DEMO',
  })));
  styleSheet(activity, [16, 30, 34, 28, 24, 14, 12, 16, 20, 12, 18, 22, 18, 22, 14]);
  sheets.push({ name: 'Activity Data', ws: activity });

  const productSheet = jsonToSheet(products.map((p) => ({
    'Product ID': p.id,
    Product: p.name,
    Industry: p.industry,
    Facility: p.facilityName,
    'Product code': p.productCode || '',
    'Market scope': p.marketScope,
    Destination: p.destinationMarket || '',
    'CN code': p.cnCode || '',
    Intensity: p.intensity || '',
    'Data quality (%)': p.quality,
    Readiness: p.readiness,
    'Evidence count': p.evidenceCount,
    'Mapped reports': p.reportTargets.join(', '),
    'Data status': 'DEMO',
  })));
  styleSheet(productSheet, [16, 34, 24, 34, 20, 16, 24, 16, 20, 18, 16, 16, 48, 14]);
  sheets.push({ name: 'Mapped Products', ws: productSheet });

  const evidenceSheet = jsonToSheet(evidence.map((e) => ({
    'Evidence ID': e.id,
    Type: e.documentType,
    'File name': e.fileName,
    Period: e.period,
    Issuer: e.issuer || '',
    Status: e.status,
    Level: e.evidenceLevel,
    Activity: e.linkedActivity || '',
    'Report targets': e.linkedReportTargets.join(', '),
    'Integrity hash': e.integrityHash || '',
    Note: e.notes || '',
    'Data status': 'SYNTHETIC DEMO METADATA',
  })));
  styleSheet(evidenceSheet, [18, 28, 52, 16, 28, 18, 12, 30, 48, 28, 42, 24]);
  sheets.push({ name: 'Evidence Register', ws: evidenceSheet });

  const cadence = jsonToSheet(reporting.cadence.map((r) => ({
    Period: r.periodLabel,
    Industry: r.industry,
    'Emissions (tCO2e)': r.emissionsTco2e,
    'Production index': r.productionIndex,
    'Evidence coverage (%)': r.evidenceCoveragePct,
    'Primary data (%)': r.primaryDataPct,
    'Data status': 'DEMO',
  })));
  styleSheet(cadence, [16, 26, 20, 18, 24, 20, 14]);
  sheets.push({ name: 'Industry Cadence', ws: cadence });

  const safe = profile.profileCode.replace(/[^A-Za-z0-9_-]/g, '_');
  return writeWorkbook(sheets, `WeaveCarbon_${safe}_${dataset.organization.period.replace(/\s+/g, '_')}.xlsx`);
}
