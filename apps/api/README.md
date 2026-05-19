```txt
bun install
bun run dev
```

```txt
bun run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
bun run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## http api

### base

#### github

##### languages

```http
http://localhost:5173/api/base/github/languages?username=Nahida-aa
```
```http
http://localhost:5173/api/base/github/languages?username=Nahida-aa&mode=detailed
```

- `username` — GitHub 用户名（必填）
- `mode` — `aggregated`（汇总，默认）或 `detailed`(按仓库列出)