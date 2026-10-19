# WEAVECARBON — DESIGN SYSTEM, COLOR TOKENS & MOTION SPEC
#design-system #tokens #animation #weavecarbon #enterprise #spec

> [!NOTE] Nguồn gốc & Mục tiêu
> **Thẻ 2** — Chuẩn màu sắc, typography, surfaces và animation của `weavecarbon.lovable.app` để port sang `weavecarbon.com`.
> **Mục tiêu**: Làm *source of truth* khi phát triển và bảo trì giao diện WeaveCarbon để tránh tình trạng mỗi page dùng một màu, một shadow, một kiểu animation hoặc spacing khác nhau. Các giá trị được đồng bộ trực tiếp từ design tokens và motion implementation của Lovable.

---

## 1. NGUYÊN TẮC VIBE CHUNG
WeaveCarbon không nên trông giống một “green ESG landing page” hoặc một AI demo nhiều neon. Vibe chuẩn là:
$$\text{Industrial infrastructure} \times \text{enterprise software} \times \text{climate intelligence}$$

### Cảm giác cần đạt:
- **Sạch, ấm, đáng tin cậy**, có chiều sâu nhưng không nặng nề.
- **Nền cream rất nhạt** thay vì trắng lạnh.
- **Màu xanh chính phải là deep forest/emerald**, không phải xanh lá tươi.
- **Accent lime/sage** chỉ dùng để tạo hierarchy hoặc trạng thái, không phủ toàn màn hình.
- **Data table, chart và status** phải đọc được nhanh; decoration luôn đứng sau thông tin.
- **Motion mềm**, có quán tính nhẹ, không “bay nhảy”.
- **Glass effect có nhưng restrained**; không biến toàn bộ app thành glassmorphism.
- **Dashboard phải mang cảm giác enterprise product**, không phải marketing microsite.

---

## 2. TYPOGRAPHY — PHẢI ĐỒNG BỘ TRƯỚC KHI SỬA COMPONENT

### 2.1. Font family
- **Body / UI**: `Inter`, `system-ui`, `sans-serif`.
- **Heading / display**: `Manrope`, `system-ui`, `sans-serif`.
- **System fallback**: `system-ui`, `sans-serif`.
- *Quy tắc*: Không dùng font khác cho riêng page, chart title, modal hoặc menu.

### 2.2. Letter spacing
- **Body**: `-0.01em`
- **Heading h1–h4**: `-0.025em`
- *Mục đích*: Chữ compact hơn, hiện đại hơn và giảm cảm giác “website template”.

### 2.3. Font Weight
- **Body**: `400`
- **Supporting text**: `400–500`
- **Label / menu**: `500–600`
- **Heading**: `600–700` tùy cấp
- *Quy tắc*: Không dùng bold `700` cho mọi label; chỉ dùng cho hierarchy thật sự.

### 2.4. Quy tắc màu chữ
- **Primary text**: `Foreground / Ink`
- **Secondary / help text**: `Muted Foreground / Charcoal`
- **Active / interactive text**: `Primary`
- **Warning / error**: dùng semantic token, không tự chọn orange/red khác.

---

## 3. CORE COLOR TOKENS — GIÁ TRỊ CHÍNH XÁC

> [!IMPORTANT]
> Dev dùng shared theme/token layer và tuyệt đối hạn chế hard-coded HEX trong component.

