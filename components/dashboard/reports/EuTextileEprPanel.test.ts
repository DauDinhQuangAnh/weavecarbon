import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const panel = fs.readFileSync(path.resolve(process.cwd(), 'components/dashboard/reports/EuTextileEprPanel.tsx'), 'utf8');
const reportClient = fs.readFileSync(path.resolve(process.cwd(), 'components/dashboard/reports/ReportClient.tsx'), 'utf8');

describe('R17 EU textile EPR UI contract', () => {
  it('mounts the EPR workflow on the ESG tab', () => {
    expect(reportClient).toContain('import("./EuTextileEprPanel")');
    expect(reportClient).toContain('activeCategory === "esg" && <EuTextileEprPanel />');
  });

  it('keeps national and external lifecycle claims explicit', () => {
    expect(panel).toContain('EU-core planning only');
    expect(panel).toContain('Không phải đăng ký quốc gia');
    expect(panel).toContain('External authority/PRO evidence event');
    expect(panel).toContain('Create immutable EPR revision');
    expect(panel).toContain('exact CN code and unit');
  });
});
