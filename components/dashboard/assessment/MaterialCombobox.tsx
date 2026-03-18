import React, { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  CatalogMaterial,
  MaterialType,
  MATERIAL_CATALOG,
  MATERIAL_TYPE_LABELS,
  MATERIAL_FAMILY_LABELS
} from "./materialCatalog";

interface MaterialComboboxProps {
  value?: string;
  onSelect: (material: CatalogMaterial | null) => void;
  onOtherClick: () => void;
  materialType?: MaterialType;
  placeholder?: string;
  disabled?: boolean;
}

const MaterialCombobox: React.FC<MaterialComboboxProps> = ({
  value,
  onSelect,
  onOtherClick,
  materialType,
  placeholder,
  disabled = false
}) => {
  const t = useTranslations("assessment.materialCombobox");
  const locale = useLocale();
  const isVi = locale === "vi";

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const defaultPlaceholder = placeholder || t("searchPlaceholder");

  const filteredMaterials = useMemo(() => {
    const query = search.toLowerCase().trim();

    return MATERIAL_CATALOG
      .filter((material: { status: string }) => material.status === "active")
      .filter((material) => !materialType || material.materialType === materialType)
      .filter(
        (material: {
          displayNameVi: string;
          displayNameEn: string;
          materialFamily: string;
        }) => {
          if (!query) return true;
          return (
            material.displayNameVi.toLowerCase().includes(query) ||
            material.displayNameEn.toLowerCase().includes(query) ||
            material.materialFamily.includes(query)
          );
        }
      )
      .slice(0, 15);
  }, [materialType, search]);

  const groupedMaterials = useMemo(() => {
    const groups: Record<MaterialType, CatalogMaterial[]> = {
      fabric: [],
      trim: [],
      accessory: [],
      packaging: []
    };

    filteredMaterials.forEach((material) => {
      groups[material.materialType].push(material);
    });

    return groups;
  }, [filteredMaterials]);

  const selectedMaterial = value ? MATERIAL_CATALOG.find((material) => material.id === value) : null;

  const getMaterialName = (material: CatalogMaterial) =>
    isVi ? material.displayNameVi : material.displayNameEn;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", !selectedMaterial && "text-muted-foreground")}
          disabled={disabled}
        >
          {selectedMaterial ? (
            <span className="flex items-center gap-2 truncate">
              {getMaterialName(selectedMaterial)}
              {selectedMaterial.isRecycled ? (
                <Badge variant="secondary" className="text-xs">
                  {t("recycledBadge")}
                </Badge>
              ) : null}
            </span>
          ) : (
            defaultPlaceholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />

          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">{t("notFound")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    onOtherClick();
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("addOther")}
                </Button>
              </div>
            </CommandEmpty>

            {Object.entries(groupedMaterials).map(([type, materials]) => {
              if (materials.length === 0) return null;

              return (
                <CommandGroup
                  key={type}
                  heading={
                    t.has(`materialTypes.${type}`)
                      ? t(`materialTypes.${type}`)
                      : MATERIAL_TYPE_LABELS[type as MaterialType]
                  }
                >
                  {materials.map((material) => (
                    <CommandItem
                      key={material.id}
                      value={material.id}
                      onSelect={() => {
                        onSelect(material);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === material.id ? "opacity-100" : "opacity-0"
                          )}
                        />

                        <div>
                          <span>{getMaterialName(material)}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            (
                            {t.has(`materialFamilies.${material.materialFamily}`)
                              ? t(`materialFamilies.${material.materialFamily}`)
                              : MATERIAL_FAMILY_LABELS[material.materialFamily]}
                            )
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {material.isRecycled ? (
                          <Badge variant="secondary" className="text-xs">
                            ♻
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {material.co2Factor} {t("co2Unit")}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}

            <CommandSeparator />

            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  onOtherClick();
                }}
                className="text-primary"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span>{t("addOtherHint")}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MaterialCombobox;
