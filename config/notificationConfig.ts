export interface NotificationRecipient {
  type: 'user' | 'admin' | 'company_members';
  roles?: ('admin' | 'member' | 'viewer')[];
}

export interface NotificationConfig {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  recipients: NotificationRecipient;
  emailSubjectTemplate: string;
  triggerEvents: string[];
}

export const allNotificationConfigs: NotificationConfig[] = [
  {
    id: 'shipment_status',
    label: 'Trạng thái vận chuyển',
    description: 'Thông báo khi shipment thay đổi trạng thái (tạo mới, đang giao, đã giao, hủy)',
    defaultEnabled: true,
    recipients: { type: 'company_members', roles: ['admin', 'member'] },
    emailSubjectTemplate: '[WeaveCarbon] Cập nhật trạng thái vận chuyển - {{shipmentRef}}',
    triggerEvents: ['shipment.created', 'shipment.in_transit', 'shipment.delivered', 'shipment.cancelled'],
  },
  {
    id: 'report_ready',
    label: 'Báo cáo sẵn sàng',
    description: 'Thông báo khi báo cáo carbon hoặc tuân thủ được tạo xong và sẵn sàng tải xuống',
    defaultEnabled: true,
    recipients: { type: 'company_members', roles: ['admin', 'member'] },
    emailSubjectTemplate: '[WeaveCarbon] Báo cáo {{reportType}} đã sẵn sàng',
    triggerEvents: ['report.generated', 'report.approved', 'report.exported'],
  },
  {
    id: 'user_invited',
    label: 'Tài khoản mới',
    description: 'Gửi email thông tin đăng nhập khi Root Admin tạo tài khoản mới cho thành viên',
    defaultEnabled: true,
    recipients: { type: 'user' },
    emailSubjectTemplate: '[WeaveCarbon] Tài khoản của bạn đã được tạo',
    triggerEvents: ['user.created', 'user.invited'],
  },
  {
    id: 'compliance_deadline',
    label: 'Deadline compliance',
    description: 'Nhắc nhở về các deadline CBAM, EUDR, kiểm kê KNK sắp đến (7 ngày, 3 ngày, 1 ngày)',
    defaultEnabled: true,
    recipients: { type: 'company_members', roles: ['admin'] },
    emailSubjectTemplate: '[WeaveCarbon] Nhắc nhở: Deadline {{complianceType}} còn {{daysLeft}} ngày',
    triggerEvents: [
      'compliance.deadline_7days',
      'compliance.deadline_3days',
      'compliance.deadline_1day',
      'compliance.deadline_overdue',
    ],
  },
];
