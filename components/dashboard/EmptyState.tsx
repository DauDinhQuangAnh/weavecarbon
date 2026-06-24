'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Package,
  Truck,
  FileText,
  Play,
  ArrowRight,
  Leaf,
  Globe,
  CheckCircle2
} from 'lucide-react';

interface EmptyStateProps {
  type?: 'overview' | 'products' | 'logistics' | 'reports';
}

const EmptyState: React.FC<EmptyStateProps> = () => {
  const router = useRouter();
  const { locale } = useLanguage();

  const steps = [
    {
      icon: Package,
      title: locale === 'vi' ? 'Thêm sản phẩm đầu tiên' : 'Add your first product',
      description: locale === 'vi'
        ? 'Nhập thông tin SKU và vật liệu để tính toán carbon footprint'
        : 'Enter SKU info and materials to calculate carbon footprint',
      action: () => router.push('/dashboard/products'),
      buttonText: locale === 'vi' ? 'Thêm sản phẩm' : 'Add Product'
    },
    {
      icon: Truck,
      title: locale === 'vi' ? 'Thiết lập tuyến vận chuyển' : 'Set up shipping routes',
      description: locale === 'vi'
        ? 'Theo dõi logistics và phát thải CO₂ từ vận chuyển'
        : 'Track logistics and CO₂ emissions from transport',
      action: () => router.push('/dashboard/logistics'),
      buttonText: locale === 'vi' ? 'Thêm shipment' : 'Add Shipment'
    },
    {
      icon: FileText,
      title: locale === 'vi' ? 'Xuất báo cáo tuân thủ' : 'Export compliance reports',
      description: locale === 'vi'
        ? 'Tạo báo cáo theo chuẩn EU CBAM, CSRD cho xuất khẩu'
        : 'Generate EU CBAM, CSRD compliant reports for export',
      action: () => router.push('/dashboard/export'),
      buttonText: locale === 'vi' ? 'Xem báo cáo' : 'View Reports'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Welcome Header */}
      <div className="text-center mb-8 max-w-2xl">
        <div className="w-16 h-16 bg-gradient-forest rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {locale === 'vi' ? 'Chào mừng đến với WeaveCarbon!' : 'Welcome to WeaveCarbon!'}
        </h1>
        <p className="text-muted-foreground text-lg">
          {locale === 'vi'
            ? 'Bắt đầu hành trình bền vững của doanh nghiệp bạn với 3 bước đơn giản'
            : 'Start your sustainability journey with 3 simple steps'}
        </p>
      </div>

      {/* Video Guide */}
      <Card className="w-full max-w-3xl mb-8 overflow-hidden border-primary/20">
        <CardContent className="p-0">
          <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 mb-4"
                  onClick={() => window.open('https://www.youtube.com/watch?v=demo', '_blank')}
                >
                  <Play className="w-6 h-6 ml-1" />
                </Button>
                <p className="text-muted-foreground font-medium">
                  {locale === 'vi' ? 'Xem hướng dẫn nhanh (2 phút)' : 'Watch quick guide (2 min)'}
                </p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">WeaveCarbon Tutorial</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
        {steps.map((step, index) => (
          <Card key={index} className="relative overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{index + 1}</span>
              </div>
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">{step.description}</p>
                <Button
                  variant="outline"
                  className="w-full mt-auto"
                  onClick={step.action}
                >
                  {step.buttonText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Benefits */}
      <div className="mt-12 max-w-3xl">
        <h3 className="text-center text-lg font-semibold mb-6 text-foreground">
          {locale === 'vi' ? 'Với WeaveCarbon, bạn có thể:' : 'With WeaveCarbon, you can:'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            locale === 'vi' ? 'Tính toán carbon footprint theo chuẩn GHG Protocol' : 'Calculate carbon footprint per GHG Protocol',
            locale === 'vi' ? 'Theo dõi logistics và phát thải vận chuyển' : 'Track logistics and transport emissions',
            locale === 'vi' ? 'Đánh giá độ sẵn sàng xuất khẩu EU, US, Nhật' : 'Assess export readiness for EU, US, Japan',
            locale === 'vi' ? 'Nhận gợi ý AI để giảm 15-30% CO₂' : 'Get AI suggestions to reduce 15-30% CO₂'
          ].map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
