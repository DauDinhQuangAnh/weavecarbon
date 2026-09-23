// @vitest-environment jsdom

import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({ pathname: "/overview" }));

vi.mock("next/navigation", () => ({
  usePathname: () => routeState.pathname
}));

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
    options?: { loading?: ComponentType }
  ) => {
    const LazyComponent = lazy(loader);
    const Loading = options?.loading;
    return function TestDynamicComponent(props: Record<string, unknown>) {
      return (
        <Suspense fallback={Loading ? <Loading /> : null}>
          <LazyComponent {...props} />
        </Suspense>
      );
    };
  }
}));

vi.mock("./WeaveyChat", () => ({
  default: ({ initiallyOpen }: { initiallyOpen?: boolean }) => (
    <div data-testid="weavey-chat" data-open={String(Boolean(initiallyOpen))} />
  )
}));

import RouteWeaveyChat from "./RouteWeaveyChat";

describe("RouteWeaveyChat", () => {
  beforeEach(() => {
    routeState.pathname = "/overview";
  });

  afterEach(() => {
    cleanup();
  });

  it("does not mount the chat client before the launcher is activated", () => {
    render(<RouteWeaveyChat />);

    expect(screen.getByRole("button", { name: "Mở trợ lý Weavey" })).toBeInTheDocument();
    expect(screen.queryByTestId("weavey-chat")).not.toBeInTheDocument();
  });

  it("mounts and opens the chat after the user activates the launcher", async () => {
    const user = userEvent.setup();
    render(<RouteWeaveyChat />);

    await user.click(screen.getByRole("button", { name: "Mở trợ lý Weavey" }));

    const chat = await screen.findByTestId("weavey-chat");
    expect(chat).toHaveAttribute("data-open", "true");
  });

  it("does not render the widget on the dedicated AI settings page", () => {
    routeState.pathname = "/settings/ai";
    render(<RouteWeaveyChat />);

    expect(screen.queryByRole("button", { name: "Mở trợ lý Weavey" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("weavey-chat")).not.toBeInTheDocument();
  });
});
