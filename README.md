# Donadores BCS

Donadores BCS es un proyecto que busca facilitar la coordinación de donadores de sangre en Baja California Sur. La idea es que los hospitales puedan encontrar personas compatibles de manera más rápida y organizada, especialmente cuando necesitan sangre con urgencia.

Actualmente, cuando un hospital necesita una donación, muchas veces tiene que recurrir a llamadas telefónicas, grupos de WhatsApp o publicaciones en redes sociales. Estos métodos pueden funcionar, pero también hacen que encontrar a la persona adecuada tome más tiempo.

Con Donadores BCS buscamos mejorar ese proceso mediante un sistema en el que los donantes puedan registrarse, indicar su tipo de sangre y actualizar su disponibilidad. Cuando un hospital genera una solicitud, el sistema identifica a los donantes compatibles y les envía una notificación para que puedan responder.

El objetivo es aprovechar la tecnología para mejorar la comunicación entre hospitales y donantes, mantener un registro organizado de las donaciones y facilitar la atención de las solicitudes.

### Equipo de desarrollo

- Cristhian Iram Olivas Flores
- Henry Castro Bustillos
- María José Ochoa Beltrán
- Ashley América Campa Moreno

## ¿Cómo funciona el sistema?

El funcionamiento de Donadores BCS se divide en cinco pasos principales:

1. **Registro de donantes.** Las personas se registran con su CURP, tipo de sangre y colonia para que el sistema pueda identificarlas y considerar su ubicación al buscar donantes compatibles.
2. **Creación de solicitudes.** El personal del hospital registra la necesidad de sangre e indica si la solicitud es urgente o crítica.
3. **Búsqueda de donantes.** El sistema busca personas compatibles que estén disponibles y que no hayan donado durante los últimos 90 días. En las solicitudes urgentes, la búsqueda se realiza en la región del hospital; en las críticas, se amplía a todo el estado.
4. **Envío de notificaciones.** Los donantes seleccionados reciben una alerta y pueden confirmar o rechazar la invitación.
5. **Registro de la donación.** Cuando una persona acude al hospital y realiza la donación, el personal registra el evento para mantener actualizado su historial.

De esta manera, la información se mantiene organizada y los hospitales pueden dar seguimiento a las solicitudes desde un mismo sistema.

## Seguridad y protección de datos

Como el sistema maneja información personal y registros relacionados con las donaciones, la seguridad es una parte importante de su desarrollo.

El historial de donaciones utiliza una cadena de hashes SHA-256. Cada registro depende del anterior, lo que permite detectar modificaciones o eliminaciones no autorizadas cuando se verifica la integridad de la cadena.

Además, el sistema cuenta con una bitácora de auditoría que registra acciones importantes, como los inicios de sesión, la creación de solicitudes y las respuestas a las notificaciones.

Para proteger la información se utilizan diferentes mecanismos:

- **AES-256:** cifra datos personales, como nombres y teléfonos.
- **bcrypt:** protege las contraseñas almacenadas.
- **HMAC:** permite trabajar con la CURP sin guardarla directamente en la base de datos.
- **JWT:** permite autenticar a los usuarios y controlar el acceso a las rutas protegidas.
- **SHA-256:** ayuda a verificar la integridad del historial de donaciones y detectar alteraciones.

Estas medidas forman parte de la protección de la información, aunque su implementación y configuración deben revisarse antes de utilizar el sistema con datos reales.

## Tecnologías utilizadas

Para desarrollar Donadores BCS se utilizan las siguientes tecnologías:

- **Node.js:** entorno de ejecución del backend.
- **Express 5:** framework utilizado para crear la API.
- **PostgreSQL 16:** base de datos para almacenar la información.
- **Docker:** facilita la ejecución del entorno de desarrollo.
- **JWT:** autenticación de usuarios.
- **bcrypt:** protección de contraseñas.
- **AES-256 y HMAC:** mecanismos de protección de datos.
- **SHA-256:** verificación de integridad de los registros.
- **node:test y Supertest:** herramientas utilizadas para las pruebas automatizadas.
- **React, Vite y Tailwind CSS:** tecnologías previstas para el frontend, que se encuentra en desarrollo.
- **PWA:** enfoque para convertir la aplicación web en una experiencia similar a la de una aplicación instalada.
- **Render:** plataforma utilizada para desplegar el backend.
- **Vercel:** plataforma prevista para desplegar el frontend.

