"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
