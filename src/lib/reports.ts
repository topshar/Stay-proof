import "server-only";
import { db, CONDITIONS, type Condition } from "./db";

export type Item = { id: string; name: string; condition: Condition; notes: string; position: number };
export type Room = { id: string; name: string; position: number; items: Item[] };
export type ReportSummary = {
  id: string;
  property_address: string;
  tenant_name: string;
  inspection_date: string;
  status: string;
  room_count: number;
  item_count: number;
  updated_at: string;
};
export type Report = {
  id: string;
  user_id: string;
  property_address: string;
  landlord_name: string;
  tenant_name: string;
  tenant_email: string;
  inspection_date: string;
  summary: string;
  status: string;
  share_token: string;
  created_at: string;
  updated_at: string;
  rooms: Room[];
};

export type NewItem = { name: string; condition: Condition; notes?: string };
export type NewRoom = { name: string; items: NewItem[] };
export type NewReport = {
  property_address: string;
  landlord_name?: string;
  tenant_name?: string;
  tenant_email?: string;
  inspection_date?: string;
  summary?: string;
  rooms: NewRoom[];
};

export function isCondition(v: unknown): v is Condition {
  return typeof v === "string" && (CONDITIONS as readonly string[]).includes(v);
}

export async function listReports(userId: string): Promise<ReportSummary[]> {
  const sql = await db();
  return sql<ReportSummary[]>`
    select r.id, r.property_address, r.tenant_name, to_char(r.inspection_date, 'YYYY-MM-DD') as inspection_date,
           r.status, r.updated_at,
           (select count(*)::int from rooms where report_id = r.id) as room_count,
           (select count(*)::int from items i join rooms ro on ro.id = i.room_id where ro.report_id = r.id) as item_count
    from reports r where r.user_id = ${userId}
    order by r.updated_at desc`;
}

async function loadRooms(reportId: string): Promise<Room[]> {
  const sql = await db();
  const rooms = await sql<Omit<Room, "items">[]>`
    select id, name, position from rooms where report_id = ${reportId} order by position, name`;
  if (rooms.length === 0) return [];
  const items = await sql<(Item & { room_id: string })[]>`
    select id, room_id, name, condition, notes, position from items
    where room_id in ${sql(rooms.map((r) => r.id))} order by position, name`;
  return rooms.map((r) => ({
    ...r,
    items: items
      .filter((i) => i.room_id === r.id)
      .map((i) => ({ id: i.id, name: i.name, condition: i.condition, notes: i.notes, position: i.position })),
  }));
}

const REPORT_COLS = `id, user_id, property_address, landlord_name, tenant_name, tenant_email,
  to_char(inspection_date, 'YYYY-MM-DD') as inspection_date, summary, status, share_token, created_at, updated_at`;

export async function getReport(userId: string, reportId: string): Promise<Report | null> {
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return null;
  const sql = await db();
  const [r] = await sql.unsafe<Omit<Report, "rooms">[]>(
    `select ${REPORT_COLS} from reports where id = $1 and user_id = $2`,
    [reportId, userId],
  );
  if (!r) return null;
  return { ...r, rooms: await loadRooms(r.id) };
}

async function insertRooms(reportId: string, rooms: NewRoom[], startAt = 0) {
  const sql = await db();
  let pos = startAt;
  for (const room of rooms) {
    const [row] = await sql<{ id: string }[]>`
      insert into rooms (report_id, name, position) values (${reportId}, ${room.name}, ${pos++}) returning id`;
    await insertItems(row.id, room.items);
  }
}

async function insertItems(roomId: string, items: NewItem[]) {
  if (items.length === 0) return;
  const sql = await db();
  const [{ max }] = await sql<{ max: number }[]>`select coalesce(max(position), -1)::int as max from items where room_id = ${roomId}`;
  const rows = items.map((it, i) => ({
    room_id: roomId,
    name: it.name,
    condition: isCondition(it.condition) ? it.condition : "good",
    notes: it.notes ?? "",
    position: max + 1 + i,
  }));
  await sql`insert into items ${sql(rows, "room_id", "name", "condition", "notes", "position")}`;
}

