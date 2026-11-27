import "server-only";
import { createHash } from "node:crypto";
import { db, CONDITIONS, type Condition } from "./db";

export type Item = {
  id: string;
  name: string;
  condition: Condition;
  notes: string;
  tenant_note: string;
  position: number;
  move_out_condition: Condition | null;
  move_out_notes: string;
  deduction_cents: number;
};
export type Photo = { id: string; room_id: string | null; phase: "move_in" | "move_out"; created_at: string };
export type Room = { id: string; name: string; position: number; items: Item[]; photos: Photo[]; move_out_photos: Photo[] };
export type ReportStatus = "draft" | "awaiting_tenant" | "signed";
export type ReportSummary = {
  id: string;
  property_address: string;
  tenant_name: string;
  inspection_date: string;
  status: string;
  move_out_date: string | null;
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
  landlord_signed_name: string | null;
  landlord_signed_at: string | null;
  tenant_signed_name: string | null;
  tenant_signed_at: string | null;
  tenant_comment: string;
  fingerprint: string | null;
  move_out_date: string | null;
  bond_cents: number;
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
           r.status, r.updated_at, to_char(r.move_out_date, 'YYYY-MM-DD') as move_out_date,
           (select count(*)::int from rooms where report_id = r.id) as room_count,
           (select count(*)::int from items i join rooms ro on ro.id = i.room_id where ro.report_id = r.id) as item_count
    from reports r where r.user_id = ${userId}
    order by r.updated_at desc`;
}

async function loadRooms(reportId: string): Promise<Room[]> {
  const sql = await db();
  const photos = await sql<Photo[]>`
    select id, room_id, phase, created_at from photos where report_id = ${reportId} order by created_at`;
  const rooms = await sql<Omit<Room, "items" | "photos" | "move_out_photos">[]>`
    select id, name, position from rooms where report_id = ${reportId} order by position, name`;
  if (rooms.length === 0) return [];
  const items = await sql<(Item & { room_id: string })[]>`
    select id, room_id, name, condition, notes, tenant_note, position, move_out_condition, move_out_notes, deduction_cents from items
    where room_id in ${sql(rooms.map((r) => r.id))} order by position, name`;
  return rooms.map((r) => ({
    ...r,
    items: items
      .filter((i) => i.room_id === r.id)
      .map((i) => ({
        id: i.id, name: i.name, condition: i.condition, notes: i.notes, tenant_note: i.tenant_note, position: i.position,
        move_out_condition: i.move_out_condition, move_out_notes: i.move_out_notes, deduction_cents: i.deduction_cents,
      })),
    photos: photos.filter((p) => p.room_id === r.id && p.phase === "move_in"),
    move_out_photos: photos.filter((p) => p.room_id === r.id && p.phase === "move_out"),
  }));
}

const REPORT_COLS = `id, user_id, property_address, landlord_name, tenant_name, tenant_email,
  to_char(inspection_date, 'YYYY-MM-DD') as inspection_date, summary, status, share_token, created_at, updated_at,
  landlord_signed_name, landlord_signed_at, tenant_signed_name, tenant_signed_at, tenant_comment, fingerprint,
  to_char(move_out_date, 'YYYY-MM-DD') as move_out_date, bond_cents`;

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
    where ro.id = ${roomId} and r.user_id = ${userId} and r.status = 'draft'`;
  return r?.report_id ?? null;
}

async function itemReport(userId: string, itemId: string): Promise<string | null> {
  const sql = await db();
  const [r] = await sql<{ report_id: string }[]>`
    select ro.report_id from items i join rooms ro on ro.id = i.room_id join reports r on r.id = ro.report_id
    where i.id = ${itemId} and r.user_id = ${userId} and r.status = 'draft'`;
  return r?.report_id ?? null;
}

export type ReportPatch = Partial<
  Pick<Report, "property_address" | "landlord_name" | "tenant_name" | "tenant_email" | "inspection_date" | "summary">
>;

export async function updateReport(userId: string, reportId: string, patch: ReportPatch) {
  const sql = await db();
  const keys = Object.keys(patch).filter((k) => patch[k as keyof ReportPatch] !== undefined) as (keyof ReportPatch)[];
  if (keys.length === 0) return;
  await sql`update reports set ${sql(patch, keys)}, updated_at = now() where id = ${reportId} and user_id = ${userId} and status = 'draft'`;
}

export async function deleteReport(userId: string, reportId: string) {
  const sql = await db();
  const photos = await sql<{ storage: string; storage_key: string }[]>`
    select p.storage, p.storage_key from photos p join reports r on r.id = p.report_id
    where r.id = ${reportId} and r.user_id = ${userId}`;
  await sql`delete from reports where id = ${reportId} and user_id = ${userId}`;
  const { removePhotoObject } = await import("./storage");
  await Promise.all(photos.map((p) => removePhotoObject(p)));
}