Por ahora, las notificaciones push y los mensajes SMS se simulan en la consola. El proyecto está preparado para integrar Firebase cuando se configure el servicio correspondiente.

## Cómo ejecutar el proyecto en tu computadora

Para instalar y ejecutar el proyecto localmente, necesitas tener lo siguiente:

- Node.js 20 o una versión posterior.
- Docker Desktop.

### 1. Iniciar Docker

Abre una terminal en la carpeta raíz del proyecto y ejecuta:

```bash
docker compose up -d
```

Esto iniciará los servicios definidos en el archivo `docker-compose.yml`, incluida la base de datos utilizada durante el desarrollo.

### 2. Instalar las dependencias

Entra a la carpeta del backend:

```bash
cd backend
npm install
```

Después, crea el archivo de variables de entorno:

```bash
cp .env.example .env
```

Si trabajas en Windows y el comando `cp` no está disponible en tu terminal, puedes copiar `.env.example` manualmente y guardar la copia con el nombre `.env`.

### 3. Inicializar la base de datos

Ejecuta el siguiente comando:

```bash
npm run init-db
```

Este script prepara la base de datos de desarrollo y carga los datos iniciales necesarios para realizar pruebas.

**Importante:** el comando elimina y vuelve a crear la base de datos de desarrollo. Si ya habías registrado donantes o guardado información, esos datos se perderán.

### 4. Iniciar el servidor

Una vez completada la configuración, ejecuta:

```bash
npm run dev
```

Para comprobar que el backend está funcionando, abre la siguiente dirección en tu navegador:

