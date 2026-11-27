"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { removePhotoObject } from "@/lib/storage";
import { logIn, logOut, requireUser } from "@/lib/auth";
import * as reports from "@/lib/reports";
import type { Condition } from "@/lib/db";

export async function loginAction(_prev: string | null, form: FormData): Promise<string | null> {
  const ok = await logIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return "That email and password don't match.";
  redirect("/dashboard");
}

export async function logoutAction() {
  await logOut();
  redirect("/login");
}

export async function updateReportAction(reportId: string, patch: reports.ReportPatch) {
  const user = await requireUser();
  await reports.updateReport(user.id, reportId, patch);
  revalidatePath(`/reports/${reportId}`);
}

export async function deleteReportAction(reportId: string) {
  const user = await requireUser();
  await reports.deleteReport(user.id, reportId);
  redirect("/dashboard");
}

export async function addRoomAction(reportId: string, name: string) {
  const user = await requireUser();
  await reports.addRoom(user.id, reportId, { name: name || "New room", items: [] });
  revalidatePath(`/reports/${reportId}`);
}

export async function renameRoomAction(reportId: string, roomId: string, name: string) {
  const user = await requireUser();
  await reports.renameRoom(user.id, roomId, name);
  revalidatePath(`/reports/${reportId}`);
}

export async function deleteRoomAction(reportId: string, roomId: string) {
  const user = await requireUser();
  await reports.deleteRoom(user.id, roomId);
  revalidatePath(`/reports/${reportId}`);
}

export async function addItemAction(reportId: string, roomId: string, name: string) {
  const user = await requireUser();
  await reports.addItem(user.id, roomId, { name: name || "New item", condition: "good" });
  revalidatePath(`/reports/${reportId}`);
}

export async function updateItemAction(
  reportId: string,
  itemId: string,
  patch: { name?: string; condition?: Condition; notes?: string },
) {
  const user = await requireUser();
  await reports.updateItem(user.id, itemId, patch);
  revalidatePath(`/reports/${reportId}`);
}

export async function deleteItemAction(reportId: string, itemId: string) {
  const user = await requireUser();
  await reports.deleteItem(user.id, itemId);
  revalidatePath(`/reports/${reportId}`);
}

// ---------- Stage 2 ----------

export async function landlordSignAction(reportId: string, name: string) {
  const user = await requireUser();
  const ok = await reports.landlordSign(user.id, reportId, name);
  revalidatePath(`/reports/${reportId}`);
  return ok;
}

export async function unlockReportAction(reportId: string) {
  const user = await requireUser();
  await reports.unlockReport(user.id, reportId);
  revalidatePath(`/reports/${reportId}`);
}

export async function deletePhotoAction(reportId: string, photoId: string) {
  const user = await requireUser();
  const sql = await db();
  const [row] = await sql<{ storage: string; storage_key: string }[]>`
    delete from photos p using reports r
    where p.id = ${photoId} and p.report_id = r.id and r.id = ${reportId} and r.user_id = ${user.id}
      and ((p.phase = 'move_in' and r.status = 'draft') or (p.phase = 'move_out' and r.status = 'signed'))
    returning p.storage, p.storage_key`;
  if (row) await removePhotoObject(row);
  revalidatePath(`/reports/${reportId}`);
  revalidatePath(`/reports/${reportId}/move-out`);
}

export async function tenantNoteAction(token: string, itemId: string, note: string) {
  await reports.setTenantNote(token, itemId, note);
  revalidatePath(`/s/${token}`);
}

export async function tenantSignAction(token: string, name: string, comment: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ok = await reports.tenantSign(token, name, comment, ip);
  revalidatePath(`/s/${token}`);
  return ok;
}

// ---------- Stage 3 ----------

export async function updateMoveOutAction(
  reportId: string,
  itemId: string,
  patch: { condition?: Condition | null; notes?: string; deduction_cents?: number },
) {
  const user = await requireUser();
  await reports.updateMoveOutItem(user.id, reportId, itemId, patch);
  revalidatePath(`/reports/${reportId}/move-out`);
}

export async function setBondAction(reportId: string, bondCents: number) {
  const user = await requireUser();
  await reports.setBond(user.id, reportId, bondCents);
  revalidatePath(`/reports/${reportId}/move-out`);
}
