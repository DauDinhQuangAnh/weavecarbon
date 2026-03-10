export const PRODUCT_USAGE_UPDATED_EVENT = "weavecarbon:product-usage-updated";

export const dispatchProductUsageUpdatedEvent = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(PRODUCT_USAGE_UPDATED_EVENT));
};
