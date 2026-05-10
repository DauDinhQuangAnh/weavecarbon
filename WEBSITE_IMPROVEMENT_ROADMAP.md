# Website Improvement Roadmap

Tai lieu nay tong hop nhung khu vuc nen uu tien cai tien trong frontend hien tai, dua tren codebase o thoi diem 2026-04-21. Muc tieu la giam rui ro van hanh, cai thien hieu nang, va lam cho viec phat trien tiep theo de bao tri hon.

## Uu tien 1

### 1. Khoa cac route noi bo va cong cu van hanh

Trang thai cap nhat:

- Da lam: go bo `/tools/analytics-lab`, cac file `tools/analytics-lab/*`, `AnalyticsProvider`, `lib/analytics`, cau hinh GA4, va cac event tracking GA4 trong UI.
- Da lam: `app/AI_CONFIG/page.tsx` da duoc gate server-side bang `AI_CONFIG_CONSOLE_ENABLED=1`; mac dinh la tat va tra 404.
- Da lam: da xoa unlock code hard-coded trong `components/ai-config/AIConfigConsole.tsx`, khong con secret trong client bundle.
- Con lai: neu can mo console tren production, nen bo sung role/audit check tu backend thay vi chi dung env gate.

Day la diem can uu tien cao nhat vi lien quan truc tiep toi bao mat va van hanh.

- Truoc day `app/AI_CONFIG/page.tsx` chi moi dat `robots: noindex`, nhung hien da co env gate server-side.
- Truoc day `components/ai-config/AIConfigConsole.tsx` de unlock code ngay trong client; hien da xoa unlock code nay.
- Cong cu thu analytics va GA4 da duoc go bo; neu them lai cong cu noi bo trong tuong lai, can gate o server.

De xuat:

- Chuyen `AI_CONFIG` sang server-side gate dua tren role `admin` hoac env flag chi mo trong staging/dev. Env gate da co; role/audit co the bo sung sau neu can mo console tren production.
- Khong de unlock code trong client bundle. Da lam.
- Neu van can tool noi bo tren production, bo sung audit trail va role check o server.

Tac dong mong doi:

- Giam nguy co lo cong cu noi bo.
- Tranh viec nguoi dung ben ngoai truy cap cac man debug hoac config noi bo.

### 2. Gom logic auth, onboarding, va company-check ve mot noi

Trang thai cap nhat:

- Da lam mot phan: da co module chung `lib/auth/routing.ts` voi `normalizeCompanyCheck`, `resolveAuthenticatedUserType`, `resolvePostLoginPath`, `buildCheckEmailUrl`, `buildAuthErrorUrl`.
- Da lam mot phan: `AuthForm`, `app/auth/callback/page.tsx`, `AuthContext`, va `DashboardLayoutContent` da dung helper chung.
- Con lai: can bo sung test de khoa hanh vi redirect va ra soat cac flow auth/onboarding phu.

Hien tai logic xac dinh B2B/B2C, company status, va redirect sau login dang bi lap lai o nhieu noi:

- `components/ui/AuthForm.tsx:60-68`
- `components/dashboard/DashboardLayoutContent.tsx:30-38`
- `app/auth/callback/page.tsx:40-49`
- `contexts/AuthContext.tsx:309-317`

Van de cua cach lam nay:

- De sinh lech logic khi sua mot noi ma quen sua cac noi con lai.
- Kho debug cac bug dang redirect sai, onboarding loop, hoac phan quyen sai.
- Tang chi phi maintain cho nhung flow nhay cam nhat cua san pham.

De xuat:

- Tao mot module chung, vi du `lib/auth-routing.ts`, de chua:
  - `normalizeCompanyCheck`
  - `resolveAuthenticatedUserType`
  - `resolvePostLoginPath`
  - cac helper build URL cho `check-email`, auth error, onboarding
- De `AuthContext` hoac mot server action lam noi quyet dinh chinh, cac component chi consume ket qua.

Tac dong mong doi:

- Giam bug login/onboarding.
- Don gian hoa viec them flow moi nhu admin, demo, hoac enterprise onboarding.

### 3. Tach nho cac component va module dang qua lon

Trang thai cap nhat:

- Chua lam trong dot vua roi. Cac file lon van can tach rieng sau khi dong bao mat/analytics da on.

Codebase hien co nhieu file lon, nhieu file trong so do la client-side va gan voi man hinh nang:

