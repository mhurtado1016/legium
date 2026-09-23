-- ============================================================
-- Legium — Teléfono de WhatsApp por usuario
--
-- Para poder enviarle WhatsApp a un usuario de la firma (recordatorios,
-- avisos, etc. — ver supabase/functions/enviar-whatsapp) hace falta
-- guardar su número en alguna parte. Se agrega a `usuarios` en vez de
-- reusar un campo nuevo de "teléfono genérico": el nombre deja explícito
-- que es el número que recibe mensajes de WhatsApp, no un teléfono de
-- contacto general (ese ya existe para clientes en `clientes.telefono`).
-- ============================================================

alter table usuarios add column telefono_whatsapp text;
