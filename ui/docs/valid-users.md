# Referencia de acceso local (sin secretos)

Este archivo no debe incluir passwords, tokens ni credenciales en texto plano.

## Login UI

- URL: `https://oc02.cognitive.la/login`
- Usuario admin: revisar `data/users.json` (local) o el bind mount de producción
- Rol esperado para administración: `admin`

## Gateway OpenClaw (producción actual)

- Runtime: App Service en EasyPanel (`openclaw-gateway`)
- URL interna desde `cognitive`: `http://openclaw-gateway:18789`
- Token: configurado por variables de entorno en EasyPanel (no versionado)
- Config principal: file mount en `/home/node/.openclaw/openclaw.json`

## Notas operativas

- Si cambia la instancia del gateway o el modo de device auth, borrar `device-identity.json` del bind mount de `cognitive` y reaprobar pairing si aplica.
- Para troubleshooting completo, usar `docs/ops/2026-03-05-easypanel-openclaw-runbook.md`.
