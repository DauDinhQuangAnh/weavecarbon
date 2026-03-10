import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { Camera, MapPin, ShieldCheck } from "lucide-react";

interface PermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "camera" | "location";
  onAllow: () => void;
  onDeny: () => void;
}

const PermissionDialog: React.FC<PermissionDialogProps> = ({
  open,
  onOpenChange,
  type,
  onAllow,
  onDeny
}) => {
  const config = {
    camera: {
      icon: Camera,
      title: "Allow Camera Access",
      description:
      "The app needs camera access to scan QR codes on garments and identify materials. Camera data is only processed on your device.",
      allowText: "Allow",
      denyText: "Deny"
    },
    location: {
      icon: MapPin,
      title: "Allow Location Access",
      description:
      "The app needs location access to calculate transport distance and carbon footprint. Your location is secure and not shared with third parties.",
      allowText: "Allow",
      denyText: "Deny"
    }
  };

  const currentConfig = config[type];
  const IconComponent = currentConfig.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <IconComponent className="w-8 h-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-xl text-center">
            {currentConfig.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base">
            {currentConfig.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <span>
            You can change this permission anytime in device settings.
          </span>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onDeny} className="flex-1">
            {currentConfig.denyText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onAllow}
            className="flex-1 bg-primary hover:bg-primary/90">
            
            {currentConfig.allowText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>);

};

export default PermissionDialog;