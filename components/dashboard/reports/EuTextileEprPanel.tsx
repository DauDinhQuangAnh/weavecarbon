'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, LockKeyhole, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createEuTextileEprAssessment,
  fetchEuTextileEprAssessments,
  recordEuTextileEprExternalEvent,
  reviewEuTextileEprAssessment,
  type EprActor,
  type EprReview,
  type EuTextileEprAssessment,
  type EuTextileEprInput
} from '@/lib/weave-v2/euTextileEprApi';

const today = () => new Date().toISOString().slice(0, 10);
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const emptyActor = (country = ''): EprActor => ({ name: '', address: { street: '', postalCode: '', city: '', country },
  email: '', phone: '', website: '', nationalIdentificationCode: '', tradeRegisterNumber: '',
  taxIdentificationNumber: '', mandateEvidenceIds: [] });
const defaultInput = (): EuTextileEprInput => ({
  assessmentReference: '', assessmentDate: today(), memberState: 'NL',
  reportingPeriodStart: `${new Date().getUTCFullYear()}-01-01`, reportingPeriodEnd: `${new Date().getUTCFullYear()}-12-31`,
  intendedUse: 'Internal EU textile/footwear EPR planning and shipment-ledger reconciliation.',
  producer: { legalName: '', trademarks: [], brandNames: [], address: { street: '', postalCode: '', city: '', country: 'VN' },
    email: '', phone: '', website: '', contactPoint: '', nationalIdentificationCode: '', tradeRegisterNumber: '',
    taxIdentificationNumber: '', establishedCountry: 'VN', role: 'distance_seller', employeeCount: 10,
    annualTurnoverEur: 0, annualBalanceSheetEur: 0, suppliesUsedGoodsOnly: false,
    selfEmployedTailorCustomizedOnly: false, derivedFromUsedWasteOnly: false },
  authorizedRepresentative: { ...emptyActor('NL'), applicable: false,
    nationalRuleBasis: 'Member-State rule must be confirmed by an EPR specialist.' },
  producerResponsibilityOrganisation: emptyActor('NL'), cnCodes: ['62'],
  memberStateRule: { adapterId: 'EU-CORE-NATIONAL-PENDING', version: '2026-09',
    sourceUrl: 'https://eur-lex.europa.eu/eli/dir/2025/1892/oj', effectiveFrom: null, schemeStatus: 'unknown',
    competentAuthorityName: '', registerUrl: '', reportingSchedule: '', feeMethodStatus: 'pending', reviewEvidenceIds: [] },
  declaredMarketRows: [], truthStatementConfirmed: false, evidenceDocumentIds: [],
  limitations: 'EU-core planning record only. National registration, fee, reporting and submission details require a reviewed Member-State adapter.',
  notes: ''
});

