'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Mail,
  Truck,
  FileText,
  UserPlus,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { allNotificationConfigs, type NotificationConfig } from '@/config/notificationConfig';

interface Setting {
  id: string;
  enabled: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  shipment_status: Truck,
  report_ready: FileText,
  user_invited: UserPlus,
  compliance_deadline: AlertTriangle,
};

const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>(
    allNotificationConfigs.map((c) => ({ id: c.id, enabled: c.defaultEnabled }))
  );

  const toggle = (id: string, value: boolean) =>
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: value } : s)));

  const configById = (id: string): NotificationConfig | undefined =>
    allNotificationConfigs.find((c) => c.id === id);

  const handleSave = () => {
    toast.success('Đã lưu cài đặt thông báo');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Thông báo Email
              </CardTitle>
              <CardDescription className="mt-1">
                Cấu hình thông báo gửi qua email. Mỗi loại thông báo sẽ được gửi đến người nhận tương ứng.
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSettings((p) => p.map((s) => ({ ...s, enabled: true })))
                }
              >
                Bật tất cả
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSettings((p) => p.map((s) => ({ ...s, enabled: false })))
                }
              >
                Tắt tất cả
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {settings.map((setting) => {
            const config = configById(setting.id);
            if (!config) return null;
            const Icon = ICON_MAP[setting.id] ?? Mail;
            return (
              <div
                key={setting.id}
                className="flex items-center justify-between border-b py-4 last:border-0"
              >
                <div className="flex flex-1 items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{config.label}</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                              <strong>Người nhận:</strong>{' '}
                              {config.recipients.type === 'user'
                                ? 'Người dùng được tạo mới'
                                : config.recipients.roles?.join(', ') || 'Tất cả thành viên'}
                            </p>
                            <p className="mt-1 text-xs">
                              <strong>Trigger:</strong>{' '}
                              {config.triggerEvents.slice(0, 2).join(', ')}
                              {config.triggerEvents.length > 2 && '…'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                    {setting.id === 'user_invited' && (
                      <div className="mt-2 rounded bg-muted p-2 text-xs text-muted-foreground">
                        <strong>Lưu ý:</strong> Khi Root Admin tạo tài khoản mới, email thông báo sẽ
                        được gửi trực tiếp đến email của người dùng mới với thông tin đăng nhập.
                      </div>
                    )}
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <Badge variant={setting.enabled ? 'default' : 'secondary'} className="text-xs">
                    {setting.enabled ? 'Bật' : 'Tắt'}
                  </Badge>
                  <Checkbox
                    id={`notif-${setting.id}`}
                    checked={setting.enabled}
                    onCheckedChange={(v) => toggle(setting.id, Boolean(v))}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>Lưu cài đặt thông báo</Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