export async function createReport(userId: string, input: NewReport): Promise<Report> {
  const sql = await db();
  const [row] = await sql<{ id: string }[]>`
    insert into reports (user_id, property_address, landlord_name, tenant_name, tenant_email, inspection_date, summary)
    values (${userId}, ${input.property_address}, ${input.landlord_name ?? ""}, ${input.tenant_name ?? ""},
            ${input.tenant_email ?? ""}, ${input.inspection_date ?? new Date().toISOString().slice(0, 10)},
            ${input.summary ?? ""})
    returning id`;
  await insertRooms(row.id, input.rooms);
  return (await getReport(userId, row.id))!;
}

async function touch(reportId: string) {
  const sql = await db();
  await sql`update reports set updated_at = now() where id = ${reportId}`;
}

/** Returns the report id if the user owns the room, else null. */
async function roomReport(userId: string, roomId: string): Promise<string | null> {
  const sql = await db();
  const [r] = await sql<{ report_id: string }[]>`
    select ro.report_id from rooms ro join reports r on r.id = ro.report_id
    where ro.id = ${roomId} and r.user_id = ${userId}`;
  return r?.report_id ?? null;
}

async function itemReport(userId: string, itemId: string): Promise<string | null> {
  const sql = await db();
  const [r] = await sql<{ report_id: string }[]>`
    select ro.report_id from items i join rooms ro on ro.id = i.room_id join reports r on r.id = ro.report_id
    where i.id = ${itemId} and r.user_id = ${userId}`;
  return r?.report_id ?? null;
}

export type ReportPatch = Partial<
  Pick<Report, "property_address" | "landlord_name" | "tenant_name" | "tenant_email" | "inspection_date" | "summary">
>;

export async function updateReport(userId: string, reportId: string, patch: ReportPatch) {
  const sql = await db();
  const keys = Object.keys(patch).filter((k) => patch[k as keyof ReportPatch] !== undefined) as (keyof ReportPatch)[];
  if (keys.length === 0) return;
  await sql`update reports set ${sql(patch, keys)}, updated_at = now() where id = ${reportId} and user_id = ${userId}`;
}

export async function deleteReport(userId: string, reportId: string) {
  const sql = await db();
  await sql`delete from reports where id = ${reportId} and user_id = ${userId}`;
}

export async function addRoom(userId: string, reportId: string, room: NewRoom): Promise<boolean> {
  const sql = await db();
  const [own] = await sql`select 1 from reports where id = ${reportId} and user_id = ${userId}`;
  if (!own) return false;
  const [{ max }] = await sql<{ max: number }[]>`select coalesce(max(position), -1)::int as max from rooms where report_id = ${reportId}`;
  await insertRooms(reportId, [room], max + 1);
  await touch(reportId);
  return true;
}

export async function renameRoom(userId: string, roomId: string, name: string) {
  const reportId = await roomReport(userId, roomId);
  if (!reportId) return;
  const sql = await db();
  await sql`update rooms set name = ${name} where id = ${roomId}`;
  await touch(reportId);
}

export async function deleteRoom(userId: string, roomId: string) {
  const reportId = await roomReport(userId, roomId);
  if (!reportId) return;
  const sql = await db();
  await sql`delete from rooms where id = ${roomId}`;
  await touch(reportId);
}

export async function addItem(userId: string, roomId: string, item: NewItem): Promise<boolean> {
  const reportId = await roomReport(userId, roomId);
  if (!reportId) return false;
  await insertItems(roomId, [item]);
  await touch(reportId);
  return true;
}

export async function updateItem(
  userId: string,
  itemId: string,
  patch: { name?: string; condition?: Condition; notes?: string },
): Promise<boolean> {
  const reportId = await itemReport(userId, itemId);
  if (!reportId) return false;
  const clean: Record<string, string> = {};
  if (patch.name !== undefined) clean.name = patch.name;
  if (patch.condition !== undefined && isCondition(patch.condition)) clean.condition = patch.condition;
  if (patch.notes !== undefined) clean.notes = patch.notes;
  if (Object.keys(clean).length === 0) return true;
  const sql = await db();
  await sql`update items set ${sql(clean, Object.keys(clean))} where id = ${itemId}`;
  await touch(reportId);
  return true;
}

export async function deleteItem(userId: string, itemId: string) {
  const reportId = await itemReport(userId, itemId);
  if (!reportId) return;
  const sql = await db();
  await sql`delete from items where id = ${itemId}`;
  await touch(reportId);
}