export async function addRoom(userId: string, reportId: string, room: NewRoom): Promise<boolean> {
  const sql = await db();
  const [own] = await sql`select 1 from reports where id = ${reportId} and user_id = ${userId} and status = 'draft'`;
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

// ---------- Stage 2: signing ----------

/** A stable SHA-256 of what was signed, so either party can prove the content never changed. */
export function fingerprintOf(r: Report): string {
  const canonical = {
    property_address: r.property_address,
    landlord_name: r.landlord_name,
    tenant_name: r.tenant_name,
    inspection_date: r.inspection_date,
    summary: r.summary,
    rooms: r.rooms.map((ro) => ({
      name: ro.name,
      items: ro.items.map((i) => ({ name: i.name, condition: i.condition, notes: i.notes })),
      photos: ro.photos.map((p) => p.id),
    })),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export async function landlordSign(userId: string, reportId: string, name: string): Promise<boolean> {
  const r = await getReport(userId, reportId);
  if (!r || r.status !== "draft" || !name.trim()) return false;
  const sql = await db();
  await sql`
    update reports set landlord_signed_name = ${name.trim()}, landlord_signed_at = now(),
      fingerprint = ${fingerprintOf(r)}, status = 'awaiting_tenant', updated_at = now()
    where id = ${reportId} and user_id = ${userId} and status = 'draft'`;
  return true;
}

/** Landlord takes the report back to draft before the tenant has signed. */
export async function unlockReport(userId: string, reportId: string) {
  const sql = await db();
  await sql`
    update reports set status = 'draft', landlord_signed_name = null, landlord_signed_at = null, fingerprint = null,
      updated_at = now()
    where id = ${reportId} and user_id = ${userId} and status = 'awaiting_tenant'`;
}

export type PublicReport = Omit<Report, "user_id" | "tenant_email">;

export async function getReportByToken(token: string): Promise<PublicReport | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const sql = await db();
  const [r] = await sql.unsafe<Report[]>(`select ${REPORT_COLS} from reports where share_token = $1`, [token]);
  if (!r || r.status === "draft") return null;
  const rest: Partial<Report> = { ...r };
  delete rest.user_id;
  delete rest.tenant_email;
  return { ...(rest as PublicReport), rooms: await loadRooms(r.id) };
}

export async function setTenantNote(token: string, itemId: string, note: string): Promise<boolean> {
  const sql = await db();
  const res = await sql`
    update items i set tenant_note = ${note.slice(0, 2000)}
    from rooms ro, reports r
    where i.id = ${itemId} and ro.id = i.room_id and r.id = ro.report_id
      and r.share_token = ${token} and r.status = 'awaiting_tenant'`;
  return res.count > 0;
}

export async function tenantSign(token: string, name: string, comment: string, ip: string): Promise<boolean> {
  if (!name.trim()) return false;
  const sql = await db();
  const res = await sql`
    update reports set tenant_signed_name = ${name.trim()}, tenant_signed_at = now(), tenant_signed_ip = ${ip},
      tenant_comment = ${comment.slice(0, 4000)}, status = 'signed', updated_at = now()
    where share_token = ${token} and status = 'awaiting_tenant'`;
  return res.count > 0;
}

// ---------- Stage 3: move-out ----------

export const SEVERITY: Record<Condition, number> = { excellent: 0, good: 1, fair: 2, poor: 3, damaged: 4 };

export function change(item: Item): "worse" | "same" | "better" | "pending" {
  if (!item.move_out_condition) return "pending";
  const d = SEVERITY[item.move_out_condition] - SEVERITY[item.condition];
  return d > 0 ? "worse" : d < 0 ? "better" : "same";
}

export type MoveOutEntry = { item_id: string; condition: Condition; notes?: string; deduction_cents?: number };

/** Move-out can be recorded once both parties have signed the move-in report. */
async function signedReport(userId: string, reportId: string) {
  const sql = await db();
  const [r] = await sql`select 1 from reports where id = ${reportId} and user_id = ${userId} and status = 'signed'`;
  return Boolean(r);
}

export async function recordMoveOut(
  userId: string,
  reportId: string,
  input: { move_out_date?: string; entries: MoveOutEntry[] },
): Promise<{ ok: boolean; updated: number; unknown: string[] }> {
  if (!(await signedReport(userId, reportId))) return { ok: false, updated: 0, unknown: [] };
  const sql = await db();
  let updated = 0;
  const unknown: string[] = [];
  for (const e of input.entries) {
    if (!isCondition(e.condition)) { unknown.push(e.item_id); continue; }
    const res = await sql`
      update items i set move_out_condition = ${e.condition},
        move_out_notes = coalesce(${e.notes ?? null}, i.move_out_notes),
        deduction_cents = coalesce(${e.deduction_cents ?? null}::int, i.deduction_cents)
      from rooms ro where i.id = ${e.item_id} and ro.id = i.room_id and ro.report_id = ${reportId}`;
    if (res.count) updated++; else unknown.push(e.item_id);
  }
  await sql`update reports set move_out_date = coalesce(${input.move_out_date ?? null}::date, move_out_date, current_date),
              updated_at = now() where id = ${reportId}`;
  return { ok: true, updated, unknown };
}

export async function updateMoveOutItem(
  userId: string,
  reportId: string,
  itemId: string,
  patch: { condition?: Condition | null; notes?: string; deduction_cents?: number },
) {
  if (!(await signedReport(userId, reportId))) return false;
  const sql = await db();
  const clean: Record<string, unknown> = {};
  if (patch.condition !== undefined) clean.move_out_condition = patch.condition && isCondition(patch.condition) ? patch.condition : null;
  if (patch.notes !== undefined) clean.move_out_notes = patch.notes;
  if (patch.deduction_cents !== undefined) clean.deduction_cents = Math.max(0, Math.round(patch.deduction_cents));
  if (!Object.keys(clean).length) return true;
  const res = await sql`
    update items i set ${sql(clean as Record<string, string>, Object.keys(clean))}
    from rooms ro where i.id = ${itemId} and ro.id = i.room_id and ro.report_id = ${reportId}`;
  if (res.count) await sql`update reports set move_out_date = coalesce(move_out_date, current_date), updated_at = now() where id = ${reportId}`;
  return res.count > 0;
}

export async function setBond(userId: string, reportId: string, bondCents: number) {
  const sql = await db();
  await sql`update reports set bond_cents = ${Math.max(0, Math.round(bondCents))}, updated_at = now()
            where id = ${reportId} and user_id = ${userId}`;
}
