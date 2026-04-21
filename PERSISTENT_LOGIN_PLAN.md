# Persistent Login Plan

Tai lieu nay mo ta ke hoach nang cap he thong dang nhap hien tai thanh trai nghiem "vao website la vao luon" giong cac san pham nhu Facebook, trong khi van giu duoc muc an toan hop ly cho web app.

Pham vi tai lieu nay bao gom ca:

- Frontend: `D:\test\Weavecarbon\FE`
- Backend: `D:\test\Weavecarbon\BE`

## Muc tieu

Nguoi dung da dang nhap thanh cong mot lan thi:

- mo lai Chrome
- nhap dung domain cua web
- neu session van hop le thi vao thang app ma khong phai dang nhap lai

Va khi session het han hoac bi revoke:

- he thong tu dong dua ve man dang nhap
- khong de token stale giu trang thai sai

## Hien trang sau khi kiem tra code

### Backend

- `POST /api/auth/signin` tra `access_token` va `refresh_token` trong JSON tai `BE/src/routes/auth.js:346`
- `POST /api/auth/refresh` nhan `refresh_token` tu body va cap token moi tai `BE/src/routes/auth.js:530`
- Google OAuth callback redirect ve FE bang URL hash co token tai `BE/src/routes/auth.js:1098`
- JWT expiry hien tai:
  - access token: `15m`
  - refresh token: `7d`
  duoc cau hinh o `BE/src/config/jwt.js:1` va `BE/.env.example:9`
- Schema da co bang `refresh_tokens` trong `BE/DATABASE_SCHEMA.sql:92`, nhung route auth hien tai chua su dung bang nay de rotate/revoke session that su
- `POST /signout` hien chua revoke session thuc su, chi tra success tai `BE/src/routes/auth.js:510`

### Frontend

- FE dang luu access token va refresh token trong `localStorage` hoac `sessionStorage` tai `FE/lib/apiClient.ts:248`
- FE da co co che refresh token khi gap `401` tai `FE/lib/apiClient.ts:510`
- FE dang bootstrap user session trong `FE/contexts/AuthContext.tsx`
- Google callback dang doc token tu URL hash va dua vao `authTokenStore`

## Van de can giai quyet

De co trai nghiem giong Facebook, kien truc hien tai van chua du tot vi:

- refresh token dang di qua JSON + storage client
- refresh token chua duoc giu trong `httpOnly cookie`
- session chua duoc quan ly theo tung thiet bi/browser
- signout chua revoke refresh session that su
- Google OAuth callback van de token lo ra o URL hash

## Kien truc muc tieu

Huong de xuat:

- Access token: ngan han, giu trong memory o FE
- Refresh token: luu trong `httpOnly`, `secure`, `sameSite=lax` cookie
- Moi lan mo lai web:
  - FE goi bootstrap session
  - BE doc refresh cookie
  - neu hop le thi cap access token moi
  - FE lay user profile va vao app
- Signout:
  - xoa cookie
  - revoke refresh session trong DB

## Nguyen tac thiet ke

1. Khong luu refresh token trong `localStorage` nua sau khi migration xong.
2. Cookie phai la `httpOnly` de JS tren client khong doc duoc.
3. Moi refresh nen rotate refresh token de giam rui ro replay.
4. Session phai co kha nang revoke theo thiet bi.
5. Can co giai doan tuong thich nguoc de khong lam vo login cua user hien tai.

## Ke hoach trien khai

## Phase 0 - Chot cach van hanh

Muc tieu:

- thong nhat co dung cookie-based session khong
- thong nhat `remember me` se map vao cookie nhu the nao

Quyet dinh khuyen nghi:

- `rememberMe = true`: refresh cookie persistent, `Max-Age = 7d`
- `rememberMe = false`: refresh cookie dang session cookie, dong browser la het
- access token van ngan han `15m`

Ket qua cua phase nay:

- team chot duoc contract session moi
- khong can tranh cai lai khi da bat tay code

## Phase 1 - Backend session foundation

Muc tieu:

- dua backend sang model refresh session that su
- cookie tro thanh nguon session chinh

Cong viec:

1. Them helper cookie auth tai backend

- Tao util moi, vi du `BE/src/utils/authCookies.js`
- Chuan hoa:
  - ten cookie
  - `httpOnly`
  - `secure`
  - `sameSite`
  - `path`
  - `maxAge`