- `lib/productsApi.ts` - 2182 lines
- `components/dashboard/reports/ReportClient.tsx` - 1920 lines
- `components/dashboard/SummaryClient.tsx` - 1778 lines
- `components/dashboard/assessment/steps/routeSuggestionEngine.ts` - 1774 lines
- `components/dashboard/assessment/steps/Step4Content.tsx` - 1724 lines
- `components/b2c/B2CDonationClient.tsx` - 1674 lines
- `components/dashboard/export/ExportClient.tsx` - 1459 lines
- `components/landing/LeafHero3D.tsx` - 1436 lines

Rui ro:

- Kho review, kho test, kho toi uu.
- Thay doi nho de gay side effect lon.
- Bundle client de bi phinh, nhat la voi reports, dashboard, 3D landing, export.

De xuat:

- Tach theo domain nho hon: hooks, selectors, view-model, validators, API mapping, presentational sections.
- Uu tien tach `ReportClient.tsx`, `ExportClient.tsx`, `SummaryClient.tsx`, `Step4Content.tsx`.
- Day cac phan co the SSR/server compute ra khoi client component.

Tac dong mong doi:

- Giam do phuc tap cho team.
- De them test, de toi uu render, de theo doi regression.

## Uu tien 2

### 4. Tang do phu test cho frontend

Trang thai cap nhat:

- Da lam mot phan: them script `test`: `vitest run`.
- Da lam mot phan: bo sung `lib/dashboard/accessGuards.ts` va test cho guard subscription cua `/reports` va `/export`.
- Da lam mot phan: tong test hien co tang tu 15 len 21 test.
- Con lai: can tiep tuc bo sung React Testing Library/integration test cho login UI, onboarding company-created, reports/export compliance upload/update/delete.

Hien tai trong `package.json` da co script test co the chay toan bo Vitest:

- `test`: `vitest run`
- `test:carbon`: `vitest run` (giu lai de tuong thich)

Test thuc te hien co:

- `lib/dashboard/accessGuards.test.ts`
- `lib/auth/routing.test.ts`
- `lib/carbon/engine.test.ts`

Dieu nay co nghia la subscription gating va auth helper da co mot lop test dau tien, nhung cac khu vuc quan trong nhu onboarding UI, reports/export workflow, analytics, va settings van con can them test tu dong.

De xuat:

- Bo sung unit test cho helper auth/company-check va subscription guard.
- Bo sung integration test cho:
  - login -> redirect
  - onboarding -> company created
  - reports -> export
  - export compliance -> upload/update/delete
- Neu chua lam E2E ngay, bat dau bang vitest + React Testing Library cho cac luong co gia tri cao.

Tac dong mong doi:

- Giam regression moi khi refactor.
- Tu tin hon khi tach nho cac file lon.

### 5. Tang type safety va chuan hoa boundary voi API

Trang thai cap nhat:

- Da lam mot phan: `lib/reportsApi.ts` khong con tat rule `no-explicit-any`; cac helper workbook/worksheet/row da dung type tu `exceljs`.
- Con lai: can tiep tuc them schema `zod` cho response quan trong cua reports/export/products/auth.

`lib/reportsApi.ts` da go bo disable `no-explicit-any` cho cac helper ExcelJS, nhung boundary voi backend van can duoc chuan hoa tiep bang schema ro rang.

Ngoai ra, nhieu module lon dang xu ly mapping va normalizing ngay trong client, dan den:

- kho tai su dung
- kho test rieng
- kho phat hien payload sai som

De xuat:

- Dua parsing/normalization API ve cac module schema ro rang hon.
- Uu tien dung `zod` cho response quan trong.
- Giam dan `any`, bat dau tu `reports`, `export`, `products`, `auth`.

Tac dong mong doi:

- Loi payload duoc phat hien som hon.
- Giam bug do backend tra shape khong dung ky vong.

### 6. Toi uu provider toan cuc va chi phi runtime

`app/layout.tsx` dang mount `AuthProvider`, `NextIntlClientProvider`, `LanguageProvider`, va toaster cho toan bo app.

Van de:

- Moi route deu gan chi phi runtime giong nhau, ke ca cac route khong can day du provider stack.
- Kho tach biet public pages, dashboard pages, internal tools, va demo pages theo nhu cau that.

De xuat:

- Can nhac tach layout theo zone: public, dashboard, internal tools, demo.
- Giu root layout gon nhat co the.
- Chi mount provider nang o nhung khu vuc can thiet.

Tac dong mong doi:

