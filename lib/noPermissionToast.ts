"use client";

import { toast } from "sonner";
import { NO_PERMISSION_MESSAGE } from "@/lib/permissions";
import {
  isSubscriptionLocked,
  readSubscriptionLockState
} from "@/lib/subscriptionLockState";

const PLAN_LOCKED_MESSAGE = "Gói Trial 14 ngày đã hết hạn. Vui lòng nâng cấp gói để tiếp tục thao tác.";

export const showPlanLockedToast = () => {
  toast.warning(PLAN_LOCKED_MESSAGE);
};

export const showNoPermissionToast = () => {
  if (isSubscriptionLocked(readSubscriptionLockState())) {
    showPlanLockedToast();
    return;
  }

  toast.info(NO_PERMISSION_MESSAGE);
};

