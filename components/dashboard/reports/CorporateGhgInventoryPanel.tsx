'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createCorporateGhgInventory,
  fetchCorporateGhgInventories,
  reviewCorporateGhgInventory,
  type CorporateGhgInventory,
  type CorporateGhgInventoryInput,
  type CorporateGhgReview,
  type GhgActivitySource,
  type GhgBoundaryDecision
} from '@/lib/weave-v2/corporateGhgInventoryApi';

const scope1Categories = ['stationary_combustion', 'mobile_combustion', 'process_emissions', 'fugitive_emissions'];
const scope2Categories = ['purchased_electricity', 'purchased_steam', 'purchased_heat', 'purchased_cooling'];
const gases = ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3'];
const today = () => new Date().toISOString().slice(0, 10);
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const decisions = (categories: string[], quantified: string[]): GhgBoundaryDecision[] => categories.map((category) => ({
  category, status: quantified.includes(category) ? 'quantified' : 'not_relevant',
  rationale: quantified.includes(category) ? 'Included from reviewed activity records.' : 'Screened; not relevant to current operations.'
}));
const defaultInput = (): CorporateGhgInventoryInput => ({
  inventoryReference: '', inventoryDate: today(), reportingEntityName: '',
  reportingPeriodStart: `${new Date().getUTCFullYear()}-01-01`, reportingPeriodEnd: `${new Date().getUTCFullYear()}-12-31`,
  intendedUse: 'Internal management reporting and inventory improvement planning.',
  organizationalBoundary: { approach: 'operational_control', description: 'Entities and facilities under operational control.',
    entities: [{ reference: 'ENTITY-1', name: '', ownershipPercent: 100, included: true, rationale: 'Reporting entity under operational control.' }] },
  facilities: [{ reference: 'FAC-1', name: 'Main Facility', country: 'VN', included: true,
    rationale: 'Facility under operational control.', evidenceDocumentIds: [] }], defaultFuelFacilityReference: 'FAC-1',
  operationalBoundary: { scope1: decisions(scope1Categories, ['stationary_combustion']),
    scope2: decisions(scope2Categories, ['purchased_electricity']), scope3Claim: 'not_included', scope3: [] },
  gasCoverage: gases.map((gas) => ({ gas, status: ['CO2', 'CH4', 'N2O'].includes(gas) ? 'quantified' : 'not_relevant',
    rationale: ['CO2', 'CH4', 'N2O'].includes(gas) ? 'Included through CO2e conversion factors.' : 'Screened; no relevant source identified.' })),
  baseYear: { year: new Date().getUTCFullYear() - 1, emissionsKgCo2e: null,
    recalculationPolicy: 'Recalculate the base year for structural or methodology changes above the significance threshold.',
    significanceThresholdPercent: 5, structuralChanges: 'None recorded.' },
  scope2Accounting: { marketBasedApplicable: false, locationBasedFactorVersion: 'Vietnam grid emission factor 2023',
    gwpBasis: 'IPCC AR6 100-year', marketBasedMethod: '', contractualInstrumentEvidenceIds: [] },
  fuelFactorMetadata: [{ fuelType: 'diesel', source: 'DEFRA greenhouse gas conversion factors', version: '2025', gwpBasis: 'IPCC AR6 100-year' }],
  additionalSources: [], dataCompletenessPercent: 100,
  dataQualityAssessment: 'Review source reliability, technological/geographical/temporal representativeness and completeness.',
  dataImprovementPlan: 'Replace estimates and generic factors with primary meter, supplier and facility records.',
  uncertaintyAssessment: 'Document activity-data, emission-factor, scenario and model uncertainty.',
  biogenicCo2Kg: 0, removalsCo2Kg: 0, offsetsRetiredKgCo2e: 0, exclusions: [], evidenceDocumentIds: [],
  assurance: { verifiedLanguageRequested: false, providerName: '', level: '', statementDate: null, evidenceDocumentId: null },
  limitations: 'Internal Scope 1 and Scope 2 inventory. Scope 3 is not included. No independent assurance.', notes: ''
});

