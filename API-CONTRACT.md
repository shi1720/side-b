# Shared implementation contract

Types: `lib/types.ts`. All money is decimal currency units in the API; database accounting uses integer cents. Prices in one workspace currency. Frontend fetch with credentials same-origin; responses JSON `{error:string}` on errors. All writes require same Origin check. No secret in browser.

- `GET /api/workspace` -> Workspace. Creates private guest workspace seeded sample. Signed-in via Sites ChatGPT login; guest can run full demo. `POST /api/workspace` `{name?,currency?}` -> Workspace.
- `PUT /api/inventory` `{items:InventoryItem[],sample?:boolean}` -> `{inventory:InventoryItem[]}`. Replace stock, max50, no replacement with active holds. Validate all fields. Frontend parses CSV.
- `GET /api/search?q=...&kind=artist|movie|book|tv_show` -> `{entities:TasteEntity[]}`. Root implements.
- `POST /api/agent` `{anchors:TasteEntity[],constraints:Constraints}` -> AgentRun. Root implements. Uses server workspace inventory, not supplied client stock.
- `POST /api/campaigns` `{runId:string,title?:string,description?:string}` -> `{campaign:Campaign,url:string}`. Resolve run server-side. Publishes public storefront; user explicitly clicks publish. Root saves run in `agent_runs` via exported persistence function.
- `GET /api/campaigns/[id]` public -> `{campaign:Campaign,shop:{name,currency,sample},inventory:InventoryItem[]}`. No cost prices, private evidence economics or customer details in public response. May use redacted run type on public page.
- `POST /api/campaigns/[id]/reserve` `{sku,customerName,quantity:1,idempotencyKey:uuid}` -> `{reservation:{id,reference,status}}`. Public, safe stock decrements atomically. No email field. Names max60. Holds no payment. Cancel restores stock.
- `PATCH /api/reservations/[id]` `{status:'collected'|'cancelled'}` -> `{reservation:Reservation}`. Owner only, status transition idempotent; cancel restores stock exactly once. Owner inventory shows available units after holds.
- `DELETE /api/workspace` -> `{ok:true}` delete private guest/user data, campaigns unpublished/deleted.

Persistence layer agent exports `getWorkspaceContext(request): Promise<{ownerId:string,workspace:Workspace,cookie?:string}>`, `saveAgentRun(ownerId,run)`. Routes attach cookie when returned. Root imports from `lib/store.ts`.

Frontend owned by UI agent: app/page.tsx, app/globals.css, app/layout.tsx, app/c/[id]/page.tsx and UI components. DB agent owns db/schema.ts, lib/store.ts, lib/seed.ts, app/api/workspace,inventory,campaigns,reservations and migrations. Root owns lib/qloo.ts,lib/agent.ts,app/api/agent,app/api/search,tests,config,docs. Coordinate changes through root.

- `PATCH /api/campaigns/[id]` owner-only `{published:boolean}` pauses/resumes public visibility and new holds; existing holds stay manageable.
- Workspace `pickupInstructions` is published. Real stock requires nonempty shop details before publication. Holds expire after48h, reconciled lazily on the next related request. Campaign sample designation snapshots at publication.
