# Repository Guidelines

## Project Structure & Module Organization

- `frontend/` contains the Next.js 16/React 19 web app. Routes live in `app/`, reusable UI in `components/`, state in `context/`, `contexts/`, and `store/`, and assets in `public/`.
- `backend/` contains the NestJS API. Feature modules are under `src/`, Prisma files under `prisma/`, end-to-end tests under `test/`, and runtime uploads under `uploads/`.
- `desktop/AvoraPos/` and `desktop/AvoraPosNative/` are .NET 8 WPF apps. Keep XAML views paired with `.xaml.cs`; native POS logic is split into `ViewModels/`, `Services/`, `Models/`, and `Storage/`.
- `installer/` stores Inno Setup scripts. Root Markdown files document RBAC, POS migration, and assets.

## Build, Test, and Development Commands

Run commands from the relevant application directory:

- `cd frontend && npm ci && npm run dev` starts the web app on port `4000`; `npm run build` and `npm run lint` validate it.
- `cd backend && npm ci && npm run start:dev` starts the watched API, normally on port `4001`; `npm run build` compiles it.
- From `backend/`, use `npm test`, `npm run test:e2e`, or `npm run test:cov` for Jest testing.
- `dotnet build desktop/AvoraPos/AvoraPos.csproj` builds the WebView POS; substitute `AvoraPosNative` for the native client.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation and follow ESLint/Prettier output. Run `npm run format` in `backend/` before broad API changes. Use `PascalCase` for React components and C# types, `useSomething` for hooks, and `camelCase` for utilities. Follow NestJS suffixes such as `orders.service.ts`, `orders.controller.ts`, and `orders.service.spec.ts`. Preserve C# 4-space indentation and nullable annotations.

## Testing Guidelines

Backend unit tests use Jest and sit beside source files as `*.spec.ts`; end-to-end tests belong in `backend/test/`. Add focused tests for changed business rules. Frontend and desktop currently lack automated suites, so lint/build them and record manual checks in the pull request.

## Commit & Pull Request Guidelines

Recent history favors Conventional Commit subjects such as `feat:`, `fix:`, and `build:`; scoped forms like `fix(frontend): ...` are encouraged. Keep commits imperative and focused. Pull requests should summarize affected apps, link issues, list validation commands, note schema/configuration changes, and include UI screenshots.

## Security & Configuration

Never commit `.env` files, credentials, generated output (`dist/`, `.next/`, `bin/`, `obj/`), or runtime uploads unless they are intentional fixtures. Review Prisma migrations before submission.