export default function CorporateGhgInventoryPanel() {
  const [input, setInput] = useState<CorporateGhgInventoryInput>(defaultInput);
  const [inventories, setInventories] = useState<CorporateGhgInventory[]>([]);
  const [additionalSourcesJson, setAdditionalSourcesJson] = useState('[]');
  const [scope3Json, setScope3Json] = useState('[]');
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const latest = inventories[0] || null;
  const load = useCallback(async () => setInventories(await fetchCorporateGhgInventories()), []);
  useEffect(() => { void load().catch(() => setInventories([])); }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'R13 operation failed.');
    } finally {
      setBusy('');
    }
  };

  const patchDecision = (scope: 'scope1' | 'scope2', category: string, patch: Partial<GhgBoundaryDecision>) =>
    setInput((value) => ({
      ...value,
      operationalBoundary: {
        ...value.operationalBoundary,
        [scope]: value.operationalBoundary[scope].map((item) =>
          item.category === category ? { ...item, ...patch } : item
        )
      }
    }));

  const create = () => run('create', async () => {
    const additionalSources = JSON.parse(additionalSourcesJson) as GhgActivitySource[];
    const scope3 = JSON.parse(scope3Json) as GhgBoundaryDecision[];
    await createCorporateGhgInventory({ ...input, additionalSources, operationalBoundary: { ...input.operationalBoundary, scope3 } });
    setOpenCreateDialog(false);
  }, 'Đã tạo inventory revision R13 bất biến.');

  const review = (decision: CorporateGhgReview['decision']) =>
    run('review', () => reviewCorporateGhgInventory(latest!.id, {
      reviewerRole: 'corporate_ghg_inventory_reviewer', decision, notes: reviewNotes
    }), decision === 'approved_for_internal_report' ? 'Đã duyệt inventory nội bộ.' : 'Đã ghi inventory review.');

  return (
    <Card className="mt-4 rounded-xl border-amber-200 bg-white shadow-xs">
      <CardHeader className="border-b border-amber-100/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
              <Building2 className="h-4 w-4 text-amber-700" />
              <span>R13 — Corporate/facility GHG inventory</span>
              <Badge variant="outline" className="text-xs font-normal border-amber-300 text-amber-800 bg-amber-50">
                GHG Protocol 2004 · Scope 2 Guidance 2015
              </Badge>
            </CardTitle>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium shadow-xs"
            onClick={() => setOpenCreateDialog(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tạo Inventory Revision
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle className="mr-2 inline h-4 w-4 align-[-2px] text-amber-700" />
          Inventory nội bộ có kiểm soát. Không phải ISO 14064 certification hay assurance; offsets không được trừ khỏi gross inventory.
          Bộ GHG Protocol/ISO hợp nhất đang phát triển, dự kiến công bố năm 2028.
        </div>

        {latest ? (
          <section className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <b className="text-base text-slate-900 font-bold">{latest.inventoryReference} · rev {latest.revision}</b>
                <Badge className="bg-emerald-700">{latest.inventoryStatus}</Badge>
                <Badge variant="outline" className="border-slate-300">{latest.result.inventoryScopeLabel}</Badge>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Scope 1</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{latest.result.totals.scope1KgCo2e.toLocaleString()} <span className="text-xs font-normal text-slate-500">kgCO₂e</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Scope 2 (Location)</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{latest.result.totals.scope2LocationBasedKgCo2e.toLocaleString()} <span className="text-xs font-normal text-slate-500">kgCO₂e</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Gross S1 + S2</div>
                <div className="text-lg font-bold text-amber-800 mt-0.5">{latest.result.totals.grossScope1AndLocationScope2KgCo2e.toLocaleString()} <span className="text-xs font-normal text-slate-500">kgCO₂e</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Offsets đã hủy</div>
                <div className="text-lg font-bold text-slate-600 mt-0.5">{latest.result.totals.offsetsRetiredKgCo2e.toLocaleString()} <span className="text-xs font-normal text-slate-500">kgCO₂e</span></div>
              </div>
            </div>

            {latest.result.findings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-semibold text-slate-700">Phát hiện / Findings ({latest.result.findings.length}):</div>
                {latest.result.findings.map((item) => (
                  <p key={`${item.code}:${item.path}`} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                    <b className="text-amber-800">{item.code}</b> · {item.message}
                  </p>
                ))}
              </div>
            )}

            <div>
              <a href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline font-medium">
                GHG Protocol source · {latest.rulesetVersion}
              </a>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <b className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Named inventory review (append-only)</b>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Boundary, completeness, factors, uncertainty and limitations reviewed"
                className="text-xs min-h-[60px]"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white" disabled={!reviewNotes || latest.automatedStatus !== 'inventory_review_required' || Boolean(busy)} onClick={() => void review('approved_for_internal_report')}>
                  Approve internal report
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>
                  Needs information
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs text-red-700 border-red-200 hover:bg-red-50" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>
                  Reject
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-3">
            <Building2 className="mx-auto h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">Chưa có bản kiểm kê phát thải GHG nào được ghi nhận.</p>
            <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white text-xs" onClick={() => setOpenCreateDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tạo bản kiểm kê đầu tiên
            </Button>
          </div>
        )}
      </CardContent>

      {/* DIALOG POPUP: Tạo Corporate GHG Inventory Revision */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>Tạo revision Corporate GHG Inventory R13</DialogTitle>
            <DialogDescription>
              Thiết lập ranh giới vận hành, cơ sở phát sinh phát thải và thông số GHG Protocol chuẩn mực.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-3">
            <section className="space-y-3">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Identity, period và organizational boundary</b>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder="Inventory reference (VD: GHG-2026-V1)" value={input.inventoryReference} onChange={(e) => setInput((v) => ({ ...v, inventoryReference: e.target.value }))} />
                <Input type="date" value={input.inventoryDate} onChange={(e) => setInput((v) => ({ ...v, inventoryDate: e.target.value }))} />
                <Input placeholder="Reporting entity name" value={input.reportingEntityName} onChange={(e) => setInput((v) => ({ ...v, reportingEntityName: e.target.value, organizationalBoundary: { ...v.organizationalBoundary, entities: [{ ...v.organizationalBoundary.entities[0], name: e.target.value }] } }))} />
                <Input aria-label="Reporting period start" type="date" value={input.reportingPeriodStart} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
                <Input aria-label="Reporting period end" type="date" value={input.reportingPeriodEnd} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
                <Select value={input.organizationalBoundary.approach} onValueChange={(approach: CorporateGhgInventoryInput['organizationalBoundary']['approach']) => setInput((v) => ({ ...v, organizationalBoundary: { ...v.organizationalBoundary, approach } }))}>
                  <SelectTrigger aria-label="Consolidation approach"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational_control">Operational control</SelectItem>
                    <SelectItem value="financial_control">Financial control</SelectItem>
                    <SelectItem value="equity_share">Equity share</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Intended use" value={input.intendedUse} onChange={(e) => setInput((v) => ({ ...v, intendedUse: e.target.value }))} rows={2} />
              <Textarea placeholder="Organizational boundary description" value={input.organizationalBoundary.description} onChange={(e) => setInput((v) => ({ ...v, organizationalBoundary: { ...v.organizationalBoundary, description: e.target.value } }))} rows={2} />
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Facility mapping</b>
              <div className="grid gap-2.5 sm:grid-cols-4">
                <Input placeholder="Facility reference" value={input.facilities[0].reference} onChange={(e) => setInput((v) => ({ ...v, defaultFuelFacilityReference: e.target.value, facilities: [{ ...v.facilities[0], reference: e.target.value }] }))} />
                <Input placeholder="Exact invoice facility name" value={input.facilities[0].name} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], name: e.target.value }] }))} />
                <Input placeholder="Country code (VN)" value={input.facilities[0].country} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], country: e.target.value.toUpperCase() }] }))} />
                <Input placeholder="Facility evidence UUIDs" value={input.facilities[0].evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], evidenceDocumentIds: csv(e.target.value) }] }))} />
              </div>
              <Textarea placeholder="Rationale" value={input.facilities[0].rationale} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], rationale: e.target.value }] }))} rows={2} />
            </section>

            <section className="space-y-3">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Operational boundary — explicit decision for every Scope 1/2 source</b>
              {(['scope1', 'scope2'] as const).map((scope) => (
                <div key={scope} className="grid gap-2.5 sm:grid-cols-2">
                  {input.operationalBoundary[scope].map((item) => (
                    <div key={item.category} className="rounded-lg border border-slate-200 p-2.5 text-xs bg-white">
                      <Label className="text-xs font-medium text-slate-700">{scope.toUpperCase()} · {item.category}</Label>
                      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                        <Select value={item.status} onValueChange={(status: GhgBoundaryDecision['status']) => patchDecision(scope, item.category, { status })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quantified">Quantified</SelectItem>
                            <SelectItem value="not_relevant">Not relevant</SelectItem>
                            <SelectItem value="excluded">Excluded</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className="h-8 text-xs sm:col-span-2" placeholder="Lý do / Rationale" value={item.rationale} onChange={(e) => patchDecision(scope, item.category, { rationale: e.target.value })} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Scope 2, base year và gas coverage</b>
              <div className="grid gap-2.5 sm:grid-cols-4">
                <Input placeholder="Location EF version" value={input.scope2Accounting.locationBasedFactorVersion} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, locationBasedFactorVersion: e.target.value } }))} />
                <Input placeholder="GWP basis" value={input.scope2Accounting.gwpBasis} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, gwpBasis: e.target.value } }))} />
                <Input type="number" placeholder="Base year" value={input.baseYear.year} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, year: Number(e.target.value) } }))} />
                <Input type="number" min="0" max="100" placeholder="Threshold %" value={input.baseYear.significanceThresholdPercent} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, significanceThresholdPercent: Number(e.target.value) } }))} />
              </div>
              <Textarea placeholder="Recalculation policy" value={input.baseYear.recalculationPolicy} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, recalculationPolicy: e.target.value } }))} rows={2} />
              <div className="grid gap-2 sm:grid-cols-2">
                {input.gasCoverage.map((item, index) => (
                  <div key={item.gas} className="grid grid-cols-4 gap-2 items-center text-xs">
                    <Label className="text-xs font-semibold">{item.gas}</Label>
                    <Select value={item.status} onValueChange={(status: 'quantified' | 'not_relevant') => setInput((v) => ({ ...v, gasCoverage: v.gasCoverage.map((gas, i) => i === index ? { ...gas, status } : gas) }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quantified">Quantified</SelectItem>
                        <SelectItem value="not_relevant">Not relevant</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input className="h-8 text-xs col-span-2" value={item.rationale} onChange={(e) => setInput((v) => ({ ...v, gasCoverage: v.gasCoverage.map((gas, i) => i === index ? { ...gas, rationale: e.target.value } : gas) }))} />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Scope 3, supplemental activity và market-based Scope 2</b>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={input.operationalBoundary.scope3Claim} onValueChange={(scope3Claim: CorporateGhgInventoryInput['operationalBoundary']['scope3Claim']) => setInput((v) => ({ ...v, operationalBoundary: { ...v.operationalBoundary, scope3Claim } }))}>
                  <SelectTrigger aria-label="Scope 3 claim"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_included">Scope 3 not included</SelectItem>
                    <SelectItem value="screened">Scope 3 screened</SelectItem>
                    <SelectItem value="full_inventory">Full Scope 3 inventory claimed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={input.scope2Accounting.marketBasedApplicable ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, marketBasedApplicable: value === 'yes' } }))}>
                  <SelectTrigger aria-label="Market based applicable"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Market-based not applicable</SelectItem>
                    <SelectItem value="yes">Dual Scope 2 reporting required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Scope 3 decisions (JSON array)</Label>
                <Textarea value={scope3Json} onChange={(e) => setScope3Json(e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Additional source rows, including market-based Scope 2 (JSON array)</Label>
                <Textarea value={additionalSourcesJson} onChange={(e) => setAdditionalSourcesJson(e.target.value)} rows={2} />
              </div>
              <Input placeholder="Contractual instrument evidence UUIDs" value={input.scope2Accounting.contractualInstrumentEvidenceIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, contractualInstrumentEvidenceIds: csv(e.target.value) } }))} />
              <Textarea placeholder="Market-based method" value={input.scope2Accounting.marketBasedMethod} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, marketBasedMethod: e.target.value } }))} rows={2} />
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Quality, uncertainty, evidence và claim safety</b>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="number" min="0" max="100" placeholder="Data completeness %" value={input.dataCompletenessPercent} onChange={(e) => setInput((v) => ({ ...v, dataCompletenessPercent: Number(e.target.value) }))} />
                <Input placeholder="Inventory evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
              </div>
              <Textarea placeholder="Data quality assessment" value={input.dataQualityAssessment} onChange={(e) => setInput((v) => ({ ...v, dataQualityAssessment: e.target.value }))} rows={2} />
              <Textarea placeholder="Data improvement plan" value={input.dataImprovementPlan} onChange={(e) => setInput((v) => ({ ...v, dataImprovementPlan: e.target.value }))} rows={2} />
              <Textarea placeholder="Uncertainty assessment" value={input.uncertaintyAssessment} onChange={(e) => setInput((v) => ({ ...v, uncertaintyAssessment: e.target.value }))} rows={2} />
              <Textarea placeholder="Limitations" value={input.limitations} onChange={(e) => setInput((v) => ({ ...v, limitations: e.target.value }))} rows={2} />
            </section>
          </div>

          <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenCreateDialog(false)}>Hủy</Button>
            <Button
              disabled={!input.inventoryReference || !input.reportingEntityName || Boolean(busy)}
              onClick={() => void create()}
              className="bg-amber-700 hover:bg-amber-800 text-white font-medium"
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              Create immutable inventory revision
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
