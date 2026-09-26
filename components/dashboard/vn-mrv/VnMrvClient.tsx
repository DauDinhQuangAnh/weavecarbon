"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";import {ClipboardCheck,FileLock2,Loader2} from "lucide-react";import {useTranslations} from "next-intl";import {Badge} from "@/components/ui/badge";import {Button} from "@/components/ui/button";import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card";import {Input} from "@/components/ui/input";import {Textarea} from "@/components/ui/textarea";import {isApiError} from "@/lib/apiClient";import {industrialCoreApi,type IndustrialFacility} from "@/lib/industrialCoreApi";import {fetchCorporateGhgInventories,type CorporateGhgInventory} from "@/lib/weave-v2/corporateGhgInventoryApi";import {vnMrvApi,type VnMrvCase,type VnMrvFiling,type VnMrvPlan} from "@/lib/vnMrvApi";
const today="2026-09-15";
export default function VnMrvClient({demo=false}:{demo?:boolean}){const t=useTranslations("vnMrv");const [facilities,setFacilities]=useState<IndustrialFacility[]>([]);const[cases,setCases]=useState<VnMrvCase[]>([]);const[plans,setPlans]=useState<VnMrvPlan[]>([]);const[filings,setFilings]=useState<VnMrvFiling[]>([]);const[inventories,setInventories]=useState<CorporateGhgInventory[]>([]);const[loading,setLoading]=useState(!demo);const[saving,setSaving]=useState(false);const[error,setError]=useState<string|null>(null);const[caseForm,setCaseForm]=useState({caseReference:"",facilityRevisionId:"",reportingYear:2026,sector:"industry_trade",applicabilityStatus:"undetermined",listingReference:"",listingEvidenceDocumentId:"",assessmentDate:today,rationale:""});const[planForm,setPlanForm]=useState({caseId:"",planReference:"",sourceReference:"",methodology:"",qaqc:"",uncertainty:"",dqlIds:"",evidenceIds:""});const[filingForm,setFilingForm]=useState({caseId:"",measurementPlanId:"",corporateInventoryId:""});
const load=useCallback(async()=>{if(demo)return;setLoading(true);try{const[f,c,p,i,g]=await Promise.all([industrialCoreApi.facilities(),vnMrvApi.cases(),vnMrvApi.plans(),vnMrvApi.filings(),fetchCorporateGhgInventories()]);setFacilities(f);setCases(c);setPlans(p);setFilings(i);setInventories(g);}catch(e){setError(isApiError(e)?e.message:t("loadError"));}finally{setLoading(false);}},[demo,t]);useEffect(()=>{void load();},[load]);
const saveCase=async(e:FormEvent)=>{e.preventDefault();if(demo||saving)return;setSaving(true);try{const payload={...caseForm,listingReference:caseForm.listingReference||null,listingEvidenceDocumentId:caseForm.listingEvidenceDocumentId||null};const x=await vnMrvApi.createCase(payload);setCases(v=>[x,...v]);}catch(x){setError(isApiError(x)?x.message:t("saveError"));}finally{setSaving(false);}};
const savePlan=async(e:FormEvent)=>{e.preventDefault();if(demo||saving)return;setSaving(true);try{const ids=(s:string)=>s.split(",").map(x=>x.trim()).filter(Boolean);const x=await vnMrvApi.createPlan({caseId:planForm.caseId,planReference:planForm.planReference,organizationalBoundary:{approach:"operational_control"},operationalBoundary:{scopes:["scope1","scope2"]},sourceMap:[{reference:planForm.sourceReference}],methodology:{description:planForm.methodology},qaqcPlan:{description:planForm.qaqc},uncertaintyPlan:{description:planForm.uncertainty},dqlAssessmentIds:ids(planForm.dqlIds),evidenceDocumentIds:ids(planForm.evidenceIds)});setPlans(v=>[x,...v]);}catch(x){setError(isApiError(x)?x.message:t("saveError"));}finally{setSaving(false);}};
const prepare=async(e:FormEvent)=>{e.preventDefault();if(demo||saving)return;setSaving(true);try{const x=await vnMrvApi.prepareFiling(filingForm);setFilings(v=>[x,...v]);}catch(x){setError(isApiError(x)?x.message:t("saveError"));}finally{setSaving(false);}};
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-red-950 via-slate-950 to-emerald-950 p-7 text-white shadow-md">
        <p className="text-sm font-semibold uppercase tracking-[.15em] text-emerald-200">
          G2-03 · Báo cáo MRV Quốc gia (Nghị định 06/2022/NĐ-CP)
        </p>
        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-slate-200 text-sm leading-relaxed">{t("description")}</p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("demoReadOnly")}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        {/* Case Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("caseTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("caseDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={saveCase}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã hồ sơ (Case Reference)</label>
                <Input required disabled={demo} placeholder={t("caseReference")} value={caseForm.caseReference} onChange={e => setCaseForm({ ...caseForm, caseReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={demo} className={select} value={caseForm.facilityRevisionId} onChange={e => setCaseForm({ ...caseForm, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Trạng thái danh mục bắt buộc</label>
                <select disabled={demo} className={select} value={caseForm.applicabilityStatus} onChange={e => setCaseForm({ ...caseForm, applicabilityStatus: e.target.value })}>
                  <option value="undetermined">undetermined (Chưa xác định)</option>
                  <option value="potentially_listed">potentially listed (Có khả năng thuộc danh mục)</option>
                  <option value="confirmed_listed">confirmed listed (Bắt buộc kiểm kê QĐ 01/2022)</option>
                  <option value="not_listed">not listed (Không thuộc đối tượng)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã quyết định / danh mục</label>
                <Input disabled={demo} placeholder={t("listingReference")} value={caseForm.listingReference} onChange={e => setCaseForm({ ...caseForm, listingReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Tài liệu pháp lý chứng minh</label>
                <Input disabled={demo} placeholder={t("listingEvidence")} value={caseForm.listingEvidenceDocumentId} onChange={e => setCaseForm({ ...caseForm, listingEvidenceDocumentId: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Căn cứ pháp lý & giải trình</label>
                <Textarea required disabled={demo} placeholder={t("rationale")} value={caseForm.rationale} onChange={e => setCaseForm({ ...caseForm, rationale: e.target.value })} />
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createCase")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plan Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("planTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("planDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={savePlan}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectCase")}</label>
                <select required disabled={demo} className={select} value={planForm.caseId} onChange={e => setPlanForm({ ...planForm, caseId: e.target.value })}>
                  <option value="">{t("selectCase")}</option>
                  {cases.map(x => <option key={x.id} value={x.id}>{x.caseReference}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã kế hoạch giám sát</label>
                <Input required disabled={demo} placeholder={t("planReference")} value={planForm.planReference} onChange={e => setPlanForm({ ...planForm, planReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã nguồn phát thải</label>
                <Input required disabled={demo} placeholder={t("sourceReference")} value={planForm.sourceReference} onChange={e => setPlanForm({ ...planForm, sourceReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phương pháp đo đạc</label>
                <Textarea required disabled={demo} placeholder={t("methodology")} value={planForm.methodology} onChange={e => setPlanForm({ ...planForm, methodology: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Kế hoạch QA/QC</label>
                <Textarea required disabled={demo} placeholder="Quy trình kiểm soát chất lượng QA/QC..." value={planForm.qaqc} onChange={e => setPlanForm({ ...planForm, qaqc: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Độ không đảm bảo đo (Uncertainty)</label>
                <Textarea required disabled={demo} placeholder={t("uncertainty")} value={planForm.uncertainty} onChange={e => setPlanForm({ ...planForm, uncertainty: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID đánh giá DQL</label>
                <Input disabled={demo} placeholder={t("dqlIds")} value={planForm.dqlIds} onChange={e => setPlanForm({ ...planForm, dqlIds: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Bằng chứng liên kết</label>
                <Input disabled={demo} placeholder={t("evidenceIds")} value={planForm.evidenceIds} onChange={e => setPlanForm({ ...planForm, evidenceIds: e.target.value })} />
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createPlan")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Filing Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("filingTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("filingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={prepare}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectCase")}</label>
                <select required disabled={demo} className={select} value={filingForm.caseId} onChange={e => setFilingForm({ ...filingForm, caseId: e.target.value, measurementPlanId: "" })}>
                  <option value="">{t("selectCase")}</option>
                  {cases.map(x => <option key={x.id} value={x.id}>{x.caseReference}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectPlan")}</label>
                <select required disabled={demo} className={select} value={filingForm.measurementPlanId} onChange={e => setFilingForm({ ...filingForm, measurementPlanId: e.target.value })}>
                  <option value="">{t("selectPlan")}</option>
                  {plans.filter(x => x.caseId === filingForm.caseId).map(x => <option key={x.id} value={x.id}>{x.planReference}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInventory")}</label>
                <select required disabled={demo} className={select} value={filingForm.corporateInventoryId} onChange={e => setFilingForm({ ...filingForm, corporateInventoryId: e.target.value })}>
                  <option value="">{t("selectInventory")}</option>
                  {inventories.map(x => <option key={x.id} value={x.id}>{x.inventoryReference} · rev {x.revision}</option>)}
                </select>
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("prepareFiling")}
              </Button>
            </form>
            <div className="mt-5 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ nộp MRV</h4>
              {filings.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Chưa có hồ sơ nào được chuẩn bị</p>
              ) : (
                filings.map(x => (
                  <div key={x.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <FileLock2 className="h-4 w-4 text-emerald-600" />
                      <Badge variant="outline" className="font-semibold">{x.readinessStatus}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {x.blockers.length ? x.blockers.join(" · ") : t("noBlockers")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 bg-slate-50/50">
        <CardContent className="flex gap-3 p-5">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{t("legalNotice")}</p>
        </CardContent>
      </Card>
    </main>
  );
}
