import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import { donantes, hospitales, solicitudes, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { AreaTexto, Aviso, Boton, Campo, Cargando, EncabezadoPagina, EnlaceBoton, FichaSangre, Panel, Selector, SelectorUnidades } from '../../componentes/ui.jsx';
import { textoUrgencia } from '../../componentes/insignias.jsx';
import { puedeRecibirDe } from '../../utils/compatibilidad.js';
import { IMAGENES_MAXIMAS, prepararFoto } from '../../utils/imagen.js';

// Lenguaje sencillo. El hospital confirma la solicitud y su urgencia antes de que se avise a nadie
const URGENCIAS = [
  { valor: 'normal', titulo: 'Tiene una cirugía o tratamiento programado', detalle: 'Al confirmarla el hospital, se avisa a donantes de su región.' },
  { valor: 'urgente', titulo: 'El médico dijo que necesita sangre en estos días', detalle: 'Al confirmarla el hospital, se avisa a donantes de su región.' },
  { valor: 'critica', titulo: 'El médico dijo que la necesita de inmediato', detalle: 'Al confirmarla el hospital, se avisa a donantes de todo el estado.' }
];

const ANILLO_URGENCIA = {
  critica: 'bg-red-50 ring-2 ring-red-600',
  urgente: 'bg-amber-50 ring-2 ring-amber-500',
  normal: 'bg-gray-50 ring-2 ring-gray-500'
};

const CLASES_OPCION = 'cursor-pointer rounded-lg p-4 ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento-600 ';
const OPCION_LIBRE = 'bg-white ring-1 ring-gray-200 hover:bg-gray-50';

// Misma estructura que Nueva solicitud del hospital: formulario a la izquierda y resumen fijo a la derecha
export default function PedirSangre() {
  const navegar = useNavigate();
  const consultaPerfil = useConsulta(() => donantes.perfil());
  const consultaMias = useConsulta(() => solicitudes.mias());
  const consultaHospitales = useConsulta(() => hospitales.listar());
  const consultaTipos = useConsulta(() => ubicaciones.tiposSangre());

  const [paraSiMismo, setParaSiMismo] = useState(null);
  const [nombre, setNombre] = useState('');
  const [expediente, setExpediente] = useState('');
  const [idHospital, setIdHospital] = useState('');
  const [idTipo, setIdTipo] = useState('');
  const [urgencia, setUrgencia] = useState('');
  const [unidades, setUnidades] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [historia, setHistoria] = useState('');
  const [fotos, setFotos] = useState([]);
  const [consentimientoPublico, setConsentimientoPublico] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (consultaPerfil.cargando || consultaMias.cargando) return <Cargando />;
  if (consultaPerfil.error) return <Aviso>{consultaPerfil.error.message}</Aviso>;
  if (consultaMias.error) return <Aviso>{consultaMias.error.message}</Aviso>;

  const perfil = consultaPerfil.datos.perfil;
  const { faltas, solicitudes: mias } = consultaMias.datos;
  const tipos = consultaTipos.datos?.tipos || [];
  const encabezado = (
    <EncabezadoPagina
      titulo="Pedir sangre"
      descripcion="El hospital revisa que el paciente esté ahí y, al confirmarla, avisamos a los donantes compatibles."
      volver={{ ruta: '/donante/solicitudes', texto: 'Mis solicitudes' }}
    />
  );

  const bloqueo = faltas >= 2
    ? 'No puedes crear solicitudes: tu cuenta tiene solicitudes marcadas como falsas.'
    : mias.some((s) => s.estado === 'activa') && 'Ya tienes una solicitud activa. Cancélala o espera a que se cierre para pedir otra.';
  if (bloqueo) {
    return (
      <>
        {encabezado}
        <Aviso tono={faltas >= 2 ? 'error' : 'info'}>{bloqueo}</Aviso>
        <EnlaceBoton to="/donante/solicitudes" variante="contorno" className="mt-4">Ver mis solicitudes</EnlaceBoton>
      </>
    );
  }

  // "Para mi" prellena nombre y tipo con los del perfil; se pueden editar
  function elegirDestinatario(paraMi) {
    setParaSiMismo(paraMi);
    setNombre(paraMi ? perfil.nombre_completo : '');
    setIdTipo(paraMi ? String(tipos.find((t) => t.codigo === perfil.tipo_sangre)?.id || '') : '');
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    if (paraSiMismo === null) return setError('Indica para quién es la solicitud.');
    if (nombre.trim().length < 3) return setError('Escribe el nombre del paciente (mínimo 3 letras).');
    if (!idHospital) return setError('Selecciona el hospital donde está el paciente.');
    if (!idTipo) return setError('Selecciona el tipo de sangre del paciente.');
    if (!urgencia) return setError('Indica qué tan pronto se necesita la sangre.');
    if (!consentimiento) return setError('Confirma la autorización para compartir el nombre del paciente.');
    if (compartePublico && !consentimientoPublico) return setError('Confirma que tienes permiso para mostrar el mensaje y las fotos a los donantes.');

    const datos = {
      consentimiento: true,
      para_si_mismo: paraSiMismo,
      paciente_nombre: nombre.trim(),
      id_hospital: Number(idHospital),
      id_tipo_sangre: Number(idTipo),
      urgencia,
      unidades_requeridas: unidades
    };
    if (expediente.trim()) datos.paciente_expediente = expediente.trim();
    if (descripcion.trim()) datos.descripcion = descripcion.trim();
    if (historia.trim()) datos.historia = historia.trim();
    if (fotos.length > 0) datos.imagenes = fotos.map((f) => f.dataUrl);
    if (compartePublico) datos.consentimiento_publico = true;

    setEnviando(true);
    try {
      await solicitudes.crearCiudadana(datos);
      const texto = 'Solicitud enviada. El hospital la revisará y, al confirmarla, avisará a los donantes compatibles.';
      navegar('/donante/solicitudes', { state: { aviso: texto } });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  const compartePublico = historia.trim() !== '' || fotos.length > 0;
  const tipoElegido = tipos.find((t) => String(t.id) === idTipo)?.codigo;
  const hospitalElegido = (consultaHospitales.datos?.hospitales || []).find((h) => String(h.id) === idHospital);
  const urgenciaElegida = URGENCIAS.find((u) => u.valor === urgencia);

  return (
    <>
      {encabezado}

      <form onSubmit={enviar} className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" noValidate>
        <div className="min-w-0 space-y-6">
          <div className="grid items-start gap-6 2xl:grid-cols-2">
            <Panel titulo="¿Para quién es?">
              <fieldset>
                <legend className="sr-only">¿Para quién es?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[{ valor: true, texto: 'Para mí' }, { valor: false, texto: 'Para otra persona' }].map((o) => (
                    <label key={o.texto} className={CLASES_OPCION + (paraSiMismo === o.valor ? 'bg-acento-50 ring-2 ring-acento-600' : OPCION_LIBRE)}>
                      <input type="radio" name="destinatario" className="sr-only" checked={paraSiMismo === o.valor} onChange={() => elegirDestinatario(o.valor)} />
                      <span className="block text-sm font-semibold text-gray-900">{o.texto}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Panel>

            <Panel titulo="Paciente">
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-1">
                <Campo etiqueta="Nombre del paciente" id="paciente-nombre" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" required />
                <Campo
                  etiqueta="Número de expediente (opcional)"
                  id="paciente-expediente"
                  maxLength={40}
                  value={expediente}
                  onChange={(e) => setExpediente(e.target.value)}
                  ayuda="Solo lo ven el hospital y el administrador."
                  autoComplete="off"
                />
              </div>
            </Panel>
          </div>

          <Panel titulo="Hospital">
            <Selector
              etiqueta="Hospital donde está el paciente"
              id="hospital"
              className="md:max-w-md"
              value={idHospital}
              onChange={(e) => setIdHospital(e.target.value)}
              opciones={(consultaHospitales.datos?.hospitales || []).map((h) => ({ valor: String(h.id), texto: h.nombre }))}
            />
          </Panel>

          <Panel titulo="Tipo de sangre del paciente">
            <fieldset>
              <legend className="sr-only">Tipo de sangre del paciente</legend>
              {consultaTipos.cargando ? <Cargando /> : (
                <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
                  {tipos.map((t) => (
                    <label
                      key={t.id}
                      className={'cursor-pointer rounded-lg py-3 text-center text-lg font-bold ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento-600 ' +
                        (idTipo === String(t.id) ? 'bg-red-50 text-red-700 ring-2 ring-red-600' : 'bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50')}
                    >
                      <input type="radio" name="tipo" value={t.id} className="sr-only" checked={idTipo === String(t.id)} onChange={(e) => setIdTipo(e.target.value)} />
                      {t.codigo}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </Panel>

          <div className="grid items-start gap-6 2xl:grid-cols-2">
            <Panel titulo="¿Qué tan pronto se necesita?">
              <fieldset>
                <legend className="sr-only">¿Qué tan pronto se necesita?</legend>
                <div className="grid gap-2 sm:grid-cols-3 2xl:grid-cols-1">
                  {URGENCIAS.map((u) => (
                    <label key={u.valor} className={CLASES_OPCION + (urgencia === u.valor ? ANILLO_URGENCIA[u.valor] : OPCION_LIBRE)}>
                      <input type="radio" name="urgencia" value={u.valor} className="sr-only" checked={urgencia === u.valor} onChange={(e) => setUrgencia(e.target.value)} />
                      <span className="block text-sm font-semibold text-gray-900">{u.titulo}</span>
                      <span className="mt-0.5 block text-sm text-gray-700">{u.detalle}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Panel>

            <Panel titulo="Detalle">
              <div className="space-y-5">
                <SelectorUnidades valor={unidades} alCambiar={setUnidades} />
                <AreaTexto
                  etiqueta="Nota para el hospital (opcional)"
                  id="descripcion"
                  rows={3}
                  maxLength={500}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Cirugía el lunes por la mañana"
                  ayuda="No incluyas diagnósticos ni datos médicos."
                />
              </div>
            </Panel>
          </div>

          <Panel titulo="Cuéntales a los donantes" detalle="Opcional. Lo verán cuando el hospital confirme la solicitud; el hospital lo revisa antes.">
            <div className="space-y-5">
              <AreaTexto
                etiqueta="Mensaje"
                id="historia"
                rows={4}
                maxLength={HISTORIA_MAXIMA}
                value={historia}
                onChange={(e) => setHistoria(e.target.value)}
                placeholder="Ej. Mi papá tiene 62 años y lo operan del corazón el lunes. Cualquier ayuda cuenta."
                ayuda={historia.length + ' de ' + HISTORIA_MAXIMA + ' caracteres. No incluyas teléfonos, direcciones ni diagnósticos.'}
              />
              <SelectorFotos fotos={fotos} alCambiar={setFotos} alFallar={setError} />
              {compartePublico && (
                <label className="flex items-start gap-3 text-sm text-gray-800">
                  <input type="checkbox" checked={consentimientoPublico} onChange={(e) => setConsentimientoPublico(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-acento-600" />
                  Autorizo que los donantes vean este mensaje y estas fotos, y tengo permiso de las personas que aparecen en ellas.
                </label>
              )}
            </div>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-8">
          <Panel titulo="Resumen">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-600">Tipo</dt>
                <dd>{tipoElegido ? <FichaSangre tipo={tipoElegido} tamano="sm" /> : <span className="text-gray-500">Sin elegir</span>}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Urgencia</dt>
                <dd className="text-right font-medium text-gray-900">
                  {urgenciaElegida ? textoUrgencia(urgencia) : <span className="font-normal text-gray-500">Sin elegir</span>}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Unidades</dt>
                <dd className="font-medium tabular-nums text-gray-900">{unidades}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-gray-600">Hospital</dt>
                <dd className="text-right font-medium text-gray-900">{hospitalElegido ? hospitalElegido.nombre : <span className="font-normal text-gray-500">Sin elegir</span>}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-gray-600">Para los donantes</dt>
                <dd className={'text-right ' + (compartePublico ? 'font-medium text-gray-900' : 'text-gray-500')}>{textoCompartido(historia, fotos)}</dd>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <dt className="text-gray-600">Pueden donar</dt>
                <dd key={tipoElegido} className="mt-2 flex animate-aparecer flex-wrap gap-1.5 motion-reduce:animate-none">
                  {tipoElegido
                    ? puedeRecibirDe(tipoElegido).map((t) => <FichaSangre key={t} tipo={t} tamano="sm" />)
                    : <span className="text-gray-500">Elige un tipo para ver los compatibles</span>}
                </dd>
              </div>
            </dl>

            <label className="mt-5 flex items-start gap-3 border-t border-gray-100 pt-4 text-sm text-gray-800">
              <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-acento-600" />
              {paraSiMismo
                ? 'Acepto que el hospital vea mi nombre y que los donantes vean mis iniciales.'
                : 'Tengo autorización del paciente o su familia para compartir su nombre con el hospital y sus iniciales con los donantes.'}
            </label>

            <Aviso className="mt-4">{error}</Aviso>
            <Boton type="submit" cargando={enviando} className="mt-4 w-full">
              Enviar solicitud
            </Boton>
          </Panel>
        </aside>
      </form>
    </>
  );
}

const HISTORIA_MAXIMA = 1000;

function textoCompartido(historia, fotos) {
  const partes = [];
  if (historia.trim()) partes.push('Mensaje');
  if (fotos.length > 0) partes.push(fotos.length === 1 ? '1 foto' : fotos.length + ' fotos');
  return partes.length > 0 ? partes.join(' y ') : 'Nada';
}

let siguienteFoto = 0;

// Las fotos se reducen y se vuelven JPEG en el navegador antes de enviarse; se ven en miniatura y se pueden quitar
function SelectorFotos({ fotos, alCambiar, alFallar }) {
  const [preparando, setPreparando] = useState(false);
  const lugares = IMAGENES_MAXIMAS - fotos.length;

  async function agregar(evento) {
    const archivos = [...evento.target.files];
    evento.target.value = '';
    if (archivos.length === 0) return;
    alFallar(archivos.length > lugares ? 'Solo caben ' + IMAGENES_MAXIMAS + ' fotos; se agregaron las primeras.' : '');
    setPreparando(true);
    const nuevas = [];
    for (const archivo of archivos.slice(0, lugares)) {
      try {
        nuevas.push({ id: siguienteFoto++, dataUrl: await prepararFoto(archivo) });
      } catch (e) {
        alFallar(e.message);
      }
    }
    alCambiar((previas) => [...previas, ...nuevas].slice(0, IMAGENES_MAXIMAS));
    setPreparando(false);
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-800">Fotos (hasta {IMAGENES_MAXIMAS})</p>
      <p className="mt-0.5 text-sm text-gray-600">Por ejemplo, con su familia, en su trabajo o en el hospital.</p>
      <ul className="mt-3 grid max-w-md grid-cols-3 gap-2">
        {fotos.map((foto, indice) => (
          <li key={foto.id} className="relative">
            <img src={foto.dataUrl} alt={'Foto ' + (indice + 1) + ' elegida'} className="aspect-square w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => alCambiar((previas) => previas.filter((f) => f.id !== foto.id))}
              aria-label={'Quitar foto ' + (indice + 1)}
              className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-white/90 text-gray-800 ring-1 ring-gray-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-acento-600"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {lugares > 0 && (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-sm text-gray-700 hover:bg-gray-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento-600">
              {preparando
                ? <LoaderCircle className="size-5 animate-spin text-acento-600" aria-hidden="true" />
                : <ImagePlus className="size-5 text-acento-600" aria-hidden="true" />}
              {preparando ? 'Preparando' : 'Agregar'}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={preparando} onChange={agregar} />
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}
