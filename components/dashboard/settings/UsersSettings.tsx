"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { api, isApiError } from "@/lib/apiClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
"@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter } from
"@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Mail, MoreHorizontal, Check, X, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "editor" | "member" | "viewer";
  status: "active" | "invited" | "pending" | "inactive" | "disabled";
  last_login: string | null;
  created_at: string;
}

type TeamMemberPatchResponse = Partial<TeamMember> & Pick<TeamMember, "id">;
type TeamManageableRole = "admin" | "member" | "viewer";

const toManageableRole = (role: TeamMember["role"]): TeamManageableRole => {
  if (role === "admin") return "admin";
  if (role === "viewer") return "viewer";
  return "member";
};

const keepPreviousWhenUndefined = <T,>(value: T | undefined, fallback: T): T =>
value === undefined ? fallback : value;

const mergeMemberPatch = (
current: TeamMember,
patch: TeamMemberPatchResponse | null,
optimistic: Partial<TeamMember> = {})
: TeamMember => {
  const merged = { ...optimistic, ...(patch || {}) };
  return {
    ...current,
    ...merged,
    user_id: keepPreviousWhenUndefined(merged.user_id, current.user_id),
    full_name: keepPreviousWhenUndefined(merged.full_name, current.full_name),
    email: keepPreviousWhenUndefined(merged.email, current.email),
    role: keepPreviousWhenUndefined(merged.role, current.role),
    status: keepPreviousWhenUndefined(merged.status, current.status),
    last_login: keepPreviousWhenUndefined(merged.last_login, current.last_login),
    created_at: keepPreviousWhenUndefined(merged.created_at, current.created_at)
  };
};

const MEMBERS_PAGE_SIZE = 8;

