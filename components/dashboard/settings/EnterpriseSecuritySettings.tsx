"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/useToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  enterpriseSecurityApi,
  type EnterpriseIncidentEvent,
  type EnterpriseKeyEvent,
  type EnterpriseSecurityPolicy,
  type EnterpriseSecurityPosture,
  type EnterpriseSsoConnection,
  type MfaEnrollment,
  type MfaStatus,
  type ProductionAcceptanceRun
} from "@/lib/enterpriseSecurityApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const initialPosture: EnterpriseSecurityPosture = {
  policy: null,
  adminMfa: { total: 0, enabled: 0, missing: [] },
  activeSsoConnections: 0,
  overdueKeys: 0,
  openIncidents: 0,
  latestProductionAcceptance: null,
  productionReady: false
};
const message = (error: unknown) => error instanceof Error ? error.message : "Yêu cầu không thành công.";

export default function EnterpriseSecuritySettings() {
  const pathname = usePathname();
  const demo = pathname?.startsWith("/demo") === true;
  const { isRoot } = usePermissions();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [mfa, setMfa] = useState<MfaStatus>({ status: "not_enrolled", enabled: false, revision: 0 });
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [mfaForm, setMfaForm] = useState({ password: "", currentCode: "", confirmationCode: "", disableReason: "MFA factor replaced by an approved administrator workflow." });
  const [posture, setPosture] = useState(initialPosture);
  const [policies, setPolicies] = useState<EnterpriseSecurityPolicy[]>([]);
  const [sso, setSso] = useState<EnterpriseSsoConnection[]>([]);
  const [keys, setKeys] = useState<EnterpriseKeyEvent[]>([]);
  const [incidents, setIncidents] = useState<EnterpriseIncidentEvent[]>([]);
  const [acceptance, setAcceptance] = useState<ProductionAcceptanceRun[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [evidenceId, setEvidenceId] = useState("");
  const [policyForm, setPolicyForm] = useState({ policyReference: "default", requireMfaForAdmins: true, ssoMode: "optional", sessionIdleMinutes: "30", dataRetentionDays: "2555", approvalStatus: "draft", rationale: "Enterprise security baseline reviewed against the current WeaveCarbon release." });
  const [ssoForm, setSsoForm] = useState({ connectionReference: "", issuerUrl: "", authorizationEndpoint: "", tokenEndpoint: "", jwksUri: "", clientId: "", clientSecretReference: "vault://weavecarbon/oidc/client-secret", allowedEmailDomains: "", scopes: "openid email profile", requiredAcr: "", status: "draft", discoveryValidated: false, jwksValidated: false, idTokenValidationValidated: false, loginRoundTripValidated: false });
  const [keyForm, setKeyForm] = useState({ keyReference: "", purpose: "mfa_encryption", provider: "Vault", externalSecretReference: "vault://weavecarbon/keys/", keyVersion: "1", lifecycleStatus: "active", effectiveAt: new Date().toISOString().slice(0, 16), rotationDueAt: "", reason: "Key lifecycle event supported by locked custody evidence." });
  const [incidentForm, setIncidentForm] = useState({ incidentReference: "", eventType: "detected", severity: "medium", occurredAt: new Date().toISOString().slice(0, 16), owner: "Security lead", summary: "", personalDataInvolved: false, regulatoryNotificationRequired: false });
  const [acceptanceForm, setAcceptanceForm] = useState({ releaseReference: "", backendCommitSha: "", frontendCommitSha: "", backendImageDigest: "sha256:", frontendImageDigest: "sha256:", highestMigration: "051_g2_enterprise_security_acceptance.sql", ciRunUrl: "", rollbackImageDigest: "sha256:", backupRestoreReportSha256: "", unresolvedCritical: "0", unresolvedHigh: "0", decision: "blocked", decisionRationale: "Awaiting complete production evidence.", health: false, readiness: false, capability: false, authentication: false, tenantIsolation: false, migration: false, rollbackAvailable: false });

  const lockedEvidence = useMemo(() => evidence.filter((item) =>
    ["locked", "third_party_verified"].includes(item.status) &&
    /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0
  ), [evidence]);

  const load = useCallback(async () => {
    if (demo) {
      setMfa({ status: "not_enrolled", enabled: false, revision: 0 });
      setPosture(initialPosture);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status = await enterpriseSecurityApi.mfaStatus();
      setMfa(status);
      if (isRoot) {
        const [nextPosture, nextPolicies, nextSso, nextKeys, nextIncidents, nextAcceptance, evidencePage] = await Promise.all([
          enterpriseSecurityApi.posture(), enterpriseSecurityApi.policies(),
          enterpriseSecurityApi.ssoConnections(), enterpriseSecurityApi.keyEvents(),
          enterpriseSecurityApi.incidents(), enterpriseSecurityApi.acceptanceRuns(), listEvidenceV2()
        ]);
        setPosture(nextPosture); setPolicies(nextPolicies); setSso(nextSso); setKeys(nextKeys);
        setIncidents(nextIncidents); setAcceptance(nextAcceptance); setEvidence(evidencePage.items);
        const first = evidencePage.items.find((item) => ["locked", "third_party_verified"].includes(item.status) && /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0);
        if (first) setEvidenceId((current) => current || first.id);
      }
    } catch (error) {
      toast({ title: "Không thể tải trạng thái bảo mật", description: message(error), variant: "destructive" });
    } finally { setLoading(false); }
  }, [demo, isRoot, toast]);

  useEffect(() => { void load(); }, [load]);

  const run = async (label: string, work: () => Promise<void>) => {
    if (demo) return;
    setBusy(label);
    try { await work(); } catch (error) {
      toast({ title: "Không thể ghi nhận kiểm soát", description: message(error), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const beginMfa = () => run("mfa-enroll", async () => {
    const result = await enterpriseSecurityApi.beginMfaEnrollment({ password: mfaForm.password, ...(mfa.enabled ? { current_code: mfaForm.currentCode } : {}) });
    setEnrollment(result); setMfa((current) => ({ ...current, status: "pending" }));
    toast({ title: "Đã tạo khóa MFA đang chờ", description: "Thêm khóa vào ứng dụng xác thực rồi nhập mã 6 số để xác nhận." });
  });
  const confirmMfa = () => run("mfa-confirm", async () => {
    const result = await enterpriseSecurityApi.confirmMfaEnrollment(mfaForm.confirmationCode);
    setRecoveryCodes(result.recoveryCodes); setEnrollment(null);
    setMfa({ status: "enabled", enabled: true, revision: result.revision, recoveryCodesRemaining: result.recoveryCodes.length });
    toast({ title: "MFA đã bật", description: "Lưu các mã khôi phục rồi đăng nhập lại." });
  });
  const disableMfa = () => run("mfa-disable", async () => {
    await enterpriseSecurityApi.disableMfa({ password: mfaForm.password, mfa_code: mfaForm.currentCode, reason: mfaForm.disableReason });
    await signOut();
  });
  const copyRecovery = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast({ title: "Đã sao chép", description: "Cất mã khôi phục trong kho bí mật ngoại tuyến." });
  };

  const requireEvidence = () => {
    if (evidenceId) return true;
    toast({ title: "Thiếu bằng chứng", description: "Chọn một tài liệu đã khóa, có checksum và kích thước hợp lệ.", variant: "destructive" });
    return false;
  };

  if (loading) return <Card><CardContent className="flex min-h-48 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return <div className="space-y-5">
    <Card className="border-emerald-200">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-emerald-700" />MFA cá nhân</CardTitle><CardDescription>TOTP RFC 6238, khóa AES-GCM và mã khôi phục chỉ dùng một lần.</CardDescription></div>
          <Badge variant={mfa.enabled ? "default" : "secondary"}>{mfa.enabled ? "Đang bảo vệ" : mfa.status === "pending" ? "Chờ xác nhận" : "Chưa bật"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {demo ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Demo chỉ đọc; MFA không thay đổi tài khoản thật.</p> : null}
        {recoveryCodes.length ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />Chỉ hiển thị một lần</div>
          <div className="grid gap-2 font-mono text-sm sm:grid-cols-2">{recoveryCodes.map((code) => <code key={code} className="rounded bg-white px-2 py-1">{code}</code>)}</div>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={copyRecovery}><Copy className="mr-2 h-4 w-4" />Sao chép</Button><Button type="button" onClick={() => void signOut()}>Đã lưu, đăng nhập lại</Button></div>
        </div> : null}
        {!recoveryCodes.length ? <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2"><Label>Mật khẩu hiện tại</Label><Input type="password" value={mfaForm.password} onChange={(event) => setMfaForm({ ...mfaForm, password: event.target.value })} disabled={demo || Boolean(busy)} /></div>
            {mfa.enabled ? <div className="space-y-2"><Label>Mã MFA hiện tại</Label><Input value={mfaForm.currentCode} onChange={(event) => setMfaForm({ ...mfaForm, currentCode: event.target.value.toUpperCase() })} disabled={demo || Boolean(busy)} /></div> : null}
          </div>
          {!enrollment ? <div className="flex flex-wrap gap-2"><Button type="button" onClick={beginMfa} disabled={demo || Boolean(busy) || !mfaForm.password}>{mfa.enabled ? "Xoay khóa MFA" : "Bắt đầu thiết lập MFA"}</Button>{mfa.enabled ? <Button type="button" variant="destructive" onClick={disableMfa} disabled={demo || Boolean(busy) || !mfaForm.password || !mfaForm.currentCode}>Tắt MFA có kiểm soát</Button> : null}</div> : null}
          {mfa.enabled ? <div className="space-y-2"><Label>Lý do tắt MFA</Label><Input value={mfaForm.disableReason} onChange={(event) => setMfaForm({ ...mfaForm, disableReason: event.target.value })} disabled={demo || Boolean(busy)} /></div> : null}
          {enrollment ? <div className="space-y-3 rounded-xl border bg-muted/30 p-4"><p className="text-sm font-medium">Khóa thiết lập (không lưu ở trình duyệt)</p><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="w-fit rounded-lg bg-white p-3"><QRCodeSVG value={enrollment.otpauthUri} size={160} level="M" /></div><div className="min-w-0 flex-1 space-y-2"><p className="text-xs text-muted-foreground">Quét QR hoặc nhập khóa thủ công:</p><code className="block break-all rounded bg-background p-2 text-sm">{enrollment.secret}</code><details><summary className="cursor-pointer text-sm">URI dành cho ứng dụng xác thực</summary><code className="mt-2 block break-all text-xs">{enrollment.otpauthUri}</code></details></div></div><div className="flex gap-2"><Input placeholder="Mã 6 số" value={mfaForm.confirmationCode} onChange={(event) => setMfaForm({ ...mfaForm, confirmationCode: event.target.value })} /><Button type="button" onClick={confirmMfa} disabled={Boolean(busy) || !/^\d{6}$/.test(mfaForm.confirmationCode)}>Xác nhận</Button></div></div> : null}
        </> : null}
      </CardContent>
    </Card>

    {isRoot ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Trạng thái", posture.productionReady ? "Đủ gate" : "Chưa đủ gate"],
          ["Admin MFA", `${posture.adminMfa.enabled}/${posture.adminMfa.total}`],
          ["OIDC đã xác thực", String(posture.activeSsoConnections)],
          ["Khóa quá hạn", String(posture.overdueKeys)],
          ["Sự cố đang mở", String(posture.openIncidents)]
        ].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Bằng chứng điều khiển</CardTitle><CardDescription>Mọi bản ghi quản trị chỉ nhận tài liệu cùng tenant đã khóa hoặc được bên thứ ba xác minh, có checksum SHA-256.</CardDescription></CardHeader><CardContent><select className={inputClass} value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} disabled={demo || Boolean(busy)}><option value="">Chọn bằng chứng hợp lệ</option>{lockedEvidence.map((item) => <option key={item.id} value={item.id}>{item.documentName} · {item.status} · {item.checksumSha256?.slice(0, 12)}…</option>)}</select>{!lockedEvidence.length ? <p className="mt-2 text-sm text-amber-700">Chưa có tài liệu khóa đáp ứng checksum và kích thước; các thao tác phê duyệt sẽ bị chặn.</p> : null}</CardContent></Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Chính sách doanh nghiệp</CardTitle><CardDescription>Phê duyệt MFA/SSO chỉ thành công khi trạng thái thực tế đáp ứng.</CardDescription></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Mã chính sách"><Input value={policyForm.policyReference} onChange={(event) => setPolicyForm({ ...policyForm, policyReference: event.target.value })} /></Field><Field label="SSO"><select className={inputClass} value={policyForm.ssoMode} onChange={(event) => setPolicyForm({ ...policyForm, ssoMode: event.target.value })}><option value="disabled">Tắt</option><option value="optional">Tùy chọn</option><option value="required">Bắt buộc</option></select></Field><Field label="Session idle (phút)"><Input type="number" value={policyForm.sessionIdleMinutes} onChange={(event) => setPolicyForm({ ...policyForm, sessionIdleMinutes: event.target.value })} /></Field><Field label="Lưu dữ liệu (ngày)"><Input type="number" value={policyForm.dataRetentionDays} onChange={(event) => setPolicyForm({ ...policyForm, dataRetentionDays: event.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={policyForm.requireMfaForAdmins} onCheckedChange={(checked) => setPolicyForm({ ...policyForm, requireMfaForAdmins: checked === true })} />Bắt buộc MFA cho toàn bộ admin đang hoạt động</label>
          <Textarea value={policyForm.rationale} onChange={(event) => setPolicyForm({ ...policyForm, rationale: event.target.value })} />
          <select className={inputClass} value={policyForm.approvalStatus} onChange={(event) => setPolicyForm({ ...policyForm, approvalStatus: event.target.value })}><option value="draft">Bản nháp</option><option value="approved">Phê duyệt</option></select>
          <Button type="button" disabled={demo || Boolean(busy)} onClick={() => void run("policy", async () => { if (!requireEvidence()) return; await enterpriseSecurityApi.createPolicy({ ...policyForm, requireMfaForAdmins: policyForm.requireMfaForAdmins, ssoMode: policyForm.ssoMode as "disabled" | "optional" | "required", sessionIdleMinutes: Number(policyForm.sessionIdleMinutes), dataRetentionDays: Number(policyForm.dataRetentionDays), approvalStatus: policyForm.approvalStatus as "draft" | "approved", evidenceDocumentId: evidenceId }); await load(); })}>Ghi revision chính sách</Button>
          <History rows={policies.slice(0, 4).map((item) => `${item.policyReference} · r${item.revision} · ${item.approvalStatus}`)} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>OIDC / SSO</CardTitle><CardDescription>Đây là sổ cấu hình. Trạng thái “active” chỉ được chấp nhận sau discovery, JWKS, kiểm tra ID token và round-trip với IdP thật; secret chỉ là tham chiếu vault.</CardDescription></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Mã kết nối"><Input value={ssoForm.connectionReference} onChange={(event) => setSsoForm({ ...ssoForm, connectionReference: event.target.value })} /></Field><Field label="Client ID"><Input value={ssoForm.clientId} onChange={(event) => setSsoForm({ ...ssoForm, clientId: event.target.value })} /></Field></div>
          {["issuerUrl", "authorizationEndpoint", "tokenEndpoint", "jwksUri"].map((key) => <Field key={key} label={key}><Input value={ssoForm[key as keyof typeof ssoForm] as string} onChange={(event) => setSsoForm({ ...ssoForm, [key]: event.target.value })} placeholder="https://…" /></Field>)}
          <Field label="Tham chiếu secret"><Input value={ssoForm.clientSecretReference} onChange={(event) => setSsoForm({ ...ssoForm, clientSecretReference: event.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Miền email (dấu phẩy)"><Input value={ssoForm.allowedEmailDomains} onChange={(event) => setSsoForm({ ...ssoForm, allowedEmailDomains: event.target.value })} /></Field><Field label="Scopes (cách bằng khoảng trắng)"><Input value={ssoForm.scopes} onChange={(event) => setSsoForm({ ...ssoForm, scopes: event.target.value })} /></Field></div>
          <div className="grid gap-2 sm:grid-cols-2">{(["discoveryValidated", "jwksValidated", "idTokenValidationValidated", "loginRoundTripValidated"] as const).map((key) => <label key={key} className="flex items-center gap-2 text-xs"><Checkbox checked={ssoForm[key]} onCheckedChange={(checked) => setSsoForm({ ...ssoForm, [key]: checked === true })} />{key}</label>)}</div>
          <select className={inputClass} value={ssoForm.status} onChange={(event) => setSsoForm({ ...ssoForm, status: event.target.value })}><option value="draft">draft</option><option value="active">active</option><option value="disabled">disabled</option></select>
          <Button type="button" disabled={demo || Boolean(busy)} onClick={() => void run("sso", async () => { if (!requireEvidence()) return; await enterpriseSecurityApi.createSsoConnection({ connectionReference: ssoForm.connectionReference, protocol: "oidc", issuerUrl: ssoForm.issuerUrl, authorizationEndpoint: ssoForm.authorizationEndpoint, tokenEndpoint: ssoForm.tokenEndpoint, jwksUri: ssoForm.jwksUri, clientId: ssoForm.clientId, clientSecretReference: ssoForm.clientSecretReference, allowedEmailDomains: ssoForm.allowedEmailDomains.split(",").map((item) => item.trim()).filter(Boolean), scopes: ssoForm.scopes.split(/\s+/).filter(Boolean), requiredAcr: ssoForm.requiredAcr || null, validationChecks: { discoveryValidated: ssoForm.discoveryValidated, jwksValidated: ssoForm.jwksValidated, idTokenValidationValidated: ssoForm.idTokenValidationValidated, loginRoundTripValidated: ssoForm.loginRoundTripValidated }, status: ssoForm.status, evidenceDocumentId: evidenceId }); await load(); })}>Ghi revision OIDC</Button>
          <History rows={sso.slice(0, 4).map((item) => `${item.connectionReference} · r${item.revision} · ${item.status}`)} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Vòng đời khóa</CardTitle><CardDescription>Mỗi keyReference là một phiên bản khóa; chỉ cho phép active → rotated/revoked, không hồi sinh.</CardDescription></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Key reference"><Input value={keyForm.keyReference} onChange={(event) => setKeyForm({ ...keyForm, keyReference: event.target.value })} /></Field><Field label="Phiên bản"><Input value={keyForm.keyVersion} onChange={(event) => setKeyForm({ ...keyForm, keyVersion: event.target.value })} /></Field><Field label="Mục đích"><select className={inputClass} value={keyForm.purpose} onChange={(event) => setKeyForm({ ...keyForm, purpose: event.target.value })}>{["jwt_signing", "mfa_encryption", "database_encryption", "object_storage_encryption", "weavenode_transport", "deployment", "integration"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Trạng thái"><select className={inputClass} value={keyForm.lifecycleStatus} onChange={(event) => setKeyForm({ ...keyForm, lifecycleStatus: event.target.value })}>{["active", "rotated", "revoked"].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <Field label="Tham chiếu vault"><Input value={keyForm.externalSecretReference} onChange={(event) => setKeyForm({ ...keyForm, externalSecretReference: event.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Hiệu lực"><Input type="datetime-local" value={keyForm.effectiveAt} onChange={(event) => setKeyForm({ ...keyForm, effectiveAt: event.target.value })} /></Field><Field label="Hạn xoay"><Input type="datetime-local" value={keyForm.rotationDueAt} onChange={(event) => setKeyForm({ ...keyForm, rotationDueAt: event.target.value })} /></Field></div>
          <Textarea value={keyForm.reason} onChange={(event) => setKeyForm({ ...keyForm, reason: event.target.value })} />
          <Button type="button" disabled={demo || Boolean(busy)} onClick={() => void run("key", async () => { if (!requireEvidence()) return; await enterpriseSecurityApi.createKeyEvent({ ...keyForm, effectiveAt: new Date(keyForm.effectiveAt).toISOString(), rotationDueAt: keyForm.rotationDueAt ? new Date(keyForm.rotationDueAt).toISOString() : null, evidenceDocumentId: evidenceId }); await load(); })}>Ghi sự kiện khóa</Button>
          <History rows={keys.slice(0, 4).map((item) => `${item.keyReference} · r${item.revision} · ${item.lifecycleStatus}`)} />
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Ứng phó sự cố</CardTitle><CardDescription>Chuỗi append-only: detected → triaged → contained → eradicated → recovered → closed; closed có thể reopened.</CardDescription></CardHeader><CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Incident reference"><Input value={incidentForm.incidentReference} onChange={(event) => setIncidentForm({ ...incidentForm, incidentReference: event.target.value })} /></Field><Field label="Owner"><Input value={incidentForm.owner} onChange={(event) => setIncidentForm({ ...incidentForm, owner: event.target.value })} /></Field><Field label="Event"><select className={inputClass} value={incidentForm.eventType} onChange={(event) => setIncidentForm({ ...incidentForm, eventType: event.target.value })}>{["detected", "triaged", "contained", "eradicated", "recovered", "closed", "reopened"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Mức độ"><select className={inputClass} value={incidentForm.severity} onChange={(event) => setIncidentForm({ ...incidentForm, severity: event.target.value })}>{["low", "medium", "high", "critical"].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <Input type="datetime-local" value={incidentForm.occurredAt} onChange={(event) => setIncidentForm({ ...incidentForm, occurredAt: event.target.value })} /><Textarea placeholder="Tóm tắt có thể kiểm toán" value={incidentForm.summary} onChange={(event) => setIncidentForm({ ...incidentForm, summary: event.target.value })} />
          <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm"><Checkbox checked={incidentForm.personalDataInvolved} onCheckedChange={(checked) => setIncidentForm({ ...incidentForm, personalDataInvolved: checked === true })} />Có dữ liệu cá nhân</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={incidentForm.regulatoryNotificationRequired} onCheckedChange={(checked) => setIncidentForm({ ...incidentForm, regulatoryNotificationRequired: checked === true })} />Cần thông báo cơ quan</label></div>
          <Button type="button" disabled={demo || Boolean(busy)} onClick={() => void run("incident", async () => { if (!requireEvidence()) return; await enterpriseSecurityApi.createIncidentEvent({ ...incidentForm, occurredAt: new Date(incidentForm.occurredAt).toISOString(), evidenceDocumentId: evidenceId }); await load(); })}>Ghi sự kiện sự cố</Button>
          <History rows={incidents.slice(0, 4).map((item) => `${item.incidentReference} · r${item.revision} · ${item.eventType}`)} />
        </CardContent></Card>
      </div>

      <Card className="border-sky-200"><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />Nghiệm thu production</CardTitle><CardDescription>Quyết định “accepted” bị backend từ chối nếu commit/image/migration, smoke, scan, backup/restore, rollback hoặc posture bảo mật chưa đủ.</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3"><Field label="Release"><Input value={acceptanceForm.releaseReference} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, releaseReference: event.target.value })} /></Field><Field label="Backend commit"><Input value={acceptanceForm.backendCommitSha} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, backendCommitSha: event.target.value })} /></Field><Field label="Frontend commit"><Input value={acceptanceForm.frontendCommitSha} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, frontendCommitSha: event.target.value })} /></Field><Field label="Backend image digest"><Input value={acceptanceForm.backendImageDigest} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, backendImageDigest: event.target.value })} /></Field><Field label="Frontend image digest"><Input value={acceptanceForm.frontendImageDigest} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, frontendImageDigest: event.target.value })} /></Field><Field label="Rollback digest"><Input value={acceptanceForm.rollbackImageDigest} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, rollbackImageDigest: event.target.value })} /></Field><Field label="Migration"><Input value={acceptanceForm.highestMigration} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, highestMigration: event.target.value })} /></Field><Field label="CI run URL"><Input value={acceptanceForm.ciRunUrl} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, ciRunUrl: event.target.value })} /></Field><Field label="Backup/restore SHA-256"><Input value={acceptanceForm.backupRestoreReportSha256} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, backupRestoreReportSha256: event.target.value })} /></Field></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(["health", "readiness", "capability", "authentication", "tenantIsolation", "migration", "rollbackAvailable"] as const).map((gate) => <label key={gate} className="flex items-center gap-2 text-sm"><Checkbox checked={acceptanceForm[gate]} onCheckedChange={(checked) => setAcceptanceForm({ ...acceptanceForm, [gate]: checked === true })} />{gate}</label>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Critical chưa xử lý"><Input type="number" min="0" value={acceptanceForm.unresolvedCritical} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, unresolvedCritical: event.target.value })} /></Field><Field label="High chưa xử lý"><Input type="number" min="0" value={acceptanceForm.unresolvedHigh} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, unresolvedHigh: event.target.value })} /></Field></div>
        <Textarea value={acceptanceForm.decisionRationale} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, decisionRationale: event.target.value })} /><select className={inputClass} value={acceptanceForm.decision} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, decision: event.target.value })}><option value="blocked">blocked</option><option value="accepted">accepted</option></select>
        <Button type="button" disabled={demo || Boolean(busy)} onClick={() => void run("acceptance", async () => { if (!requireEvidence()) return; await enterpriseSecurityApi.createAcceptanceRun({ releaseReference: acceptanceForm.releaseReference, backendCommitSha: acceptanceForm.backendCommitSha, frontendCommitSha: acceptanceForm.frontendCommitSha, backendImageDigest: acceptanceForm.backendImageDigest, frontendImageDigest: acceptanceForm.frontendImageDigest, highestMigration: acceptanceForm.highestMigration, ciRunUrl: acceptanceForm.ciRunUrl, rollbackImageDigest: acceptanceForm.rollbackImageDigest, backupRestoreReportSha256: acceptanceForm.backupRestoreReportSha256, smokeResults: { health: acceptanceForm.health, readiness: acceptanceForm.readiness, capability: acceptanceForm.capability, authentication: acceptanceForm.authentication, tenantIsolation: acceptanceForm.tenantIsolation, migration: acceptanceForm.migration, rollbackAvailable: acceptanceForm.rollbackAvailable }, securityScanSummary: { unresolvedCritical: Number(acceptanceForm.unresolvedCritical), unresolvedHigh: Number(acceptanceForm.unresolvedHigh) }, decision: acceptanceForm.decision, decisionRationale: acceptanceForm.decisionRationale, evidenceDocumentId: evidenceId }); await load(); })}>Ghi bản nghiệm thu bất biến</Button>
        <History rows={acceptance.slice(0, 5).map((item) => `${item.releaseReference} · ${item.decision} · ${item.highestMigration}`)} />
      </CardContent></Card>
    </> : <Card><CardContent className="pt-6 text-sm text-muted-foreground">Các ledger chính sách, SSO, khóa, sự cố và nghiệm thu chỉ dành cho quản trị viên công ty. MFA cá nhân vẫn khả dụng ở trên.</CardContent></Card>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function History({ rows }: { rows: string[] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Chưa có revision.</p>;
  return <div className="space-y-1 border-t pt-3">{rows.map((row, index) => <div key={`${row}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{row}</div>)}</div>;
}
