-- ============================================================
-- Legium — evita vincular la misma sentencia dos veces al mismo caso.
-- caso_sentencias (0004_modulo2_casos.sql) no tenía esta restricción;
-- hasta ahora vincularSentencia() nunca se había conectado a ninguna
-- pantalla, así que no hay filas duplicadas existentes que limpiar antes
-- de agregarla.
-- ============================================================

alter table caso_sentencias
  add constraint caso_sentencias_caso_id_sentencia_id_key unique (caso_id, sentencia_id);
