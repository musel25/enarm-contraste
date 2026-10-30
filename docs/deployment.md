# Despliegue de ENARM Contraste

URL: https://enarm.musel.dev/.

La aplicación es estática. Se publica por SSH en el VPS existente, con el alias local `my-vps`. Tiene un virtual host y certificado propios. nginx sirve los archivos desde `/var/www/enarm-contraste/site-current/`. No requiere un servidor Node ni el sitio del temporizador para funcionar.

El registro DNS `enarm A 145.241.168.188`, TTL 60, se añadió con Chrome MCP en la cuenta Vercel del usuario. Se verificó en el servidor DNS autoritativo y en 1.1.1.1.

## Publicar

Requisitos locales: Node 22.12 o posterior compatible, npm, uv, Chrome, SSH, rsync y ripgrep. El usuario SSH debe poder ejecutar nginx, instalar archivos en `/var/www` y recargar nginx con `sudo -n`.

```sh
npm ci
uv sync
bash scripts/deploy.sh
```

El script exige un árbol limpio y un commit subido a la rama remota de seguimiento. La compilación genera ambos mazos y audita sus bases SQLite. Requiere la validación de fuentes y las revisiones de las 34 secciones. Después ejecuta las pruebas de Python y navegador. Copia solo `dist/` y escribe el commit completo en `version.txt`. No copia PDF, mazos originales, comentarios locales ni credenciales.

Cada publicación crea `/var/www/enarm-contraste/releases/<commit>-<fecha-UTC>-standalone/`. `scripts/setup-domain.sh` prepara únicamente el servidor HTTP de `enarm.musel.dev` y obtiene su certificado con Certbot, mediante el directorio de validación existente. `scripts/deploy.sh` instala `deploy/nginx-enarm.musel.dev.conf`, respalda la configuración previa y cambia `site-current` de forma atómica. Valida nginx antes de recargarlo.

Las comprobaciones validan el commit desde el origen y la URL pública, la página, JavaScript, el manifiesto, ambos mazos, la muestra anterior y la salud del temporizador. Si falla una comprobación remota, se recuperan el enlace y la configuración anteriores del nuevo host. No se modifica la configuración de otros sitios. nginx devuelve 404 para archivos ausentes en `/study/`.

## Comprobar la publicación

```sh
curl -fsS https://enarm.musel.dev/version.txt
PLAYWRIGHT_BASE_URL=https://enarm.musel.dev/ npm test
```

La aplicación usa un fragmento para elegir el eje. Por ejemplo: `https://enarm.musel.dev/#ictericia`.

## Recuperar una versión

El script conserva las versiones previas. Para volver a una versión independiente, el operador debe elegir el directorio exacto de `releases`, crear `site-current.next` hacia ese directorio y moverlo sobre `site-current` con `mv -Tf`. No hace falta cambiar nginx si la ubicación de la aplicación sigue igual.

## Comentarios y progreso

La muestra guarda comentarios y progreso en el navegador. Los comentarios se comparten con Descargar comentarios o Copiar texto. La publicación no recopila ni envía comentarios de forma automática. El navegador debe permitir descargas para exportar el archivo JSON.

Al cambiar solo los archivos de la web se conservan los datos locales del navegador. La app usa claves propias con prefijo `enarm-contraste-`. No modifica datos del temporizador ni de otras aplicaciones del mismo dominio.

## Compatibilidad con la primera publicación

La primera muestra permanece en `https://timer.musel.dev/grind/enarm/` y usa el enlace `current`, que este despliegue no cambia. Permite abrir y exportar los comentarios guardados en ese origen. El nuevo subdominio tiene almacenamiento separado; no copia los comentarios de forma automática.