export default function EuTextileEprPanel() {
  const [input, setInput] = useState<EuTextileEprInput>(defaultInput);
  const [rowsJson, setRowsJson] = useState('[\n  {"cnCode":"62052000","quantity":0,"unit":"PCE","weightKg":0,"productDescription":""}\n]');
  const [items, setItems] = useState<EuTextileEprAssessment[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [event, setEvent] = useState({ eventType: 'authority_registration_confirmed', externalReference: '',
    actorName: '', occurredAt: new Date().toISOString().slice(0, 16), evidenceDocumentId: '', amount: '', currency: 'EUR',
    reportingPeriodStart: '', reportingPeriodEnd: '' });
  const [busy, setBusy] = useState('');
  const latest = items[0] || null;
  const load = useCallback(async () => setItems(await fetchEuTextileEprAssessments()), []);
  useEffect(() => { void load().catch(() => setItems([])); }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'R17 operation failed.'); }
    finally { setBusy(''); }
  };
  const patchProducer = <K extends keyof EuTextileEprInput['producer']>(key: K, value: EuTextileEprInput['producer'][K]) =>
    setInput((current) => ({ ...current, producer: { ...current.producer, [key]: value } }));
  const patchProducerAddress = <K extends keyof EuTextileEprInput['producer']['address']>(key: K, value: string) =>
    setInput((current) => ({ ...current, producer: { ...current.producer,
      address: { ...current.producer.address, [key]: value } } }));
  const patchPro = <K extends keyof EprActor>(key: K, value: EprActor[K]) =>
    setInput((current) => ({ ...current,
      producerResponsibilityOrganisation: { ...current.producerResponsibilityOrganisation, [key]: value } }));
  const patchProAddress = <K extends keyof EprActor['address']>(key: K, value: string) =>
    setInput((current) => ({ ...current, producerResponsibilityOrganisation: { ...current.producerResponsibilityOrganisation,
      address: { ...current.producerResponsibilityOrganisation.address, [key]: value } } }));
  const patchRepresentative = <K extends keyof EuTextileEprInput['authorizedRepresentative']>(key: K,
    value: EuTextileEprInput['authorizedRepresentative'][K]) => setInput((current) => ({ ...current,
    authorizedRepresentative: { ...current.authorizedRepresentative, [key]: value } }));
  const patchRepresentativeAddress = <K extends keyof EprActor['address']>(key: K, value: string) =>
    setInput((current) => ({ ...current, authorizedRepresentative: { ...current.authorizedRepresentative,
      address: { ...current.authorizedRepresentative.address, [key]: value } } }));

  const create = () => run('create', async () => {
    const declaredMarketRows = JSON.parse(rowsJson) as EuTextileEprInput['declaredMarketRows'];
    await createEuTextileEprAssessment({ ...input, declaredMarketRows });
  }, 'Đã tạo revision EPR bất biến.');
  const review = (decision: EprReview['decision']) => run('review', () => reviewEuTextileEprAssessment(latest!.id, {
    reviewerRole: 'eu_epr_specialist', decision, notes: reviewNotes
  }), 'Đã ghi nhận EPR specialist review.');
  const recordEvent = () => run('event', () => {
    const { amount, currency, reportingPeriodStart, reportingPeriodEnd, ...base } = event;
    return recordEuTextileEprExternalEvent(latest!.id, { ...base, occurredAt: new Date(event.occurredAt).toISOString(),
      ...(event.eventType === 'fee_payment_confirmed' ? { amount: Number(amount), currency } : {}),
      ...(event.eventType === 'report_submission_confirmed' ? { reportingPeriodStart, reportingPeriodEnd } : {}) });
  }, 'Đã lưu external evidence event.');
  const externalEventIncomplete = !event.externalReference || !event.actorName || !event.occurredAt || !event.evidenceDocumentId
    || (event.eventType === 'fee_payment_confirmed' && (event.amount === '' || !/^[A-Z]{3}$/.test(event.currency)))
    || (event.eventType === 'report_submission_confirmed'
      && (!event.reportingPeriodStart || !event.reportingPeriodEnd
        || event.reportingPeriodStart !== latest?.reportingPeriodStart || event.reportingPeriodEnd !== latest?.reportingPeriodEnd));

  return <Card className="mt-4 rounded-xl border-blue-200">
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>R17 — EU textile & footwear EPR core</span><Badge variant="outline">Directive (EU) 2025/1892 · limited</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />EU-core planning only. Không phải đăng ký quốc gia, PRO invoice,
        thanh toán hay xác nhận đã nộp. Format hài hòa và country adapters phải được cập nhật khi nguồn chính thức ban hành.
      </div>

      <section className="space-y-3">
        <b className="text-sm">Assessment, Member State và kỳ đối soát</b>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Assessment reference" value={input.assessmentReference}
            onChange={(e) => setInput((v) => ({ ...v, assessmentReference: e.target.value }))} />
          <Input type="date" value={input.assessmentDate} onChange={(e) => setInput((v) => ({ ...v, assessmentDate: e.target.value }))} />
          <Input placeholder="EU Member State, e.g. NL" value={input.memberState}
            onChange={(e) => setInput((v) => ({ ...v, memberState: e.target.value.toUpperCase(),
              authorizedRepresentative: { ...v.authorizedRepresentative, address: { ...v.authorizedRepresentative.address, country: e.target.value.toUpperCase() } },
              producerResponsibilityOrganisation: { ...v.producerResponsibilityOrganisation, address: { ...v.producerResponsibilityOrganisation.address, country: e.target.value.toUpperCase() } } }))} />
          <Input aria-label="EPR period start" type="date" value={input.reportingPeriodStart}
            onChange={(e) => setInput((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
          <Input aria-label="EPR period end" type="date" value={input.reportingPeriodEnd}
            onChange={(e) => setInput((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
          <Input placeholder="Annex IVc CN codes, comma separated" value={input.cnCodes.join(', ')}
            onChange={(e) => setInput((v) => ({ ...v, cnCodes: csv(e.target.value) }))} />
        </div>
        <Textarea value={input.intendedUse} onChange={(e) => setInput((v) => ({ ...v, intendedUse: e.target.value }))} />
      </section>

      <section className="space-y-3 rounded border p-3">
        <b className="text-sm">Producer identity and qualification</b>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Legal name" value={input.producer.legalName} onChange={(e) => patchProducer('legalName', e.target.value)} />
          <Input placeholder="Brand names" value={input.producer.brandNames.join(', ')} onChange={(e) => patchProducer('brandNames', csv(e.target.value))} />
          <Select value={input.producer.role} onValueChange={(role: EuTextileEprInput['producer']['role']) => patchProducer('role', role)}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="manufacturer_own_brand">Manufacturer own brand</SelectItem>
              <SelectItem value="reseller_own_brand">Reseller own brand</SelectItem>
              <SelectItem value="first_supplier_import">First supplier/import</SelectItem>
              <SelectItem value="distance_seller">Distance seller</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Street" value={input.producer.address.street} onChange={(e) => patchProducerAddress('street', e.target.value)} />
          <Input placeholder="Postal code" value={input.producer.address.postalCode} onChange={(e) => patchProducerAddress('postalCode', e.target.value)} />
          <Input placeholder="City" value={input.producer.address.city} onChange={(e) => patchProducerAddress('city', e.target.value)} />
          <Input placeholder="Address country" value={input.producer.address.country} onChange={(e) => patchProducerAddress('country', e.target.value.toUpperCase())} />
          <Input placeholder="Established country" value={input.producer.establishedCountry} onChange={(e) => patchProducer('establishedCountry', e.target.value.toUpperCase())} />
          <Input placeholder="Contact point" value={input.producer.contactPoint} onChange={(e) => patchProducer('contactPoint', e.target.value)} />
          <Input placeholder="Email" value={input.producer.email} onChange={(e) => patchProducer('email', e.target.value)} />
          <Input placeholder="National identification code" value={input.producer.nationalIdentificationCode} onChange={(e) => patchProducer('nationalIdentificationCode', e.target.value)} />
          <Input placeholder="Trade register number" value={input.producer.tradeRegisterNumber} onChange={(e) => patchProducer('tradeRegisterNumber', e.target.value)} />
          <Input placeholder="Tax identification number" value={input.producer.taxIdentificationNumber} onChange={(e) => patchProducer('taxIdentificationNumber', e.target.value)} />
          <Input type="number" min="0" placeholder="Employees" value={input.producer.employeeCount} onChange={(e) => patchProducer('employeeCount', Number(e.target.value))} />
          <Input type="number" min="0" placeholder="Annual turnover EUR" value={input.producer.annualTurnoverEur} onChange={(e) => patchProducer('annualTurnoverEur', Number(e.target.value))} />
          <Input type="number" min="0" placeholder="Balance sheet EUR" value={input.producer.annualBalanceSheetEur} onChange={(e) => patchProducer('annualBalanceSheetEur', Number(e.target.value))} />
        </div>
      </section>

      <section className="space-y-3 rounded border p-3">
        <b className="text-sm">Producer responsibility organisation and mandate</b>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="PRO name" value={input.producerResponsibilityOrganisation.name} onChange={(e) => patchPro('name', e.target.value)} />
          <Input placeholder="PRO email" value={input.producerResponsibilityOrganisation.email} onChange={(e) => patchPro('email', e.target.value)} />
          <Input placeholder="PRO website" value={input.producerResponsibilityOrganisation.website} onChange={(e) => patchPro('website', e.target.value)} />
          <Input placeholder="PRO street" value={input.producerResponsibilityOrganisation.address.street} onChange={(e) => patchProAddress('street', e.target.value)} />
          <Input placeholder="PRO postal code" value={input.producerResponsibilityOrganisation.address.postalCode} onChange={(e) => patchProAddress('postalCode', e.target.value)} />
          <Input placeholder="PRO city" value={input.producerResponsibilityOrganisation.address.city} onChange={(e) => patchProAddress('city', e.target.value)} />
          <Input placeholder="PRO national ID" value={input.producerResponsibilityOrganisation.nationalIdentificationCode} onChange={(e) => patchPro('nationalIdentificationCode', e.target.value)} />
          <Input placeholder="PRO trade register" value={input.producerResponsibilityOrganisation.tradeRegisterNumber} onChange={(e) => patchPro('tradeRegisterNumber', e.target.value)} />
          <Input placeholder="PRO tax ID" value={input.producerResponsibilityOrganisation.taxIdentificationNumber} onChange={(e) => patchPro('taxIdentificationNumber', e.target.value)} />
          <Input className="md:col-span-3" placeholder="PRO written-mandate evidence UUIDs" value={input.producerResponsibilityOrganisation.mandateEvidenceIds.join(', ')}
            onChange={(e) => patchPro('mandateEvidenceIds', csv(e.target.value))} />
        </div>
      </section>

      <section className="space-y-3 rounded border p-3">
        <b className="text-sm">Member-State adapter — source-versioned</b>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Adapter ID" value={input.memberStateRule.adapterId} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, adapterId: e.target.value } }))} />
          <Input placeholder="Adapter version" value={input.memberStateRule.version} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, version: e.target.value } }))} />
          <Select value={input.memberStateRule.schemeStatus} onValueChange={(schemeStatus: EuTextileEprInput['memberStateRule']['schemeStatus']) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, schemeStatus } }))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="not_transposed">Not transposed</SelectItem><SelectItem value="transposed">Transposed</SelectItem><SelectItem value="existing_scheme">Existing scheme</SelectItem></SelectContent>
          </Select>
          <Input className="md:col-span-2" placeholder="Primary source URL" value={input.memberStateRule.sourceUrl} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, sourceUrl: e.target.value } }))} />
          <Input type="date" value={input.memberStateRule.effectiveFrom || ''} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, effectiveFrom: e.target.value || null } }))} />
          <Input placeholder="Competent authority" value={input.memberStateRule.competentAuthorityName} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, competentAuthorityName: e.target.value } }))} />
          <Input placeholder="National register URL" value={input.memberStateRule.registerUrl} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, registerUrl: e.target.value } }))} />
          <Select value={input.memberStateRule.feeMethodStatus} onValueChange={(feeMethodStatus: EuTextileEprInput['memberStateRule']['feeMethodStatus']) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, feeMethodStatus } }))}>
            <SelectTrigger aria-label="Fee method status"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="unknown">Fee method unknown</SelectItem><SelectItem value="pending">Fee method pending</SelectItem><SelectItem value="published">Fee method published</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Rule-review evidence UUIDs" value={input.memberStateRule.reviewEvidenceIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, reviewEvidenceIds: csv(e.target.value) } }))} />
        </div>
        <Textarea placeholder="Reporting schedule" value={input.memberStateRule.reportingSchedule} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, reportingSchedule: e.target.value } }))} />
        <Textarea placeholder="Authorised representative national-rule basis" value={input.authorizedRepresentative.nationalRuleBasis}
          onChange={(e) => setInput((v) => ({ ...v, authorizedRepresentative: { ...v.authorizedRepresentative, nationalRuleBasis: e.target.value } }))} />
        <Select value={input.authorizedRepresentative.applicable ? 'yes' : 'no'}
          onValueChange={(value) => patchRepresentative('applicable', value === 'yes')}>
          <SelectTrigger aria-label="Authorised representative applicable"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="no">Representative not required by reviewed national rule</SelectItem>
            <SelectItem value="yes">Representative applicable</SelectItem>
          </SelectContent>
        </Select>
        {input.authorizedRepresentative.applicable && <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Representative name" value={input.authorizedRepresentative.name} onChange={(e) => patchRepresentative('name', e.target.value)} />
          <Input placeholder="Representative email" value={input.authorizedRepresentative.email} onChange={(e) => patchRepresentative('email', e.target.value)} />
          <Input placeholder="Representative street" value={input.authorizedRepresentative.address.street} onChange={(e) => patchRepresentativeAddress('street', e.target.value)} />
          <Input placeholder="Representative postal code" value={input.authorizedRepresentative.address.postalCode} onChange={(e) => patchRepresentativeAddress('postalCode', e.target.value)} />
          <Input placeholder="Representative city" value={input.authorizedRepresentative.address.city} onChange={(e) => patchRepresentativeAddress('city', e.target.value)} />
          <Input placeholder="Representative national ID" value={input.authorizedRepresentative.nationalIdentificationCode} onChange={(e) => patchRepresentative('nationalIdentificationCode', e.target.value)} />
          <Input placeholder="Representative trade register" value={input.authorizedRepresentative.tradeRegisterNumber} onChange={(e) => patchRepresentative('tradeRegisterNumber', e.target.value)} />
          <Input placeholder="Representative tax ID" value={input.authorizedRepresentative.taxIdentificationNumber} onChange={(e) => patchRepresentative('taxIdentificationNumber', e.target.value)} />
          <Input placeholder="Representative mandate evidence UUIDs" value={input.authorizedRepresentative.mandateEvidenceIds.join(', ')} onChange={(e) => patchRepresentative('mandateEvidenceIds', csv(e.target.value))} />
        </div>}
      </section>

      <section className="space-y-3 rounded border p-3">
        <b className="text-sm">Declared market volume vs shipment ledger</b>
        <p className="text-xs text-slate-600">JSON rows are reconciled by exact CN code and unit against confirmed shipment lines for the Member State and invoice period.</p>
        <Textarea className="min-h-32 font-mono text-xs" value={rowsJson} onChange={(e) => setRowsJson(e.target.value)} />
        <Input placeholder="Assessment evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
        <Select value={input.truthStatementConfirmed ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, truthStatementConfirmed: value === 'yes' }))}>
          <SelectTrigger aria-label="Registration truth statement"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="no">Truth statement not confirmed</SelectItem><SelectItem value="yes">Information confirmed true for internal dossier</SelectItem>
          </SelectContent>
        </Select>
        <Textarea value={input.limitations} onChange={(e) => setInput((v) => ({ ...v, limitations: e.target.value }))} />
        <Button disabled={!input.assessmentReference || Boolean(busy)} onClick={() => void create()}>
          <LockKeyhole className="mr-2 h-4 w-4" />Create immutable EPR revision
        </Button>
      </section>

      {latest && <section className="space-y-3 rounded border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>{latest.assessmentReference} · {latest.memberState} · rev {latest.revision}</b>
          <Badge>{latest.assessmentStatus}</Badge><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
        <p className="rounded bg-slate-50 p-2">Declared: {latest.result.totals.declaredQuantity} units / {latest.result.totals.declaredWeightKg} kg ·
          ledger: {latest.result.totals.systemQuantity} units / {latest.result.totals.systemWeightKg} kg · statutory date: {latest.result.statutoryApplicationDate}</p>
        {latest.result.findings.map((item) => <p key={`${item.code}:${item.path}`} className="rounded border p-2"><b>{item.code}</b> · {item.message}</p>)}
        <a href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-700 underline">
          Official EU source <ExternalLink className="ml-1 h-3 w-3" />
        </a>
        <div className="space-y-2 rounded bg-slate-50 p-3"><b>Named EU EPR specialist review</b>
          <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Producer role, Member-State adapter, PRO mandate, CN scope and volume reconciliation reviewed" />
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'specialist_review_required' || Boolean(busy)}
            onClick={() => void review('approved_for_internal_planning')}>Approve internal planning</Button>
            <Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Needs information</Button>
            <Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Reject</Button></div>
        </div>
        <div className="space-y-2 rounded border border-blue-200 p-3"><b>External authority/PRO evidence event</b>
          <Select value={event.eventType} onValueChange={(eventType) => setEvent((v) => ({ ...v, eventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="authority_registration_confirmed">Authority registration confirmed</SelectItem><SelectItem value="pro_membership_confirmed">PRO membership confirmed</SelectItem>
            <SelectItem value="report_submission_confirmed">Report submission confirmed</SelectItem><SelectItem value="fee_payment_confirmed">Fee payment confirmed</SelectItem>
            <SelectItem value="authority_rejected">Authority rejected</SelectItem><SelectItem value="registration_withdrawn">Registration withdrawn</SelectItem>
          </SelectContent></Select>
          <div className="grid gap-2 md:grid-cols-2"><Input placeholder="External reference" value={event.externalReference} onChange={(e) => setEvent((v) => ({ ...v, externalReference: e.target.value }))} />
            <Input placeholder="Authority or PRO actor" value={event.actorName} onChange={(e) => setEvent((v) => ({ ...v, actorName: e.target.value }))} />
            <Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((v) => ({ ...v, occurredAt: e.target.value }))} />
            <Input placeholder="Typed receipt evidence UUID" value={event.evidenceDocumentId} onChange={(e) => setEvent((v) => ({ ...v, evidenceDocumentId: e.target.value }))} /></div>
          {event.eventType === 'fee_payment_confirmed' && <div className="grid gap-2 md:grid-cols-2">
            <Input type="number" min="0" placeholder="Paid amount" value={event.amount} onChange={(e) => setEvent((v) => ({ ...v, amount: e.target.value }))} />
            <Input placeholder="Currency" value={event.currency} onChange={(e) => setEvent((v) => ({ ...v, currency: e.target.value.toUpperCase() }))} />
          </div>}
          {event.eventType === 'report_submission_confirmed' && <div className="grid gap-2 md:grid-cols-2">
            <Input type="date" value={event.reportingPeriodStart} onChange={(e) => setEvent((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
            <Input type="date" value={event.reportingPeriodEnd} onChange={(e) => setEvent((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
          </div>}
          <Button size="sm" disabled={externalEventIncomplete
            || !['approved_for_internal_planning', 'external_evidence_recorded'].includes(latest.assessmentStatus) || Boolean(busy)} onClick={() => void recordEvent()}>
            Record evidence-backed external event
          </Button>
        </div>
      </section>}
    </CardContent>
  </Card>;
}
