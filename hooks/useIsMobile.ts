import { useBreakpoint } from "@/hooks/useBreakpoint";

export function useIsMobile() {
  const { isMobile } = useBreakpoint();
  return isMobile;
}
