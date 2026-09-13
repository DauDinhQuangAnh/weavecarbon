'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, LockKeyhole, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createCorporateGhgInventory, fetchCorporateGhgInventories, reviewCorporateGhgInventory,
  type CorporateGhgInventory, type CorporateGhgInventoryInput, type CorporateGhgReview,
  type GhgActivitySource, type GhgBoundaryDecision } from '@/lib/weave-v2/corporateGhgInventoryApi';

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
  const [additionalSourcesJson, setAdditionalSourcesJson] = useState('[]'); const [scope3Json, setScope3Json] = useState('[]');
  const [reviewNotes, setReviewNotes] = useState(''); const [busy, setBusy] = useState('');
  const latest = inventories[0] || null;
  const load = useCallback(async () => setInventories(await fetchCorporateGhgInventories()), []);
  useEffect(() => { void load().catch(() => setInventories([])); }, [load]);
  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key); try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'R13 operation failed.'); } finally { setBusy(''); }
  };
  const patchDecision = (scope: 'scope1' | 'scope2', category: string, patch: Partial<GhgBoundaryDecision>) => setInput((value) => ({ ...value,
    operationalBoundary: { ...value.operationalBoundary, [scope]: value.operationalBoundary[scope].map((item) => item.category === category ? { ...item, ...patch } : item) } }));
  const create = () => run('create', async () => {
    const additionalSources = JSON.parse(additionalSourcesJson) as GhgActivitySource[];
    const scope3 = JSON.parse(scope3Json) as GhgBoundaryDecision[];
    await createCorporateGhgInventory({ ...input, additionalSources, operationalBoundary: { ...input.operationalBoundary, scope3 } });
  }, 'Đã tạo inventory revision R13 bất biến.');
  const review = (decision: CorporateGhgReview['decision']) => run('review', () => reviewCorporateGhgInventory(latest!.id, {
    reviewerRole: 'corporate_ghg_inventory_reviewer', decision, notes: reviewNotes
  }), decision === 'approved_for_internal_report' ? 'Đã duyệt inventory nội bộ.' : 'Đã ghi inventory review.');

  return <Card className="mt-4 rounded-xl border-amber-200"><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
    <span>R13 — Corporate/facility GHG inventory</span><Badge variant="outline">GHG Protocol 2004 · Scope 2 Guidance 2015</Badge>
  </CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />
      Inventory nội bộ có kiểm soát. Không phải ISO 14064 certification hay assurance; offsets không được trừ khỏi gross inventory.
      Bộ GHG Protocol/ISO hợp nhất đang phát triển, dự kiến công bố năm 2028.</div>
    <section className="space-y-3"><b className="text-sm">Identity, period và organizational boundary</b><div className="grid gap-3 md:grid-cols-3">
      <Input placeholder="Inventory reference" value={input.inventoryReference} onChange={(e) => setInput((v) => ({ ...v, inventoryReference: e.target.value }))} />
      <Input type="date" value={input.inventoryDate} onChange={(e) => setInput((v) => ({ ...v, inventoryDate: e.target.value }))} />
      <Input placeholder="Reporting entity name" value={input.reportingEntityName} onChange={(e) => setInput((v) => ({ ...v, reportingEntityName: e.target.value, organizationalBoundary: { ...v.organizationalBoundary, entities: [{ ...v.organizationalBoundary.entities[0], name: e.target.value }] } }))} />
      <Input aria-label="Reporting period start" type="date" value={input.reportingPeriodStart} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
      <Input aria-label="Reporting period end" type="date" value={input.reportingPeriodEnd} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
      <Select value={input.organizationalBoundary.approach} onValueChange={(approach: CorporateGhgInventoryInput['organizationalBoundary']['approach']) => setInput((v) => ({ ...v, organizationalBoundary: { ...v.organizationalBoundary, approach } }))}><SelectTrigger aria-label="Consolidation approach"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operational_control">Operational control</SelectItem><SelectItem value="financial_control">Financial control</SelectItem><SelectItem value="equity_share">Equity share</SelectItem></SelectContent></Select>
    </div><Textarea placeholder="Intended use" value={input.intendedUse} onChange={(e) => setInput((v) => ({ ...v, intendedUse: e.target.value }))} /><Textarea placeholder="Organizational boundary description" value={input.organizationalBoundary.description} onChange={(e) => setInput((v) => ({ ...v, organizationalBoundary: { ...v.organizationalBoundary, description: e.target.value } }))} /></section>
    <section className="space-y-3 rounded border p-3"><b className="text-sm">Facility mapping</b><div className="grid gap-2 md:grid-cols-4"><Input placeholder="Facility reference" value={input.facilities[0].reference} onChange={(e) => setInput((v) => ({ ...v, defaultFuelFacilityReference: e.target.value, facilities: [{ ...v.facilities[0], reference: e.target.value }] }))} /><Input placeholder="Exact invoice facility name" value={input.facilities[0].name} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], name: e.target.value }] }))} /><Input placeholder="Country code" value={input.facilities[0].country} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], country: e.target.value.toUpperCase() }] }))} /><Input placeholder="Facility evidence UUIDs" value={input.facilities[0].evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], evidenceDocumentIds: csv(e.target.value) }] }))} /></div><Textarea value={input.facilities[0].rationale} onChange={(e) => setInput((v) => ({ ...v, facilities: [{ ...v.facilities[0], rationale: e.target.value }] }))} /></section>
    <section className="space-y-3"><b className="text-sm">Operational boundary — explicit decision for every Scope 1/2 source</b>{(['scope1', 'scope2'] as const).map((scope) => <div key={scope} className="grid gap-2 md:grid-cols-2">{input.operationalBoundary[scope].map((item) => <div key={item.category} className="rounded border p-2"><Label>{scope.toUpperCase()} · {item.category}</Label><div className="mt-1 grid gap-2 sm:grid-cols-3"><Select value={item.status} onValueChange={(status: GhgBoundaryDecision['status']) => patchDecision(scope, item.category, { status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quantified">Quantified</SelectItem><SelectItem value="not_relevant">Not relevant</SelectItem><SelectItem value="excluded">Excluded</SelectItem></SelectContent></Select><Input className="sm:col-span-2" value={item.rationale} onChange={(e) => patchDecision(scope, item.category, { rationale: e.target.value })} /></div></div>)}</div>)}</section>
    <section className="space-y-3 rounded border p-3"><b className="text-sm">Scope 2, base year và gas coverage</b><div className="grid gap-2 md:grid-cols-4"><Input placeholder="Location EF version" value={input.scope2Accounting.locationBasedFactorVersion} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, locationBasedFactorVersion: e.target.value } }))} /><Input placeholder="GWP basis" value={input.scope2Accounting.gwpBasis} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, gwpBasis: e.target.value } }))} /><Input type="number" placeholder="Base year" value={input.baseYear.year} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, year: Number(e.target.value) } }))} /><Input type="number" min="0" max="100" placeholder="Recalculation threshold %" value={input.baseYear.significanceThresholdPercent} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, significanceThresholdPercent: Number(e.target.value) } }))} /></div><Textarea value={input.baseYear.recalculationPolicy} onChange={(e) => setInput((v) => ({ ...v, baseYear: { ...v.baseYear, recalculationPolicy: e.target.value } }))} /><div className="grid gap-2 md:grid-cols-2">{input.gasCoverage.map((item, index) => <div key={item.gas} className="grid grid-cols-4 gap-2"><Label className="self-center">{item.gas}</Label><Select value={item.status} onValueChange={(status: 'quantified' | 'not_relevant') => setInput((v) => ({ ...v, gasCoverage: v.gasCoverage.map((gas, i) => i === index ? { ...gas, status } : gas) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quantified">Quantified</SelectItem><SelectItem value="not_relevant">Not relevant</SelectItem></SelectContent></Select><Input className="col-span-2" value={item.rationale} onChange={(e) => setInput((v) => ({ ...v, gasCoverage: v.gasCoverage.map((gas, i) => i === index ? { ...gas, rationale: e.target.value } : gas) }))} /></div>)}</div></section>
    <section className="space-y-3 rounded border p-3"><b className="text-sm">Scope 3, supplemental activity và market-based Scope 2</b><div className="grid gap-2 md:grid-cols-2"><Select value={input.operationalBoundary.scope3Claim} onValueChange={(scope3Claim: CorporateGhgInventoryInput['operationalBoundary']['scope3Claim']) => setInput((v) => ({ ...v, operationalBoundary: { ...v.operationalBoundary, scope3Claim } }))}><SelectTrigger aria-label="Scope 3 claim"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_included">Scope 3 not included</SelectItem><SelectItem value="screened">Scope 3 screened</SelectItem><SelectItem value="full_inventory">Full Scope 3 inventory claimed</SelectItem></SelectContent></Select><Select value={input.scope2Accounting.marketBasedApplicable ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, marketBasedApplicable: value === 'yes' } }))}><SelectTrigger aria-label="Market based applicable"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Market-based not applicable</SelectItem><SelectItem value="yes">Dual Scope 2 reporting required</SelectItem></SelectContent></Select></div><Label>Scope 3 decisions (JSON array)</Label><Textarea value={scope3Json} onChange={(e) => setScope3Json(e.target.value)} /><Label>Additional source rows, including market-based Scope 2 (JSON array)</Label><Textarea value={additionalSourcesJson} onChange={(e) => setAdditionalSourcesJson(e.target.value)} /><Input placeholder="Contractual instrument evidence UUIDs" value={input.scope2Accounting.contractualInstrumentEvidenceIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, contractualInstrumentEvidenceIds: csv(e.target.value) } }))} /><Textarea placeholder="Market-based method" value={input.scope2Accounting.marketBasedMethod} onChange={(e) => setInput((v) => ({ ...v, scope2Accounting: { ...v.scope2Accounting, marketBasedMethod: e.target.value } }))} /></section>
    <section className="space-y-3 rounded border p-3"><b className="text-sm">Quality, uncertainty, evidence và claim safety</b><div className="grid gap-2 md:grid-cols-2"><Input type="number" min="0" max="100" value={input.dataCompletenessPercent} onChange={(e) => setInput((v) => ({ ...v, dataCompletenessPercent: Number(e.target.value) }))} /><Input placeholder="Inventory evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} /></div><Textarea value={input.dataQualityAssessment} onChange={(e) => setInput((v) => ({ ...v, dataQualityAssessment: e.target.value }))} /><Textarea value={input.dataImprovementPlan} onChange={(e) => setInput((v) => ({ ...v, dataImprovementPlan: e.target.value }))} /><Textarea value={input.uncertaintyAssessment} onChange={(e) => setInput((v) => ({ ...v, uncertaintyAssessment: e.target.value }))} /><Textarea value={input.limitations} onChange={(e) => setInput((v) => ({ ...v, limitations: e.target.value }))} /><Button disabled={!input.inventoryReference || !input.reportingEntityName || Boolean(busy)} onClick={() => void create()}><LockKeyhole className="mr-2 h-4 w-4" />Create immutable inventory revision</Button></section>
    {latest && <section className="space-y-3 rounded border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{latest.inventoryReference} · rev {latest.revision}</b><Badge>{latest.inventoryStatus}</Badge><Badge variant="outline">{latest.result.inventoryScopeLabel}</Badge><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div><p className="rounded bg-slate-50 p-2">Scope 1: {latest.result.totals.scope1KgCo2e} kg CO₂e · Scope 2 location: {latest.result.totals.scope2LocationBasedKgCo2e} kg CO₂e · Gross S1+S2: {latest.result.totals.grossScope1AndLocationScope2KgCo2e} kg CO₂e · offsets separately: {latest.result.totals.offsetsRetiredKgCo2e} kg CO₂e</p>{latest.result.findings.map((item) => <p key={`${item.code}:${item.path}`} className="rounded border p-2"><b>{item.code}</b> · {item.message}</p>)}<a href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">GHG Protocol source · {latest.rulesetVersion}</a><div className="space-y-2 rounded bg-slate-50 p-3"><b>Named inventory review (append-only)</b><Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Boundary, completeness, factors, uncertainty and limitations reviewed" /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'inventory_review_required' || Boolean(busy)} onClick={() => void review('approved_for_internal_report')}>Approve internal report</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Needs information</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Reject</Button></div></div></section>}
  </CardContent></Card>;
}
