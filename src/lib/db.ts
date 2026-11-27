import "server-only";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

declare global {
  var __dgSql: ReturnType<typeof postgres> | undefined;
  var __dgSchema: Promise<void> | undefined;
}

function client() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalThis.__dgSql) {
    globalThis.__dgSql = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  }
  return globalThis.__dgSql;
}

export const CONDITIONS = ["excellent", "good", "fair", "poor", "damaged"] as const;
export type Condition = (typeof CONDITIONS)[number];

async function migrate(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(`
    create extension if not exists pgcrypto;
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      name text not null,
      password_hash text not null,
      api_key text unique not null,
      created_at timestamptz not null default now()
    );
    create table if not exists reports (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      property_address text not null,
      landlord_name text not null default '',
      tenant_name text not null default '',
      tenant_email text not null default '',
      inspection_date date not null default current_date,
      summary text not null default '',
      status text not null default 'draft',
      share_token text unique not null default encode(gen_random_bytes(16), 'hex'),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists rooms (
      id uuid primary key default gen_random_uuid(),
      report_id uuid not null references reports(id) on delete cascade,
      name text not null,
      position int not null default 0
    );
    create table if not exists items (
      id uuid primary key default gen_random_uuid(),
      room_id uuid not null references rooms(id) on delete cascade,
      name text not null,
      condition text not null default 'good',
      notes text not null default '',
      position int not null default 0
    );
    create index if not exists reports_user_idx on reports(user_id);
    create index if not exists rooms_report_idx on rooms(report_id);
    create index if not exists items_room_idx on items(room_id);

    -- Stage 2: signing and photos
    alter table reports add column if not exists landlord_signed_name text;
    alter table reports add column if not exists landlord_signed_at timestamptz;
    alter table reports add column if not exists tenant_signed_name text;
    alter table reports add column if not exists tenant_signed_at timestamptz;
    alter table reports add column if not exists tenant_signed_ip text;
    alter table reports add column if not exists tenant_comment text not null default '';
    alter table reports add column if not exists fingerprint text;
    alter table items add column if not exists tenant_note text not null default '';
    create table if not exists photos (
      id uuid primary key default gen_random_uuid(),
      report_id uuid not null references reports(id) on delete cascade,
      room_id uuid references rooms(id) on delete cascade,
      storage text not null,
      storage_key text not null,
      content_type text not null default 'image/jpeg',
      data bytea,
      created_at timestamptz not null default now()
    );
    create index if not exists photos_report_idx on photos(report_id);
  `);
  // Seed the reviewer/demo account once.
  const email = (process.env.DEMO_EMAIL ?? "demo@stayproof.app").toLowerCase();
  const [existing] = await sql`select id from users where email = ${email}`;
  if (!existing) {
    const hash = await bcrypt.hash(process.env.DEMO_PASSWORD ?? "movein2026", 10);
    await sql`
      insert into users (email, name, password_hash, api_key)
      values (${email}, ${"Demo Landlord"}, ${hash}, ${newApiKey()})
      on conflict (email) do nothing`;
  }
}

export function newApiKey() {
  return "dg_" + randomBytes(18).toString("base64url");
}

export async function db() {
  const sql = client();
  if (!globalThis.__dgSchema) {
    globalThis.__dgSchema = migrate(sql).catch((e) => {
      globalThis.__dgSchema = undefined;
      throw e;
    });
  }
  await globalThis.__dgSchema;
  return sql;
}
