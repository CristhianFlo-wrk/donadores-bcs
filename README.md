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

1. Registro de donantes. Las personas se registran con su CURP, tipo de sangre y colonia para que el sistema pueda identificarlas y considerar su ubicación al buscar donantes compatibles.
2. Creación de solicitudes. El personal del hospital registra la necesidad de sangre e indica si la solicitud es crítica, urgente o normal (programada). Un donante también puede pedir sangre para sí mismo o para otra persona (solicitud ciudadana).
3. Búsqueda de donantes. El sistema busca personas compatibles que estén disponibles y que no hayan donado durante los últimos 90 días. En las solicitudes urgentes y normales, la búsqueda se realiza en la región del hospital; en las críticas, se amplía a todo el estado.
4. Envío de notificaciones. Los donantes seleccionados reciben una alerta y pueden confirmar o rechazar la invitación. Rechazar siempre se puede; para confirmar debe estar disponible, fuera del periodo de espera entre donaciones y sin otra asistencia confirmada en una solicitud activa (409).
5. Registro de la donación. Cuando una persona acude al hospital y realiza la donación, el personal registra el evento para mantener actualizado su historial.

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
- **Render:** plataforma utilizada para desplegar el backend.
- **Vercel:** plataforma prevista para desplegar el frontend.

Por ahora, las notificaciones push se simulan en la consola. El sistema no envía SMS. El proyecto está preparado para integrar Firebase cuando se configure el servicio correspondiente.

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

Al inicializar la base de datos se crea una cuenta de administrador, una de auditor y una cuenta para cada uno de los ocho hospitales de prueba.

**Administrador**

- Correo: `admin@demo.donadores.mx`
- Contraseña: `Admin12345`

**Auditor (solo lectura de la auditoría)**

- Correo: `auditor@demo.donadores.mx`
- Contraseña: `Auditor123`
- Solo ve Auditoría y Constancias; no puede crear, modificar ni cerrar nada. Pensado para quien revisa el sistema desde fuera, por ejemplo un auditor de gobierno.

**Hospitales**

- Correos: desde `hospital1@demo.donadores.mx` hasta `hospital8@demo.donadores.mx`.
- Contraseña para las cuentas de hospital: `Hospital123`.
- El número incluido en el correo corresponde al ID del hospital.

Para probar el sistema como donante, puedes registrar una cuenta mediante el endpoint `POST /api/auth/registro`.

Estas cuentas son exclusivamente para desarrollo y pruebas. No se crean automáticamente en el entorno de producción.

