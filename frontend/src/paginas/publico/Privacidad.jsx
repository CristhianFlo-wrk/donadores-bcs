import MarcoPublico from '../../componentes/MarcoPublico.jsx';

// Igual a VERSION_AVISO_PRIVACIDAD del backend (auth.service.js): es la version que acepta el donante. Lo vigila backend/test/auth.test.js
export const VERSION_AVISO = '2026-11-09';

// shortcut: sin correo de contacto los derechos se ejercen con la administracion; poner el correo del responsable antes de produccion
const CORREO_PRIVACIDAD = '';

// Igual a DIAS_CONSERVACION_IP del backend (auditoria.service.js). Lo vigila backend/test/auth.test.js
export const DIAS_CONSERVACION_IP = 90;

const URL_LEY = 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf';

function Seccion({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function Lista({ elementos }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {elementos.map((texto) => <li key={texto}>{texto}</li>)}
    </ul>
  );
}

export default function Privacidad() {
  const contacto = CORREO_PRIVACIDAD
    ? <>escribiendo a <a href={'mailto:' + CORREO_PRIVACIDAD} className="font-medium text-red-700 underline">{CORREO_PRIVACIDAD}</a></>
    : 'a través de la administración del sistema';

  return (
    <MarcoPublico titulo="Aviso de privacidad" subtitulo="Vigencia 2026" ancho="max-w-2xl">
      <div className="space-y-6">
        <Seccion titulo="Quién es responsable de tus datos">
          <p>
            Donadores BCS es un proyecto académico de la carrera de Ingeniería en Desarrollo de Software de la Universidad Autónoma
            de Baja California Sur. No es un servicio oficial de la Secretaría de Salud ni de ningún banco de sangre.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos recabamos">
          <Lista
            elementos={[
              'Identificación y contacto: nombre completo, CURP, fecha de nacimiento, sexo (opcional), correo electrónico, teléfono (opcional), municipio y colonia.',
              'Datos sensibles de salud: tipo de sangre, peso (opcional), fechas de tus donaciones y si estás disponible para donar.',
              'Datos de otra persona: si pides sangre para alguien más, su nombre y su número de expediente. El nombre lo ven los donantes que reciben la alerta, para saber a quién ayudan; el expediente, solo el hospital que elijas y la administración del sistema.',
              'Mensaje y fotos (opcionales): si pides sangre puedes compartir un mensaje y hasta 3 fotos. Primero los revisa el hospital, que puede quitarlos; cuando confirma la solicitud los ven los donantes mientras siga activa. Las fotos se guardan sin la ubicación ni otros datos del celular. El mensaje y las fotos se borran 30 días después de que la solicitud se cierra. Solo compártelos con permiso de las personas que aparecen.',
              'Datos técnicos: dirección IP, fecha y hora, y la acción realizada (inicio de sesión, cambios en tu perfil, solicitudes y respuestas a alertas).'
            ]}
          />
        </Seccion>

        <Seccion titulo="Para qué los usamos">
          <Lista
            elementos={[
              'Crear y administrar tu cuenta de donante.',
              'Avisarte cuando un hospital necesite sangre compatible con la tuya en tu región.',
              'Coordinar tu asistencia con el hospital y registrar tus donaciones.',
              'Calcular cuándo puedes volver a donar.',
              'Proteger el sistema: limitar intentos de acceso, detectar accesos indebidos y llevar una bitácora de auditoría a prueba de alteraciones.'
            ]}
          />
          <p>No usamos tus datos para publicidad ni los vendemos.</p>
        </Seccion>

        <Seccion titulo="Con quién los compartimos">
          <p>
            Los hospitales ven de cada donante solo datos que no lo identifican: tipo de sangre, región, municipio, disponibilidad,
            fecha de su última donación y un código de asistencia. Nunca ven tu nombre, tu CURP, tu teléfono ni tu correo.
          </p>
          <p>No transferimos tus datos a otras personas o instituciones, salvo que lo requiera una autoridad competente.</p>
        </Seccion>

        <Seccion titulo="Cómo los protegemos">
          <Lista
            elementos={[
              'Tu nombre y tu teléfono se guardan cifrados con AES-256.',
              'Tu CURP se guarda solo como huella irreversible (HMAC-SHA256) y tu contraseña con bcrypt.',
              'Todas las conexiones viajan cifradas (HTTPS).',
              'Cada donación y cada acción del sistema se encadena con SHA-256: cualquier alteración se detecta.',
              'A la bitácora de auditoría entra solo una huella de tu IP; la IP completa se borra a los ' + DIAS_CONSERVACION_IP + ' días.'
            ]}
          />
        </Seccion>

        <Seccion titulo="Cuánto tiempo los conservamos">
          <p>
            Tus datos de cuenta se conservan mientras tu cuenta esté activa. La dirección IP se borra a los {DIAS_CONSERVACION_IP} días.
            El historial de donaciones y la bitácora de auditoría se conservan porque garantizan la integridad del sistema; no
            contienen tu nombre, tu CURP ni tu teléfono.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p>
            Tienes derecho a acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso (derechos ARCO), y a revocar tu
            consentimiento. Puedes consultar y corregir tus datos en tu perfil, y dejar de recibir alertas marcándote como no
            disponible. Para cualquier otra solicitud, comunícate {contacto}.
          </p>
        </Seccion>

        <Seccion titulo="Tu consentimiento">
          <p>
            Al crear tu cuenta das tu consentimiento expreso para que tratemos tus datos, incluidos los datos sensibles de salud,
            con las finalidades de este aviso. Queda registrado cuándo lo diste y qué versión del aviso aceptaste.
          </p>
        </Seccion>

        <Seccion titulo="Fundamentos">
          <p>
            El tratamiento de tus datos se rige por la{' '}
            <a href={URL_LEY} target="_blank" rel="noreferrer" className="font-medium text-red-700 underline">
              Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados
            </a>
            .
          </p>
        </Seccion>
      </div>
    </MarcoPublico>
  );
}
