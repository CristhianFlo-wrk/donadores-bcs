import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router';
import { ArrowRight, BookOpen } from 'lucide-react';
import { donantes, notificaciones, solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, Badge, BarraProgreso, Boton, Cargando, EncabezadoPagina, FichaSangre, Panel } from '../../componentes/ui.jsx';
import { BadgeUrgencia, InsigniasCiudadana } from '../../componentes/insignias.jsx';
import FotosSolicitud from '../../componentes/FotosSolicitud.jsx';
import { esCompatible } from '../../utils/compatibilidad.js';
import { hace, nombreRegion } from '../../utils/formato.js';

// Lo que ve el donante al pulsar una solicitud: quien la necesita, su mensaje y fotos, el avance y el boton para donar
export default function VerSolicitud() {
  const { id } = useParams();
  const consulta = useConsulta(() => solicitudes.obtener(id), [id]);
  const consultaPerfil = useConsulta(() => donantes.perfil());
  const consultaStats = useConsulta(() => donantes.stats());
  const volver = { ruta: '/donante', texto: 'Inicio' };

  if (consulta.cargando || consultaPerfil.cargando) return <Cargando />;
  // Cerrada, sin confirmar o inexistente: la API responde 404 y se explica sin tecnicismos
  if (consulta.error) {
    return (
      <>
        <EncabezadoPagina titulo="Solicitud no disponible" volver={volver} />
        <Aviso tono="info">{consulta.error.status === 404 ? 'Esta solicitud ya se cerró o no está disponible.' : consulta.error.message}</Aviso>
      </>
    );
  }
  if (consultaPerfil.error) return <Aviso>{consultaPerfil.error.message}</Aviso>;

  const { solicitud } = consulta.datos;
  const perfil = consultaPerfil.datos.perfil;
  const compartio = Boolean(solicitud.historia) || solicitud.imagenes.length > 0;
  // Los conteos llegan como texto (COUNT de PostgreSQL)
  const confirmaciones = Number(solicitud.metricas.confirmaciones);

  return (
    <>
      <EncabezadoPagina
        volver={volver}
        antes={<FichaSangre tipo={solicitud.tipo_sangre} tamano="lg" />}
        titulo={solicitud.hospital.nombre + ' necesita sangre ' + solicitud.tipo_sangre}
        descripcion={
          <span className="inline-flex flex-wrap items-center gap-2">
            <BadgeUrgencia urgencia={solicitud.urgencia} />
            <InsigniasCiudadana solicitud={solicitud} />
            {nombreRegion(solicitud.hospital.region)} · {hace(solicitud.fecha_solicitud)}
          </span>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {compartio ? (
            <Panel titulo={solicitud.paciente ? 'Para ' + solicitud.paciente.nombre : 'Mensaje de quien la pidió'} detalle="Lo compartió quien pidió la sangre; el hospital lo revisó.">
              <div className="space-y-5">
                {solicitud.historia && (
                  <blockquote className="whitespace-pre-line border-l-2 border-acento-200 pl-4 text-base leading-relaxed text-gray-800 [overflow-wrap:anywhere]">
                    {solicitud.historia}
                  </blockquote>
                )}
                <FotosSolicitud solicitud={solicitud} />
              </div>
            </Panel>
          ) : (
            <Panel titulo={solicitud.paciente ? 'Para ' + solicitud.paciente.nombre : 'Solicitud del hospital'}>
              <p className="text-sm text-gray-700">
                {solicitud.ciudadana
                  ? 'Quien la pidió no dejó mensaje. El hospital confirmó que el paciente está ahí.'
                  : 'El hospital necesita reponer sangre ' + solicitud.tipo_sangre + ' para sus pacientes.'}
              </p>
            </Panel>
          )}

          <Panel titulo="Avance">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-gray-700">
                <span className="font-semibold tabular-nums text-gray-900">{solicitud.metricas.donaciones}</span> de <span className="tabular-nums">{solicitud.unidades_requeridas}</span> {solicitud.unidades_requeridas === 1 ? 'unidad donada' : 'unidades donadas'}
              </span>
              <span className="text-gray-600">{confirmaciones} {confirmaciones === 1 ? 'donante va en camino' : 'donantes van en camino'}</span>
            </div>
            <BarraProgreso valor={Number(solicitud.metricas.donaciones)} maximo={solicitud.unidades_requeridas} etiqueta="Unidades donadas" className="mt-3" />
          </Panel>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-8">
          <PanelDonar solicitud={solicitud} perfil={perfil} stats={consultaStats.datos?.stats} />
          <Link to="/donante/antes-de-donar" className="group flex items-center gap-4 rounded-xl bg-acento-50 p-5 transition-colors hover:bg-acento-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600">
            <BookOpen className="size-5 shrink-0 text-acento-600" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-semibold text-acento-800">Antes de donar</span>
              <span className="block text-gray-700">Requisitos y qué llevar el día de la donación.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-acento-700" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </>
  );
}

// Mismas condiciones que la API para ofrecerse: sangre compatible, estar disponible y haber cumplido la espera
function PanelDonar({ solicitud, perfil, stats }) {
  const navegar = useNavigate();
  const { recargarAlertas } = useOutletContext();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const sirve = esCompatible(perfil.tipo_sangre, solicitud.tipo_sangre);
  const motivo = !sirve
    ? 'Tu sangre ' + perfil.tipo_sangre + ' no es compatible con ' + solicitud.tipo_sangre + '. Puedes ayudar compartiendo la solicitud con alguien que sí lo sea.'
    : !perfil.disponible
      ? 'Estás en pausa. Activa tu disponibilidad en Inicio para ofrecerte.'
      : stats && !stats.puede_donar
        ? 'Aún no cumples el periodo de espera entre donaciones: faltan ' + stats.dias_para_poder_donar + ' días.'
        : null;

  async function donar() {
    setEnviando(true);
    setError('');
    try {
      await notificaciones.ofrecerme(solicitud.id);
      recargarAlertas();
      navegar('/donante/alertas');
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <Panel titulo="¿Puedes donar?">
      <div className="flex items-center gap-3">
        <FichaSangre tipo={perfil.tipo_sangre} tamano="sm" />
        {sirve ? <Badge tono="acento">Tu sangre sirve</Badge> : <Badge tono="gris">No compatible</Badge>}
      </div>
      {motivo && <p className="mt-3 text-sm text-gray-700">{motivo}</p>}
      <Aviso className="mt-3">{error}</Aviso>
      <Boton className="mt-4 w-full" disabled={Boolean(motivo) || !stats} cargando={enviando} onClick={donar}>Quiero donar</Boton>
      {!motivo && <p className="mt-2 text-xs text-gray-600">Te llevamos a Alertas para que confirmes tu asistencia y recibas tu código.</p>}
    </Panel>
  );
}
