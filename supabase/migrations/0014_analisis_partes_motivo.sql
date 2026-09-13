-- ============================================================
-- Añadir demandante, demandado y motivo al análisis generado por IA.
-- ============================================================

alter table sentencias_cache
  add column if not exists demandante_ia text,
  add column if not exists demandado_ia text,
  add column if not exists motivo_ia text;
