"use client";

import { useEffect, useState } from "react";
import { Building2, User, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";

interface UserTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserTypeDialog = ({ open, onOpenChange }: UserTypeDialogProps) => {
  const t = useTranslations("userType");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const { signInDemo, startLocalDemo } = useAuth();
  const { toast } = useToast();
  const [demoLoading, setDemoLoading] = useState<"b2b" | "b2c" | null>(null);
  const demoB2CLabel = t.has("demoB2C") ? t("demoB2C") : "Demo B2C";

  useEffect(() => {
    if (!open) return;

    router.prefetch("/demo/overview");
    router.prefetch("/b2c");
  }, [open, router]);

  const handleDemoLogin = async () => {
    if (demoLoading) return;

    setDemoLoading("b2b");
    try {
      const { error } = await startLocalDemo("b2b_standard_20");
      if (error) {
        toast({
          title: tAuth("error"),
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      onOpenChange(false);
      router.push("/demo/overview");
    } finally {
      setDemoLoading(null);
    }
  };

  const handleB2CDemoLogin = async () => {
    if (demoLoading) return;

    setDemoLoading("b2c");
    try {
      const { error } = await signInDemo("b2c");
      if (error) {
        toast({
          title: tAuth("error"),
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      onOpenChange(false);
      router.push("/b2c");
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-4 sm:gap-4 sm:py-6">
          <Link
            href="/auth?type=b2b&forceLogin=1"
            onClick={() => onOpenChange(false)}
            className="group flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4 transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 sm:gap-4 sm:p-5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-14 sm:w-14">
              <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                {t("b2b")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("b2bDesc")}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>

          <Link
            href="/auth?type=b2c&forceLogin=1"
            onClick={() => onOpenChange(false)}
            className="group flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4 transition-all duration-300 hover:border-accent/50 hover:bg-accent/5 sm:gap-4 sm:p-5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground sm:h-14 sm:w-14">
              <User className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                {t("b2c")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("b2cDesc")}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-accent" />
          </Link>

          <div className="pt-2">
            <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>{t("orTry")}</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleDemoLogin()}
                disabled={demoLoading !== null}
                className="group flex items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-60"
              >
                <Play className="h-4 w-4 text-primary" />
                <span>{demoLoading === "b2b" ? tAuth("loading") : t("demoB2B")}</span>
              </button>

              <Button
                type="button"
                variant="outline"
                className="h-auto rounded-xl px-5 py-4 text-sm"
                disabled={demoLoading !== null}
                onClick={() => void handleB2CDemoLogin()}
              >
                <User className="h-4 w-4" />
                <span>{demoLoading === "b2c" ? tAuth("loading") : demoB2CLabel}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserTypeDialog;
