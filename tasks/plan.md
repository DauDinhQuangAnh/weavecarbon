# Implementation Plan: Gợi Ý Hệ Số Phát Thải Tự Động Bằng AI (Smart Factor Recommendation)

## Overview
Xây dựng tính năng **Gợi Ý Hệ Số Phát Thải Tự Động Bằng AI (Smart Factor Recommendation Engine)** cho hệ thống WeaveCarbon. Tính năng này giúp kỹ sư nhà máy và cán bộ ESG tự động nhận diện và áp dụng hệ số phát thải chuẩn hóa (QĐ 13/2024/QĐ-TTg, Cục Biến đổi khí hậu - Bộ TN&MT, EVN Grid 2023/2025, IPCC AR6, DEFRA 2025) ngay khi nhập liệu hoặc sau khi AI scan hóa đơn/chứng từ, đồng thời tính toán lượng phát thải tức thời ($tCO_2e$) minh bạch.

---

## Architecture Decisions
1. **Độc lập và mô-đun hóa cao (`lib/ai/factorRecommendationAiService.ts`)**:
   - Tách riêng logic tri thức hệ số và thuật toán matching sang một service chuyên biệt, không làm phình to `carbonDataAiService.ts`.
   - Re-export các phương thức cần thiết để giữ tính nhất quán trong toàn bộ hệ thống AI của WeaveCarbon.
2. **Căn cứ pháp lý & Nguồn dữ liệu thực chứng (No Hallucination)**:
   - Toàn bộ hệ số phát thải được gán chặt với xuất xứ (provenance), tiêu chuẩn GWP (IPCC AR5/AR6 100-year), ranh giới (Cradle-to-Gate, Gate-to-Gate) và văn bản quy phạm pháp luật Việt Nam (QĐ 13/2024/QĐ-TTg, Công bố Cục BĐKH).
   - Tách biệt rõ ràng lượng phát thải hóa thạch (Fossil GHG) và lượng $CO_2$ sinh học (Biogenic Carbon) đối với nhiên liệu sinh khối (trấu, mùn cưa, dăm gỗ) theo chuẩn GHG Protocol Corporate Standard.
3. **Trải nghiệm người dùng 1-Click thông minh (`components/ui/SmartFactorSuggestionCard.tsx`)**:
   - Reactive: Tự động cập nhật gợi ý ngay khi người dùng thay đổi loại hoạt động hoặc số lượng tiêu thụ.
   - Instant Estimate: Tính toán ngay lượng phát thải ($tCO_2e$) kèm công thức toán học minh bạch để người dùng đối soát tức thời.
   - One-Click Apply: Nhấn 1 nút để tự động áp dụng hệ số, chuẩn hóa đơn vị và đề xuất cấp chất lượng DQL phù hợp.
   - Alternatives Switcher: Cho phép linh hoạt chuyển đổi giữa các nguồn tương đương (VD: Điện lưới EVN vs Điện mặt trời tự dùng vs Điện gió; hoặc Dầu Diesel lò hơi vs xe nâng).
4. **Bảo toàn tuyệt đối 9 trang được bảo vệ (`AGENTS.md`)**:
   - Giữ nguyên 665 files baseline.
   - Chỉ tích hợp vào các trang công nghiệp và quản trị dữ liệu được phép: `ActivityDataClient.tsx`, `ActivityOperationsPanel.tsx`, `DataGovernanceClient.tsx`.

---

## Task Breakdown

### Phase 1: Foundation & AI Recommendation Engine Core
- [ ] **Task 1**: Xây dựng Knowledge Base & Recommendation Engine `lib/ai/factorRecommendationAiService.ts`
  - **Mô tả**: Tạo module chứa dữ liệu hệ số chuẩn hóa theo QĐ 13/2024, Cục BĐKH, EVN 2023, DEFRA 2025, IPCC AR6 và hàm `recommendEmissionFactor(input)`.
  - **Tiêu chí hoàn thành**:
    - Nhận diện chính xác hệ số theo `activityType`, `unit`, `geography`, từ khóa bối cảnh.
    - Trả về hệ số tối ưu kèm confidence score, lý do chọn, các hệ số thay thế (alternatives) và tính toán phát thải tức thời ($tCO_2e$).
    - Hỗ trợ đầy đủ các nhóm: Điện lưới/Điện tái tạo, Nhiên liệu cố định (Diesel, Xăng, LPG, Than đá, Sinh khối), Hơi nước, Vận tải logistics, và Vật liệu dệt may.
  - **Kiểm thử**: Viết unit test `test/ai/factorRecommendationAiService.test.ts` (Vitest) kiểm tra 100% các nhánh nghiệp vụ.

