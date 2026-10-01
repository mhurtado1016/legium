-- ============================================================
-- Legium — Notas de bitácora fijadas ("sticky notes")
-- Permite marcar una nota de la bitácora del caso para que quede
-- siempre visible al costado de la página, como una nota adhesiva.
-- ============================================================

alter table caso_actividad add column fijada boolean not null default false;
