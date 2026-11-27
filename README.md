# DepositGuard

Move-in condition reports for rentals, written by **your own Claude** and kept, edited and signed in DepositGuard.

- Claude looks at move-in photos and calls DepositGuard's MCP tools to create a room-by-room report.
- The landlord reviews and edits it in the web app.
- (Stage 2) Landlord and tenant both sign from a link. (Stage 3) Move-out comparison side by side.

**No AI runs inside this app.** There are no AI SDKs or AI API keys in this codebase. All reasoning happens in the customer's Claude, over MCP.

## Stack

Next.js (App Router) · Postgres (`postgres` driver, schema auto-created on first request) · MCP TypeScript SDK over Streamable HTTP (stateless, JSON responses).

## MCP

Endpoint: `https://<your-domain>/mcp/<connector-key>`. Each account's link is shown on its dashboard.

Tools: `create_condition_report`, `list_reports`, `get_report`, `add_room`, `update_item`.

Connect in Claude: Settings → Connectors → Add custom connector → paste the link.

## Run locally

```bash
cp .env.example .env.local   # fill DATABASE_URL and SESSION_SECRET
npm install
npm run dev
```

## Deploy (Vercel)

1. Import the GitHub repo in Vercel.
2. Storage → add a Neon Postgres database (sets `DATABASE_URL`).
3. Add `SESSION_SECRET` (any long random string) in Project → Settings → Environment Variables.
4. Deploy. The demo account is created on first request.
