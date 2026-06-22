'use client';

import React from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

interface MobileFilterSheetProps {
  title?: string;
  children: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  trigger?: React.ReactNode;
}

const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  title = 'Bộ lọc',
  children,
  onApply,
  onReset,
  trigger,
}) => {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className="h-10 w-10 md:hidden">
            <Filter className="h-4 w-4" />
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>
        <DrawerFooter className="border-t pt-4 pb-safe">
          <div className="flex gap-3">
            {onReset && (
              <Button variant="outline" className="flex-1 h-12" onClick={onReset}>
                Đặt lại
              </Button>
            )}
            <DrawerClose asChild>
              <Button className="flex-1 h-12" onClick={onApply}>
                Áp dụng
              </Button>
            </DrawerClose>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileFilterSheet;
