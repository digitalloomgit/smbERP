import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

test('database enforces ownership, locking, whole-week approval, and resubmission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202611110001_timesheets.sql', import.meta.url), 'utf8'));
    const employee = '00000000-0000-0000-0000-000000000001';
    const manager = '00000000-0000-0000-0000-000000000002';
    const stranger = '00000000-0000-0000-0000-000000000003';
    const project = '10000000-0000-0000-0000-000000000001';
    const activity = '20000000-0000-0000-0000-000000000001';
    await db.exec(`
      insert into auth.users(id,email) values ('${employee}','employee@test.com'),('${manager}','manager@test.com'),('${stranger}','other@test.com');
      update public.profiles set manager_id='${manager}' where id='${employee}';
      insert into public.user_roles values('${manager}','manager');
      insert into public.projects(id,code,name) values('${project}','P1','Project');
      insert into public.project_activities(id,project_id,code,name) values('${activity}','${project}','A1','Build');
      insert into public.project_assignments(employee_id,project_id) values('${employee}','${project}');
    `);
    async function as(user: string) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec('set role authenticated');
    }
    await as(employee);
    const sheet = (await db.query<{ id: string }>("select public.open_week('2020-01-06') id")).rows[0].id;
    await assert.rejects(db.query("select public.open_week('2020-01-07')"), /Monday/);
    await assert.rejects(db.query('select public.submit_week($1)', [sheet]), /at least one/);
    await assert.rejects(db.query(`select public.save_entry($1,'2020-01-13',$2,$3,8)`, [sheet, project, activity]), /Invalid work date/);
    await assert.rejects(db.query(`select public.save_entry($1,'2020-01-06',$2,$3,0)`, [sheet, project, activity]), /check constraint/);
    const entry = (await db.query<{ id: string }>(`select public.save_entry($1,'2020-01-06',$2,$3,25) id`, [sheet, project, activity])).rows[0].id;
    await db.query(`select public.save_entry($1,'2020-01-07',$2,$3,0.5)`, [sheet, project, activity]);
    assert.equal((await db.query('select * from public.time_entries')).rows.length, 2);
    await assert.rejects(db.query("update public.timesheets set status='approved' where id=$1", [sheet]), /permission denied/);
    await as(stranger);
    assert.equal((await db.query('select * from public.timesheets')).rows.length, 0);
    assert.equal((await db.query('select * from public.time_entries')).rows.length, 0);
    await assert.rejects(db.query(`select public.save_entry($1,'2020-01-06',$2,$3,8)`, [sheet, project, activity]), /Not authorized/);
    const unassignedSheet = (await db.query<{ id: string }>("select public.open_week('2020-01-06') id")).rows[0].id;
    await assert.rejects(db.query(`select public.save_entry($1,'2020-01-06',$2,$3,8)`, [unassignedSheet, project, activity]), /unavailable/);
    await as(employee);
    await db.query('select public.submit_week($1)', [sheet]);
    await assert.rejects(db.query('select public.delete_entry($1,$2)', [sheet, entry]), /locked/);
    await assert.rejects(db.query(`select public.save_entry($1,'2020-01-06',$2,$3,8,'',$4)`, [sheet, project, activity, entry]), /locked/);
    await assert.rejects(db.query("select public.decide_week($1,1,'approved')", [sheet]), /Not authorized/);
    await as(manager);
    assert.equal((await db.query('select * from public.time_entries')).rows.length, 2);
    await assert.rejects(db.query("select public.decide_week($1,1,'returned','   ')", [sheet]), /reason/);
    await db.query("select public.decide_week($1,1,'returned','Please correct Monday')", [sheet]);
    await as(employee);
    await db.query(`select public.save_entry($1,'2020-01-06',$2,$3,7.5,'Corrected',$4)`, [sheet, project, activity, entry]);
    await db.query('select public.submit_week($1)', [sheet]);
    await as(manager);
    await assert.rejects(db.query("select public.decide_week($1,1,'approved')", [sheet]), /submission changed/);
    await db.query("select public.decide_week($1,2,'approved')", [sheet]);
    await as(employee);
    await assert.rejects(db.query('select public.delete_entry($1,$2)', [sheet, entry]), /locked/);
    const events = (await db.query<{ kind: string }>('select kind from public.timesheet_events order by created_at')).rows;
    assert.deepEqual(events.map(e => e.kind), ['submitted','returned','submitted','approved']);
    await assert.rejects(db.query('delete from public.timesheet_events'), /permission denied/);
  } finally { await db.close(); }
});
