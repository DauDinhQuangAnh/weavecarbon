// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Lưu thay đổi</Button>);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Gửi</Button>);

    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Vô hiệu hóa
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Vô hiệu hóa" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
