"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudSun, Loader2, MapPin, ShieldAlert, BarChart3, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { climateRiskApi, type ClimateAssessment, type ClimateLocation, type ClimatePortfolio } from "@/lib/climateRiskApi";

const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

const evidenceReady = (item: EvidenceDocumentV2) =>
  ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") &&
  item.fileSizeBytes > 0;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-slate-700">
      <span className="font-medium text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const initialLocation = {
  facilityRevisionId: "",
  latitude: "",
  longitude: "",
  precisionMeters: "100",
  locationBasis: "",
  evidenceDocumentId: ""
};

const initialAssessment = {
  facilityRevisionId: "",
  locationRevisionId: "",
  hazardType: "heat",
  scenarioKind: "historical",
  scenarioReference: "",
  horizonStart: "",
  horizonEnd: "",
  sourceKind: "ERA5_LAND",
  sourceUrl: "",
  datasetIdentifier: "",
  datasetVersion: "",
  spatialResolution: "",
  temporalResolution: "",
  gridReference: "",
  spatialMatchNotes: "",
  modelName: "",
  scenarioName: "",
  hazardMetric: "",
  metricValue: "",
  metricUnit: "",
  uncertaintyNotes: "",
  exposureRating: "3",
  vulnerabilityRating: "3",
  businessDependencyPercent: "",
  priorityBand: "medium",
  ratingRationale: "",
  evidenceDocumentId: ""
};

