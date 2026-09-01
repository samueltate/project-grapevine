# Project Grapevine

Project Grapevine is a disaster-response coordination workspace that lets an
AI agent gather current evidence from people and sensors, turn a crisis resource
directory into an actionable plan, and stop at explicit human approval before
anything is dispatched. It contains two demonstration workspaces:

- Live Ground Truth: an agent coordinates with field responders and
  infrastructure sensors around a western North Carolina relief corridor.
- Resource Coordination: an internal relief coordinator uses a structured
  partner directory to turn an operational need into a reviewable work request.

The demo uses a Hurricane Helene response scenario inspired by the
aid-distribution and access challenges experienced across western North
Carolina. A relief operations team must decide whether vehicles can travel from
a Boone staging hub to a mountain shelter through the Watauga Relief Corridor.
A delayed regional baseline says the route is passable, while live human
observations or machine telemetry can report changing conditions. This is a
technical reference and does not provide current emergency or travel guidance.

This repository is a technical reference, not the commercial product or
operating model behind it. Source verification and machine responses are
intentionally simplified for the demonstration.

Live demo: <https://project-grapevine.preflyhq.com/>

## Why WebMCP

Disaster dashboards contain useful information, but an agent normally has to
infer meaning from page layout and click through controls designed only for
people. Grapevine exposes the same operational workflows as structured,
page-scoped tools. The agent can discover available evidence, compare a stale
baseline with current reports, shortlist appropriate response partners, and
prepare the next action without guessing how the interface works.

WebMCP also preserves the human role. Read-only tools gather and inspect
evidence. Controlled tools prepare requests or plans, then the visible interface
requires a person to authorize consequential steps. The result is collaboration,
not autonomous dispatch:

| Workspace | Agent contribution | Human responsibility |
| --- | --- | --- |
| Live Ground Truth | Finds people, sensors, and a drone; compares evidence; and stages questions or drone missions | Authorizes requests and missions, then supplies field observations |
| Resource Coordination | Matches a verified obstruction to an appropriate debris crew and prepares a work request | Reviews uncertainty and approves the request |
| Warehouse | Reads supply inventory and drafts a shortage appeal | Reviews inventory priorities and decides whether a draft is published |

This project was created during The WebMCP Challenge submission period. Its
initial public commit is dated August 31, 2026.

## Test the Live Site with WebMCP

Use the ChatGPT desktop app's built-in browser. Site tools are tied to the page
that provides them, so keep the relevant Grapevine page open while running each
scenario. Operations exposes eight tools, Partner Directory exposes six, and
Warehouse exposes three. The field inbox intentionally exposes no WebMCP tools
because it is the human response surface.

Requirements:

1. Open the built-in browser in the ChatGPT desktop app.
2. Visit <https://project-grapevine.preflyhq.com/>.
3. Approve access to the site if prompted.
4. Check the site-tools control in the address bar. The operations page should
   show eight available tools.

Site-tool availability depends on the tester's ChatGPT account and selected
model. See OpenAI's [site tools documentation](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app).

### Scenario 1: Corroborate a Human Report with a Drone

Open <https://project-grapevine.preflyhq.com/> and send:

> Use only the WebMCP tools provided by this page. Read the published baseline
> for the Watauga Relief Corridor, find available sources within 3 miles, and use
> Miles to prepare a route-status question asking whether a fallen tree blocks
> access to Mountain Shelter B. Show me the exact question and ask whether I
> want you to send it. Do not send it until I explicitly say yes.

Expected flow:

1. ChatGPT calls `get_web_baseline` and `find_available_sources`.
2. ChatGPT calls `prepare_source_request` for Miles and asks whether it should send the exact question.
3. Reply **Yes**. ChatGPT calls `send_source_request`; the dashboard also retains a manual **Send question** fallback.
4. Miles is a human source, not a sensor, so nothing answers the question
   automatically. In a separate browser tab or a second device, open
   <https://project-grapevine.preflyhq.com/drive>, use the seeded name
   `Miles Carter` and call sign `miles828`, select **Go online**, and submit a
   structured answer to the question that appears there. Only after you do
   this will ChatGPT have a response to retrieve.