### Checkpoint 1: Foundation
- [ ] Chạy `npx vitest run test/ai/factorRecommendationAiService.test.ts` pass toàn bộ.

---

### Phase 2: UI Component & User Interaction
- [ ] **Task 2**: Xây dựng UI Component `components/ui/SmartFactorSuggestionCard.tsx`
  - **Mô tả**: Tạo thẻ card hiển thị hệ số gợi ý từ AI, độ phù hợp, lượng phát thải ước tính ($tCO_2e$), nút 1-click Apply và danh sách hệ số thay thế.
  - **Tiêu chí hoàn thành**:
    - Tuân thủ WeaveCarbon Design System (Slate/Emerald/Sky, badges DQL, Lucide icons).
    - Tương thích Responsive và hỗ trợ cả trạng thái Loading/Empty.
    - Hỗ trợ callback `onApplyFactor(factor)` để đồng bộ ngược vào form dữ liệu cha.

### Checkpoint 2: UI Component
- [ ] Component compile sạch, không lỗi TypeScript.

---

### Phase 3: Integration into Industrial Workflows
- [ ] **Task 3**: Tích hợp gợi ý hệ số vào Sổ cái Hoạt động (`ActivityDataClient.tsx` & `ActivityOperationsPanel.tsx`)
  - **Mô tả**: Kết nối `SmartFactorSuggestionCard` vào modal thêm hoạt động phát thải.
  - **Tiêu chí hoàn thành**:
    - Khi người dùng nhập/scan số lượng và loại hoạt động, thẻ gợi ý AI hiển thị ngay lập tức.
    - Khi bấm "Áp dụng hệ số này", tự động điền đơn vị đo lường, lưu thông tin hệ số vào payload hoạt động và cập nhật DQL phù hợp.
- [ ] **Task 4**: Tích hợp AI Gợi ý Thông số Chuẩn vào Quản trị Dữ liệu (`DataGovernanceClient.tsx`)
  - **Mô tả**: Thêm nút *"AI Gợi ý Thông số Chuẩn"* trên form Đề xuất Hệ số phát thải mới.
  - **Tiêu chí hoàn thành**:
    - Tự động điền giá trị phát thải, đơn vị, nguồn trích dẫn pháp lý, đường dẫn nguồn, ranh giới và chuẩn GWP từ thư viện hệ số chuẩn quốc gia khi nhập tên hệ số.

### Checkpoint 3: Integration
- [ ] Luồng thêm hoạt động và đề xuất hệ số hoạt động trơn tru trong cả môi trường Demo và Live.

---

### Phase 4: Verification & Quality Assurance
- [ ] **Task 5**: Kiểm thử tổng thể và rà soát hệ thống
  - **Tiêu chí hoàn thành**:
    - `npm test`: Tất cả unit tests (bao gồm các test mới) passed.
    - `npx tsc --noEmit`: 0 lỗi type.
    - `node scripts/check-protected-pages.mjs`: Bảo toàn 665 files unchanged.
    - `npm run build`: Production build thành công.

---

## Risks and Mitigations
| Nguy cơ (Risk) | Mức độ | Biện pháp giảm thiểu (Mitigation) |
|---|---|---|
| Hệ số phát thải không đúng thực tế dẫn đến sai lệch kiểm toán ESG | Cao | Chỉ sử dụng các hệ số chính thống từ QĐ 13/2024/QĐ-TTg, Cục BĐKH, EVN, DEFRA 2025, IPCC AR6. Luôn hiển thị nguồn trích dẫn minh bạch. |
| Xung đột với 665 tệp được bảo vệ theo `AGENTS.md` | Rất cao | Không chỉnh sửa bất kỳ tệp nào trong danh mục 9 menu bảo vệ; chạy script kiểm tra trước và sau mỗi thay đổi. |
| Tính toán phát thải sai lệch do đơn vị đo không tương thích | Trung bình | Tích hợp bộ quy đổi đơn vị tự động (kWh, MWh, L, m³, kg, tấn, tonne.km) với cảnh báo trực quan nếu đơn vị không tương thích. |
