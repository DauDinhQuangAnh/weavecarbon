'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Crown,
  Package,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useSubscriptionLock } from '@/hooks/useSubscriptionLock';
import { getSubscriptionPlanFamily } from '@/lib/subscriptionPlans';
import { getSubscriptionApiPayload } from '@/lib/subscriptionApi';
import { fetchProducts } from '@/lib/productsApi';
import { apiRequest } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionState {
  plan: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  skuCount: number;
  skuLimit: number;
  status: string | null;
}

const PLAN_CARDS = [
  {
    key: 'trial',
    label: 'Trial',
    description: 'Dùng thử miễn phí',
    price: '0đ',
    priceNote: '14 ngày',
    icon: Zap,
    iconBg: 'bg-blue-500',
    features: [
      { text: 'Tối đa 5 SKU', ok: true },
      { text: 'Carbon Proxy cơ bản', ok: true },
      { text: 'Dashboard online', ok: true },
      { text: 'Export PDF', ok: false },
      { text: 'Chứng chỉ xuất khẩu', ok: false },
      { text: 'Báo cáo CBAM/SEC', ok: false },
    ],
  },
  {
    key: 'standard',
    label: 'Standard',
    description: 'Theo hạn mức SKU',
    price: '899k — 1.5M',
    priceNote: 'VNĐ/tháng',
    icon: Sparkles,
    iconBg: 'bg-primary',
    badge: 'Phổ biến nhất',
    features: [
      { text: '20 / 35 / 50 SKU', ok: true },
      { text: 'Carbon Proxy đầy đủ', ok: true },
      { text: 'Export PDF mẫu Standard', ok: true },
      { text: 'Chứng chỉ cơ bản', ok: true },
      { text: 'Vận chuyển nội địa', ok: true },
      { text: 'Báo cáo CBAM/SEC', ok: false },
    ],
  },
  {
    key: 'export',
    label: 'Export',
    description: 'Audit-ready cho buyer EU/Mỹ',
    price: '3M — 6M',
    priceNote: 'VNĐ/tháng',
    icon: Package,
    iconBg: 'bg-emerald-500',
    badge: 'Cho xuất khẩu',
    badgeClass: 'bg-emerald-600',
    borderClass: 'border-emerald-300',
    features: [
      { text: '100 — 300 SKU', ok: true },
      { text: 'Tất cả tính năng Standard', ok: true },
      { text: 'Báo cáo PCF / Batch / Facility', ok: true },
      { text: 'Audit-ready Mode + evidence lock', ok: true },
      { text: 'Supplier Request Form', ok: true },
      { text: 'Hỗ trợ chuẩn bị hồ sơ buyer', ok: true },
    ],
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    description: 'Toàn diện cho xuất khẩu',
    price: '5M — 10M+',
    priceNote: 'VNĐ/tháng',
    icon: Crown,
    iconBg: 'bg-amber-500',
    features: [
      { text: 'SKU không giới hạn', ok: true },
      { text: 'Tất cả tính năng Standard', ok: true },
      { text: 'Báo cáo CBAM/SEC', ok: true },
      { text: 'Supplier Portal (Scope 3)', ok: true },
      { text: 'Multi-entity Management', ok: true },
      { text: 'API/ERP Integration', ok: true },
    ],
  },
] as const;

