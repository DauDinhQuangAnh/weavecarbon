"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";import {FileLock2,Leaf,Loader2,Scale} from "lucide-react";import {useTranslations} from "next-intl";import {Badge} from "@/components/ui/badge";import {Button} from "@/components/ui/button";import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "@/components/ui/card";import {Input} from "@/components/ui/input";import {Textarea} from "@/components/ui/textarea";import {isApiError} from "@/lib/apiClient";import {industrialCoreApi,type IndustrialFacility} from "@/lib/industrialCoreApi";import {fetchCorporateGhgInventories,type CorporateGhgInventory} from "@/lib/weave-v2/corporateGhgInventoryApi";import {mitigationOperationsApi,type AllowanceAllocation,type AllowancePosition,type MitigationInitiative,type MitigationScenario} from "@/lib/mitigationOperationsApi";
const ids=(value:string)=>value.split(",").map((item)=>item.trim()).filter(Boolean);const select="h-10 w-full rounded-md border bg-background px-3 text-sm";
export default function MitigationOperationsClient({demo=false}:{demo?:boolean}){const t=useTranslations("mitigationOperations");const[facilities,setFacilities]=useState<IndustrialFacility[]>([]);const[inventories,setInventories]=useState<CorporateGhgInventory[]>([]);const[initiatives,setInitiatives]=useState<MitigationInitiative[]>([]);const[scenarios,setScenarios]=useState<MitigationScenario[]>([]);const[allocations,setAllocations]=useState<AllowanceAllocation[]>([]);const[positions,setPositions]=useState<AllowancePosition[]>([]);const[loading,setLoading]=useState(!demo);const[saving,setSaving]=useState(false);const[error,setError]=useState<string|null>(null);
const[initiative,setInitiative]=useState({initiativeReference:"",facilityRevisionId:"",title:"",lifecycleStatus:"proposed",ownerName:"",baselineYear:2025,targetReductionTco2e:0,plannedStart:"2026-01-01",plannedEnd:"2027-12-31",methodology:"",assumptions:"",evidenceDocumentIds:""});const[scenario,setScenario]=useState({initiativeId:"",scenarioReference:"",scenarioType:"planned",periodStart:"2026-01-01",periodEnd:"2026-12-31",baselineEmissionsTco2e:0,projectedEmissionsTco2e:0,assumptions:"",sensitivity:"",evidenceDocumentIds:""});const[allocation,setAllocation]=useState({allocationReference:"",facilityRevisionId:"",reportingYear:2026,instrumentType:"authority_quota",recordStatus:"draft_reference",quantityTco2e:0,vintageYear:2026,externalReference:"",evidenceDocumentId:"",notes:""});const[position,setPosition]=useState({facilityRevisionId:"",corporateInventoryId:"",reportingYear:2026,allocationIds:"",scenarioIds:""});
const load=useCallback(async()=>{if(demo)return;setLoading(true);try{const[f,i,m,s,a,p]=await Promise.all([industrialCoreApi.facilities(),fetchCorporateGhgInventories(),mitigationOperationsApi.initiatives(),mitigationOperationsApi.scenarios(),mitigationOperationsApi.allocations(),mitigationOperationsApi.positions()]);setFacilities(f);setInventories(i);setInitiatives(m);setScenarios(s);setAllocations(a);setPositions(p);}catch(e){setError(isApiError(e)?e.message:t("loadError"));}finally{setLoading(false);}},[demo,t]);useEffect(()=>{void load();},[load]);
const save=async(e:FormEvent,action:()=>Promise<unknown> )=>{e.preventDefault();if(demo||saving)return;setSaving(true);setError(null);try{await action();await load();}catch(x){setError(isApiError(x)?x.message:t("saveError"));}finally{setSaving(false);}};
const saveInitiative=(e:FormEvent)=>save(e,()=>mitigationOperationsApi.createInitiative({...initiative,methodology:{description:initiative.methodology},assumptions:{description:initiative.assumptions},evidenceDocumentIds:ids(initiative.evidenceDocumentIds)}));
const saveScenario=(e:FormEvent)=>save(e,()=>mitigationOperationsApi.createScenario({...scenario,annualProjection:[{year:Number(scenario.periodEnd.slice(0,4)),projectedTco2e:Number(scenario.projectedEmissionsTco2e)}],assumptions:{description:scenario.assumptions},sensitivity:{description:scenario.sensitivity},evidenceDocumentIds:ids(scenario.evidenceDocumentIds)}));
const saveAllocation=(e:FormEvent)=>save(e,()=>mitigationOperationsApi.createAllocation({...allocation,externalReference:allocation.externalReference||null,evidenceDocumentId:allocation.evidenceDocumentId||null}));
const savePosition=(e:FormEvent)=>save(e,()=>mitigationOperationsApi.createPosition({...position,allocationIds:ids(position.allocationIds),scenarioIds:ids(position.scenarioIds)}));
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950 p-7 text-white shadow-md">
        <p className="text-sm font-semibold uppercase tracking-[.15em] text-emerald-200">
          G2-04 · Giảm thiểu & Quản lý Hạn ngạch
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

      <section className="grid gap-6 xl:grid-cols-2">
        {/* Initiative Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("initiativeTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("initiativeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveInitiative}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã sáng kiến</label>
                <Input required disabled={demo} placeholder={t("initiativeReference")} value={initiative.initiativeReference} onChange={e => setInitiative({ ...initiative, initiativeReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={demo} className={select} value={initiative.facilityRevisionId} onChange={e => setInitiative({ ...initiative, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Tên sáng kiến</label>
                <Input required disabled={demo} placeholder={t("initiativeName")} value={initiative.title} onChange={e => setInitiative({ ...initiative, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Người phụ trách</label>
                <Input required disabled={demo} placeholder={t("owner")} value={initiative.ownerName} onChange={e => setInitiative({ ...initiative, ownerName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mục tiêu giảm (tCO₂e)</label>
                <Input required disabled={demo} type="number" min="0.000001" step="any" placeholder={t("targetReduction")} value={initiative.targetReductionTco2e || ""} onChange={e => setInitiative({ ...initiative, targetReductionTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Tài liệu bằng chứng</label>
                <Input required disabled={demo} placeholder={t("evidenceIds")} value={initiative.evidenceDocumentIds} onChange={e => setInitiative({ ...initiative, evidenceDocumentIds: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Phương pháp tính</label>
                <Textarea required disabled={demo} placeholder={t("methodology")} value={initiative.methodology} onChange={e => setInitiative({ ...initiative, methodology: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Giả định tính toán</label>
                <Textarea required disabled={demo} placeholder={t("assumptions")} value={initiative.assumptions} onChange={e => setInitiative({ ...initiative, assumptions: e.target.value })} />
              </div>
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createInitiative")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sáng kiến hiện có</h4>
              {initiatives.slice(0, 4).map(x => (
                <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <span className="text-sm"><b>{x.initiativeReference}</b> · {x.title}</span>
                  <Badge variant="outline" className="font-mono text-emerald-800 border-emerald-200 bg-emerald-50">{x.targetReductionTco2e} tCO₂e</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scenario Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("scenarioTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("scenarioDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveScenario}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInitiative")}</label>
                <select required disabled={demo} className={select} value={scenario.initiativeId} onChange={e => setScenario({ ...scenario, initiativeId: e.target.value })}>
                  <option value="">{t("selectInitiative")}</option>
                  {initiatives.map(x => <option key={x.id} value={x.id}>{x.initiativeReference}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã kịch bản</label>
                <Input required disabled={demo} placeholder={t("scenarioReference")} value={scenario.scenarioReference} onChange={e => setScenario({ ...scenario, scenarioReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phát thải cơ sở (tCO₂e)</label>
                <Input required disabled={demo} type="number" min="0" step="any" placeholder={t("baselineEmissions")} value={scenario.baselineEmissionsTco2e || ""} onChange={e => setScenario({ ...scenario, baselineEmissionsTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phát thải dự phóng (tCO₂e)</label>
                <Input required disabled={demo} type="number" min="0" step="any" placeholder={t("projectedEmissions")} value={scenario.projectedEmissionsTco2e || ""} onChange={e => setScenario({ ...scenario, projectedEmissionsTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Giả định kịch bản</label>
                <Textarea required disabled={demo} placeholder={t("assumptions")} value={scenario.assumptions} onChange={e => setScenario({ ...scenario, assumptions: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Phân tích độ nhạy</label>
                <Textarea required disabled={demo} placeholder={t("sensitivity")} value={scenario.sensitivity} onChange={e => setScenario({ ...scenario, sensitivity: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Bằng chứng liên kết</label>
                <Input required disabled={demo} placeholder={t("evidenceIds")} value={scenario.evidenceDocumentIds} onChange={e => setScenario({ ...scenario, evidenceDocumentIds: e.target.value })} />
              </div>
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createScenario")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kịch bản dự phóng</h4>
              {scenarios.slice(0, 4).map(x => (
                <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <span className="text-sm"><b>{x.scenarioReference}</b> · {x.scenarioType}</span>
                  <Badge variant="outline" className="font-mono text-cyan-800 border-cyan-200 bg-cyan-50">−{x.expectedReductionTco2e} tCO₂e</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allocation Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("allocationTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("allocationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveAllocation}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã phân bổ</label>
                <Input required disabled={demo} placeholder={t("allocationReference")} value={allocation.allocationReference} onChange={e => setAllocation({ ...allocation, allocationReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={demo} className={select} value={allocation.facilityRevisionId} onChange={e => setAllocation({ ...allocation, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Loại công cụ</label>
                <select disabled={demo} className={select} value={allocation.instrumentType} onChange={e => setAllocation({ ...allocation, instrumentType: e.target.value })}>
                  <option value="authority_quota">authority quota</option>
                  <option value="internal_budget">internal budget</option>
                  <option value="transfer_reference">transfer reference</option>
                  <option value="credit_reference">credit reference</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Trạng thái hồ sơ</label>
                <select disabled={demo} className={select} value={allocation.recordStatus} onChange={e => setAllocation({ ...allocation, recordStatus: e.target.value })}>
                  <option value="draft_reference">draft reference</option>
                  <option value="evidence_confirmed">evidence confirmed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Khối lượng (tCO₂e)</label>
                <Input required disabled={demo} type="number" min="0.000001" step="any" placeholder={t("quantity")} value={allocation.quantityTco2e || ""} onChange={e => setAllocation({ ...allocation, quantityTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã tham chiếu bên ngoài</label>
                <Input disabled={demo} placeholder={t("externalReference")} value={allocation.externalReference} onChange={e => setAllocation({ ...allocation, externalReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID bằng chứng</label>
                <Input disabled={demo} placeholder={t("evidenceId")} value={allocation.evidenceDocumentId} onChange={e => setAllocation({ ...allocation, evidenceDocumentId: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Ghi chú</label>
                <Input required disabled={demo} placeholder={t("notes")} value={allocation.notes} onChange={e => setAllocation({ ...allocation, notes: e.target.value })} />
              </div>
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createAllocation")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hạn ngạch đã cấp</h4>
              {allocations.slice(0, 4).map(x => (
                <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <span className="text-sm"><b>{x.allocationReference}</b> · {x.instrumentType}</span>
                  <Badge variant="outline" className="font-mono text-slate-800">{x.quantityTco2e} tCO₂e</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Position Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("positionTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("positionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={savePosition}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={demo} className={select} value={position.facilityRevisionId} onChange={e => setPosition({ ...position, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInventory")}</label>
                <select required disabled={demo} className={select} value={position.corporateInventoryId} onChange={e => setPosition({ ...position, corporateInventoryId: e.target.value })}>
                  <option value="">{t("selectInventory")}</option>
                  {inventories.map(x => <option key={x.id} value={x.id}>{x.inventoryReference} · rev {x.revision}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID hạn ngạch liên kết</label>
                <Input required disabled={demo} placeholder={t("allocationIds")} value={position.allocationIds} onChange={e => setPosition({ ...position, allocationIds: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID kịch bản giảm phát thải</label>
                <Input disabled={demo} placeholder={t("scenarioIds")} value={position.scenarioIds} onChange={e => setPosition({ ...position, scenarioIds: e.target.value })} />
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={demo || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createPosition")}
              </Button>
            </form>
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vị thế carbon cơ sở</h4>
              {positions.slice(0, 4).map(x => (
                <div key={x.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Scale className="h-4 w-4 text-emerald-600" />
                    <Badge variant="outline" className="font-semibold">{x.readinessStatus}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Tổng phát thải: <b className="font-mono text-slate-900">{x.grossEmissionsTco2e} t</b></span>
                    <span>Hạn ngạch: <b className="font-mono text-slate-900">{x.authorityQuotaTco2e} t</b></span>
                    <span>Kế hoạch giảm: <b className="font-mono text-emerald-700">{x.plannedReductionTco2e} t</b></span>
                    <span>Vị thế ròng: <b className="font-mono text-cyan-800">{x.projectedPositionTco2e} t</b></span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 border-t border-slate-200/60">
                    {x.blockers.length ? x.blockers.join(" · ") : t("noBlockers")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 bg-slate-50/50">
        <CardContent className="flex gap-3 p-5">
          <FileLock2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("boundaryTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("legalNotice")}</p>
          </div>
          <Leaf className="ml-auto hidden h-5 w-5 text-emerald-700 md:block" />
        </CardContent>
      </Card>
    </main>
  );
}
