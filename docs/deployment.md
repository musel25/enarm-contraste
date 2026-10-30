# Despliegue de ENARM Contraste

URL: https://enarm.musel.dev/.

La interfaz se publica por SSH en el VPS existente, con el alias local `my-vps`. Tiene un virtual host y certificado propios. nginx sirve los archivos desde `/var/www/enarm-contraste/site-current/`. El servicio independiente `enarm-progress.service` guarda el progreso en SQLite. Requiere Node 22.21 o posterior. El VPS usa Node 24.15. No usa el servicio del temporizador.

El registro DNS `enarm A 145.241.168.188`, TTL 60, se añadió con Chrome MCP en la cuenta Vercel del usuario. Se verificó en el servidor DNS autoritativo y en 1.1.1.1.

## Publicar

Requisitos locales: Node 22.12 o posterior compatible, npm, uv, Chrome, SSH, rsync y ripgrep. El usuario SSH debe poder ejecutar nginx, instalar archivos en `/var/www` y recargar nginx con `sudo -n`.

```sh
npm ci
uv sync
bash scripts/deploy.sh
```

El script exige un árbol limpio y un commit subido a la rama remota de seguimiento. La compilación genera ambos mazos, audita sus bases SQLite y empaqueta el servicio Node. Después ejecuta las pruebas de Python, Node y navegador. Copia `dist/` al directorio web y `dist-server/` a una versión separada del servicio. No copia PDF, mazos originales, comentarios locales ni credenciales.

Cada publicación crea `/var/www/enarm-contraste/releases/<commit>-<fecha-UTC>-standalone/`. `scripts/setup-domain.sh` prepara únicamente el servidor HTTP de `enarm.musel.dev` y obtiene su certificado con Certbot, mediante el directorio de validación existente. `scripts/deploy.sh` instala `deploy/nginx-enarm.musel.dev.conf`, respalda la configuración previa y cambia `site-current` de forma atómica. Valida nginx antes de recargarlo.

Las comprobaciones validan el commit desde el origen y la URL pública, la página, JavaScript, el manifiesto, ambos mazos, la muestra anterior y la salud del temporizador. Si falla una comprobación remota, se recuperan el enlace y la configuración anteriores del nuevo host. No se modifica la configuración de otros sitios. nginx devuelve 404 para archivos ausentes en `/study/`.

## Servicio y datos persistentes

`api-current` apunta a la versión del servidor, fuera del directorio público. El servicio se ejecuta como `enarm-progress`, escucha solo en 127.0.0.1:4187 y recibe solicitudes mediante `/api/` de nginx. `GET /api/health` comprueba su salud. Las rutas de progreso requieren un código privado en la cabecera Authorization. SQLite conserva solo el hash del código.

La base vive en `/var/lib/enarm-contraste/progress.sqlite`, con permisos privados. Las publicaciones y sus recuperaciones nunca reemplazan esta base. Cada escritura usa una transacción con revisión esperada. La repetición de una solicitud confirmada devuelve el mismo resultado. Los conflictos devuelven 409. Las importaciones conservan una instantánea previa por perfil.

`enarm-progress-backup.timer` ejecuta una copia en línea cada noche. El despliegue hace otra copia antes de cambiar el servicio. Se conservan las 14 instantáneas más recientes, con fecha y hora distintas, bajo `/var/lib/enarm-contraste/backups/`. Incluyen el contenido confirmado del WAL. No copies solo el archivo SQLite mientras el servicio está activo.

```sh
ssh my-vps 'sudo systemctl status enarm-progress.service --no-pager'
ssh my-vps 'sudo systemctl start enarm-progress-backup.service'
curl -fsS https://enarm.musel.dev/api/health
```

Para restaurar datos, detén el servicio y conserva primero los archivos actuales. Usa una copia validada y restaura su propietario `enarm-progress`. Reinicia el servicio y comprueba el plan con un código conocido. No restaures una copia como parte de una recuperación de código: hacerlo puede borrar respuestas posteriores a esa copia.

## Comprobar la publicación

```sh
curl -fsS https://enarm.musel.dev/version.txt
PLAYWRIGHT_BASE_URL=https://enarm.musel.dev/ npm test
```

La aplicación usa un fragmento para elegir el eje. Por ejemplo: `https://enarm.musel.dev/#ictericia`.

## Recuperar una versión

El script conserva las versiones previas. Para volver a una versión independiente, el operador debe elegir el directorio exacto de `releases`, crear `site-current.next` hacia ese directorio y moverlo sobre `site-current` con `mv -Tf`. No hace falta cambiar nginx si la ubicación de la aplicación sigue igual.

## Comentarios y progreso

El plan diario se guarda en el VPS y mantiene una copia en IndexedDB. El código privado queda en el navegador. Permite conectar otro dispositivo al mismo perfil. Los comentarios y las marcas de práctica libre conservan su almacenamiento anterior en el navegador. Los comentarios se comparten con Descargar comentarios o Copiar texto. La publicación no envía comentarios de forma automática.

Al cambiar solo los archivos de la web se conservan los datos locales del navegador. La app usa claves propias con prefijo `enarm-contraste-`. No modifica datos del temporizador ni de otras aplicaciones del mismo dominio.

## Compatibilidad con la primera publicación

La primera muestra permanece en `https://timer.musel.dev/grind/enarm/` y usa el enlace `current`, que este despliegue no cambia. Permite abrir y exportar los comentarios guardados en ese origen. El nuevo subdominio tiene almacenamiento separado; no copia los comentarios de forma automática.
