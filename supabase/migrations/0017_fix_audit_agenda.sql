-- ============================================================
-- Fix: trg_audit_citas_agenda / trg_audit_bloqueos_agenda fallaban con
--   ERROR: 42703 record "old"/"new" has no field "firma_id"
--
-- fn_audit_log() usa `coalesce(v_firma, old.firma_id / new.firma_id)`
-- como respaldo, pero ni citas_agenda ni bloqueos_agenda tienen esa
-- columna (igual que contactos_landing y configuracion_agenda, no son
-- datos aislados por tenant — ver 0016). El COALESCE no evita el
-- error: Postgres resuelve esa referencia al planear el INSERT del
-- propio trigger sin importar si el runtime la usa o no, así que
-- cualquier escritura autenticada (crear/eliminar bloqueos, agendar o
-- cancelar una cita desde el equipo) fallaba siempre.
-- ============================================================

drop trigger if exists trg_audit_bloqueos_agenda on bloqueos_agenda;
drop trigger if exists trg_audit_citas_agenda on citas_agenda;
