-- UniTest: первый этап подключения Supabase.
-- Выполнить один раз в Supabase → SQL Editor → New query → Run.
--
-- Таблица app_state хранит все ключи UniTest в виде JSONB.
-- Это позволяет приложению работать с общей БД без переписывания
-- всех разделов на отдельные таблицы. Следующий этап — Auth + RLS
-- и нормальные таблицы пользователей/тестов/результатов.

create table if not exists public.app_state (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Автообновление updated_at при UPSERT/UPDATE.
create or replace function public.touch_app_state()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_state_touch on public.app_state;
create trigger trg_app_state_touch
before update on public.app_state
for each row execute function public.touch_app_state();

-- RLS: пока это демо-режим (без Auth). Позже заменим на политики по ролям.
alter table public.app_state enable row level security;

drop policy if exists "unitest_demo_read"   on public.app_state;
drop policy if exists "unitest_demo_insert" on public.app_state;
drop policy if exists "unitest_demo_update" on public.app_state;
drop policy if exists "unitest_demo_delete" on public.app_state;

create policy "unitest_demo_read"
  on public.app_state for select
  to anon, authenticated
  using (true);

create policy "unitest_demo_insert"
  on public.app_state for insert
  to anon, authenticated
  with check (true);

create policy "unitest_demo_update"
  on public.app_state for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "unitest_demo_delete"
  on public.app_state for delete
  to anon, authenticated
  using (true);

grant select, insert, update, delete on public.app_state to anon, authenticated;

-- Ускорение выборки «что изменилось» на будущее.
create index if not exists app_state_updated_at_idx
  on public.app_state (updated_at desc);

-- Проверка: должна вернуться пустая таблица без ошибки.
select * from public.app_state limit 5;