5. After Miles answers, send this follow-up:

> Retrieve the structured response. Then inspect Watauga Recon 1 and prepare a
> repositioning mission to confirm the obstruction. Stop for approval.

ChatGPT should call `get_response`, `get_drone_status`, and
`prepare_drone_mission`. The mission remains pending until a person
selects the visible approval button.

### Scenario 1B: Verify Conditions with a Human Source

This optional version uses a phone or second browser window.

1. On the second device, open
   <https://project-grapevine.preflyhq.com/drive>.
2. Use the seeded name `Miles Carter` and call sign `miles828`, keep the operational area as
   `Watauga Relief Corridor`, and select **Go online**.
3. On the operations page in ChatGPT, send:

> Use this page's WebMCP tools to find Miles and prepare a
> route-status question asking whether relief vehicles can safely reach
> Mountain Shelter B. Show me the exact question and ask whether I want you to
> send it. Do not send it until I explicitly say yes.

4. When ChatGPT asks whether to send the request, reply **Yes**. You can also select **Send question** in the request drawer.
5. On the field device, choose a structured answer, add a short
   observation, and submit it.
6. In ChatGPT, send:

> Retrieve the field response and explain whether dispatch should proceed.

This demonstrates the same WebMCP contract coordinating with a live human
instead of a deterministic sensor.

### Scenario 2: Turn a Resource Directory into a Work Request

Open <https://project-grapevine.preflyhq.com/response> and send:

> Use only the WebMCP tools provided by this page. Read the crisis brief. We
> Miles and the recon drone confirm a fallen tree blocking the shelter route.
> Find an active, locally led debris-clearance partner serving the Watauga Relief
> Corridor, inspect its evidence, save a transparent shortlist, and prepare a crew work request.
> Do not claim that anyone has been contacted or that dispatch is approved.
> Tell me what remains uncertain.

Expected flow:

1. ChatGPT calls `get_crisis_brief`, `find_response_partners`, and
   `get_partner_details`.
2. ChatGPT calls `create_response_shortlist` and
   `prepare_work_request`.
3. The work request shows the selected partners, but dispatch remains locked
   until a current obstruction report is available.

To test the cross-demo handoff, continue with:

> Follow the recommended handoff to Live Ground Truth. Find the Boone field
> team and prepare a route-status question asking whether aid vehicles can
> safely reach Mountain Shelter B. Stop for approval.

Approve the question, answer `blocked` from the field inbox, and ask ChatGPT to
retrieve the response and return to the partner directory. The plan should show
the field evidence and unlock the final human-controlled **Approve plan**
button.

For the warehouse portion, open <https://project-grapevine.preflyhq.com/warehouse>
and ask ChatGPT to read the supply inventory, explain why blanket volume is not
the priority, and draft a social appeal for yellow-jacket repellent without
publishing anything. The visible Facebook button demonstrates a two-step
publish approval for the communications team.

### Troubleshooting Site Tools

- Use the ChatGPT desktop app's built-in browser, not Chrome or a normal browser.
- Keep the relevant page open; tools do not carry from `/response` to `/` or
  `/drive`.
- In ChatGPT Browser settings, open **Permissions** and confirm site tools are
  enabled and `project-grapevine.preflyhq.com` is allowed.
- Reload the page after changing permissions.
- If no site-tools control appears, the tester's account or selected model may
  not currently support site tools. The visual demo will still work, but the
  WebMCP scenarios require site-tool access.

## Aid Logistics Flow

1. An AI agent reads the published operational baseline.
2. The agent discovers available human and machine sources.
3. The agent prepares a structured verification request.
4. A user reviews and authorizes the request.
5. The selected source returns a structured response with optional context.
6. The agent can corroborate the report with drone telemetry before a human approves the next action.

## Route-Specific WebMCP Tools

The Aid Logistics board at `/` registers eight tools:

