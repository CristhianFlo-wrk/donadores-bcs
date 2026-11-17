import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { solicitudes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, BarraProgreso, Boton, EncabezadoPagina, EnlaceBoton, EstadoConsulta, FichaSangre, Tarjeta, Vacio } from '../../componentes/ui.jsx';
import { BadgeEstadoSolicitud, BadgeUrgencia, InsigniasCiudadana } from '../../componentes/insignias.jsx';
import { fechaHora, hace } from '../../utils/formato.js';

export const ESTADOS_ARCHIVADOS = ['cancelada', 'caducada', 'falsa'];

// Seguimiento de la sangre que pidio el donante: avance sin datos de quien dona
export default function MisSolicitudes() {
  const ubicacion = useLocation();
  const consulta = useConsulta(() => solicitudes.mias(), [], { intervaloMs: 30000 });
  const [aviso, setAviso] = useState(() => (ubicacion.state?.aviso ? { tono: 'exito', texto: ubicacion.state.aviso } : null));

  // Las canceladas, caducadas y falsas se archivan en el Historial
  const todas = consulta.datos?.solicitudes || [];
  const lista = todas.filter((s) => !ESTADOS_ARCHIVADOS.includes(s.estado));
  const archivadas = todas.length - lista.length;
  const bloqueadaPorFaltas = (consulta.datos?.faltas || 0) >= 2;
  const tieneActiva = lista.some((s) => s.estado === 'activa');
  const puedePedir = Boolean(consulta.datos) && !bloqueadaPorFaltas && !tieneActiva;
  const botonPedir = <EnlaceBoton to="/donante/solicitudes/nueva" className="w-full sm:w-auto">Pedir sangre</EnlaceBoton>;

  return (
    <>
      <EncabezadoPagina
        titulo="Mis solicitudes"
        descripcion="Sigue el avance de la sangre que pediste. Por privacidad no se muestran los nombres de quienes donan."
        acciones={puedePedir && lista.length > 0 && botonPedir}
      />

      {aviso && <Aviso tono={aviso.tono} className="mb-6">{aviso.texto}</Aviso>}
      {bloqueadaPorFaltas && (
        <Aviso className="mb-6">No puedes crear solicitudes: tu cuenta tiene solicitudes marcadas como falsas.</Aviso>
      )}
      {!bloqueadaPorFaltas && tieneActiva && (
        <Aviso tono="info" className="mb-6">Tienes una solicitud activa. Para pedir otra, cancélala o espera a que se cierre.</Aviso>
      )}

      <EstadoConsulta consulta={consulta}>
        {() => lista.length === 0 ? (
          <Vacio titulo="Aún no has pedido sangre">
            Si tú o alguien cercano necesita sangre, envía una solicitud; cuando el hospital la confirme, avisamos a los donantes compatibles.
            {puedePedir && <span className="mt-4 flex justify-center">{botonPedir}</span>}
          </Vacio>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {lista.map((s) => (
              <li key={s.id}>
                <TarjetaSolicitud solicitud={s} alCancelar={(nuevoAviso) => { setAviso(nuevoAviso); consulta.recargar(); }} />
              </li>
            ))}
          </ul>
        )}
      </EstadoConsulta>

      {archivadas > 0 && (
        <p className="mt-6 text-sm text-gray-600">
          {archivadas === 1 ? 'Tienes 1 solicitud cancelada, caducada o falsa guardada' : 'Tienes ' + archivadas + ' solicitudes canceladas, caducadas o falsas guardadas'} en tu{' '}
          <Link to="/donante/historial" className="font-medium text-acento-700 underline">historial</Link>.
        </p>
      )}
    </>
  );
}

function TarjetaSolicitud({ solicitud: s, alCancelar }) {
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const activa = s.estado === 'activa';

  async function cancelar() {
    setCancelando(true);
    try {
      await solicitudes.cerrar(s.id, 'cancelada');
      alCancelar({ tono: 'info', texto: 'Solicitud cancelada. La encontrarás en tu historial.' });
    } catch (e) {
      alCancelar({ tono: 'error', texto: e.message });
    } finally {
      setCancelando(false);
      setConfirmar(false);
    }
  }

  return (
    <Tarjeta className="h-full">
      <div className="flex items-start gap-4">
        <FichaSangre tipo={s.tipo_sangre} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{s.para_si_mismo ? 'Para ti' : 'Para ' + s.paciente_nombre}</p>
          <p className="mt-0.5 text-sm text-gray-700">{s.hospital_nombre}</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Pedida {hace(s.fecha_solicitud).toLowerCase()}
            {s.paciente_expediente && <> · Expediente {s.paciente_expediente}</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <BadgeEstadoSolicitud estado={s.estado} />
            <BadgeUrgencia urgencia={s.urgencia} />
            <InsigniasCiudadana solicitud={s} />
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-gray-700">
            <span className="font-semibold tabular-nums text-gray-900">{s.unidades_donadas}</span> de <span className="tabular-nums">{s.unidades_requeridas}</span> {s.unidades_requeridas === 1 ? 'unidad donada' : 'unidades donadas'}
          </span>
          <span className="text-gray-600">
            {s.confirmaciones} {s.confirmaciones === 1 ? 'donante confirmó' : 'donantes confirmaron'}
          </span>
        </div>
        <BarraProgreso valor={s.unidades_donadas} maximo={s.unidades_requeridas} etiqueta="Unidades donadas" className="mt-2" />
        {activa && s.por_confirmar && (
          <p className="mt-2 text-sm text-gray-700">El hospital todavía no la confirma. Cuando lo haga, avisaremos a los donantes compatibles.</p>
        )}
        {activa && s.fecha_caducidad && <p className="mt-2 text-xs text-gray-600">Caduca el {fechaHora(s.fecha_caducidad)}</p>}
      </div>

      {activa && (
        confirmar ? (
          <div className="mt-4 rounded-lg border border-gray-200 p-3">
            <p className="text-sm text-gray-700">¿Cancelar la solicitud? Los donantes dejarán de verla. Esta acción no se puede deshacer.</p>
            <div className="mt-2 flex gap-2">
              <Boton variante="peligro" cargando={cancelando} onClick={cancelar}>Sí, cancelar</Boton>
              <Boton variante="neutro" disabled={cancelando} onClick={() => setConfirmar(false)}>No</Boton>
            </div>
          </div>
        ) : (
          <Boton variante="peligro" className="mt-4" onClick={() => setConfirmar(true)}>Cancelar</Boton>
        )
      )}
    </Tarjeta>
  );
}