| Token Name | HSL Value | HEX tương đương | Ứng dụng chính |
| :--- | :--- | :--- | :--- |
| **3.1. Background / Canvas** | `80 30% 96%` | `#F6F8F2` | Body background, page canvas, vùng nền chính dashboard. *Không dùng pure white #FFFFFF làm toàn bộ body.* |
| **3.2. Foreground / Ink** | `103 37% 8%` | `#111C0D` | Body text chính, heading, số liệu quan trọng, icon neutral đậm (đây là black-green, không phải #000000). |
| **3.3. Card** | `75 33% 98%` | `#FBFCF8` | Card nền, panel, table container, popover base khi không dùng glass. |
| **3.4. Primary** | `150 61% 20%` | `#145233` | CTA chính, active icon, selected emphasis, progress/status tích cực, focus ring. |
| **3.5. Primary Foreground** | `80 30% 96%` | `#F6F8F2` | Text / icon trên primary button. |
| **3.6. Secondary** | `90 28% 93%` | `#EDF2E8` | Active sidebar item background, secondary button, subtle selected row, panel emphasis nhẹ. |
| **3.7. Secondary Foreground** | `97 40% 19%` | `#2C441D` | Text trên secondary surfaces. |
| **3.8. Muted** | `100 28% 88%` | `#DEE9D8` | Soft divider areas, muted chips, placeholder surfaces, chart supporting fill nhẹ. |
| **3.9. Muted Foreground / Charcoal** | `101 15% 34%` | `#52644A` | Subtitle, metadata, table secondary text, timestamp, help text. *Không dùng opacity 50% của black.* |
| **3.10. Accent** | `93 32% 57%` | `#8EB46E` | Dùng rất tiết chế: small highlight, graph accent, icon spark, top scroll progress gradient. *Không làm primary CTA.* |
| **3.11. Accent Foreground** | `96 49% 10%` | `#17260D` | Text trên nền accent. |
| **3.12. Border / Input** | `100 22% 84%` | `#D3DFCD` | Card border, table border, input outline, divider. *Tránh border xám lạnh #E5E7EB.* |
| **3.13. Ring** | `150 61% 20%` | `#145233` | Focus state phải thống nhất với primary. |
| **3.14. Deep Forest / “Navy”** | `96 49% 10%` | `#17260D` | Logo badge, strong icon background, deep section accents (legacy naming: navy nhưng màu là deep forest). |
| **3.15. Forest Dark** | `97 40% 19%` | `#2C441D` | Dùng trong gradient forest hoặc supporting emphasis. |
| **3.16. Forest Light / Info** | `150 35% 35%` | `#3A7859` | Info status, supporting green chart, gradient pair. |
| **3.17. Earth Warm** | `98 43% 21%` | `#2F4D1F` | Supporting organic dark tone, không phải CTA chính. |
| **3.18. Warning** | `38 70% 52%` | `#DA9B2F` | Warning badge, needs review, incomplete state, confidence issue. |
| **3.19. Destructive** | `0 52% 54%` | `#C74D4D` | Lỗi, reject, destructive action. *Không dùng đỏ tươi #EF4444 nếu không cần.* |

---

## 4. SEMANTIC COLOR RULES
- **4.1. Active sidebar**:
  - `Background`: `secondary` (`#EDF2E8`)
  - `Text`: `secondary-foreground` hoặc `foreground`
  - `Icon`: `primary` (`#145233`)
  - *Không dùng primary background + white text cho toàn row vì sẽ làm sidebar nặng.*
- **4.2. Positive / ready**:
  - Không mặc định “green = verified”. Green chỉ có nghĩa positive state theo context.
  - Ví dụ: “Ready for calculation” có thể xanh; còn “Third-party verified” phải có nhãn riêng bảo chứng.
- **4.3. Warning / needs review**:
  - Warning background nên ở dạng tint rất nhạt (amber 50–100 style).
  - Text/icon warning đậm hơn nhưng không saturate quá mạnh.
- **4.4. Error / rejected**:
  - Destructive chỉ dùng khi thực sự error/rejected/destructive.
  - Không dùng red cho “missing data” nếu missing chỉ là task cần bổ sung (dùng warning).
- **4.5. DEMO**:
  - Demo badge dùng tone amber/sand thay vì green để tránh nhầm với real/verified data.

---

## 5. BODY BACKGROUND — CÔNG THỨC NỀN
Body không phải flat color, cấu tạo gồm 3 lớp layer xếp chồng:
1. **Radial green light** phía trái trên:
   `radial-gradient(44rem 44rem at calc(18% + var(--scroll-progress, 0) * 6%) calc(-6% + var(--scroll-progress, 0) * 8%), rgba(58, 120, 89, 0.22), transparent 62%)`
2. **Radial sage light** phía phải trên:
   `radial-gradient(38rem 38rem at calc(86% - var(--scroll-progress, 0) * 8%) calc(8% + var(--scroll-progress, 0) * 10%), rgba(142, 180, 110, 0.18), transparent 62%)`
3. **Linear gradient dọc**:
   `linear-gradient(180deg, #F6F8F2 0%, #EDF2E8 50%, #F6F8F2 100%)`
- **Hiệu ứng**: Khi scroll, vị trí radial background dịch rất nhẹ. User không “nhìn thấy animation” rõ; chỉ cảm thấy background có chiều sâu quang học. Thuộc tính `background-attachment: fixed`.

---

## 6. POINTER-REACTIVE AMBIENT GLOW
Lớp `body::before` tạo ambient glow rất nhẹ theo con trỏ chuột:
- **Biến CSS**: `--pointer-x` (mặc định `50vw`), `--pointer-y` (mặc định `30vh`).
- **Layer**: Radial `22rem × 22rem`, opacity `~0.10`, transparent `72%`, kèm linear highlight chéo rất nhẹ.
- **Dev implementation**:
  1. Con trỏ chuột di chuyển $\to$ cập nhật CSS variables `--pointer-x` / `--pointer-y`.
  2. Không `setState` React mỗi pixel; cập nhật trực tiếp `document.documentElement.style` bằng RequestAnimationFrame (RAF).
  3. Glow chỉ là ambient, không đặt cursor spotlight trắng chói.
  4. Mobile/touch bỏ pointer effect hoặc giữ vị trí mặc định.

---

## 7. SCROLL PROGRESS BAR
Lớp progress bar cố định ở mép trên cùng màn hình:
- **Vị trí**: `position: fixed; top: 0; left: 0; width: 100%; height: 3px; z-index: 100;`
- **Transform**: `transform-origin: left center; transform: scaleX(var(--scroll-progress, 0));`
- **Màu sắc**: Gradient `lime/sage (#8EB46E) → emerald (#145233) → deep forest (#17260D)`.
- **Hiệu ứng**: Box shadow glow xanh nhẹ, `pointer-events: none`.

---

## 8. GLOBAL MOTION TOKENS

### Timing:
- `--motion-fast`: `140ms` (opacity, simple color state, icon feedback)
- `--motion-base`: `300ms` (hover surface, background, border, collapse nhỏ)
- `--motion-slow`: `680ms` (larger entrance / transformation)

### Easing:
- `--ease-smooth`: `cubic-bezier(0.22, 1, 0.36, 1)` (scroll / reveal opacity / position)
- `--ease-spring`: `cubic-bezier(0.16, 1, 0.3, 1)` (scale / translate có cảm giác mềm)

---

## 9. MOTION REVEAL — ANIMATION KHI SECTION VÀO VIEWPORT
- **Trước khi reveal**: `opacity: 0; transform: translateY(28px) scale(0.985); filter: blur(8px);`
- **Khi visible**: `opacity: 1; transform: translateY(0) scale(1); filter: blur(0);`
- **Thời lượng**: `760ms` với `ease-smooth` và `ease-spring`.
- **Trigger**: `IntersectionObserver`. Chỉ reveal một lần cho phần lớn content; không restart liên tục khi cuộn lên/xuống gây mất tập trung.
- **Stagger**: `100ms / 200ms / 300ms / 400ms / 500ms` giữa các card chính.

---

## 10. BỘ UTILITY ANIMATION
- **10. Fade-Up Utility (`fadeUp`)**: `0.72s ease-smooth`, từ `translateY(20px), blur(5px), opacity 0` $\to$ `0`. Dùng cho hero copy, top-level card xuất hiện lần đầu, dialog có chủ đích.
- **11. Fade-In Utility (`fadeIn`)**: `0.52s`, từ opacity `0 → 1`. Dùng cho overlay, chart layer, modal backdrop.
- **12. Scale-In Utility (`scaleIn`)**: `0.5s spring`, từ `scale(0.965), opacity 0` $\to$ `scale(1), opacity 1`. Dùng cho modal focus, popover, success check.
- **13. Float Utility (`float`)**: `7s ease-in-out infinite`, `translateY(0) → -10px → 0`. Chỉ dùng cho decorative illustration, không dùng cho KPI card / table.
- **14. Pulse-Soft Utility (`pulseSoft`)**: `3s ease-in-out infinite`, opacity `1 → 0.72 → 1`. Dùng cho subtle live indicator, active data connection.

---

## 15. INTERACTIVE SURFACE — HOVER CỦA CARD
- **Base transition**:
  - `transform`: `motion-base + ease-spring`
  - `box-shadow`: `motion-base + ease-smooth`
  - `border-color`, `background`: `motion-base`
- **Desktop Hover**:
  - `translateY(-5px) scale(1.008)`
  - Border đổi sang primary green ở opacity `~0.24`
  - Shadow sâu hơn nhưng mềm mại
  - Inner white highlight giữ bề mặt sáng trong trẻo
- **Active / Tap**:
  - `translateY(-1px) scale(0.985)`
- *Lưu ý*: Chỉ card thực sự clickable mới nâng hover rõ. Không áp dụng scale cho table row.

---

## 16. GLASS CARD / PANEL / SHELL
- **Glass Card**:
  - `Background`: `linear-gradient(145deg, rgba(255, 255, 255, 0.78) → rgba(246, 248, 242, 0.46))`
  - `Backdrop`: `blur(24px) saturate(170%)`
  - `Border`: `1px solid rgba(255, 255, 255, 0.82)`
  - `Shadow`: Soft dark-green outer + white inset highlight + green inset bottom line nhẹ.
- **Glass Shell**:
  - `Background`: `rgba(246, 248, 242, 0.64)`
  - `Backdrop`: `blur(30px) saturate(185%)`
  - `Border`: `1px solid rgba(255, 255, 255, 0.70)`
  - Ứng dụng: Sticky header, hero panel, selected high-level container, overlay shell.

---

## 17. STICKY GLASS HEADER
- **Mặc định**: Warm white/cream `0.64` opacity, `blur(30px)`, `saturate(190%)`, border đáy nhẹ.
- **Khi `body[data-scrolled="true"]`**: Background opaque hơn `~0.82`, shadow rõ nét hơn.
- *Cơ chế*: `ScrollExperience` toggle thuộc tính `data-scrolled` trên `body`, CSS tự chuyển đổi transition mà không cần JS can thiệp style từng phần tử.

---

## 18–24. PAGE & VIEWPORT MOTION
- **18. Page Stage (`page-stage`)**: `position: relative; border-radius: 24px; top gradient white opacity nhẹ → transparent; scroll-snap-align: start;`
- **19. Soft Scroll Snap (`scroll-snap-soft`)**: `scroll-snap-type: y proximity; scroll-margin-top: 88px;` (dùng proximity, không ép buộc mandatory).
- **20. Custom Scrollbar**:
  - Firefox: `scrollbar-width: thin; scrollbar-color: rgba(20, 82, 51, 0.4) transparent;`
  - WebKit: `width: 10px; track: transparent; thumb: 3px transparent border, radius 999px, bg gradient forest light → primary.`
- **21. Text Selection**: `::selection` background `rgba(20, 82, 51, 0.18)`.
- **22. Top-level Gradients**:
  - `text-gradient-forest`: 135deg forest-dark $\to$ forest-light.
  - `bg-gradient-forest`: 135deg forest-dark $\to$ forest-light.
  - `bg-gradient-hero`: Radial green light 20%/15% + linear cream $\to$ secondary.
- **23. Delay System**: `delay-100`, `delay-200`, `delay-300`, `delay-400`, `delay-500`.
- **24. Prefers Reduced Motion**: Khi OS/Browser bật: tắt `body::before` và `body::after`, `scroll-behavior: auto`, animation & transition `~0.01ms`, motion-reveal ép hiển thị ngay lập tức.

---

## 25. SIDEBAR VISUAL STATES
- **Kích thước**: Expanded `~256px`, Collapsed `~68px`, Transition `200ms`.
- **Container**: `border-right` dùng border token, background dùng warm white/cream. Logo icon: vuông bo tròn, deep forest background + accent icon. Group label: uppercase 12px, font semibold, tracking wide.
- **Active Item**: `secondary background`, `font-medium`, `primary icon`.
- **Hover Item**: `muted background`, `foreground text`.
- *Tuyệt đối không dùng*: Full dark sidebar, dải neon active, màu xanh phủ toàn bộ text và nền.

---

## 26–28. COMPONENTS & CAMERA SCANNER
- **26. Button**:
  - Primary: bg primary (`#145233`), text primary-foreground (`#F6F8F2`), active scale `0.98`, focus ring primary.
  - Secondary/outline: border token, bg card/transparent, hover muted/secondary.
  - Danger: destructive token (`#C74D4D`).
- **27. Modal / Dialog**: Entrance backdrop fade-in, dialog scale-in nhẹ (không bounce). Surface card/warm-white hoặc glass strong.
- **28. Camera Scanner**: Full-screen black background, center scan frame `256×256px`, 4 góc marker border 4px white, nút chụp `64×64px` tròn trắng, preview state sau khi capture với Retake / Use Photo.

---

## 29–33. CHARTS, STATUS & SPACING
- **29. Chart Color Rules**: Tránh 7 chuỗi cùng shade xanh. Bảng màu chuẩn gồm:
  1. `Primary deep emerald` (`#145233`)
  2. `Forest light` (`#3A7859`)
  3. `Accent sage/lime` (`#8EB46E`)
  4. `Earth warm` (`#2F4D1F`)
  5. `Muted green` (`#DEE9D8`)
  6. `Warning amber` (`#DA9B2F`)
  7. `Destructive red` (`#C74D4D`)
- **30. Status Pill / Badge**: Radius `rounded-full`, padding và font đồng bộ: Neutral (muted), Processing (soft info), Needs review (warning tint), Confirmed (forest/emerald tint), Error (destructive tint), Independent verified (badge riêng nổi bật), Demo (amber/sand).
- **31. Shadow Tokens**:
  - `shadow-sm`: `0 2px 8px -5px rgba(23, 38, 13, 0.18)`
  - `shadow-md`: `0 16px 40px -24px rgba(23, 38, 13, 0.36), 0 1px 0 rgba(255, 255, 255, 0.82) inset`
  - `shadow-lg`: `0 26px 70px -30px rgba(23, 38, 13, 0.42), 0 1px 0 rgba(255, 255, 255, 0.92) inset`
  - `shadow-glow`: `0 20px 70px -22px rgba(20, 82, 51, 0.42)`
- **32. Border Radius**: Global token `0.85rem`, Page stage `24px`, Pill/badge `rounded-full`, Camera `circle`.
- **33. Spacing & Density**: Section gap `24px`, Card group gap `12–24px`, Card padding `16–24px`, Sidebar py `8px`. Enterprise density vừa phải, không thừa khoảng trắng vô nghĩa.

---

## 34–38. TRẢI NGHIỆM TƯƠNG TÁC & NGÂN SÁCH CHUYỂN ĐỘNG
- **34. Page Transition**: Content section reveal/fade nhẹ, không slide ngang toàn màn hình, sidebar giữ stable không rerender.
- **35. Loading Motion**: Spinner `Loader2` quay cho tác vụ ngắn, skeleton cho nạp trang. OCR state hiển thị text cụ thể: *“AI đang đọc chứng từ…”*.
- **36. Empty State**: Tĩnh hoặc fade-in nhẹ, CTA rõ ràng.
- **37. Hover / Focus Matrix**: Bảng ma trận phản hồi rõ ràng cho Card, Button, Sidebar Item, Table Row (không scale), Input (không glow neon).
- **38. Animation Budget**: Tối đa trong 1 viewport: **1 ambient background** + **1 global scroll progress** + **1 reveal sequence** + **hover/tap micro-interactions**.

---

## 40. CSS TOKEN BASELINE CODE
```css
:root {
  --background: 80 30% 96%;
  --foreground: 103 37% 8%;
  --card: 75 33% 98%;
  --card-foreground: 103 37% 8%;
  --primary: 150 61% 20%;
  --primary-foreground: 80 30% 96%;
  --secondary: 90 28% 93%;
  --secondary-foreground: 97 40% 19%;
  --muted: 100 28% 88%;
  --muted-foreground: 101 15% 34%;
  --accent: 93 32% 57%;
  --accent-foreground: 96 49% 10%;
  --destructive: 0 52% 54%;
  --border: 100 22% 84%;
  --input: 100 22% 84%;
  --ring: 150 61% 20%;
  --radius: 0.85rem;
  --navy: 96 49% 10%;
  --forest-dark: 97 40% 19%;
  --forest-light: 150 35% 35%;
  --warning: 38 70% 52%;
  --motion-fast: 140ms;
  --motion-base: 300ms;
  --motion-slow: 680ms;
  --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 41. TIÊU CHÍ CHẤP THUẬN (ACCEPTANCE CRITERIA)
- [x] `.com` và `Lovable` nhìn cùng một brand dù mở ở hai domain khác nhau.
- [x] Background là hệ màu cream / forest; không còn palette cũ riêng rẽ.
- [x] Sidebar active/hover/collapse nhất quán theo logic chuẩn.
- [x] Font Inter / Manrope đồng bộ.
- [x] Card border / radius / shadow cùng family.
- [x] Scroll progress hoạt động mượt, không giật lag.
- [x] Pointer ambient không gây giật / re-render nặng.
- [x] Section reveal không replay liên tục khi cuộn.
- [x] `prefers-reduced-motion` được tôn trọng đầy đủ khi OS kích hoạt.
- [x] Không có neon AI glow, bouncing quá mức hoặc rainbow chart palette.
- [x] Motion chỉ hỗ trợ hierarchy, feedback và nâng cao chất lượng sản phẩm công nghiệp.

---

## 42. NORTH-STAR CHO DEV KHI THÊM UI MỚI
Trước khi thêm một màu hoặc animation mới, trả lời 3 câu hỏi:
1. **Semantic token hiện tại có đủ để diễn đạt trạng thái này chưa?** (Nếu CÓ: không tạo màu mới).
2. **Animation có giúp user hiểu hierarchy / feedback / state hay chỉ để trang “trông động”?** (Nếu CHỈ ĐỂ ĐẸP: bỏ animation).
3. **Component mới có nhìn như cùng một sản phẩm với Overview / Evidence / Reports không?** (Nếu KHÔNG: sửa component về đúng design system trước khi merge).
