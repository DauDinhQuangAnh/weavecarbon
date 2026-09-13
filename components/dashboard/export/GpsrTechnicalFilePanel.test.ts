import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/dashboard/export/GpsrTechnicalFilePanel.tsx'), 'utf8'
);

describe('R10 GPSR safety workspace boundaries', () => {
  it('does not present automation as proof of safety or an authority filing', () => {
    expect(source).toContain('không chứng nhận sản phẩm an toàn');
    expect(source).toContain('chỉ ghi “đã báo” khi có reference và bằng chứng ngoài hệ thống');
    expect(source).toContain('product_safety_reviewer');
    expect(source).toContain('Duyệt phát hành nội bộ');
  });

  it('exposes risk, operators, distance-sale, retention and post-market controls', () => {
    expect(source).toContain('Risk analysis và verification');
    expect(source).toContain('EU responsible person');
    expect(source).toContain('Thông tin bắt buộc khi bán online');
    expect(source).toContain('retentionUntil');
    expect(source).toContain('safety_business_gateway_notification');
    expect(source).toContain('không chứa dữ liệu cá nhân người tiêu dùng');
    expect(source).toContain('Nguồn EUR-Lex');
  });
});