- Dinh nghia ro:
  - cookie cho persistent session
  - cookie cho session-only mode

2. Bat dau su dung bang `refresh_tokens`

- Luu refresh token dang hash vao DB
- Gan metadata de phan biet session:
  - user_id
  - expires_at
  - revoked_at
  - user_agent
  - ip neu can
- Moi login/refresh tao hoac rotate refresh session

3. Nang cap `POST /api/auth/signin`

File chinh: `BE/src/routes/auth.js:346`

Can lam:

- sau khi tao refresh token, set refresh cookie thay vi tra token nay cho client la chinh
- co the tam thoi van tra refresh token trong response de ho tro migration, nhung danh dau la deprecated
- tiep tuc tra access token trong JSON de FE set state ngay

4. Nang cap `POST /api/auth/refresh`

File chinh: `BE/src/routes/auth.js:530`

Can lam:

- uu tien doc refresh token tu cookie
- van chap nhan body `refresh_token` trong giai doan migration
- verify refresh token
- doi chieu voi token hash trong DB
- rotate refresh token moi
- update lai cookie
- tra access token moi

5. Nang cap `POST /api/auth/signout`

File chinh: `BE/src/routes/auth.js:510`

Can lam:

- clear refresh cookie
- revoke current refresh session
- neu `all_devices = true` thi revoke tat ca refresh sessions cua user

6. Them bootstrap endpoint session

De xuat them:

- `GET /api/auth/session`

Muc dich:

- doc refresh cookie
- neu hop le thi co the:
  - refresh access token moi
  - tra ve user summary hoac access token + user state

Khuyen nghi:

- `GET /api/auth/session` chi dung de bootstrap
- `POST /api/auth/refresh` van giu cho refresh flow chu dong

7. Chuyen Google OAuth callback sang cookie mode

File chinh: `BE/src/routes/auth.js:970`

Can lam:

- sau khi Google auth thanh cong:
  - set refresh cookie tai BE
  - chi redirect ve FE voi thong tin can thiet
  - tranh gui `refresh_token` trong URL hash
- neu can giai doan chuyen tiep:
  - giu hash response cho FE cu
  - bat config flag de tat dan

Deliverable cua Phase 1:

- backend ho tro cookie-based session
- co revoke session that su
- co refresh-token rotation

## Phase 2 - Frontend bootstrap va migration

Muc tieu:

- FE khong phu thuoc vao refresh token trong storage nua
- mo lai web la tu bootstrap session

Cong viec:

1. Nang cap `apiClient`

File chinh: `FE/lib/apiClient.ts`

Can lam:

- dam bao request auth gui `credentials: "include"` de cookie di kem
- cho phep `POST /api/auth/refresh` hoat dong ca khi body khong co refresh token
- giai doan dau van support legacy localStorage refresh token

2. Doi vai tro cua `authTokenStore`

Can lam:

- ngan han:
  - van doc legacy refresh token neu co
  - nhung khong tiep tuc xem day la co che chinh
- muc tieu cuoi:
  - chi giu access token trong memory
  - khong giu refresh token trong JS-accessible storage

3. Bootstrap session khi app mount

File chinh: `FE/contexts/AuthContext.tsx`

Can lam:

- khi app khoi dong:
  - neu khong co access token nhung co cookie session
  - goi `GET /api/auth/session` hoac `POST /api/auth/refresh`
  - nhan access token moi
  - goi account/profile
  - set user va vao app

4. Cap nhat flow login email

Files chinh:

- `FE/components/ui/AuthForm.tsx`
- `FE/contexts/AuthContext.tsx`

Can lam:

- `rememberMe` khong con la chon localStorage hay sessionStorage
- `rememberMe` se tro thanh chi dan cho backend set cookie persistent hay session cookie

5. Cap nhat flow Google login

Files chinh:

- `FE/app/auth/callback/page.tsx`
- `FE/lib/auth/googleOAuth.ts`

Can lam:

- FE khong con phai lay refresh token tu URL hash
- callback page chi xu ly:
  - error state
  - next step
  - bootstrap user session tu cookie/backend

6. Signout sach se

Can lam:

- goi `POST /api/auth/signout`
- clear access token memory
- clear legacy token storage neu con
- clear local user cache neu can

