# OnlyMarket (`1.0.0-rc.1`) — NanoLabs

Sistema comercial y de trazabilidad por lote para kioscos, mercados, supermercados, carnicerías, fiambrerías y verdulerías.

## Características implementadas
- **Arquitectura multi-tenant por subdominio**:
  - Consola SuperAdmin exclusiva en `PLATFORM_DOMAIN` (`https://onlymarket.nanoapps.ar`).
  - Acceso de cada comercio en `https://{slug}.nanoapps.ar` (configurable mediante `TENANT_BASE_DOMAIN`), sin ingreso manual de código, login personalizado con el nombre del comercio, bloqueo por suspensión/vencimiento/inexistencia y cookies *host-only* aisladas.
  - Endpoint `/api/internal/caddy/ask` para `nanoapps-router`. Las altas en dominios compartidos se rechazan temporalmente hasta disponer de reservas atómicas entre todos los SaaS; un chequeo del router no garantiza exclusividad. Consultar el bloqueo operativo en `docs/DEPLOY.md`.
- **Operación comercial completa**: Multi-tenant con aislamiento estricto por `tenantId` en base de datos, inventario por lote, FEFO, compras múltiples, mermas/regalos, desposte/fraccionamiento con conservación de masa y costo, conteos físicos, traslados, reposición, POS con escaneo rápido y peso variable EAN-13, promociones, combos, pagos mixtos, arqueos de caja, anulaciones/devoluciones, fidelización e informes de rentabilidad.
- **Identidad NanoLabs**: Login espacial 2D oficial de NanoLabs (`login-nanolabs`) y shell interno estándar (`visual-nanolabs`) con 7 paletas corporativas y modo claro/oscuro.
- **Control central e integración**: Superadministrador (`/superadmin`), licencias y endpoint de lectura para NanoLabs Hub (`/api/integrations/nanolabs/tenants`).

## Documentación
- Instalación local y desarrollo: [docs/LOCAL.md](docs/LOCAL.md)
- Despliegue en producción, dominios, backups y alcance de la versión: [docs/DEPLOY.md](docs/DEPLOY.md)
- Seguridad de plataforma e integración Hub: [docs/PLATFORM.md](docs/PLATFORM.md)
