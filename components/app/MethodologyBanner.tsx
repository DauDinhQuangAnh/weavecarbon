import { ShieldCheck } from "lucide-react";
import { METHODOLOGY_DISCLAIMER_VI } from "@/config/penalties";

interface MethodologyBannerProps {
  variant?: "subtle" | "prominent";
  className?: string;
}

/** Ghi chú phương pháp luận — ghim ở chân dashboard và các màn báo cáo/xuất khẩu. */
export default function MethodologyBanner({ variant = "subtle", className = "" }: MethodologyBannerProps) {
  if (variant === "prominent") {
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 ${className}`}>
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-foreground">{METHODOLOGY_DISCLAIMER_VI}</p>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <span>{METHODOLOGY_DISCLAIMER_VI}</span>
    </div>
  );
}