export default function BillingPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const { currentPlan, trialEndsAt, trialExpired, hasHydrated } =
    useSubscriptionLock();

  const [subState, setSubState] = useState<SubscriptionState>({
    plan: null,
    trialEndsAt: null,
    trialExpired: false,
    trialDaysLeft: null,
    skuCount: 0,
    skuLimit: 0,
    status: null,
  });

  useEffect(() => {
    Promise.all([getSubscriptionApiPayload(), fetchProducts({ page: 1, page_size: 1 })])
      .then(([payload, productsResult]) => {
        const plan =
          payload.current_plan ??
          payload.subscription?.current_plan ??
          null;
        const endsAt = payload.trial_ends_at ?? payload.trial?.ends_at ?? null;
        const expired =
          payload.trial_expired ?? payload.trial?.expired ?? false;
        const daysLeft =
          payload.trial_days_remaining ??
          payload.trial?.days_remaining ??
          null;
        const skuCount = productsResult.pagination.total ?? 0;
        const skuLimit =
          payload.limits?.products ?? payload.plan_details?.products ?? 0;
        const status = payload.features_locked ? 'locked' : plan ?? null;
        setSubState({
          plan,
          trialEndsAt: endsAt,
          trialExpired: expired,
          trialDaysLeft: typeof daysLeft === 'number' ? daysLeft : null,
          skuCount,
          skuLimit,
          status,
        });
      })
      .catch(() => {
        /* use lock state / zero fallback */
      });
  }, []);

  const effectivePlan = subState.plan ?? currentPlan;
  const planFamily = getSubscriptionPlanFamily(effectivePlan);

  const currentPlanLabel = useMemo(() => {
    if (!effectivePlan) return 'Chưa có gói';
    if (planFamily === 'trial') {
      if (subState.trialExpired || trialExpired) return 'Trial đã hết hạn';
      const days =
        subState.trialDaysLeft ??
        (trialEndsAt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(trialEndsAt).getTime() - Date.now()) /
                  (24 * 60 * 60 * 1000)
              )
            )
          : null);
      return days !== null ? `Trial (còn ${days} ngày)` : 'Trial';
    }
    if (planFamily === 'standard') return `Standard`;
    if (planFamily === 'export') return 'Export';
    if (effectivePlan?.toLowerCase().includes('enterprise')) return 'Enterprise';
    return effectivePlan;
  }, [effectivePlan, planFamily, subState, trialEndsAt, trialExpired]);

  const isEnterprisePending = subState.status === 'enterprise_pending';
  const isTrialExpired = subState.trialExpired || trialExpired;

  const requestUpgrade = async (toKey: string) => {
    if (!companyId) return;
    try {
      await apiRequest('/subscription/request-upgrade', {
        method: 'POST',
        body: JSON.stringify({ company_id: companyId, requested_plan: toKey }),
      });
      toast({
        title:
          toKey === 'enterprise'
            ? '📩 Yêu cầu Enterprise đã được gửi! Chúng tôi sẽ liên hệ sớm.'
            : `✅ Yêu cầu nâng cấp lên ${toKey} đã được ghi nhận!`,
      });
    } catch {
      toast({
        title:
          'Vui lòng liên hệ sales@weavecarbon.com để nâng cấp gói dịch vụ.',
      });
    }
  };

  const getPlanCta = (
    key: string
  ): { label: string; disabled: boolean; onClick: () => void } => {
    if (key === 'trial') {
      if (planFamily === 'trial')
        return {
          label: 'Đang dùng Trial',
          disabled: true,
          onClick: () => {},
        };
      if (planFamily !== 'free')
        return {
          label: 'Bắt đầu Trial',
          disabled: true,
          onClick: () => {},
        };
      return {
        label: 'Bắt đầu Trial',
        disabled: false,
        onClick: () => requestUpgrade('trial'),
      };
    }
    if (key === 'standard' || key === 'export') {
      if (effectivePlan?.toLowerCase().includes('enterprise'))
        return { label: 'Chọn', disabled: true, onClick: () => {} };
      return {
        label:
          planFamily === key ? 'Đổi tier' : `Chọn ${key[0].toUpperCase() + key.slice(1)}`,
        disabled: false,
        onClick: () => requestUpgrade(key),
      };
    }
    if (key === 'enterprise') {
      if (isEnterprisePending)
        return {
          label: 'Đang chờ xử lý',
          disabled: true,
          onClick: () => {},
        };
      if (effectivePlan?.toLowerCase().includes('enterprise'))
        return {
          label: 'Đang dùng Enterprise',
          disabled: true,
          onClick: () => {},
        };
      return {
        label: 'Yêu cầu Enterprise',
        disabled: false,
        onClick: () => requestUpgrade('enterprise'),
      };
    }
    return { label: 'Chọn', disabled: false, onClick: () => requestUpgrade(key) };
  };

  return (
    <div className="flex-1 p-6">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Current plan banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">
                  Gói hiện tại:{' '}
                  <span className="text-primary">
                    {hasHydrated ? currentPlanLabel : '…'}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {subState.skuCount} SKU đang sử dụng
                  {subState.skuLimit > 0
                    ? ` / ${subState.skuLimit} giới hạn`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isTrialExpired && (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Trial đã hết hạn
                </Badge>
              )}
              {isEnterprisePending && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  Enterprise đang chờ xử lý
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLAN_CARDS.map((card) => {
            const cta = getPlanCta(card.key);
            const isActive = planFamily === card.key;
            const IconComp = card.icon;
            return (
              <Card
                key={card.key}
                className={`relative transition-all hover:shadow-lg ${'borderClass' in card && card.borderClass ? card.borderClass : ''} ${isActive ? 'ring-2 ring-primary shadow-md' : ''}`}
              >
                {'badge' in card && card.badge && (
                  <Badge
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 ${'badgeClass' in card && card.badgeClass ? card.badgeClass : 'bg-primary'}`}
                  >
                    {card.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div
                    className={`mx-auto w-12 h-12 rounded-full ${card.iconBg} flex items-center justify-center mb-3`}
                  >
                    <IconComp className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{card.label}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">{card.price}</span>
                    <span className="text-sm text-muted-foreground block">
                      {card.priceNote}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {card.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        {f.ok ? (
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={f.ok ? '' : 'text-muted-foreground'}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={
                      card.key === 'standard' && !isActive
                        ? 'default'
                        : 'outline'
                    }
                    className={`w-full ${card.key === 'export' && !isActive ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : ''}`}
                    disabled={cta.disabled}
                    onClick={cta.onClick}
                  >
                    {card.key === 'enterprise' && !cta.disabled && (
                      <Building2 className="w-4 h-4 mr-2" />
                    )}
                    {cta.label}
                    {!cta.disabled && card.key !== 'enterprise' && (
                      <ArrowRight className="w-4 h-4 ml-1" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Để được tư vấn hoặc tùy chỉnh gói, liên hệ{' '}
          <a
            href="mailto:sales@weavecarbon.com"
            className="text-primary underline"
          >
            sales@weavecarbon.com
          </a>
        </p>
      </div>
    </div>
  );
}
