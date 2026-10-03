'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, FileText, LockKeyhole, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
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
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEventDialog, setOpenEventDialog] = useState(false);

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
    setOpenCreateDialog(false);
  }, 'Đã tạo revision EPR bất biến.');

  const review = (decision: EprReview['decision']) => run('review', () => reviewEuTextileEprAssessment(latest!.id, {
    reviewerRole: 'eu_epr_specialist', decision, notes: reviewNotes
  }), 'Đã ghi nhận EPR specialist review.');

  const recordEvent = () => run('event', () => {
    const { amount, currency, reportingPeriodStart, reportingPeriodEnd, ...base } = event;
    const res = recordEuTextileEprExternalEvent(latest!.id, { ...base, occurredAt: new Date(event.occurredAt).toISOString(),
      ...(event.eventType === 'fee_payment_confirmed' ? { amount: Number(amount), currency } : {}),
      ...(event.eventType === 'report_submission_confirmed' ? { reportingPeriodStart, reportingPeriodEnd } : {}) });
    setOpenEventDialog(false);
    return res;
  }, 'Đã lưu external evidence event.');

  const externalEventIncomplete = !event.externalReference || !event.actorName || !event.occurredAt || !event.evidenceDocumentId
    || (event.eventType === 'fee_payment_confirmed' && (event.amount === '' || !/^[A-Z]{3}$/.test(event.currency)))
    || (event.eventType === 'report_submission_confirmed'
      && (!event.reportingPeriodStart || !event.reportingPeriodEnd
        || event.reportingPeriodStart !== latest?.reportingPeriodStart || event.reportingPeriodEnd !== latest?.reportingPeriodEnd));

  return (
    <Card className="mt-4 rounded-xl border-blue-200 bg-white shadow-xs">
      <CardHeader className="border-b border-blue-100/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <span>R17 — EU textile & footwear EPR core</span>
              <Badge variant="outline" className="text-xs font-normal border-blue-300 text-blue-800 bg-blue-50">
                Directive (EU) 2025/1892 · limited
              </Badge>
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="h-8 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium shadow-xs"
              onClick={() => setOpenCreateDialog(true)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tạo Revision EPR
            </Button>
            {latest && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-blue-300 text-blue-800 hover:bg-blue-50"
                onClick={() => setOpenEventDialog(true)}
              >
                <FileText className="mr-1 h-3.5 w-3.5" />
                Ghi nhận sự kiện
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle className="mr-2 inline h-4 w-4 align-[-2px] text-amber-700" />
          EU-core planning only. Không phải đăng ký quốc gia, PRO invoice, thanh toán hay xác nhận đã nộp. Format hài hòa và country adapters phải được cập nhật khi nguồn chính thức ban hành.
        </div>

        {latest ? (
          <section className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <b className="text-base text-slate-900 font-bold">{latest.assessmentReference} · {latest.memberState} · rev {latest.revision}</b>
                <Badge className="bg-blue-700">{latest.assessmentStatus}</Badge>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Khai báo (Declared)</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{latest.result.totals.declaredQuantity} <span className="text-xs font-normal text-slate-500">sp</span> / {latest.result.totals.declaredWeightKg} <span className="text-xs font-normal text-slate-500">kg</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Đối soát hệ thống (Ledger)</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{latest.result.totals.systemQuantity} <span className="text-xs font-normal text-slate-500">sp</span> / {latest.result.totals.systemWeightKg} <span className="text-xs font-normal text-slate-500">kg</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-500">Hạn định kỳ (Statutory Date)</div>
                <div className="text-base font-bold text-blue-800 mt-0.5">{latest.result.statutoryApplicationDate || '—'}</div>
              </div>
            </div>

            {latest.result.findings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-semibold text-slate-700">Phát hiện / Findings ({latest.result.findings.length}):</div>
                {latest.result.findings.map((item) => (
                  <p key={`${item.code}:${item.path}`} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                    <b className="text-blue-800">{item.code}</b> · {item.message}
                  </p>
                ))}
              </div>
            )}

            <div>
              <a href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-700 underline font-medium">
                Official EU source <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
              <b className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Named EU EPR specialist review</b>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Producer role, Member-State adapter, PRO mandate, CN scope and volume reconciliation reviewed"
                className="text-xs min-h-[60px]"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" className="h-8 text-xs bg-blue-700 hover:bg-blue-800 text-white" disabled={!reviewNotes || latest.automatedStatus !== 'specialist_review_required' || Boolean(busy)} onClick={() => void review('approved_for_internal_planning')}>
                  Approve internal planning
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
            <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600">Chưa có bản đánh giá EU Textile EPR nào.</p>
            <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs" onClick={() => setOpenCreateDialog(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tạo bản đánh giá đầu tiên
            </Button>
          </div>
        )}
      </CardContent>

      {/* DIALOG 1: Tạo Revision EPR mới */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>Tạo revision EPR dệt may EU bất biến</DialogTitle>
            <DialogDescription>
              Khai báo tổ chức chịu trách nhiệm, thông tin nhà sản xuất và đối soát khối lượng thị trường.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-3">
            <section className="space-y-3">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Assessment, Member State và kỳ đối soát</b>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input placeholder="Assessment reference (VD: EPR-NL-2026-V1)" value={input.assessmentReference} onChange={(e) => setInput((v) => ({ ...v, assessmentReference: e.target.value }))} />
                <Input type="date" value={input.assessmentDate} onChange={(e) => setInput((v) => ({ ...v, assessmentDate: e.target.value }))} />
                <Input placeholder="EU Member State, e.g. NL" value={input.memberState} onChange={(e) => setInput((v) => ({ ...v, memberState: e.target.value.toUpperCase(),
                  authorizedRepresentative: { ...v.authorizedRepresentative, address: { ...v.authorizedRepresentative.address, country: e.target.value.toUpperCase() } },
                  producerResponsibilityOrganisation: { ...v.producerResponsibilityOrganisation, address: { ...v.producerResponsibilityOrganisation.address, country: e.target.value.toUpperCase() } } }))} />
                <Input aria-label="EPR period start" type="date" value={input.reportingPeriodStart} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
                <Input aria-label="EPR period end" type="date" value={input.reportingPeriodEnd} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
                <Input placeholder="Annex IVc CN codes (phân cách bằng dấu phẩy)" value={input.cnCodes.join(', ')} onChange={(e) => setInput((v) => ({ ...v, cnCodes: csv(e.target.value) }))} />
              </div>
              <Textarea placeholder="Mục đích sử dụng (Intended use)" value={input.intendedUse} onChange={(e) => setInput((v) => ({ ...v, intendedUse: e.target.value }))} rows={2} />
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Producer identity and qualification</b>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input placeholder="Legal name" value={input.producer.legalName} onChange={(e) => patchProducer('legalName', e.target.value)} />
                <Input placeholder="Brand names" value={input.producer.brandNames.join(', ')} onChange={(e) => patchProducer('brandNames', csv(e.target.value))} />
                <Select value={input.producer.role} onValueChange={(role: EuTextileEprInput['producer']['role']) => patchProducer('role', role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
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

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Producer responsibility organisation and mandate</b>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input placeholder="PRO name" value={input.producerResponsibilityOrganisation.name} onChange={(e) => patchPro('name', e.target.value)} />
                <Input placeholder="PRO email" value={input.producerResponsibilityOrganisation.email} onChange={(e) => patchPro('email', e.target.value)} />
                <Input placeholder="PRO website" value={input.producerResponsibilityOrganisation.website} onChange={(e) => patchPro('website', e.target.value)} />
                <Input placeholder="PRO street" value={input.producerResponsibilityOrganisation.address.street} onChange={(e) => patchProAddress('street', e.target.value)} />
                <Input placeholder="PRO postal code" value={input.producerResponsibilityOrganisation.address.postalCode} onChange={(e) => patchProAddress('postalCode', e.target.value)} />
                <Input placeholder="PRO city" value={input.producerResponsibilityOrganisation.address.city} onChange={(e) => patchProAddress('city', e.target.value)} />
                <Input placeholder="PRO national ID" value={input.producerResponsibilityOrganisation.nationalIdentificationCode} onChange={(e) => patchPro('nationalIdentificationCode', e.target.value)} />
                <Input placeholder="PRO trade register" value={input.producerResponsibilityOrganisation.tradeRegisterNumber} onChange={(e) => patchPro('tradeRegisterNumber', e.target.value)} />
                <Input placeholder="PRO tax ID" value={input.producerResponsibilityOrganisation.taxIdentificationNumber} onChange={(e) => patchPro('taxIdentificationNumber', e.target.value)} />
                <Input className="sm:col-span-3" placeholder="PRO written-mandate evidence UUIDs" value={input.producerResponsibilityOrganisation.mandateEvidenceIds.join(', ')} onChange={(e) => patchPro('mandateEvidenceIds', csv(e.target.value))} />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Member-State adapter — source-versioned</b>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Input placeholder="Adapter ID" value={input.memberStateRule.adapterId} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, adapterId: e.target.value } }))} />
                <Input placeholder="Adapter version" value={input.memberStateRule.version} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, version: e.target.value } }))} />
                <Select value={input.memberStateRule.schemeStatus} onValueChange={(schemeStatus: EuTextileEprInput['memberStateRule']['schemeStatus']) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, schemeStatus } }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="not_transposed">Not transposed</SelectItem>
                    <SelectItem value="transposed">Transposed</SelectItem>
                    <SelectItem value="existing_scheme">Existing scheme</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="sm:col-span-2" placeholder="Primary source URL" value={input.memberStateRule.sourceUrl} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, sourceUrl: e.target.value } }))} />
                <Input type="date" value={input.memberStateRule.effectiveFrom || ''} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, effectiveFrom: e.target.value || null } }))} />
                <Input placeholder="Competent authority" value={input.memberStateRule.competentAuthorityName} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, competentAuthorityName: e.target.value } }))} />
                <Input placeholder="National register URL" value={input.memberStateRule.registerUrl} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, registerUrl: e.target.value } }))} />
                <Select value={input.memberStateRule.feeMethodStatus} onValueChange={(feeMethodStatus: EuTextileEprInput['memberStateRule']['feeMethodStatus']) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, feeMethodStatus } }))}>
                  <SelectTrigger aria-label="Fee method status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Fee method unknown</SelectItem>
                    <SelectItem value="pending">Fee method pending</SelectItem>
                    <SelectItem value="published">Fee method published</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Rule-review evidence UUIDs" value={input.memberStateRule.reviewEvidenceIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, reviewEvidenceIds: csv(e.target.value) } }))} />
              </div>
              <Textarea placeholder="Reporting schedule" value={input.memberStateRule.reportingSchedule} onChange={(e) => setInput((v) => ({ ...v, memberStateRule: { ...v.memberStateRule, reportingSchedule: e.target.value } }))} rows={2} />
              <Textarea placeholder="Authorised representative national-rule basis" value={input.authorizedRepresentative.nationalRuleBasis} onChange={(e) => setInput((v) => ({ ...v, authorizedRepresentative: { ...v.authorizedRepresentative, nationalRuleBasis: e.target.value } }))} rows={2} />
              <Select value={input.authorizedRepresentative.applicable ? 'yes' : 'no'} onValueChange={(value) => patchRepresentative('applicable', value === 'yes')}>
                <SelectTrigger aria-label="Authorised representative applicable"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Representative not required by reviewed national rule</SelectItem>
                  <SelectItem value="yes">Representative applicable</SelectItem>
                </SelectContent>
              </Select>
              {input.authorizedRepresentative.applicable && (
                <div className="grid gap-2.5 sm:grid-cols-3 pt-2">
                  <Input placeholder="Representative name" value={input.authorizedRepresentative.name} onChange={(e) => patchRepresentative('name', e.target.value)} />
                  <Input placeholder="Representative email" value={input.authorizedRepresentative.email} onChange={(e) => patchRepresentative('email', e.target.value)} />
                  <Input placeholder="Representative street" value={input.authorizedRepresentative.address.street} onChange={(e) => patchRepresentativeAddress('street', e.target.value)} />
                  <Input placeholder="Representative postal code" value={input.authorizedRepresentative.address.postalCode} onChange={(e) => patchRepresentativeAddress('postalCode', e.target.value)} />
                  <Input placeholder="Representative city" value={input.authorizedRepresentative.address.city} onChange={(e) => patchRepresentativeAddress('city', e.target.value)} />
                  <Input placeholder="Representative national ID" value={input.authorizedRepresentative.nationalIdentificationCode} onChange={(e) => patchRepresentative('nationalIdentificationCode', e.target.value)} />
                  <Input placeholder="Representative trade register" value={input.authorizedRepresentative.tradeRegisterNumber} onChange={(e) => patchRepresentative('tradeRegisterNumber', e.target.value)} />
                  <Input placeholder="Representative tax ID" value={input.authorizedRepresentative.taxIdentificationNumber} onChange={(e) => patchRepresentative('taxIdentificationNumber', e.target.value)} />
                  <Input placeholder="Representative mandate evidence UUIDs" value={input.authorizedRepresentative.mandateEvidenceIds.join(', ')} onChange={(e) => patchRepresentative('mandateEvidenceIds', csv(e.target.value))} />
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
              <b className="text-xs font-semibold uppercase tracking-wider text-slate-700">Declared market volume vs shipment ledger</b>
              <p className="text-xs text-slate-600">JSON rows are reconciled by exact CN code and unit against confirmed shipment lines for the Member State and invoice period.</p>
              <Textarea className="min-h-28 font-mono text-xs" value={rowsJson} onChange={(e) => setRowsJson(e.target.value)} />
              <Input placeholder="Assessment evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
              <Select value={input.truthStatementConfirmed ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, truthStatementConfirmed: value === 'yes' }))}>
                <SelectTrigger aria-label="Registration truth statement"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Truth statement not confirmed</SelectItem>
                  <SelectItem value="yes">Information confirmed true for internal dossier</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Limitations" value={input.limitations} onChange={(e) => setInput((v) => ({ ...v, limitations: e.target.value }))} rows={2} />
            </section>
          </div>

          <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenCreateDialog(false)}>Hủy</Button>
            <Button
              disabled={!input.assessmentReference || Boolean(busy)}
              onClick={() => void create()}
              className="bg-blue-700 hover:bg-blue-800 text-white font-medium"
            >
              <LockKeyhole className="mr-2 h-4 w-4" />
              Create immutable EPR revision
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: Ghi nhận sự kiện thẩm quyền (External Evidence Event) */}
      <Dialog open={openEventDialog} onOpenChange={setOpenEventDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>External authority/PRO evidence event</DialogTitle>
            <DialogDescription>
              Ghi nhận chứng từ xác nhận từ cơ quan quản lý thành viên EU hoặc tổ chức PRO.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            <Select value={event.eventType} onValueChange={(eventType) => setEvent((v) => ({ ...v, eventType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="authority_registration_confirmed">Authority registration confirmed</SelectItem>
                <SelectItem value="pro_membership_confirmed">PRO membership confirmed</SelectItem>
                <SelectItem value="report_submission_confirmed">Report submission confirmed</SelectItem>
                <SelectItem value="fee_payment_confirmed">Fee payment confirmed</SelectItem>
                <SelectItem value="authority_rejected">Authority rejected</SelectItem>
                <SelectItem value="registration_withdrawn">Registration withdrawn</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input placeholder="External reference" value={event.externalReference} onChange={(e) => setEvent((v) => ({ ...v, externalReference: e.target.value }))} />
              <Input placeholder="Authority or PRO actor" value={event.actorName} onChange={(e) => setEvent((v) => ({ ...v, actorName: e.target.value }))} />
              <Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((v) => ({ ...v, occurredAt: e.target.value }))} />
              <Input placeholder="Typed receipt evidence UUID" value={event.evidenceDocumentId} onChange={(e) => setEvent((v) => ({ ...v, evidenceDocumentId: e.target.value }))} />
            </div>

            {event.eventType === 'fee_payment_confirmed' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input type="number" min="0" placeholder="Paid amount" value={event.amount} onChange={(e) => setEvent((v) => ({ ...v, amount: e.target.value }))} />
                <Input placeholder="Currency (EUR)" value={event.currency} onChange={(e) => setEvent((v) => ({ ...v, currency: e.target.value.toUpperCase() }))} />
              </div>
            )}

            {event.eventType === 'report_submission_confirmed' && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input type="date" value={event.reportingPeriodStart} onChange={(e) => setEvent((v) => ({ ...v, reportingPeriodStart: e.target.value }))} />
                <Input type="date" value={event.reportingPeriodEnd} onChange={(e) => setEvent((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} />
              </div>
            )}

            <div className="pt-3 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenEventDialog(false)}>Hủy</Button>
              <Button
                disabled={externalEventIncomplete || !latest || !['approved_for_internal_planning', 'external_evidence_recorded'].includes(latest.assessmentStatus) || Boolean(busy)}
                onClick={() => void recordEvent()}
                className="bg-blue-700 hover:bg-blue-800 text-white font-medium"
              >
                Record evidence-backed external event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