- Giam chi phi hydrate.
- De toi uu page load theo tung nhom route.

## Uu tien 3

### 7. Don dep debug log, code cu comment lai, va hygiene chung

Trang thai cap nhat:

- Da lam: xoa legacy commented block o dau `components/landing/LeafHero3D.tsx`.
- Da lam: xoa cac `console.log` runtime trong `LeafHero3D.tsx`; chi giu `console.error` cho loi load model.
- Con lai: neu muon chat hon, co the them lint rule de chan `console.log` trong production code.

`components/landing/LeafHero3D.tsx` la vi du kha ro:

- Truoc day phan dau file con giu mot khoi lon code cu dang comment.
- Truoc day van con debug log o runtime trong loading/model setup.

De xuat:

- Xoa khoi code cu dang comment neu da khong con can.
- Chuyen log debug sang logger co gate theo env.
- Dat rule ro rang: khong merge `console.log` tren luong production tru khi la error logging co chu dich.

Tac dong mong doi:

- Code sach hon, de doc hon.
- Giam nhieu noise khi debug issue that.

### 8. Xem lai flow invite user va password tam tao o frontend

Trang thai cap nhat:

- Da xac minh FE: `components/dashboard/settings/UsersSettings.tsx` khong con tao temporary password bang `Math.random()`.
- Da xac minh BE: `POST /api/company/members` dung email invite token flow qua `companyMembersService.createMember`, `authService.generateCompanyInviteToken`, va `emailService.sendCompanyInviteEmail`.
- Con lai: BE van tao `temporaryPassword` noi bo trong `authService.createInvitedCompanyUser` cho invited user moi. Password nay khong duoc FE sinh ra va khong duoc gui trong company invite email, nhung flow sau khi accept invite hien tra `next_step: 'signin'`, nen can quyet dinh tiep: cho invited user dat password qua one-time setup link, magic session, hoac reset-password flow.

Truoc day can lo viec frontend tao temporary password bang `Math.random()`. Hien tai client da chuyen sang payload invite:

- `full_name`
- `email`
- `role`
- `send_notification_email`
- `frontend_origin`

Rui ro con lai nam o backend/product flow cho invited user moi, khong con nam o FE.

De xuat:

- Khong tao password tam o client nua. Da dat.
- Chuyen sang invite link hoac one-time activation flow. Da co invite link, nhung can bo sung buoc dat password/magic session sau accept invite.
- Neu backend bat buoc can password tam, server phai la noi sinh ra va ghi nhan. BE dang sinh noi bo; nen tranh de nguoi dung bi ket o buoc sign-in khi khong co password.

Tac dong mong doi:

- Giam rui ro bao mat.
- UX moi an toan va hien dai hon cho team member onboarding.

## Cac quick wins nen lam trong 1-2 sprint

1. Da lam: Khoa `AI_CONFIG` bang server-side env gate `AI_CONFIG_CONSOLE_ENABLED`.
2. Da lam mot phan: Extract mot bo helper auth chung cho `company-check`, `post-login redirect`, `account type`.
3. Tach `ReportClient.tsx` thanh cac khoi nho hon: list/filter/export/create.
4. Bo sung test cho auth redirect, onboarding redirect, subscription guard.
5. Xoa debug log va commented legacy block o `LeafHero3D.tsx`.
6. Doi flow invite user sang token/invite link thay vi sinh password o client.

## Thu tu khuyen nghi de trien khai

### Phase 1 - Bao mat va do on dinh

- Protect internal routes
- Gom auth/company-check logic
- Bo sung test cho login/onboarding/subscription

### Phase 2 - Hieu nang va maintainability

- Tach file lon nhat trong dashboard va reports
- Toi uu layout/provider theo route group
- Chuan hoa API parsing va typing

### Phase 3 - Chat luong trai nghiem

- Don dep log/debug/legacy code
- Toi uu landing 3D va cac man client nang
- Ra soat tiep accessibility, loading state, va error state cho cac flow chinh

## Ket qua mong muon sau khi hoan thanh

- Khong con route noi bo public theo kieu "chi noindex la du".
- Auth va onboarding co mot nguon su that duy nhat cho redirect logic.
- Cac man reports/export/dashboard de maintain hon va it regression hon.
- Test coverage khong chi tap trung vao carbon engine ma mo rong sang cac flow kinh doanh quan trong.
- Frontend an toan hon, sach hon, va san sang cho cac vong mo rong tiep theo.
