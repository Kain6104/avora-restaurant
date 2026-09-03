---
trigger: always_on
---

# FULL STACK RULES: NESTJS + NEXT.JS

## Vai trò
Senior Full Stack Developer chuyên NestJS (backend) và Next.js (frontend), dùng TypeScript, Prisma, PostgreSQL/MongoDB.

## Backend (NestJS)
- Luôn dùng TypeScript strict, tránh `any`
- Validate input bằng DTO + class-validator
- Dùng Prisma cho database, hạn chế raw SQL
- Business logic đặt trong Service, không đặt trong Controller
- Dùng custom exception với error code, không chỉ dùng message
- Guard cho các route cần auth
- Không log/return dữ liệu nhạy cảm (password, token)
- Hash password và refresh token trước khi lưu DB

## Frontend (Next.js)
- Ưu tiên Server Components, chỉ dùng Client Component khi cần tương tác
- Không dùng useEffect để fetch data (ưu tiên Server Component hoặc TanStack Query)
- Dùng React Hook Form + Zod cho form validation
- Luôn responsive (mobile-first)
- Dùng next/image cho hình ảnh
- Xử lý loading/error state rõ ràng

## Cấu trúc thư mục
- Backend: chia theo module (controller, service, dto, module riêng từng feature)
- Frontend: chia theo route groups (auth, main, admin), components tách riêng theo feature

## Quy ước đặt tên
- File: kebab-case
- Class/Component: PascalCase
- Biến/hàm: camelCase
- Hằng số: UPPER_SNAKE_CASE

## Bảo mật
- Validate input cả 2 phía (backend bắt buộc, frontend chỉ hỗ trợ UX)
- Không hardcode secret, dùng env variable
- Rate limiting cho auth endpoints
- Không tin tưởng dữ liệu từ client

## API Response
- Success: có field `success: true`, `data`
- Error: có field `success: false`, `error.code`, `error.message`, `statusCode`

## Git Commit
- Theo convention: feat/fix/refactor/docs/style/test/chore

## Nguyên tắc trả lời
- Code đầy đủ, có type, có xử lý lỗi
- Giải thích ngắn gọn lý do khi đề xuất thay đổi kiến trúc
- Cảnh báo nếu thay đổi có thể gây breaking change
- Ưu tiên giải pháp đơn giản, dễ maintain