- `list_available_actions`
- `find_available_sources`
- `get_web_baseline`
- `prepare_source_request`
- `send_source_request`
- `get_response`
- `get_drone_status`
- `prepare_drone_mission`

The same tools work for both source channels. Human requests are delivered to
the human-only field view at `/drive`. Three seeded machine sources, a creek-depth
gauge, roadside conditions camera, and recon drone return deterministic
telemetry after authorization. A field responder cannot register a
phone as an infrastructure sensor.

The Resource Coordination workspace at `/response` registers six separate tools:

- `list_available_actions`
- `get_crisis_brief`
- `find_response_partners`
- `get_partner_details`
- `create_response_shortlist`
- `prepare_work_request`

The first three workflow tools read structured directory evidence. The final
two save a transparent shortlist and stage a work request. No external
partner is contacted. If route evidence is uncertain, the result directs the
coordinator to Demo 1 for live field verification before dispatch.

The Warehouse workspace at `/warehouse` registers three tools:

- `list_available_actions`
- `get_supply_inventory`
- `draft_supply_appeal`

All three tool sets are registered directly with
`document.modelContext.registerTool`. Zod schemas provide bounded JSON inputs,
tool annotations distinguish read-only operations from controlled actions, and
each execution returns structured data rather than scraped presentation text.
React owns the visible approval states while the Cloudflare Worker and D1 retain
the shared workflow state across the agent, operations dashboard, and field
inbox.

## Current Build

- React operations board at `/`
- Mobile field-responder inbox at `/drive`
- Response-partner directory at `/response`
- Cloudflare Worker API
- Cloudflare D1 persistence
- Approval-gated requests
- Structured logistics responses
- Drone telemetry and approval-gated missions
- Warehouse workspace with inventory signals and draft-only public appeals

The core reference does not require R2 or Durable Objects. D1 persists the
request loop, and the clients use short polling for updates.

## Local Setup

```bash
pnpm install
pnpm exec wrangler d1 migrations apply grapevine --local
pnpm run start
```

Open:

- Operations board: <http://localhost:5173/>
- Field inbox: <http://localhost:5173/drive>
- Resource coordination: <http://localhost:5173/response>

Deployed routes:

- Live ground truth: <https://project-grapevine.preflyhq.com/>
- Field inbox: <https://project-grapevine.preflyhq.com/drive>
- Resource coordination: <https://project-grapevine.preflyhq.com/response>

Local D1 remains local unless `--remote` is explicitly passed to Wrangler.

## Cloudflare Setup

The checked-in `wrangler.jsonc` points to the hosted reference demo. For a fork,
replace the D1 database ID and either replace the custom-domain route or remove
it and enable `workers_dev`.

Configure a D1 binding named `DB` in `wrangler.jsonc`:

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "grapevine",
    "database_id": "YOUR_D1_DATABASE_ID"
  }
]
```

For a fork without a custom domain, remove the existing `routes` block and set:

```json
"workers_dev": true
```

For a custom domain, replace the route pattern with a hostname in a Cloudflare
zone you control.

Apply migrations before deploying:

```bash
pnpm exec wrangler d1 migrations apply grapevine --remote
pnpm run deploy
```

Authenticate through Wrangler or environment variables. Do not commit secrets.

## Verification

```bash
pnpm run audit:public
pnpm run test
pnpm exec tsc --noEmit
pnpm run build
```

## Public Repository Safety

The repository contains no application secrets. Local environment files,
Wrangler state, build output, logs, and dependency folders are ignored. The D1
database UUID in `wrangler.jsonc` identifies the bound database but does not
grant access; Cloudflare credentials are still required for queries or deploys.

Run `pnpm run audit:public` before publishing. It fails on common credential
formats, non-empty secret assignments, private keys, and personal filesystem
paths. Keep real tokens in `.dev.vars`, `.env`, or your deployment environment;
those files must remain uncommitted.

## License

MIT

The static corridor map includes in-image attribution to OpenStreetMap
contributors and OpenMapTiles.
