// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SmartFactorSuggestionCard from "./SmartFactorSuggestionCard";

describe("SmartFactorSuggestionCard", () => {
  afterEach(() => cleanup());

  it("renders recommended factor with score and source", () => {
    render(
      <SmartFactorSuggestionCard
        activityType="electricity"
        quantity={1000}
        canonicalUnit="kWh"
        geography="VN"
      />
    );

    expect(screen.getByText(/AI Gợi Ý Hệ Số Phát Thải/i)).toBeDefined();
    expect(screen.getByText(/Điện lưới quốc gia Việt Nam/i)).toBeDefined();
    expect(screen.getAllByText("0.6592").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/tCO₂e/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calls onApplyFactor when Apply button is clicked", () => {
    const handleApply = vi.fn();

    render(
      <SmartFactorSuggestionCard
        activityType="fuel_diesel"
        quantity={500}
        canonicalUnit="L"
        onApplyFactor={handleApply}
      />
    );

    const applyBtn = screen.getByRole("button", { name: /Áp dụng hệ số/i });
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleApply.mock.calls[0][0].factorId).toBe("fuel-diesel-stationary-vn-2024");
    expect(screen.getByText(/Đã áp dụng/i)).toBeDefined();
  });

  it("expands alternative factors when toggled", () => {
    render(
      <SmartFactorSuggestionCard
        activityType="electricity"
        quantity={2000}
        canonicalUnit="kWh"
      />
    );

    const toggleBtn = screen.getByText(/Xem 3 hệ số thay thế khả dụng/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Điện mặt trời mái nhà tự dùng/i)).toBeDefined();
    expect(screen.getByText(/Điện gió trên bờ/i)).toBeDefined();
  });

  it("toggles and searches RAG knowledge base", async () => {
    render(
      <SmartFactorSuggestionCard
        activityType="material"
        quantity={100}
        canonicalUnit="kg"
      />
    );

    const ragToggle = screen.getByText(/Tra cứu hệ số mở rộng bằng RAG/i);
    fireEvent.click(ragToggle);

    const input = screen.getByPlaceholderText(/Nhập tên vật tư, hóa chất/i);
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: "thuốc nhuộm hoạt tính" } });
    const searchBtn = screen.getByRole("button", { name: /Tìm RAG/i });
    fireEvent.click(searchBtn);

    await screen.findByText(/Thuốc nhuộm hoạt tính/i);
    expect(screen.getByText(/RAG Verified/i)).toBeDefined();
    expect(screen.getByText(/BREF Textiles/i)).toBeDefined();
  });
});
