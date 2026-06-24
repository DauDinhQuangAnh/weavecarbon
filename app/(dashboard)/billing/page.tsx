'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useSubscriptionLock } from '@/hooks/useSubscriptionLock';
import { getSubscriptionPlanFamily } from '@/lib/subscriptionPlans';
import { getSubscriptionApiPayload } from '@/lib/subscriptionApi';
import { fetchProducts } from '@/lib/productsApi';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';

interface SubscriptionState {
  plan: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  skuCount: number;
  skuLimit: number;
}

interface PaymentSessionData {
  payment_url?: string;
  vnpay_url?: string;
  checkout_url?: string;
  session_id?: string;
}

const SKU_TIERS: { value: 20 | 35 | 50; label: string; price: string }[] = [
  { value: 20, label: '+20 SKU', price: '899,000 VND/tháng' },
  { value: 35, label: '+35 SKU', price: '1,199,000 VND/tháng' },
  { value: 50, label: '+50 SKU', price: '1,499,000 VND/tháng' },
];

export default function BillingPage() {
  const { user } = useAuth();
  const { currentPlan, trialEndsAt, trialExpired, hasHydrated } = useSubscriptionLock();

  const [subState, setSubState] = useState<SubscriptionState>({
    plan: null,
    trialEndsAt: null,
    trialExpired: false,
    trialDaysLeft: null,
    skuCount: 0,
    skuLimit: 0,
  });

  const [showStandardModal, setShowStandardModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<20 | 35 | 50>(20);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    Promise.all([
      getSubscriptionApiPayload(),
      fetchProducts({ page: 1, page_size: 1 }),
    ])
      .then(([payload, productsResult]) => {
        const plan =
          payload.current_plan ?? payload.subscription?.current_plan ?? null;
        const endsAt = payload.trial_ends_at ?? payload.trial?.ends_at ?? null;
        const expired = payload.trial_expired ?? payload.trial?.expired ?? false;
        const daysLeft =
          payload.trial_days_remaining ?? payload.trial?.days_remaining ?? null;
        const skuCount = productsResult.pagination.total ?? 0;
        const skuLimit =
          payload.limits?.products ?? payload.plan_details?.products ?? 0;
        setSubState({
          plan,
          trialEndsAt: endsAt,
          trialExpired: expired,
          trialDaysLeft: typeof daysLeft === 'number' ? daysLeft : null,
          skuCount,
          skuLimit,
        });
      })
      .catch(() => {});
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
    if (planFamily === 'standard') return 'Standard';
    if (planFamily === 'export') return 'Export';
    return effectivePlan;
  }, [effectivePlan, planFamily, subState, trialEndsAt, trialExpired]);

  const isTrialExpired = subState.trialExpired || trialExpired;

  const handleBuyStandard = async () => {
    if (!user?.company_id) return;
    setPurchasing(true);
    try {
      const res = await api.post<PaymentSessionData>(
        '/subscription/upgrade',
        {
          target_plan: 'standard',
          billing_cycle: 'monthly',
          payment_provider: 'vnpay',
          standard_sku_limit: selectedSku,
        }
      );
      const url = res?.payment_url ?? res?.vnpay_url ?? res?.checkout_url;
      if (url) {
        sessionStorage.setItem('weavecarbon_pending_upgrade_plan', 'standard');
        sessionStorage.setItem('weavecarbon_pending_upgrade_display_plan', 'standard');
        sessionStorage.setItem('weavecarbon_pending_upgrade_expected_products_limit', String(selectedSku));
        if (res?.session_id) {
          sessionStorage.setItem('weavecarbon_pending_upgrade_session_id', res.session_id);
        }
        window.location.href = url;
      }
    } catch {
      // noop — user stays on page
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="space-y-6 max-w-4xl mx-auto">
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
                  {subState.skuLimit > 0 ? ` / ${subState.skuLimit} giới hạn` : ''}
                </p>
              </div>
            </div>
            {isTrialExpired && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Trial đã hết hạn
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Plan cards — 3 cols */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {/* ── Trial ── */}
          <Card className={`relative ${planFamily === 'trial' ? 'ring-2 ring-primary shadow-md' : ''}`}>
            <CardContent className="pt-6 pb-5 px-5 space-y-4">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center mb-1">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold">Trial</h3>
                <p className="text-sm text-muted-foreground">Miễn phí 14 ngày</p>
                <div className="mt-1">
                  <span className="text-3xl font-extrabold">0đ</span>
                  <span className="block text-sm text-muted-foreground">Kích hoạt tự động</span>
                </div>
                <p className="text-xs text-primary italic mt-1">
                  Trial 14 ngày tự động kích hoạt khi tạo tài khoản mới.
                </p>
              </div>

              <ul className="space-y-2 text-sm">
                {['Tính carbon proxy đơn giản', 'Vận chuyển nội địa', 'Xuất báo cáo PDF'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button variant="outline" className="w-full" disabled>
                Trial được kích hoạt tự động
              </Button>
            </CardContent>
          </Card>

          {/* ── Standard ── */}
          <Card
            className={`relative border-2 ${
              planFamily === 'standard'
                ? 'border-primary ring-2 ring-primary shadow-md'
                : 'border-primary'
            }`}
          >
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-0.5 text-xs whitespace-nowrap">
              Mua nhiều nhất
            </Badge>

            <CardContent className="pt-7 pb-5 px-5 space-y-4">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-1">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold">Standard</h3>
                <p className="text-sm text-muted-foreground">
                  Một gói Standard, chọn thêm mức SKU phù hợp
                </p>
                <div className="mt-1">
                  <span className="text-2xl font-extrabold">899,000 – 1,499,000</span>
                  <span className="block text-sm text-muted-foreground">VND/tháng</span>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                Chọn thêm 20, 35 hoặc 50 SKU theo nhu cầu sử dụng.
              </div>

              <ul className="space-y-2 text-sm">
                {['Tính carbon proxy đơn giản', 'Vận chuyển nội địa', 'Vận chuyển xuất khẩu'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => setShowStandardModal(true)}
                disabled={!user?.company_id}
              >
                Mua thêm SKU
              </Button>
            </CardContent>
          </Card>

          {/* ── Export ── */}
          <Card className={`relative ${planFamily === 'export' ? 'ring-2 ring-amber-500 shadow-md' : ''}`}>
            <CardContent className="pt-6 pb-5 px-5 space-y-4">
              <div className="flex flex-col items-center text-center gap-1">
                <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center mb-1">
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold">Export</h3>
                <p className="text-sm text-muted-foreground">Doanh nghiệp</p>
                <div className="mt-1">
                  <span className="text-3xl font-extrabold">3M – 6M</span>
                  <span className="block text-sm text-muted-foreground">VND/tháng</span>
                </div>
              </div>

              <ul className="space-y-2 text-sm">
                {[
                  'Tất cả tính năng của Standard',
                  'Báo cáo tuân thủ US/EU',
                  'Theo dõi circular credit',
                  'Hỗ trợ audit nâng cao',
                  'Tích hợp ERP API',
                  'Quản lý tài khoản riêng',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/5"
                onClick={() =>
                  window.open(
                    'mailto:sales@weavecarbon.com?subject=Tư vấn gói Export WeaveCarbon',
                    '_blank'
                  )
                }
              >
                Liên hệ tư vấn
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Để được tư vấn hoặc tuỳ chỉnh gói, liên hệ{' '}
          <a href="mailto:sales@weavecarbon.com" className="text-primary underline">
            sales@weavecarbon.com
          </a>
        </p>
      </div>

      {/* Standard SKU purchase modal */}
      <Dialog open={showStandardModal} onOpenChange={setShowStandardModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chọn gói SKU Standard</DialogTitle>
            <DialogDescription>
              Chọn số lượng SKU phù hợp với nhu cầu doanh nghiệp của bạn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {SKU_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setSelectedSku(tier.value)}
                className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedSku === tier.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedSku === tier.value ? 'border-primary' : 'border-slate-300'
                    }`}
                  >
                    {selectedSku === tier.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="font-medium text-sm">{tier.label}</span>
                </div>
                <span className="text-sm font-semibold text-primary">{tier.price}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowStandardModal(false)}
              disabled={purchasing}
            >
              Huỷ
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleBuyStandard}
              disabled={purchasing}
            >
              {purchasing ? (
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-spin" />
                  Đang xử lý…
                </span>
              ) : (
                'Xác nhận thanh toán'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
