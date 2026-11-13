import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

test('demo seed requires accounts, creates workflow data, and preserves data on rerun', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202611110001_timesheets.sql', import.meta.url), 'utf8'));
    const seed = await readFile(new URL('../supabase/seeds/demo.sql', import.meta.url), 'utf8');
    await assert.rejects(db.exec(seed), /Create all four demo Auth users/);
    await db.exec('rollback');
    await db.exec(`insert into auth.users(id, email)
      select gen_random_uuid(), email from (values ('admin@smberp.example'),
        ('manager@smberp.example'), ('alex@smberp.example'), ('jordan@smberp.example')) a(email)`);
    await db.exec(seed);
    const counts = async () => (await db.query(`select
      (select count(*)::int from public.timesheets) sheets,
      (select count(*)::int from public.time_entries) entries,
      (select count(*)::int from public.timesheet_events) events,
      (select count(*)::int from public.project_assignments) assignments`)).rows;
    assert.deepEqual(await counts(), [{ sheets: 8, entries: 32, events: 10, assignments: 4 }]);
    assert.deepEqual((await db.query(`select status, count(*)::int as count
      from public.timesheets group by status order by status`)).rows, [
      { status: 'approved', count: 2 }, { status: 'draft', count: 2 },
      { status: 'returned', count: 2 }, { status: 'submitted', count: 2 },
    ]);
    await db.exec(seed);
    assert.deepEqual(await counts(), [{ sheets: 8, entries: 32, events: 10, assignments: 4 }]);
  } finally { await db.close(); }
});
