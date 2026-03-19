import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { DEFAULT_TOAST_DURATION } from "@/lib/toastConfig";

type ToasterToast = {
  id?: string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

const resolveMessage = (props: Partial<ToasterToast>) => {
  return props.title ?? props.description ?? "";
};

const resolveOptions = (props: Partial<ToasterToast>, id?: string | number) => {
  const hasTitle = props.title !== undefined && props.title !== null;

  return {
    id: id ?? props.id,
    description: hasTitle ? props.description : undefined,
    action: props.action,
    duration: DEFAULT_TOAST_DURATION
  };
};

const showToast = (props: Partial<ToasterToast>, id?: string | number) => {
  const message = resolveMessage(props);
  const options = resolveOptions(props, id);

  if (props.variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  return sonnerToast(message, options);
};

function toast({ ...props }: Omit<ToasterToast, "id">) {
  const id = showToast(props);

  const dismiss = () => sonnerToast.dismiss(id);
  const update = (nextProps: Partial<ToasterToast>) => {
    showToast({ ...props, ...nextProps }, id);
  };

  return { id, dismiss, update };
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId)
  };
}

export { useToast, toast };
