# AVORA Restaurant Management System

> **A multi-module restaurant management system with web-based administration, point-of-sale operations, QR ordering, kitchen workflows, workforce tools and supporting applications.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748?logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://www.mysql.com/)
[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![Android](https://img.shields.io/badge/Android-SDK_35-3DDC84?logo=android)](https://developer.android.com/)

---

## Giới thiệu tổng quan (Vietnamese Overview)

**AVORA Restaurant** là hệ thống quản lý nhà hàng đa phân hệ, phục vụ toàn diện vòng đời vận hành F&B từ khâu gọi món tại bàn, chế biến bếp, thanh toán thu ngân đến quản trị chuỗi chi nhánh và nhân sự:

- **Cổng Quản trị & Điều hành (`frontend/app/admin`)**: Quản lý thực đơn món ăn, danh mục, kho định lượng, đơn hàng, bàn ăn, báo cáo tài chính, khuyến mãi, phân quyền RBAC và cấu hình hệ thống.
- **POS Thu ngân & Waiter (`/admin/pos` & `/admin/pos/waiter`)**: Điểm bán hàng cảm ứng cho thu ngân và ứng dụng phục vụ bàn chuyên biệt trên Web PWA / Android Native.
- **Gọi món QR tại bàn (`/qr/[token]`)**: Khách hàng quét mã QR trên bàn để xem thực đơn, gọi món Alacarte & Buffet theo đợt, gọi nhân viên, yêu cầu thanh toán và xuất hóa đơn VAT theo thời gian thực.
- **Bếp & Quầy pha chế (KDS - `/admin/kds`)**: Màn hình điều phối chế biến theo từng trạm bếp, cập nhật trạng thái món tức thời qua WebSocket.
- **Chấm công & Nhân sự (`/admin/attendance`)**: Chấm công định vị QR Geofence, ca làm việc linh hoạt, bảng công tổng hợp xuất Excel tự động và thẻ chấm công cá nhân.
- **Ứng dụng di động & Desktop**: Ứng dụng Android phục vụ bàn WebView (`android-avora-phuc-vu`), ứng dụng lắng nghe giao dịch ngân hàng tự động (`android/`), và POS Desktop .NET 8 WPF (`desktop/`).

---

## Key Modules & Implementation Status

| Module | Category | Description | Status |
| :--- | :--- | :--- | :---: |
| **Point of Sale (POS)** | Operations | Full-featured cashier POS interface supporting cash, bank transfer, PayOS/Sepay, card, split payments, table merging/splitting, open price, and weight (kg) decimals. | **Implemented** |
| **Waiter PWA & Mobile Web** | Operations | Mobile-first waiter app (`/admin/pos/waiter`) with active table floor maps, order round management, and device-bound Web Push notifications. | **Implemented** |
| **QR Table Ordering** | Operations | Dynamic QR order flow (`/qr/[token]`) for guests: Alacarte food rounds, buffet submission limits, staff calling, payment requests, cooldown deduplication, and VAT invoice requests. | **Implemented** |
| **Kitchen Display System (KDS)** | Operations | Real-time kitchen screen (`/admin/kds`) with station routing, item preparation state transitions, sound/haptic alerts, and batch order dispatching. | **Implemented** |
| **Buffet Management** | Operations | Buffet ticket management with per-submission dish quantity caps, lifetime table limits, countdown timers, and buffet package tier rules. | **Implemented** |
| **Attendance & Shifts** | Workforce | Geofenced QR attendance check-in/out, multi-shift configurations, dynamic Excel reports with native formulas, and personal employee timecards. | **Implemented** |
| **Role-Based Access Control (RBAC)** | Security | Granular permission model with 5 canonical system roles (`ADMIN`, `BRANCH_MANAGER`, `BRANCH_STAFF`, `BRANCH_WAITER`, `BRANCH_KITCHEN`) and branch scoping (`ALL_BRANCHES` vs specific branches). | **Implemented** |
| **Financial & Sales Reports** | Admin | Revenue reporting by date, branch, product category, payment method, tax, cancellations, and membership point redemption analytics. | **Implemented** |
| **AVORA BankConnect App** | Integration | Android Kotlin utility (`android/`) capturing banking notification events for automated order transaction matching without SMS costs. | **Implemented** |
| **AVORA Phục Vụ Android App** | Client App | Native Android WebView client (`android-avora-phuc-vu`) with edge-to-edge window insets, status bar transparency, and native gesture navigation. | **Implemented** |
| **Native POS Desktop** | Client App | C# .NET 8 WPF application (`desktop/AvoraPosNative`) with local database storage, offline outbox order queuing, and background sync worker. | **In Progress** |
| **Multi-Branch Inventory Sync** | Inventory | Warehouse management, ingredients, procurement, recipe mapping, and multi-branch inventory transfers (`/admin/inventory`). | **In Progress** |

---

## System Architecture

```mermaid
flowchart TD
    subgraph Clients["Client Layer"]
        A["Admin Portal Web (Next.js 16)"]
        B["Waiter Web / PWA (/admin/pos/waiter)"]
        C["QR Table Ordering (/qr/token)"]
        D["Android App (AVORA Phuc Vu)"]
        E["BankConnect Android (Kotlin)"]
        F["Desktop POS (WPF / .NET 8)"]
    end

    subgraph Gateway["Ingress & Transport"]
        G["Reverse Proxy (Nginx / HTTPS)"]
        WS["WebSocket Gateway (Socket.io /pos)"]
        REST["REST API Endpoints (/api/*)"]
    end

    subgraph BackendServices["NestJS Backend Core"]
        AUTH["Auth & RBAC Service (JWT / Capabilities)"]
        POS_SVC["POS & Order Engine"]
        QR_SVC["QR Order & Session Engine"]
        NOTIF["Notification Engine & VAPID Web Push"]
        ATTEND["Attendance & Shift Service"]
        PAY["Payment & Webhook Service (PayOS, Sepay)"]
    end

    subgraph Persistence["Data & Storage Layer"]
        DB[("MySQL Database (Prisma ORM)")]
        LOCAL_DB[("Client Local Storage / IndexedDB / Dexie")]
    end

    A --> G
    B --> G
    C --> G
    D --> G
    E --> G
    F --> G

    G --> REST
    G --> WS

    REST --> AUTH
    REST --> POS_SVC
    REST --> QR_SVC
    REST --> NOTIF
    REST --> ATTEND
    REST --> PAY

    WS <--> POS_SVC
    WS <--> QR_SVC
    WS <--> NOTIF

    AUTH --> DB
    POS_SVC --> DB
    QR_SVC --> DB
    NOTIF --> DB
    ATTEND --> DB
    PAY --> DB

    B -. "Offline Cache" .-> LOCAL_DB
    F -. "Outbox Queue" .-> LOCAL_DB
```

---

## Technology Stack

### Frontend Web Application (`frontend/`)
- **Framework:** Next.js 16.3.1 (React 19, Turbopack)
- **Language:** TypeScript 5.0+
- **Styling:** TailwindCSS 4, Lucide React icons
- **State & Data Fetching:** SWR, Zustand, React Context
- **Realtime & Offline:** Socket.io-client, Dexie.js (IndexedDB), Service Worker Web Push
- **Audio & Haptics:** Custom Sound / Vibration synthesizer for kitchen and waiter alerts

### Backend API (`backend/`)
- **Framework:** NestJS 10 (Node.js runtime)
- **Language:** TypeScript 5.0+
- **ORM & Database:** Prisma ORM 5.14 with MySQL 8
- **Authentication:** JWT (JSON Web Tokens), Passport, bcrypt password hashing
- **Realtime:** Socket.io Gateway with room-based branch isolation
- **Push Notifications:** Self-hosted Web Push protocol with VAPID authentication (RFC 8292)
- **Excel Engine:** ExcelJS with dynamic formulas for payroll and attendance sheets

### Android Applications
- **AVORA Phục Vụ (`android-avora-phuc-vu/`):** Kotlin, Android SDK 35, AndroidX, ViewBinding, WindowInsetsCompat Edge-to-Edge WebView container.
- **AVORA BankConnect (`android/`):** Kotlin, Android SDK 35, Jetpack Compose, NotificationListenerService, Room database, Coroutines, OTA update manager.

### Desktop Applications (`desktop/`)
- **AvoraPos (`desktop/AvoraPos/`):** .NET 8 WPF with Microsoft WebView2 embedding.
- **AvoraPosNative (`desktop/AvoraPosNative/`):** Native .NET 8 WPF client, CommunityToolkit.Mvvm, SQLite/LiteDB offline storage, and background sync worker.

---

## Repository Structure

```text
avora-restaurant/
├── .agents/                    # Agent development guidelines and coding style guides
├── android/                    # AVORA BankConnect Android native application source
├── android-avora-phuc-vu/      # AVORA Phục Vụ Android WebView native application source
├── backend/                    # NestJS API backend source code
│   ├── prisma/                 # Prisma schema definitions and database seed scripts
│   ├── src/                    # Feature modules (auth, pos, qr-order, attendance, etc.)
│   └── test/                   # Integration and end-to-end tests
├── desktop/                    # Desktop POS client applications
│   ├── AvoraPos/               # WebView2 wrapper client (.NET 8 WPF)
│   ├── AvoraPosNative/         # Native WPF desktop client (.NET 8)
│   └── AvoraPosNative.Tests/   # Native POS unit tests
├── frontend/                   # Next.js 16 web application source code
│   ├── app/                    # App Router pages (admin, pos, qr, booking, customer)
│   ├── components/             # Reusable UI components by feature domain
│   ├── contexts/               # React providers (Admin, Notifications, Language)
│   ├── hooks/                  # Custom React hooks (realtime, audio, push, navigation)
│   ├── lib/                    # Core utilities, API client, offline sync, auth
│   ├── public/                 # Static assets, manifests, and Service Workers
│   └── store/                  # Client state stores (Zustand)
├── installer/                  # Inno Setup Windows installer script definitions
├── AGENTS.md                   # Repository guidelines and architectural conventions
├── RBAC_PERMISSION_MATRIX.md   # Comprehensive 177-permission RBAC matrix
├── RBAC_COVERAGE.md            # Route permission coverage report across admin modules
├── SUSHIWA_ATTENDANCE_*.md     # Attendance specifications, business rules, and API maps
├── AVORA_ATTENDANCE_*.md       # Attendance parity audit and verification reports
├── POS_DESKTOP_*.md            # Desktop POS migration plan and feature matrix
└── README.md                   # Project overview and development documentation
```

---

## Local Development Setup

### Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **MySQL:** v8.0 or compatible database instance
- **.NET SDK:** 8.0 (optional, for desktop clients)
- **Android Studio / Android SDK:** API Level 35 (optional, for Android apps)

### 1. Clone Repository
```bash
git clone https://github.com/Kain6104/avora-restaurant.git
cd avora-restaurant
```

### 2. Configure Environment Files

**Backend:**
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` with your MySQL connection string, JWT secrets, and port.

**Frontend:**
```bash
cp frontend/.env.example frontend/.env.local
```
Set `NEXT_PUBLIC_API_URL="http://localhost:4001"` and `INTERNAL_API_URL="http://127.0.0.1:4001"`.

### 3. Database Setup (Backend)
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```
*(Optional) Seed foundational roles, menus, and operating slots:*
```bash
npm run seed
```

### 4. Run Development Servers

**Start Backend (Port 4001):**
```bash
cd backend
npm run start:dev
```

**Start Frontend (Port 4000):**
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:4000` for customer web or `http://localhost:4000/admin` for the administration portal.

---

## Environment Variables

Safe templates are provided in the repository with non-production placeholder values:

- `backend/.env.example` — MySQL `DATABASE_URL`, `JWT_SECRET`, `VAPID_*` keys, Google OAuth, Gemini API key, and SMTP settings.
- `frontend/.env.example` — `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, and map tile endpoints.

> [!CAUTION]
> Never commit actual `.env`, `.env.local`, `.env.production` files, production database connection strings, API secrets, or signing keys to source control.

---

## Database & Migrations

- **Database Engine:** MySQL 8.0+
- **ORM:** Prisma ORM 5.14
- **Schema Location:** `backend/prisma/schema.prisma`
- **Migrations Directory:** `backend/prisma/migrations/`
- **Client Generation:** `npx prisma generate`
- **Apply Migrations (Development):** `npx prisma migrate dev`
- **Apply Migrations (Production):** `npx prisma migrate deploy`

---

## Testing & Build

### Backend Build & Test
```bash
cd backend
npm run build      # Compiles TypeScript via nest build
npm run test       # Executes Jest unit tests
npm run test:e2e   # Executes end-to-end test suite
```

### Frontend Build & Lint
```bash
cd frontend
npm run build      # Compiles production Next.js application with Turbopack
npm run lint       # Validates ESLint rules
```

### Android Release Build
```powershell
cd android-avora-phuc-vu
.\gradlew.bat assembleRelease
```
Outputs APK to `android-avora-phuc-vu/app/build/outputs/apk/release/app-release.apk`.

### Desktop Build
```powershell
dotnet build desktop/AvoraPos/AvoraPos.csproj -c Release
dotnet build desktop/AvoraPosNative/AvoraPosNative.csproj -c Release
```

---

## Technical Documentation Directory

The repository includes detailed specifications and parity audits located at the root directory:

- [AGENTS.md](AGENTS.md) — Engineering guidelines, directory conventions, and coding style rules.
- [RBAC_PERMISSION_MATRIX.md](RBAC_PERMISSION_MATRIX.md) — Complete 177-permission RBAC matrix and role definitions.
- [RBAC_COVERAGE.md](RBAC_COVERAGE.md) — Verification of route permission enforcement across all admin modules.
- [SUSHIWA_ATTENDANCE_ARCHITECTURE.md](SUSHIWA_ATTENDANCE_ARCHITECTURE.md) — Attendance system architecture and geofencing engine.
- [SUSHIWA_ATTENDANCE_BUSINESS_RULES.md](SUSHIWA_ATTENDANCE_BUSINESS_RULES.md) — Shift rules, overtime calculations, and penalty logic.
- [SUSHIWA_ATTENDANCE_DATA_DICTIONARY.md](SUSHIWA_ATTENDANCE_DATA_DICTIONARY.md) — Database schema definitions for workforce attendance.
- [SUSHIWA_ATTENDANCE_API_MAP.md](SUSHIWA_ATTENDANCE_API_MAP.md) — HTTP API endpoints for attendance check-in/out and timesheets.
- [SUSHIWA_EXCEL_STRUCTURE_SPEC.md](SUSHIWA_EXCEL_STRUCTURE_SPEC.md) — Formula and styling specifications for Excel export sheets.
- [SUSHIWA_FEATURE_PARITY_MATRIX.md](SUSHIWA_FEATURE_PARITY_MATRIX.md) — Full feature parity matrix between Sushi Wa and AVORA attendance.
- [AVORA_ATTENDANCE_FINAL_PARITY_AUDIT.md](AVORA_ATTENDANCE_FINAL_PARITY_AUDIT.md) — Verification of 100% parity across attendance workflows.
- [POS_DESKTOP_MIGRATION_PLAN.md](POS_DESKTOP_MIGRATION_PLAN.md) — Migration strategy from WebView2 POS to Native WPF.
- [POS_NATIVE_FEATURE_MATRIX.md](POS_NATIVE_FEATURE_MATRIX.md) — Offline caching and local SQLite storage capabilities.
- [POS_NATIVE_NEW_APP_PLAN.md](POS_NATIVE_NEW_APP_PLAN.md) — Native WPF architecture plan and implementation tasks.
- [farm_art_bible.md](farm_art_bible.md) — Visual styling and art direction for gamified farm loyalty components.
- [farm_asset_checklist.md](farm_asset_checklist.md) — Asset inventory checklist for farm elements.

---

## Security & Confidentiality

- **Zero Secrets in Repository:** Never commit real `.env` files, production credentials, JWT secrets, database connection strings, VAPID private keys, Android `.jks` signing keystores, or SSL certificates.
- **Role Enforcement:** All administrative routes under `/admin/*` enforce server-validated capabilities via `AdminPageGuard` and JWT verification. Users with standard `USER` accounts receive a canonical 404 response when attempting direct access.
- **Reporting Vulnerabilities:** If you discover a security vulnerability within AVORA Restaurant, please open a private security advisory on GitHub or contact the repository maintainer directly.

---

## Project Status & License

- **Project Status:** This repository is actively developed. Features and documentation may change between commits. Refer to the source code, tests, and project documentation for the current implementation status.
- **License:** Not specified. Unauthorized copying, reproduction, or redistribution of this source code without explicit permission is prohibited.

---

## Contact

- **Repository Owner:** [Kain6104](https://github.com/Kain6104)
- **Repository URL:** [https://github.com/Kain6104/avora-restaurant](https://github.com/Kain6104/avora-restaurant)