Deliverable cua Phase 2:

- FE vao web va bootstrap session tu dong
- login/logout/refresh thong suot voi cookie session

## Phase 3 - Migration an toan

Muc tieu:

- khong vo session cua user cu
- rollout dan thay vi doi mot phat

Cong viec:

1. Giai doan dual-mode

- FE van doc duoc legacy refresh token trong storage
- BE van chap nhan `refresh_token` trong body
- cookie mode duoc uu tien neu co

2. Them telemetry cho auth

Can track:

- bootstrap session success rate
- refresh success/failure rate
- signout success rate
- so lan redirect ve `/auth` do refresh fail

3. Sau khi on dinh thi tat dan legacy mode

- FE dung ghi refresh token vao storage
- BE deprecate body `refresh_token`
- xoa code hash token qua Google callback

Deliverable cua Phase 3:

- session model moi tro thanh mac dinh
- legacy path co the remove an toan

## Thu tu code khuyen nghi

1. Backend cookie util + DB-backed refresh session
2. Backend signout revoke that su
3. Backend refresh endpoint ho tro cookie
4. Backend Google callback cookie mode
5. Frontend `credentials: include` + bootstrap session
6. Frontend callback/login refactor
7. Dual-mode migration va cleanup

## Acceptance criteria

Tinh nang duoc xem la hoan thanh khi:

1. User login email, dong Chrome, mo lai Chrome, vao web, duoc vao thang app neu session con han.
2. User login Google, callback xong, reload lai web, van vao duoc app ma khong can dang nhap lai.
3. `rememberMe = false` thi dong browser xong mo lai phai dang nhap lai.
4. `rememberMe = true` thi mo lai browser trong vong 7 ngay van vao duoc.
5. Signout tren may hien tai se khong vao lai duoc neu chua dang nhap lai.
6. `Sign out all devices` neu bat thi cac session khac cung refresh fail.
7. Khong con refresh token trong `localStorage` o mode moi.

## Rui ro can luu y

### 1. CORS va cookie cross-origin

Hien backend da co `credentials: true` trong CORS tai `BE/src/server.js:52`.

Can dam bao them:

- FE fetch dung `credentials: "include"`
- cookie domain/path phu hop
- `secure` va `sameSite` dung voi moi truong production

### 2. Google callback flow

Neu chuyen tu hash token sang cookie qua nhanh, FE callback cu co the hong.

Giai phap:

- rollout bang feature flag
- giu dual-mode trong 1 giai doan ngan

### 3. Session revoke va refresh rotation

Neu rotate refresh token ma FE con giu token cu, de gay logout ngoai y muon.

Giai phap:

- cookie mode phai la nguon su that
- dual-mode phai ngan va co telemetry

## Goi implementation de xuat

### Goi 1 - Co ban nhat

- giu access token trong FE
- refresh token vao httpOnly cookie
- bootstrap session tu dong
- signout revoke current session

Gia tri:

- dat duoc trai nghiem "vao la vao"
- it thay doi nhat de ship som

### Goi 2 - Ban chuan hon

- tat ca Goi 1
- rotate refresh token moi lan refresh
- luu refresh session vao DB
- support sign out all devices

Gia tri:

- gan voi session model cua cac san pham lon hon
- an toan va de quan tri hon

Khuyen nghi:

- Ship Goi 1 truoc
- sau do nang len Goi 2 trong sprint tiep theo

## De xuat sprint thuc thi

### Sprint 1

- BE: cookie util, sign-in set cookie, refresh doc cookie, signout clear cookie
- FE: `credentials: include`, bootstrap session, login flow dung cookie mode

### Sprint 2

- BE: DB-backed refresh session, revoke, rotate
- FE: bo legacy refresh storage, cleanup Google callback

## Ket luan

He thong hien tai da co san:

- JWT access token
- refresh token
- FE auto refresh logic
- remember me

Vi vay day khong phai la bai toan "lam lai auth tu dau", ma la bai toan:

- doi session model tu `storage-centric` sang `cookie-centric`
- them session revoke va bootstrap cho dung chuan hon

Neu lam theo thu tu tren, minh co the dua trai nghiem dang nhap cua WeaveCarbon len muc "mo web la vao luon" ma van giam duoc rui ro bao mat hien tai.
