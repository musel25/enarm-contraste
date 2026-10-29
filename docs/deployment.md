# Despliegue de la muestra

URL: https://timer.musel.dev/grind/enarm/.

La aplicación es estática. Se publica por SSH en el VPS existente, con el alias local `my-vps`. nginx sirve los archivos desde `/var/www/enarm-contraste/current/`. No se instala un servidor Node en producción.

## Publicar

Requisitos locales: Node 22.12 o posterior compatible, npm, Chrome, SSH, rsync y ripgrep. El usuario SSH debe poder ejecutar nginx, instalar archivos en `/var/www` y recargar nginx con `sudo -n`.

```sh
npm ci
npm test
npm run build
bash scripts/deploy.sh
```

El script exige un árbol limpio y un commit subido a la rama remota de seguimiento. Ejecuta las pruebas y compila antes de copiar solo `dist/`. Escribe el commit completo en `version.txt`. No copia PDF, comentarios locales ni credenciales.

Cada publicación crea `/var/www/enarm-contraste/releases/<commit>-<fecha-UTC>/`. El script respalda `/etc/nginx/sites-available/timer.musel.dev`, añade una ubicación específica antes de `/grind/` y cambia `current` de forma atómica. Valida la configuración antes de recargar nginx.

Las comprobaciones validan el commit desde el origen y desde la URL pública, la página, el archivo JavaScript y las rutas existentes de Grind Recall, Capital One y salud del temporizador. Si falla una comprobación remota, se recuperan el enlace y la configuración anteriores.

## Comprobar la publicación

```sh
curl -fsS https://timer.musel.dev/grind/enarm/version.txt
PLAYWRIGHT_BASE_URL=https://timer.musel.dev/grind/enarm/ npm test
```

La aplicación usa un fragmento de URL para elegir el eje. Por ejemplo: `https://timer.musel.dev/grind/enarm/#ictericia`. No requiere rutas adicionales de aplicación en nginx.

## Recuperar una versión

El script conserva las versiones previas. Para volver a una versión, el operador debe elegir el directorio exacto de `releases`, crear `current.next` hacia ese directorio y moverlo sobre `current` con `mv -Tf`. No hace falta cambiar nginx si la ubicación de la aplicación sigue igual.

## Comentarios y progreso

La muestra guarda comentarios y progreso en el navegador. Los comentarios se comparten con Descargar comentarios o Copiar texto. La publicación no recopila ni envía comentarios de forma automática. El navegador debe permitir descargas para exportar el archivo JSON.

Al cambiar solo los archivos de la web se conservan los datos locales del navegador. La app usa claves propias con prefijo `enarm-contraste-`. No modifica datos del temporizador ni de otras aplicaciones del mismo dominio.