[http://localhost:3000/api/health](http://localhost:3000/api/health)

Si todo está configurado correctamente, la respuesta debe incluir `ok: true`.

### 5. Iniciar el frontend

Con el backend encendido, abre otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en [http://localhost:5173](http://localhost:5173). En desarrollo, Vite redirige las peticiones `/api` al backend en el puerto 3000, así que no hace falta configurar variables. La misma aplicación se adapta al rol de quien inicia sesión: vista móvil para donantes y panel web para hospitales y administradores. La guía visual está en `frontendContext/frontContext.md`.

## Usuarios de prueba

Al inicializar la base de datos se crea una cuenta de administrador y una cuenta para cada uno de los ocho hospitales de prueba.

**Administrador**

- Correo: `admin@demo.donadores.mx`
- Contraseña: `Admin12345`

**Hospitales**

- Correos: desde `hospital1@demo.donadores.mx` hasta `hospital8@demo.donadores.mx`.
- Contraseña para las cuentas de hospital: `Hospital123`.
- El número incluido en el correo corresponde al ID del hospital.

Para probar el sistema como donante, puedes registrar una cuenta mediante el endpoint `POST /api/auth/registro`.

Estas cuentas son exclusivamente para desarrollo y pruebas. No se crean automáticamente en el entorno de producción.

## Configuración de las variables de entorno

El archivo `.env.example` contiene las variables que necesita el backend para funcionar.

Primero, crea tu archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Los valores de ejemplo sirven para comenzar en desarrollo, pero en producción debes utilizar claves nuevas y seguras.

Para generar una clave aleatoria de 32 bytes con Node.js, puedes ejecutar:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables principales

- **`DATABASE_URL`:** contiene la dirección de conexión a PostgreSQL.
- **`AES_KEY`:** se utiliza para cifrar nombres y teléfonos.
- **`HASH_KEY`:** se utiliza para generar el HMAC de la CURP.
- **`JWT_SECRET`:** permite firmar los tokens de autenticación. En producción debe tener al menos 32 caracteres.
- **`CORS_ORIGIN`:** indica el dominio autorizado para realizar solicitudes desde el frontend. Es obligatoria en producción.

También existen otras variables opcionales, como `LOGIN_MAX_INTENTOS`, las relacionadas con Firebase y las que utiliza el script de creación del administrador. Puedes consultar su funcionamiento en `.env.example`.

El servidor revisa la configuración al arrancar y no inicia si falta alguna variable obligatoria.

### Consideraciones sobre las claves

Cuando el sistema comience a almacenar datos reales, es importante tener cuidado al cambiar las claves de seguridad.

- Si cambias `AES_KEY` sin migrar los datos cifrados, podrías perder acceso a la información personal almacenada.
- Si cambias `HASH_KEY`, los HMAC existentes de las CURP podrían dejar de coincidir.
- Si cambias `JWT_SECRET`, los tokens firmados con la clave anterior dejarán de ser válidos.

Por eso, las claves deben almacenarse de forma segura y cualquier cambio debe realizarse con un procedimiento de migración adecuado.

## Comandos disponibles

Los siguientes comandos se ejecutan desde la carpeta `backend`.

- **`npm run dev`:** inicia el servidor en modo desarrollo y reinicia automáticamente cuando detecta cambios.
- **`npm start`:** inicia el servidor en modo normal. Es el comando utilizado por Render.
- **`npm run init-db`:** elimina y reconstruye la base de datos de desarrollo. Está bloqueado en producción.
- **`npm run init-db:prod`:** crea las tablas que falten y carga los catálogos sin borrar los datos existentes.
- **`npm run crear-admin`:** crea una cuenta de administrador utilizando las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
- **`npm test`:** ejecuta las pruebas automatizadas del proyecto.

## API del sistema

La API permite que el frontend se comunique con el backend para consultar información, registrar donantes, administrar solicitudes y gestionar notificaciones.

Las respuestas siguen una estructura común:

- `ok: true` indica que la operación se completó correctamente.
- `ok: false` indica que ocurrió un error.
- `error` proporciona información sobre el problema cuando una operación falla.

Los nombres de los campos utilizan el formato `snake_case`.

### Autenticación en rutas protegidas

Las rutas que requieren autenticación deben recibir un token JWT en el encabezado `Authorization`:

```http
Authorization: Bearer <token>
```

El sistema maneja tres roles: donante, hospital y administrador.

- **Donante:** puede administrar su perfil, cambiar su disponibilidad, responder notificaciones y consultar su historial.
- **Hospital:** puede crear y administrar solicitudes relacionadas con su propio hospital.
- **Administrador:** puede gestionar usuarios, consultar reportes y revisar los registros de auditoría.

Cuando se menciona al *hospital dueño* de una solicitud, se hace referencia al hospital que la creó y que tiene permiso para administrarla.

### Catálogos y hospitales

Los siguientes endpoints permiten consultar información de ubicación y tipos de sangre sin iniciar sesión:

- **`GET /api/ubicaciones/municipios`:** obtiene la lista de municipios.
- **`GET /api/ubicaciones/colonias/:idMunicipio`:** obtiene las colonias correspondientes a un municipio.
- **`GET /api/ubicaciones/tipos-sangre`:** obtiene los tipos de sangre disponibles.

Para consultar la información de los hospitales es necesario iniciar sesión:

- **`GET /api/hospitales`:** consulta la lista de hospitales.
- **`GET /api/hospitales/:id`:** consulta la información de un hospital específico.

### Cuentas y autenticación

- **`POST /api/auth/registro`**
  - Permite registrar una nueva cuenta de donante.
  - No requiere una sesión previa.

- **`POST /api/auth/login`**
  - Permite iniciar sesión.
  - Está disponible para cualquier usuario registrado.

- **`GET /api/auth/perfil`**
  - Devuelve la información del usuario que inició sesión.
  - Requiere autenticación.

- **`GET /api/auth/usuarios`**
  - Permite consultar los usuarios registrados.
  - Solo está disponible para administradores.

- **`POST /api/auth/usuarios`**
  - Permite crear cuentas de hospital u otras cuentas de administrador.
  - Solo está disponible para administradores.

- **`PATCH /api/auth/usuarios/:id/activo`**
  - Permite activar o desactivar una cuenta.
  - Solo está disponible para administradores.

El sistema también limita los intentos fallidos de inicio de sesión desde una misma dirección IP. Cuando se supera el límite configurado, el servidor responde con el código HTTP `429` y es necesario esperar unos minutos antes de volver a intentarlo.

### Gestión de donantes

- **`GET /api/donantes/perfil`:** permite al donante consultar su perfil.
- **`PUT /api/donantes/perfil`:** permite al donante actualizar su información.
- **`PATCH /api/donantes/disponibilidad`:** permite cambiar la disponibilidad para donar.
- **`GET /api/donantes/stats`:** permite consultar las estadísticas del donante.
- **`PUT /api/donantes/fcm-token`:** permite registrar el token del dispositivo para recibir notificaciones push.
- **`GET /api/donantes/compatibles/:idTipoSangre`:** permite a hospitales y administradores consultar donantes compatibles con un tipo de sangre.

Los permisos de cada endpoint se aplican según el rol del usuario autenticado.

### Solicitudes y notificaciones

- **`GET /api/solicitudes`:** permite consultar las solicitudes disponibles. Los donantes solo pueden ver las activas.
- **`GET /api/solicitudes/:id`:** permite consultar una solicitud específica.
- **`POST /api/solicitudes`:** permite a hospitales y administradores crear solicitudes de donación. Campos: `id_tipo_sangre`, `urgencia` (`urgente` o `critica`), `unidades_requeridas` (opcional, entero de 1 a 20, por defecto 1) y `descripcion` (opcional). El detalle y el listado devuelven `unidades_requeridas`; el listado agrega `unidades_donadas`.
- **`GET /api/solicitudes/:id/candidatos`:** permite al hospital dueño y al administrador consultar los posibles donantes de una solicitud.
- **`PATCH /api/solicitudes/:id/cerrar`:** permite al hospital dueño y al administrador cerrar una solicitud.
- **`POST /api/notificaciones/notificar`:** permite al hospital dueño y al administrador enviar notificaciones a los donantes seleccionados.
- **`GET /api/notificaciones/mis-notificaciones`:** permite al donante consultar las notificaciones que ha recibido.
- **`PATCH /api/notificaciones/:id/responder`:** permite al donante que recibió la notificación confirmar o rechazar la invitación.
- **`PATCH /api/notificaciones/:id/donacion`:** permite al hospital dueño y al administrador registrar una donación asociada a una notificación.

Una solicitud que ya está completada todavía permite registrar a una persona que acudió a donar. En cambio, las solicitudes canceladas ya no permiten registrar nuevas donaciones.

### Historial, auditoría y reportes

- **`GET /api/auditoria/mi-historial`:** permite al donante consultar su historial de donaciones.
- **`GET /api/auditoria/notificacion/:id`:** permite al hospital dueño y al administrador consultar el historial del donante relacionado con una notificación.
- **`GET /api/auditoria/verificar/:hash`:** permite al administrador verificar la integridad de un registro mediante su hash.
- **`GET /api/auditoria/historial/:hash`:** permite al administrador consultar el historial relacionado con un hash.
- **`GET /api/auditoria/estado`:** permite al administrador consultar el estado de la auditoría.
- **`GET /api/reportes/dashboard`:** permite consultar los reportes del sistema. Los hospitales solo pueden acceder a la información de su propio hospital, mientras que el administrador dispone de acceso administrativo.

## Pruebas automatizadas

Las pruebas automatizadas ayudan a comprobar que las funciones del sistema trabajan correctamente y que los permisos de acceso se respetan.

Para ejecutar las pruebas, entra a la carpeta del backend y utiliza:

```bash
cd backend
npm test
```

Las pruebas trabajan con una base de datos independiente llamada `donadores_bcs_test`, que se crea automáticamente. Esto evita afectar los datos utilizados durante el desarrollo.

Para ejecutarlas, necesitas tener Docker encendido.

Entre los casos que se prueban se encuentran:

- El funcionamiento de los endpoints de la API.
- Los permisos correspondientes a cada rol.
- Los intentos simultáneos de dos hospitales por registrar una misma donación.
- La detección de alteraciones manuales en el historial.
- El rendimiento de la búsqueda de donantes compatibles.

También se incluye una prueba de rendimiento con 150 donantes, cuyo objetivo es comprobar que la búsqueda de personas compatibles se complete en menos de tres segundos.

Las pruebas también se ejecutan solas en GitHub Actions (`.github/workflows/tests.yml`) en cada push o pull request que modifique la carpeta `backend`, con una base PostgreSQL 16 temporal. El resultado aparece como una marca verde o roja junto a cada commit.

## Pruebas manuales con Postman

En `docs/postman/donadores-bcs.postman_collection.json` hay una colección con el flujo completo: catálogos, inicio de sesión de cada rol, registro del donante, creación de una solicitud, notificación, confirmación, registro de la donación, verificación del historial, administración y algunos casos de error esperados.

Para usarla:

1. Importa el archivo en Postman.
2. Con el servidor encendido, abre la colección y usa **Run collection** para ejecutar las carpetas en orden. Los tokens y los ids se guardan solos en las variables de la colección.
3. Para probar el despliegue, cambia la variable `baseUrl` por la URL de Render y las credenciales por las de producción.

También se puede correr desde la terminal con newman:

```bash
npx newman run docs/postman/donadores-bcs.postman_collection.json
```

El flujo completo funciona una vez por donante cada 90 días, porque después de registrar la donación el donante deja de ser compatible. Para repetirlo en desarrollo, ejecuta `npm run init-db` o cambia la variable `donanteEmail` y la CURP del registro.

## Despliegue

Todo se despliega en planes gratuitos: el backend en Render, la base de datos PostgreSQL en Neon y el frontend en Vercel. Se usa Neon porque la base gratuita de Render caduca a los 30 días.

### 1. Crear la base de datos en Neon

Crea un proyecto en [Neon](https://neon.com) en la región **AWS us-west-2 (Oregon)** y copia la cadena de conexión (incluye `sslmode=require`). Será la `DATABASE_URL`.

### 2. Crear el servicio web en Render

En Render, crea un **Web Service** gratuito en la región Oregon, conectado al repositorio.

Configura la carpeta `backend` como directorio de trabajo y utiliza los siguientes comandos:

- **Build Command:** `npm ci`
- **Health Check Path:** `/api/health`
- **Start Command:** `npm start`

### 3. Configurar las variables de entorno

En la configuración del servicio agrega las siguientes variables:

- **`NODE_ENV`:** establece el valor `production`.
- **`DATABASE_URL`:** la cadena de conexión de Neon.
- **`AES_KEY`:** configura una clave nueva y segura.
- **`HASH_KEY`:** configura otra clave nueva y segura.
- **`JWT_SECRET`:** utiliza un secreto seguro de al menos 32 caracteres.
- **`CORS_ORIGIN`:** indica el dominio del frontend desplegado en Vercel.

No reutilices las claves de desarrollo ni publiques los secretos en el repositorio.

### 4. Preparar la base de datos

Este paso se hace desde tu computadora con la cadena de conexión de Neon. En PowerShell, dentro de la carpeta `backend`:

```powershell
$env:NODE_ENV="production"; $env:DATABASE_URL="<cadena de conexion de Neon>"
npm run init-db:prod
```

Este comando crea las tablas que falten y carga los catálogos sin eliminar los datos existentes.

### 5. Crear la cuenta de administrador

En la misma terminal, define el correo y la contraseña del administrador y ejecuta:

```powershell
$env:ADMIN_EMAIL="<correo>"; $env:ADMIN_PASSWORD="<contraseña segura>"
npm run crear-admin
```

Utiliza una dirección de correo válida y una contraseña segura. Al terminar cierra esa terminal para que las variables no se queden en la sesión.

### 6. Desplegar el frontend en Vercel

Importa el repositorio en Vercel con estos ajustes:

- **Root Directory:** `frontend` (Vercel detecta Vite y usa `npm run build`).
- **Variable `VITE_API_URL`:** la URL del servicio de Render, sin `/api` al final.

El archivo `frontend/vercel.json` redirige todas las rutas a `index.html` para que funcionen las recargas de página. Al terminar, copia el dominio de Vercel en la variable `CORS_ORIGIN` de Render.

### 7. Crear las cuentas de los hospitales

Inicia sesión como administrador en el frontend y crea las cuentas de cada hospital en **Usuarios**.

### 8. Evitar el arranque en frío

El servicio gratuito de Render se duerme tras 15 minutos sin tráfico y tarda cerca de un minuto en despertar. Para la demostración, programa un ping a `https://<servicio>.onrender.com/api/health` cada 10 minutos (por ejemplo con cron-job.org).

## Estado actual del proyecto

Donadores BCS reúne las funciones necesarias para organizar el registro de donantes, gestionar solicitudes de sangre y mantener un historial de donaciones con mecanismos de verificación de integridad.

El backend cuenta con endpoints para la autenticación, los donantes, las solicitudes, las notificaciones, la auditoría y los reportes. El frontend cubre los flujos de los tres roles y es instalable como PWA: se agrega a la pantalla de inicio del celular y la interfaz abre sin conexión (los datos siempre se piden al servidor). Las notificaciones push y SMS todavía se simulan en consola.

La integración con Firebase y el desarrollo del frontend forman parte de los siguientes pasos para ampliar las funcionalidades del sistema.

## Conclusión

Donadores BCS nace con la intención de hacer más sencilla y organizada la comunicación entre los hospitales y las personas dispuestas a donar sangre en Baja California Sur.

Al centralizar la información, facilitar la búsqueda de donantes compatibles y mantener un registro de las solicitudes y donaciones, el proyecto busca contribuir a una mejor coordinación en situaciones donde el tiempo puede ser importante.

Además de desarrollar una solución tecnológica, el proyecto busca aprovechar las herramientas de desarrollo web y seguridad informática para atender una necesidad real de la comunidad.