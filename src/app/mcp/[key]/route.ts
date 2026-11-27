import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { userByApiKey, type User } from "@/lib/auth";
import { CONDITIONS } from "@/lib/db";
import * as reports from "@/lib/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const condition = z
  .enum(CONDITIONS)
  .describe("excellent = as new; good = normal, clean, no visible marks; fair = minor wear; poor = clear wear or marks; damaged = broken, stained, holes, needs repair");

const item = z.object({
  name: z.string().min(1).describe("The thing inspected, e.g. 'Walls', 'Carpet', 'Oven', 'Window (east)'"),
  condition,
  notes: z
    .string()
    .optional()
    .describe("Specific, factual observations a tribunal could rely on: location, size, colour, count of marks. Say 'No visible marks' if clean."),
});

const room = z.object({
  name: z.string().min(1).describe("Room name, e.g. 'Kitchen', 'Bedroom 1', 'Bathroom'"),
  items: z.array(item).describe("Every visible item in this room"),
});

function baseUrl(req: Request) {
  return (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function errorText(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function buildServer(user: User, origin: string) {
  const server = new McpServer(
    { name: "StayProof", version: "0.1.0" },
    {
      instructions:
        "StayProof stores rental property condition reports. When the user shares move-in photos of a property, " +
        "look at every photo carefully, group what you see by room, and call create_condition_report once with all rooms. " +
        "Be specific and factual in notes (where, how big, how many). After creating, give the user the report link so they can review, edit and send it. " +
        "At move-out, when the user shares move-out photos: call list_reports to find the property, get_report to read the signed move-in condition of every item, " +
        "then compare the photos against it and call record_move_out_inspection once with every item you can assess. Distinguish fair wear and tear (no deduction) from damage.",
    },
  );
  const link = (id: string) => `${origin}/reports/${id}`;

  server.registerTool(
    "create_condition_report",
    {
      title: "Create condition report",
      description:
        "Create a room-by-room move-in condition report for a rental property from the photos the user shared. " +
        "Include every room shown and every visible item in it with a condition rating and factual notes.",
      inputSchema: {
        property_address: z.string().min(1).describe("Full property address"),
        landlord_name: z.string().optional(),
        tenant_name: z.string().optional(),
        tenant_email: z.string().optional(),
        inspection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD; defaults to today"),
        summary: z.string().optional().describe("2-3 sentence overall summary of the property's condition"),
        rooms: z.array(room).min(1),
      },
    },
    async (args) => {
      const r = await reports.createReport(user.id, args);
      const items = r.rooms.reduce((n, ro) => n + ro.items.length, 0);
      return text({
        report_id: r.id,
        url: link(r.id),
        message: `Created a condition report for ${r.property_address} with ${r.rooms.length} rooms and ${items} items. Review and edit it at ${link(r.id)}`,
      });
    },
  );

  server.registerTool(
    "list_reports",
    {
      title: "List condition reports",
      description: "List the user's condition reports, newest first.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const list = await reports.listReports(user.id);
      return text(list.map((r) => ({ ...r, url: link(r.id) })));
    },
  );

  server.registerTool(
    "get_report",
    {
      title: "Get condition report",
      description: "Get a full condition report, including room ids and item ids needed for edits.",
      inputSchema: { report_id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ report_id }) => {
      const r = await reports.getReport(user.id, report_id);
      if (!r) return errorText("Report not found");
      const rest: Partial<typeof r> = { ...r };
      delete rest.user_id;
      delete rest.share_token;
      const tenant_link = r.status === "draft" ? undefined : `${origin}/s/${r.share_token}`;
      return text({ ...rest, url: link(r.id), tenant_link });
    },
  );

  server.registerTool(
    "add_room",
    {
      title: "Add room to report",
      description: "Add another room (with its items) to an existing report, e.g. when the user shares more photos.",
      inputSchema: { report_id: z.string(), room },
    },
    async ({ report_id, room }) => {
      const ok = await reports.addRoom(user.id, report_id, room);
      return ok ? text(`Added ${room.name} with ${room.items.length} items. ${link(report_id)}`) : errorText("Report not found, or it has been signed and is locked");
    },
  );

  server.registerTool(
    "update_item",
    {
      title: "Update an item",
      description: "Change the name, condition or notes of one item in a report. Get item ids from get_report.",
      inputSchema: {
        item_id: z.string(),
        name: z.string().optional(),
        condition: condition.optional(),
        notes: z.string().optional(),
      },
    },
    async ({ item_id, ...patch }) => {
      const ok = await reports.updateItem(user.id, item_id, patch);
      return ok ? text("Item updated") : errorText("Item not found, or the report has been signed and is locked");
    },
  );

  server.registerTool(
    "record_move_out_inspection",
    {
      title: "Record move-out inspection",
      description:
        "Record the move-out condition of items in a signed move-in report, so StayProof can show move-in and move-out side by side. " +
        "First call get_report to get item ids and their move-in condition and notes, then compare the move-out photos item by item. " +
        "Only include items you could actually assess. Suggest a deduction only for damage beyond fair wear and tear; the landlord reviews every amount.",
      inputSchema: {
        report_id: z.string(),
        move_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD; defaults to today"),
        items: z
          .array(
            z.object({
              item_id: z.string().describe("Item id from get_report"),
              condition,
              notes: z.string().optional().describe("What changed since move-in, factually. Say 'Unchanged since move-in' if so."),
              suggested_deduction: z
                .number()
                .min(0)
                .optional()
                .describe("Suggested repair/cleaning cost in dollars, only for damage beyond fair wear and tear. Omit or 0 otherwise."),
            }),
          )
          .min(1),
      },
    },
    async ({ report_id, move_out_date, items }) => {
      const res = await reports.recordMoveOut(user.id, report_id, {
        move_out_date,
        entries: items.map((i) => ({
          item_id: i.item_id,
          condition: i.condition,
          notes: i.notes,
          deduction_cents: i.suggested_deduction !== undefined ? Math.round(i.suggested_deduction * 100) : undefined,
        })),
      });
      if (!res.ok)
        return errorText(
          "Report not found, or it hasn't been signed by both landlord and tenant yet. Move-out needs a signed move-in report.",
        );
      const r = await reports.getReport(user.id, report_id);
      const all = r!.rooms.flatMap((ro) => ro.items);
      const worse = all.filter((i) => reports.change(i) === "worse").map((i) => i.name);
      const total = all.reduce((n, i) => n + i.deduction_cents, 0) / 100;
      return text({
        updated: res.updated,
        unknown_item_ids: res.unknown,
        items_still_unassessed: all.filter((i) => !i.move_out_condition).map((i) => ({ id: i.id, name: i.name })),
        worse_than_move_in: worse,
        total_suggested_deductions: `$${total.toFixed(2)}`,
        comparison_url: `${origin}/reports/${report_id}/move-out`,
      });
    },
  );

  return server;
}

async function handle(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const user = await userByApiKey(key);
  if (!user) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Invalid connector link. Copy it again from your StayProof dashboard." }, id: null },
      { status: 401 },
    );
  }
  const server = buildServer(user, baseUrl(req));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
