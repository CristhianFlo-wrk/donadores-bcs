import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Minus, Plus } from 'lucide-react';
import { hospitales, notificaciones, solicitudes, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { AreaTexto, Aviso, Boton, Cargando, EncabezadoPagina, FichaSangre, Panel, Selector } from '../../componentes/ui.jsx';
import { puedeRecibirDe } from '../../utils/compatibilidad.js';

const UNIDADES_MAXIMAS = 20;

const URGENCIAS = [
  { valor: 'urgente', titulo: 'Urgente', detalle: 'Se avisa a donantes de la región del hospital.' },
  { valor: 'critica', titulo: 'Crítica', detalle: 'Se avisa a donantes compatibles de todo el estado.' }
];

// Pensado para completarse en menos de un minuto: dos toques y enviar
export default function NuevaSolicitud() {
  const { usuario } = useSesion();
  const navegar = useNavigate();
  const esAdmin = usuario.rol === 'admin';
  const base = esAdmin ? '/admin' : '/hospital';

  const [idTipo, setIdTipo] = useState('');
  const [urgencia, setUrgencia] = useState('urgente');
  const [unidades, setUnidades] = useState(1);
  const [descripcion, setDescripcion] = useState('');
  const [idHospital, setIdHospital] = useState('');
  const [notificarAlCrear, setNotificarAlCrear] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const consultaTipos = useConsulta(() => ubicaciones.tiposSangre());
  const consultaHospitales = useConsulta(() => (esAdmin ? hospitales.listar() : Promise.resolve(null)));

  async function enviar(evento) {
    evento.preventDefault();
    setError('');
    if (!idTipo) return setError('Selecciona el tipo de sangre requerido.');
    if (esAdmin && !idHospital) return setError('Selecciona el hospital que emite la solicitud.');

    const datos = { id_tipo_sangre: Number(idTipo), urgencia, unidades_requeridas: unidades };
    if (descripcion.trim()) datos.descripcion = descripcion.trim();
    if (esAdmin) datos.id_hospital = Number(idHospital);

    setEnviando(true);
    try {
      const { solicitud } = await solicitudes.crear(datos);
      let aviso = null;
      if (notificarAlCrear) {
        const resultado = await notificaciones.notificar({ id_solicitud: solicitud.id });
        aviso = resultado.notificaciones_enviadas;
      }
      navegar(base + '/solicitudes/' + solicitud.id, { state: { notificados: aviso } });
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  const tipoElegido = (consultaTipos.datos?.tipos || []).find((t) => String(t.id) === idTipo)?.codigo;
  const urgenciaElegida = URGENCIAS.find((u) => u.valor === urgencia);

  return (
    <>
      <EncabezadoPagina
        titulo="Nueva solicitud"
        descripcion="Dos selecciones y listo: el sistema avisa a los donantes compatibles."
        volver={{ ruta: base + '/solicitudes', texto: 'Solicitudes' }}
      />

      <form onSubmit={enviar} className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" noValidate>
        <div className="min-w-0 space-y-6">
          {esAdmin && (
            <Panel titulo="Hospital que emite la solicitud">
              <Selector
                etiqueta="Hospital"
                id="hospital"
                value={idHospital}
                onChange={(e) => setIdHospital(e.target.value)}
                opciones={(consultaHospitales.datos?.hospitales || []).map((h) => ({ valor: String(h.id), texto: h.nombre }))}
              />
            </Panel>
          )}

          <Panel titulo="Tipo de sangre requerido">
            <fieldset>
              <legend className="sr-only">Tipo de sangre requerido</legend>
              {consultaTipos.cargando ? <Cargando /> : (
                <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
                  {(consultaTipos.datos?.tipos || []).map((t) => (
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

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Panel titulo="Prioridad">
              <fieldset>
                <legend className="sr-only">Prioridad</legend>
                <div className="grid gap-2">
                  {URGENCIAS.map((u) => (
                    <label
                      key={u.valor}
                      className={'cursor-pointer rounded-lg p-4 ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-acento-600 ' +
                        (urgencia === u.valor ? (u.valor === 'critica' ? 'bg-red-50 ring-2 ring-red-600' : 'bg-amber-50 ring-2 ring-amber-500') : 'bg-white ring-1 ring-gray-200 hover:bg-gray-50')}
                    >
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
                <div>
                  <p id="etiqueta-unidades" className="mb-1.5 text-sm font-medium text-gray-800">Unidades requeridas</p>
                  <div className="inline-flex items-center rounded-lg bg-white ring-1 ring-inset ring-gray-300" role="group" aria-labelledby="etiqueta-unidades">
                    <button
                      type="button"
                      onClick={() => setUnidades((u) => Math.max(1, u - 1))}
                      disabled={unidades <= 1}
                      aria-label="Una unidad menos"
                      className="flex size-11 items-center justify-center rounded-l-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <output aria-live="polite" className="w-12 text-center text-lg font-bold text-gray-900">{unidades}</output>
                    <button
                      type="button"
                      onClick={() => setUnidades((u) => Math.min(UNIDADES_MAXIMAS, u + 1))}
                      disabled={unidades >= UNIDADES_MAXIMAS}
                      aria-label="Una unidad más"
                      className="flex size-11 items-center justify-center rounded-r-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <AreaTexto
                  etiqueta="Descripción (opcional)"
                  id="descripcion"
                  rows={3}
                  maxLength={500}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Cirugía programada a las 14:00"
                  ayuda="No incluyas datos personales del paciente."
                />
              </div>
            </Panel>
          </div>
        </div>

        <aside className="xl:sticky xl:top-8">
          <Panel titulo="Resumen de la solicitud">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-600">Tipo</dt>
                <dd>{tipoElegido ? <FichaSangre tipo={tipoElegido} tamano="sm" /> : <span className="text-gray-500">Sin elegir</span>}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Prioridad</dt>
                <dd className="font-medium text-gray-900">{urgenciaElegida.titulo}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Unidades</dt>
                <dd className="font-medium tabular-nums text-gray-900">{unidades}</dd>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <dt className="text-gray-600">Pueden donar</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {tipoElegido
                    ? puedeRecibirDe(tipoElegido).map((t) => <FichaSangre key={t} tipo={t} tamano="sm" />)
                    : <span className="text-gray-500">Elige un tipo para ver los compatibles</span>}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-gray-600">{urgenciaElegida.detalle}</p>

            <label className="mt-5 flex items-start gap-3 border-t border-gray-100 pt-4 text-sm text-gray-800">
              <input type="checkbox" checked={notificarAlCrear} onChange={(e) => setNotificarAlCrear(e.target.checked)} className="mt-0.5 size-4 accent-acento-600" />
              Notificar a los donantes compatibles al crear la solicitud
            </label>

            <Aviso className="mt-4">{error}</Aviso>
            <Boton type="submit" cargando={enviando} className="mt-4 w-full">
              Crear solicitud
            </Boton>
          </Panel>
        </aside>
      </form>
    </>
  );
}