const UsersSettings: React.FC = () => {
  const t = useTranslations("settings.users");
  const locale = "vi";
  const { user } = useAuth();
  const { canAccessUsersSettings } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const companyId = user?.company_id || null;
  const normalizedCurrentPlan = (currentPlan || "").trim().toLowerCase();
  const isStarterPlan =
    normalizedCurrentPlan.includes("trial");
  const canManageSubAccounts = !isStarterPlan;
  const trialSubAccountHint =
  locale === "vi" ?
  "Gói Trial chưa hỗ trợ tài khoản phụ. Vui lòng nâng cấp để thêm thành viên." :
  "Trial plan does not support sub-accounts. Please upgrade to add members.";
  const trialSubAccountLockedMessage =
  locale === "vi" ?
  "Gói Trial chưa hỗ trợ tài khoản phụ." :
  "Trial plan does not support sub-accounts.";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "viewer">("member");
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTargetMember, setRoleTargetMember] = useState<TeamMember | null>(null);
  const [nextRole, setNextRole] = useState<TeamManageableRole>("member");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadMembers = useCallback(async () => {
    if (!companyId) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    try {
      const data = await api.get<TeamMember[]>("/company/members");
      setMembers(data || []);
    } catch (error) {
      console.error("Failed to load members:", error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!canManageSubAccounts) {
      toast.error(trialSubAccountLockedMessage);
      return;
    }

    if (!inviteEmail) {
      toast.error(t("emailRequired"));
      return;
    }

    if (!companyId) {
      toast.error(t("companyNotSet"));
      return;
    }

    setUpdating(true);
    try {
      const inviteFullName =
      inviteName.trim() || inviteEmail.split("@")[0] || t("defaultTeamMember");
      const created = await api.post<TeamMember | null>(
        "/company/members",
        {
          full_name: inviteFullName,
          email: inviteEmail,
          role: inviteRole,
          send_notification_email: true,
          frontend_origin: typeof window !== "undefined" ? window.location.origin : undefined
        }
      );

      if (created?.id) {
        setMembers((prev) => [created, ...prev]);
      } else {
        await loadMembers();
      }

      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
      toast.success(t("inviteSuccess", { email: inviteEmail }));
    } catch (error) {
      console.error("Failed to invite member:", error);
      if (isApiError(error) && error.code === "B2C_EMAIL_NOT_ALLOWED_FOR_B2B") {
        toast.error(t("b2cEmailNotAllowedForSubAccount"));
      } else {
        toast.error(error instanceof Error ? error.message : t("inviteFailed"));
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    if (!canManageSubAccounts) {
      toast.error(trialSubAccountLockedMessage);
      return;
    }

    if (!companyId || !member.email) return;

    try {
      await api.post(`/company/members/${member.id}/resend-invite`, {
        frontend_origin: typeof window !== "undefined" ? window.location.origin : undefined
      });
      toast.success(t("resendSuccess", { email: member.email || "" }));
    } catch (error) {
      console.error("Failed to resend invite:", error);
      toast.error(error instanceof Error ? error.message : t("resendFailed"));
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    if (!canManageSubAccounts) {
      toast.error(trialSubAccountLockedMessage);
      return;
    }

    if (member.role === "admin") {
      toast.error(t("cannotDisableAdmin"));
      return;
    }
    if (!companyId) return;

    const nextStatus: TeamMember["status"] =
    member.status === "active" ? "inactive" : "active";

    setUpdating(true);
    try {
      const updated = await api.put<TeamMemberPatchResponse | null>(
        `/company/members/${member.id}`,
        { status: nextStatus }
      );

      setMembers((prev) =>
      prev.map((m) =>
      m.id === member.id ?
      mergeMemberPatch(m, updated, { status: nextStatus }) :
      m
      )
      );

      toast.success(
        t("toggleSuccess", {
          action:
          member.status === "active" ?
          t("toggleDisabled") :
          t("toggleEnabled"),
          email: member.email || ""
        })
      );
    } catch (error) {
      console.error("Failed to update member status:", error);
      toast.error(
        error instanceof Error ? error.message : t("updateMemberFailed")
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!canManageSubAccounts) {
      toast.error(trialSubAccountLockedMessage);
      return;
    }

    if (member.role === "admin") {
      toast.error(t("cannotRemoveAdmin"));
      return;
    }
    if (!companyId) return;

    setUpdating(true);
    try {
      await api.delete(`/company/members/${member.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success(t("removeSuccess", { email: member.email || "" }));
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error(error instanceof Error ? error.message : t("removeFailed"));
    } finally {
      setUpdating(false);
    }
  };

  const openRoleDialog = (member: TeamMember) => {
    setRoleTargetMember(member);
    setNextRole(toManageableRole(member.role));
    setRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!canManageSubAccounts) {
      toast.error(trialSubAccountLockedMessage);
      return;
    }

    if (!roleTargetMember || !companyId) return;

    if (roleTargetMember.user_id === user?.id) {
      toast.error(t("cannotChangeOwnRole"));
      return;
    }

    const currentRole = toManageableRole(roleTargetMember.role);
    if (currentRole === nextRole) {
      setRoleDialogOpen(false);
      setRoleTargetMember(null);
      return;
    }

    setUpdating(true);
    try {
      const updated = await api.put<TeamMemberPatchResponse | null>(
        `/company/members/${roleTargetMember.id}`,
        { role: nextRole }
      );

      setMembers((prev) =>
      prev.map((member) =>
      member.id === roleTargetMember.id ?
      mergeMemberPatch(member, updated, { role: nextRole }) :
      member
      )
      );

      toast.success(t("roleUpdateSuccess", { email: roleTargetMember.email || "" }));
      setRoleDialogOpen(false);
      setRoleTargetMember(null);
    } catch (error) {
      console.error("Failed to update member role:", error);
      toast.error(error instanceof Error ? error.message : t("updateMemberFailed"));
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
            {t("active")}
          </Badge>);

      case "invited":
      case "pending":
        return (
          <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
            {t("invited")}
          </Badge>);

      case "inactive":
      case "disabled":
        return (
          <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
            {t("disabled")}
          </Badge>);

      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="border border-primary/25 bg-primary/10 text-primary">
            {t("admin")}
          </Badge>);

      case "member":
      case "editor":
        return (
          <Badge className="border border-slate-200 bg-slate-100 text-slate-700">
            {t("member")}
          </Badge>);

      case "viewer":
        return (
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            {t("viewer")}
          </Badge>);

      default:
        return (
          <Badge variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700">
            {role}
          </Badge>);

    }
  };

  const renderMemberActions = (member: TeamMember, compact = false) => {
    if (!canManageSubAccounts) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={
              compact ?
                "h-8 w-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100" :
                "text-slate-600 hover:bg-slate-100"
            }
            disabled={isLoading}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-slate-200 bg-white">
          <DropdownMenuItem
            className="text-slate-700 focus:bg-slate-100 focus:text-slate-800"
            onClick={() => openRoleDialog(member)}
          >
            {t("changeRole")}
          </DropdownMenuItem>

          {member.status === "invited" && (
            <DropdownMenuItem
              className="text-slate-700 focus:bg-slate-100 focus:text-slate-800"
              onClick={() => handleResendInvite(member)}
            >
              <Mail className="w-4 h-4 mr-2" />
              {t("resendInvite")}
            </DropdownMenuItem>
          )}

          {member.role !== "admin" && (
            <DropdownMenuItem
              className="text-slate-700 focus:bg-slate-100 focus:text-slate-800"
              onClick={() => handleToggleStatus(member)}
            >
              {member.status === "active" ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  {t("disable")}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t("enable")}
                </>
              )}
            </DropdownMenuItem>
          )}

          {member.role !== "admin" && (
            <DropdownMenuItem
              onClick={() => handleRemove(member)}
              className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
            >
              <X className="w-4 h-4 mr-2" />
              {t("removeAccount")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const isLoading = loadingMembers || updating;
  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
  const tableColumnCount = canManageSubAccounts ? 5 : 4;

  const filteredMembers = useMemo(() => {
    if (!normalizedSearchKeyword) return members;
    return members.filter((member) => {
      const fullName = (member.full_name || "").toLowerCase();
      const email = (member.email || "").toLowerCase();
      const role = (member.role || "").toLowerCase();
      const status = (member.status || "").toLowerCase();
      return (
        fullName.includes(normalizedSearchKeyword) ||
        email.includes(normalizedSearchKeyword) ||
        role.includes(normalizedSearchKeyword) ||
        status.includes(normalizedSearchKeyword)
      );
    });
  }, [members, normalizedSearchKeyword]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / MEMBERS_PAGE_SIZE)
  );

  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * MEMBERS_PAGE_SIZE;
    return filteredMembers.slice(startIndex, startIndex + MEMBERS_PAGE_SIZE);
  }, [filteredMembers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearchKeyword]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (!canAccessUsersSettings) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-slate-200 shadow-sm">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <Users className="w-4 h-4" />
                </span>
                <CardTitle className="text-lg leading-tight sm:text-xl">
                  {t("teamMembers")}
                </CardTitle>
                <Badge className="border border-primary/20 bg-primary/10 text-primary">
                  {members.length}
                </Badge>
              </div>
              <CardDescription className="max-w-[34rem] text-sm leading-5">
                {t("teamMembersDesc")}
              </CardDescription>
            </div>
            {canManageSubAccounts ? (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                    disabled={!companyId || isLoading}>

                    <UserPlus className="w-4 h-4 mr-2" />
                    {t("createAccount")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="border border-slate-200 bg-white">
                  <DialogHeader>
                    <DialogTitle>{t("createAccountTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{t("fullName")}</Label>
                      <Input
                        className="border-slate-200 bg-white"
                        type="text"
                        placeholder={t("fullNamePlaceholder")}
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)} />

                    </div>
                    <div className="space-y-2">
                      <Label>{t("email")}</Label>
                      <Input
                        className="border-slate-200 bg-white"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)} />

                    </div>
                    <div className="space-y-2">
                      <Label>{t("inviteByEmail")}</Label>
                      <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {t("inviteEmailNotice")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("role")}</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v: "member" | "viewer") =>
                        setInviteRole(v)
                        }>

                        <SelectTrigger className="border-slate-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-200 bg-white">
                          <SelectItem value="member">
                            <div>
                              <span className="font-medium">{t("member")}</span>
                              <span className="ml-2 text-slate-600">
                                - {t("memberDesc")}
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="viewer">
                            <div>
                              <span className="font-medium">{t("viewer")}</span>
                              <span className="ml-2 text-slate-600">
                                - {t("viewerDesc")}
                              </span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-600">
                        {t("roleDescription")}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      onClick={() => setInviteOpen(false)}
                      disabled={isLoading}>

                      {t("cancel")}
                    </Button>
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={handleInvite}
                      disabled={isLoading}>

                      <UserPlus className="w-4 h-4 mr-2" />
                      {t("createAccount")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                {trialSubAccountHint}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="bg-white p-4 pt-4">
          {!companyId ?
          <p className="text-sm text-slate-600">
              {t("companyContextMissing")}
            </p> :
          isLoading && members.length === 0 ?
          <div className="h-20 animate-pulse rounded-md border border-slate-200 bg-slate-100/70" /> :

          <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="h-9 border-slate-200 bg-white pl-8"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {t("searchResults", {
                    matched: filteredMembers.length,
                    total: members.length
                  })}
                </p>
              </div>

              <div className="space-y-2 md:hidden">
                {filteredMembers.length === 0 ? (
                  <Card className="border border-slate-200 bg-slate-50/60 shadow-sm">
                    <CardContent className="py-8 text-center text-sm text-slate-600">
                      {normalizedSearchKeyword ? t("noSearchResults") : t("noTeamMembersFound")}
                    </CardContent>
                  </Card>
                ) : (
                  paginatedMembers.map((member) => (
                    <Card key={member.id} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                      <CardContent className="space-y-3 p-3">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {member.full_name || t("noName")}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-600">
                              {member.email}
                            </p>
                          </div>
                          {renderMemberActions(member, true)}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {getRoleBadge(member.role)}
                          {getStatusBadge(member.status)}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-medium text-slate-500">
                            {t("memberHeaderLastLogin")}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-700">
                            {member.last_login ?
                              format(new Date(member.last_login), "dd/MM/yyyy HH:mm") :
                              t("neverLogged")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
              <Table className="w-full">
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-slate-200">
                    <TableHead className="font-semibold text-slate-700">{t("memberHeaderName")}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t("memberHeaderRole")}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t("memberHeaderStatus")}</TableHead>
                    <TableHead className="font-semibold text-slate-700">{t("memberHeaderLastLogin")}</TableHead>
                    {canManageSubAccounts && <TableHead className="w-12.5"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredMembers.length === 0 ?
                <TableRow>
                    <TableCell
                    colSpan={tableColumnCount}
                    className="py-8 text-center text-sm text-slate-600">

                      {normalizedSearchKeyword ?
                  t("noSearchResults") :
                  t("noTeamMembersFound")}
                    </TableCell>
                  </TableRow> :

                paginatedMembers.map((member) =>
                <TableRow key={member.id} className="border-slate-200 hover:bg-slate-50/70">
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.full_name || t("noName")}
                          </p>
                          <p className="text-sm text-slate-600">
                            {member.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell className="text-slate-600">
                        {member.last_login ?
                    format(new Date(member.last_login), "dd/MM/yyyy HH:mm") :
                    t("neverLogged")}
                      </TableCell>
                      {canManageSubAccounts && <TableCell>{renderMemberActions(member)}</TableCell>}
                    </TableRow>
                )
                }
                </TableBody>
              </Table>
            </div>

              {filteredMembers.length > 0 && totalPages > 1 &&
            <div className="flex items-center justify-center gap-2 md:justify-end">
                  <Button
                variant="outline"
                size="sm"
                className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}>
                    {t("paginationPrev")}
                  </Button>
                  <span className="text-xs text-slate-600">
                    {t("paginationPage", { current: currentPage, total: totalPages })}
                  </span>
                  <Button
                variant="outline"
                size="sm"
                className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}>
                    {t("paginationNext")}
                  </Button>
                </div>
            }
            </div>
          }
        </CardContent>
      </Card>

      <Dialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          setRoleDialogOpen(open);
          if (!open) {
            setRoleTargetMember(null);
          }
        }}>
        <DialogContent className="border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{t("changeRole")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              {t("changeRoleDescription")}
            </p>
            {roleTargetMember &&
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {roleTargetMember.full_name || roleTargetMember.email || t("noName")}
              </div>
            }
            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select
                value={nextRole}
                onValueChange={(value: TeamManageableRole) => setNextRole(value)}>
                <SelectTrigger className="border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white">
                  <SelectItem value="admin">{t("admin")}</SelectItem>
                  <SelectItem value="member">{t("member")}</SelectItem>
                  <SelectItem value="viewer">{t("viewer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setRoleDialogOpen(false);
                setRoleTargetMember(null);
              }}
              disabled={isLoading}>
              {t("cancel")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleUpdateRole}
              disabled={isLoading || !roleTargetMember}>
              {t("saveRole")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

};

export default UsersSettings;
