-- Los planes ahora se compran (comprar_plan): los pedidos al admin quedan sin uso.
-- Se cierran los que seguían pendientes para que no queden colgados.
--
-- Requiere 20261125000800_compras_plan.

update public.pedidos_plan
set estado = 'cancelado', resuelto_en = now()
where estado = 'pendiente';