export default function ClimateRiskClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("climateRisk");
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [locations, setLocations] = useState<ClimateLocation[]>([]);
  const [assessments, setAssessments] = useState<ClimateAssessment[]>([]);
  const [portfolios, setPortfolios] = useState<ClimatePortfolio[]>([]);
  const [portfolioDetail, setPortfolioDetail] = useState<(ClimatePortfolio & { assessments: ClimateAssessment[] }) | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState(initialLocation);
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [portfolioReference, setPortfolioReference] = useState("");
  const [methodologyNotes, setMethodologyNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [facilityRows, evidenceResponse, locationRows, assessmentRows, portfolioRows] = await Promise.all([
        industrialCoreApi.facilities(),
        listEvidenceV2(),
        climateRiskApi.locations(),
        climateRiskApi.assessments(),
        climateRiskApi.portfolios()
      ]);
      setFacilities(facilityRows);
      setEvidence(evidenceResponse.items.filter(evidenceReady));
      setLocations(locationRows);
      setAssessments(assessmentRows);
      setPortfolios(portfolioRows);
      setError(null);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const createLocation = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await climateRiskApi.createLocation({
        ...locationForm,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        precisionMeters: Number(locationForm.precisionMeters)
      });
      setLocationForm(initialLocation);
    });
  };

  const createAssessment = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await climateRiskApi.createAssessment({
        ...assessmentForm,
        metricValue: Number(assessmentForm.metricValue),
        exposureRating: Number(assessmentForm.exposureRating),
        vulnerabilityRating: Number(assessmentForm.vulnerabilityRating),
        businessDependencyPercent: Number(assessmentForm.businessDependencyPercent)
      });
      setAssessmentForm(initialAssessment);
    });
  };

  const createPortfolio = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await climateRiskApi.createPortfolio({
        portfolioReference,
        methodologyNotes,
        assessmentIds: selectedIds
      });
      setPortfolioReference("");
      setMethodologyNotes("");
      setSelectedIds([]);
    });
  };

  const inspectPortfolio = async (id: string) => {
    try {
      setPortfolioDetail(await climateRiskApi.portfolio(id));
      setError(null);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500">Đang tải dữ liệu rủi ro khí hậu...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      {/* Top Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950 to-teal-950 p-6 md:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300 ring-1 ring-inset ring-sky-500/30">
              <CloudSun className="h-3.5 w-3.5" />
              G2-07 · Climate Risk
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/20">
              TCFD / IFRS S2 Aligned
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("title")}</h1>
          <p className="max-w-3xl text-sm md:text-base text-slate-300 leading-relaxed">{t("description")}</p>
        </div>
      </section>

      {/* Caution & notices */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Lưu ý ranh giới đánh giá rủi ro vật lý</p>
          <p className="text-xs text-amber-800 leading-relaxed">{t("caution")}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {demo && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600" />
          <span>{t("demoReadOnly")}</span>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cơ sở đánh giá</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{facilities.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Nhà máy / chi nhánh</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tọa độ định vị</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{locations.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Vị trí GIS xác minh</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Đánh giá hiểm họa</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{assessments.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Kịch bản khí hậu</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Danh mục rủi ro</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{portfolios.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Portfolio báo cáo</p>
        </div>
      </div>

      {/* 1. Location Form */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-sky-600" />
            {t("locationTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("locationDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={createLocation}>
            <Field label={t("facility")}>
              <select
                required
                disabled={demo}
                className={selectClass}
                value={locationForm.facilityRevisionId}
                onChange={(event) => setLocationForm({ ...locationForm, facilityRevisionId: event.target.value })}
              >
                <option value="">{t("selectFacility")}</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.facilityReference}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("latitude")}>
              <Input
                required
                disabled={demo}
                type="number"
                min="-90"
                max="90"
                step="0.000001"
                placeholder="Ví dụ: 10.823099"
                value={locationForm.latitude}
                onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })}
              />
            </Field>

            <Field label={t("longitude")}>
              <Input
                required
                disabled={demo}
                type="number"
                min="-180"
                max="180"
                step="0.000001"
                placeholder="Ví dụ: 106.629664"
                value={locationForm.longitude}
                onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })}
              />
            </Field>

            <Field label={t("precision")}>
              <Input
                required
                disabled={demo}
                type="number"
                min="1"
                max="100000"
                value={locationForm.precisionMeters}
                onChange={(event) => setLocationForm({ ...locationForm, precisionMeters: event.target.value })}
              />
            </Field>

            <Field label={t("locationBasis")}>
              <Input
                required
                disabled={demo}
                placeholder="Ví dụ: GPS khảo sát thực địa, Trích lục địa chính"
                value={locationForm.locationBasis}
                onChange={(event) => setLocationForm({ ...locationForm, locationBasis: event.target.value })}
              />
            </Field>

            <Field label={t("locationEvidence")}>
              <select
                required
                disabled={demo}
                className={selectClass}
                value={locationForm.evidenceDocumentId}
                onChange={(event) => setLocationForm({ ...locationForm, evidenceDocumentId: event.target.value })}
              >
                <option value="">{t("selectEvidence")}</option>
                {evidence.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.documentName}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-3 pt-2">
              <Button disabled={demo || saving} className="bg-sky-600 hover:bg-sky-700 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                {t("saveLocation")}
              </Button>
            </div>
          </form>

          {locations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Vị trí đã lưu ({locations.length})</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {locations.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm hover:border-sky-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-semibold">{item.facilityName || item.facilityRevisionId}</b>
                      <Badge variant="outline" className="text-xs bg-white text-slate-700">±{item.precisionMeters} m</Badge>
                    </div>
                    <p className="mt-1 text-slate-600 text-xs font-mono">
                      {item.latitude}, {item.longitude}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400 font-mono truncate">{item.id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Assessment Form */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-teal-600" />
            {t("assessmentTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("assessmentDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={createAssessment}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t("facility")}>
                <select
                  required
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.facilityRevisionId}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, facilityRevisionId: event.target.value, locationRevisionId: "" })
                  }
                >
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("locationRevision")}>
                <select
                  required
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.locationRevisionId}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, locationRevisionId: event.target.value })}
                >
                  <option value="">{t("selectLocation")}</option>
                  {locations
                    .filter((l) => l.facilityRevisionId === assessmentForm.facilityRevisionId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.latitude}, {l.longitude} · {l.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label={t("hazard")}>
                <select
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.hazardType}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, hazardType: event.target.value })}
                >
                  <option value="heat">{t("heat")}</option>
                  <option value="drought">{t("drought")}</option>
                  <option value="extreme_rainfall">{t("rainfall")}</option>
                </select>
              </Field>

              <Field label={t("scenarioKind")}>
                <select
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.scenarioKind}
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      scenarioKind: event.target.value,
                      sourceKind: event.target.value === "historical" ? "ERA5_LAND" : "CMIP6"
                    })
                  }
                >
                  <option value="historical">{t("historical")}</option>
                  <option value="projection">{t("projection")}</option>
                </select>
              </Field>

              <Field label={t("scenarioReference")}>
                <Input
                  required
                  disabled={demo}
                  placeholder="Ví dụ: SSP2-4.5 / Historical 1991-2020"
                  value={assessmentForm.scenarioReference}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, scenarioReference: event.target.value })}
                />
              </Field>

              <Field label={t("sourceKind")}>
                <select
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.sourceKind}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, sourceKind: event.target.value })}
                >
                  {assessmentForm.scenarioKind === "historical" ? (
                    <option value="ERA5_LAND">ERA5-Land</option>
                  ) : (
                    <option value="CMIP6">CMIP6</option>
                  )}
                  <option value="OTHER">{t("otherSource")}</option>
                </select>
              </Field>

              <Field label={t("horizonStart")}>
                <Input
                  required
                  disabled={demo}
                  type="date"
                  value={assessmentForm.horizonStart}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, horizonStart: event.target.value })}
                />
              </Field>

              <Field label={t("horizonEnd")}>
                <Input
                  required
                  disabled={demo}
                  type="date"
                  value={assessmentForm.horizonEnd}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, horizonEnd: event.target.value })}
                />
              </Field>

              <Field label={t("sourceUrl")}>
                <Input
                  required
                  disabled={demo}
                  type="url"
                  placeholder="https://cds.climate.copernicus.eu/..."
                  value={assessmentForm.sourceUrl}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, sourceUrl: event.target.value })}
                />
              </Field>

              {(["datasetIdentifier", "datasetVersion", "spatialResolution", "temporalResolution"] as const).map((key) => (
                <Field key={key} label={t(key)}>
                  <Input
                    required
                    disabled={demo}
                    value={assessmentForm[key]}
                    onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })}
                  />
                </Field>
              ))}

              <Field label={t("gridReference")}>
                <Input
                  required
                  disabled={demo}
                  placeholder="Grid ID / cell reference"
                  value={assessmentForm.gridReference}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, gridReference: event.target.value })}
                />
              </Field>

              {assessmentForm.scenarioKind === "projection" &&
                (["modelName", "scenarioName"] as const).map((key) => (
                  <Field key={key} label={t(key)}>
                    <Input
                      required
                      disabled={demo}
                      value={assessmentForm[key]}
                      onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })}
                    />
                  </Field>
                ))}

              {(["hazardMetric", "metricUnit"] as const).map((key) => (
                <Field key={key} label={t(key)}>
                  <Input
                    required
                    disabled={demo}
                    placeholder={key === "hazardMetric" ? "VD: annual_consecutive_dry_days" : "VD: days, mm, °C"}
                    value={assessmentForm[key]}
                    onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })}
                  />
                </Field>
              ))}

              <Field label={t("metricValue")}>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  step="0.00000001"
                  value={assessmentForm.metricValue}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, metricValue: event.target.value })}
                />
              </Field>

              <Field label={t("exposure")}>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  min="1"
                  max="5"
                  value={assessmentForm.exposureRating}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, exposureRating: event.target.value })}
                />
              </Field>

              <Field label={t("vulnerability")}>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  min="1"
                  max="5"
                  value={assessmentForm.vulnerabilityRating}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, vulnerabilityRating: event.target.value })}
                />
              </Field>

              <Field label={t("dependency")}>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  placeholder="VD: 45 (%)"
                  value={assessmentForm.businessDependencyPercent}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, businessDependencyPercent: event.target.value })}
                />
              </Field>

              <Field label={t("priority")}>
                <select
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.priorityBand}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, priorityBand: event.target.value })}
                >
                  <option value="low">{t("low")}</option>
                  <option value="medium">{t("medium")}</option>
                  <option value="high">{t("high")}</option>
                </select>
              </Field>

              <Field label={t("sourceEvidence")}>
                <select
                  required
                  disabled={demo}
                  className={selectClass}
                  value={assessmentForm.evidenceDocumentId}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, evidenceDocumentId: event.target.value })}
                >
                  <option value="">{t("selectEvidence")}</option>
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.documentName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <Field label={t("spatialMatchNotes")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.spatialMatchNotes}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, spatialMatchNotes: event.target.value })}
                />
              </Field>
              <Field label={t("uncertainty")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.uncertaintyNotes}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, uncertaintyNotes: event.target.value })}
                />
              </Field>
              <Field label={t("rationale")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.ratingRationale}
                  onChange={(event) => setAssessmentForm({ ...assessmentForm, ratingRationale: event.target.value })}
                />
              </Field>
            </div>

            <div className="pt-2">
              <Button disabled={demo || saving} className="bg-teal-600 hover:bg-teal-700 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                {t("saveAssessment")}
              </Button>
            </div>
          </form>

          {assessments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Đánh giá hiểm họa ({assessments.length})</p>
              <div className="grid gap-3 md:grid-cols-2">
                {assessments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm hover:border-teal-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-semibold">
                        {item.facilityName || item.facilityRevisionId} · {item.hazardType}
                      </b>
                      <Badge
                        variant="outline"
                        className={
                          item.priorityBand === "high"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : item.priorityBand === "medium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {item.priorityBand}
                      </Badge>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {item.scenarioReference} · {item.horizonStart}–{item.horizonEnd} · {item.sourceKind}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.datasetIdentifier} {item.datasetVersion} · {item.gridReference} · {item.spatialResolution}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{item.id.slice(0, 12)}…</span>
                      <span className="text-slate-600 font-medium">Trạng thái: {item.screeningStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Portfolio Form */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            {t("portfolioTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("portfolioDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={createPortfolio}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("portfolioReference")}>
                <Input
                  required
                  disabled={demo}
                  placeholder="Ví dụ: PORTFOLIO-VN-TEXTILE-2030"
                  value={portfolioReference}
                  onChange={(event) => setPortfolioReference(event.target.value)}
                />
              </Field>
              <Field label={t("methodologyNotes")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={2}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  placeholder="Phương pháp tổng hợp danh mục..."
                  value={methodologyNotes}
                  onChange={(event) => setMethodologyNotes(event.target.value)}
                />
              </Field>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Chọn hiểm họa đưa vào Portfolio ({selectedIds.length} đã chọn)
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/30 p-3">
                {assessments.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-sm hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      disabled={demo}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                        )
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-900">{item.facilityName || item.facilityRevisionId}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        · {item.hazardType} · {item.scenarioReference} · Phụ thuộc: {item.businessDependencyPercent}%
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">{item.priorityBand}</Badge>
                  </label>
                ))}
              </div>
            </div>

            <Button
              disabled={demo || saving || selectedIds.length < 2}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
              {t("createPortfolio")}
            </Button>
          </form>

          {portfolios.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Danh mục rủi ro ({portfolios.length})</p>
              <div className="grid gap-4 md:grid-cols-2">
                {portfolios.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-semibold">{item.portfolioReference}</b>
                      <Badge variant="outline" className="bg-white">{item.prioritySummary.reviewStatus}</Badge>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {item.scenarioReference} · {item.facilityCount} {t("facilityCount")}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="text-red-700 font-medium">{t("high")}: {item.prioritySummary.dependencyPercentByPriority.high}%</span>
                      <span className="text-amber-700 font-medium">{t("medium")}: {item.prioritySummary.dependencyPercentByPriority.medium}%</span>
                      <span className="text-emerald-700 font-medium">{t("low")}: {item.prioritySummary.dependencyPercentByPriority.low}%</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {t("incompleteCoverage")}: {item.prioritySummary.incompleteHazardCoverageFacilities}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 bg-white hover:bg-slate-100"
                      onClick={() => void inspectPortfolio(item.id)}
                    >
                      <ChevronRight className="mr-1 h-3.5 w-3.5" />
                      {t("inspectPortfolio")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {portfolioDetail && (
            <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
              <h3 className="font-semibold text-indigo-950 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-700" />
                {portfolioDetail.portfolioReference} · {t("portfolioMembers")}
              </h3>
              <div className="mt-3 space-y-2">
                {portfolioDetail.assessments.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3.5 text-sm shadow-2xs">
                    <div className="flex items-center justify-between">
                      <b className="text-slate-900 font-medium">
                        {item.facilityName || item.facilityRevisionId} · {item.hazardType}
                      </b>
                      <Badge variant="outline">{item.priorityBand}</Badge>
                    </div>
                    <p className="mt-1 text-slate-600 text-xs">
                      {item.hazardMetric}: {item.metricValue} {item.metricUnit} · Tỷ lệ phụ thuộc doanh nghiệp: {item.businessDependencyPercent}%
                    </p>
                    <p className="mt-1 text-slate-500 text-xs">{item.uncertaintyNotes}</p>
                    <p className="mt-2 text-[11px] text-slate-400 font-mono">
                      {item.sourceKind} · {item.modelName || "—"} · {item.scenarioName || "—"} · {item.spatialResolution} · {item.gridReference}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
