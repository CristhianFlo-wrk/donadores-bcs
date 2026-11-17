import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { auditoria, hospitales } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, Badge, Boton, Campo, Cargando, EncabezadoPagina, EstadoConsulta, Panel, Selector, Vacio, clasesBoton } from '../../componentes/ui.jsx';
import BloqueIntegridad from '../../componentes/BloqueIntegridad.jsx';
import { textoUrgencia } from '../../componentes/insignias.jsx';
import { TIPOS_SANGRE } from '../../utils/compatibilidad.js';
import { NOMBRES_REGION, codigoAsistencia, fechaHora, nombreRegion, selloLegible } from '../../utils/formato.js';
import { calcularSello, canonico } from '../../utils/sello.js';
import { aCsv, descargarArchivo } from '../../utils/csv.js';

const NOMBRE_ACCION = {
  REGISTRO_DONANTE: 'Registro de donante',
  LOGIN_EXITOSO: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Inicio de sesión fallido',
  LOGIN_BLOQUEADO: 'Intento con cuenta desactivada',
  PERFIL_ACTUALIZADO: 'Perfil actualizado',
  DISPONIBILIDAD_CAMBIADA: 'Disponibilidad cambiada',
  SOLICITUD_CREADA: 'Solicitud creada',
  SOLICITUD_CERRADA: 'Solicitud cerrada',
  SOLICITUD_CONFIRMADA: 'Solicitud confirmada por el hospital',
  URGENCIA_CAMBIADA: 'Urgencia cambiada',
  IMAGEN_QUITADA: 'Foto quitada por el hospital',
  HISTORIA_QUITADA: 'Mensaje quitado por el hospital',
  IPS_BORRADAS_POR_PLAZO: 'IPs borradas por plazo',
  PUBLICACIONES_BORRADAS_POR_PLAZO: 'Fotos y mensajes borrados por plazo',
  NOTIFICACIONES_ENVIADAS: 'Donantes notificados',
  DONANTE_SE_OFRECE: 'Donante se ofrece',
  ASISTENCIA_CONFIRMADA: 'Asistencia confirmada',
  ASISTENCIA_RECHAZADA: 'Asistencia rechazada',
  DONACION_REGISTRADA: 'Donación registrada',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_ACTIVADO: 'Usuario activado',
  USUARIO_DESACTIVADO: 'Usuario desactivado',
  HOSPITAL_CREADO: 'Hospital agregado',
  HOSPITAL_EDITADO: 'Hospital editado',
  HOSPITAL_DESACTIVADO: 'Hospital desactivado',
  HOSPITAL_ACTIVADO: 'Hospital reactivado',
  COLONIA_CREADA: 'Colonia agregada',
  COLONIA_EDITADA: 'Colonia editada',
  COLONIA_DESACTIVADA: 'Colonia desactivada',
  COLONIA_ACTIVADA: 'Colonia reactivada',
  AUDITORIA_CONSULTADA: 'Auditoría consultada',
  CONSTANCIA_EMITIDA: 'Constancia emitida',
  CONSTANCIA_COMPROBADA: 'Constancia comprobada'
};

const RESULTADO_CONSTANCIA = {
  coincide: 'coincide',
  sello_distinto: 'no coincide',
  registro_inexistente: 'faltan registros',
  cadena_alterada: 'registro alterado'
};

const CATEGORIAS = [
  { valor: 'sesiones', texto: 'Sesiones', acciones: ['LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO'] },
  { valor: 'cuentas', texto: 'Cuentas y perfiles', acciones: ['REGISTRO_DONANTE', 'USUARIO_CREADO', 'USUARIO_ACTIVADO', 'USUARIO_DESACTIVADO', 'PERFIL_ACTUALIZADO', 'DISPONIBILIDAD_CAMBIADA'] },
  { valor: 'solicitudes', texto: 'Solicitudes', acciones: ['SOLICITUD_CREADA', 'SOLICITUD_CONFIRMADA', 'SOLICITUD_CERRADA', 'URGENCIA_CAMBIADA', 'IMAGEN_QUITADA', 'HISTORIA_QUITADA'] },
  { valor: 'notificaciones', texto: 'Notificaciones y asistencia', acciones: ['NOTIFICACIONES_ENVIADAS', 'DONANTE_SE_OFRECE', 'ASISTENCIA_CONFIRMADA', 'ASISTENCIA_RECHAZADA'] },
  { valor: 'donaciones', texto: 'Donaciones', acciones: ['DONACION_REGISTRADA'] },
  { valor: 'catalogos', texto: 'Hospitales y colonias', acciones: ['HOSPITAL_CREADO', 'HOSPITAL_EDITADO', 'HOSPITAL_DESACTIVADO', 'HOSPITAL_ACTIVADO', 'COLONIA_CREADA', 'COLONIA_EDITADA', 'COLONIA_DESACTIVADA', 'COLONIA_ACTIVADA'] },
  { valor: 'auditoria', texto: 'Auditoría', acciones: ['AUDITORIA_CONSULTADA', 'CONSTANCIA_EMITIDA', 'CONSTANCIA_COMPROBADA'] },
  { valor: 'plazos', texto: 'Borrados por plazo', acciones: ['IPS_BORRADAS_POR_PLAZO', 'PUBLICACIONES_BORRADAS_POR_PLAZO'] }
];

// Las hace el mantenimiento diario del servidor, no una persona
const ACCIONES_DEL_SISTEMA = ['IPS_BORRADAS_POR_PLAZO', 'PUBLICACIONES_BORRADAS_POR_PLAZO'];

const OPCIONES_REGION = Object.entries(NOMBRES_REGION).map(([valor, texto]) => ({ valor, texto }));
const ACCIONES_FALLIDAS = ['LOGIN_FALLIDO', 'LOGIN_BLOQUEADO'];
const NOMBRE_ROL = { admin: 'Administrador', hospital: 'Hospital', donante: 'Donante', auditor: 'Auditor' };
const FILTROS_VACIOS = { categoria: '', accion: '', usuario: '', id_solicitud: '', id_hospital: '', region: '', desde: '', hasta: '' };

// "#12" o "12"; cualquier otra cosa no filtra
const numeroEscrito = (texto) => (texto.trim().match(/^#?(\d{1,9})$/) || [])[1] || '';
const SIN_MAS = { entradas: [], hayMas: null };

// Cada llave de detalles se muestra legible; las desconocidas salen tal cual
const FORMATO_DETALLE = {
  id_solicitud: (v) => 'Solicitud #' + v,
  id_notificacion: (v) => 'Asistencia ' + codigoAsistencia(v),
  id_historial: (v) => 'Donación #' + v,
  id_usuario: (v) => 'Usuario #' + v,
  id_donante: (v) => 'Donante #' + v,
  id_hospital: (v) => 'Hospital #' + v,
  id_colonia: (v) => 'Colonia #' + v,
  // En HOSPITAL_CREADO el nombre ya sale como hospital_nombre
  nombre: (v, entrada) => (v === entrada.hospital_nombre ? null : v),
  municipio: (v) => v,
  codigo_postal: (v) => 'C.P. ' + v,
  cuentas_desactivadas: (v) => v + (v === 1 ? ' cuenta desactivada' : ' cuentas desactivadas'),
  id_tipo_sangre: (v) => 'Tipo ' + (TIPOS_SANGRE[v - 1] || v),
  urgencia: (v) => 'Urgencia ' + textoUrgencia(v).toLowerCase(),
  urgencia_anterior: (v) => 'antes ' + textoUrgencia(v).toLowerCase(),
  unidades_requeridas: (v) => v + (v === 1 ? ' unidad' : ' unidades'),
  total: (v) => v + (v === 1 ? ' donante' : ' donantes'),
  alcance: (v) => 'Alcance ' + v,
  estado: (v) => 'Estado ' + v,
  disponible: (v) => (v ? 'Disponible' : 'No disponible'),
  campos: (v) => 'Campos: ' + (Array.isArray(v) ? v.join(', ') : v),
  ciudadana: (v) => (v ? 'Ciudadana' : null),
  con_historia: (v) => (v ? 'Con mensaje' : null),
  imagenes: (v) => v + (v === 1 ? ' foto' : ' fotos'),
  id_imagen: (v) => 'Foto #' + v,
  ips_borradas: (v) => v + (v === 1 ? ' IP borrada' : ' IPs borradas'),
  fotos: (v) => v + (v === 1 ? ' foto borrada' : ' fotos borradas'),
  mensajes: (v) => v + (v === 1 ? ' mensaje borrado' : ' mensajes borrados'),
  plazo_dias: (v) => 'Plazo de ' + v + ' días',
  // Solo en registros viejos: antes solo la critica pedida por un donante esperaba confirmacion del hospital
  critica_por_confirmar: (v) => (v ? 'Crítica por confirmar' : null),
  aviso_privacidad: (v) => 'Aceptó el aviso de privacidad del ' + v,
  logs_hasta: (v) => 'Bitácora hasta #' + v,
  donaciones_hasta: (v) => 'Donaciones hasta #' + v,
  sello: (v) => 'Sello ' + selloLegible(v),
  resultado: (v) => 'Resultado: ' + (RESULTADO_CONSTANCIA[v] || v)
};

const ORDEN_DETALLE = Object.keys(FORMATO_DETALLE);
const posicionDetalle = (llave) => (ORDEN_DETALLE.includes(llave) ? ORDEN_DETALLE.indexOf(llave) : ORDEN_DETALLE.length);

// Hospital y region van primero (el backend ya los resolvio); JSONB reordena las llaves, se ordenan con FORMATO_DETALLE
function textoDetalles(entrada) {
  const { detalles } = entrada;
  let partes = [];
  if (detalles && typeof detalles === 'object' && !Array.isArray(detalles)) {
    const omitir = entrada.hospital_nombre ? ['region', 'id_hospital'] : ['region'];
    partes = Object.entries(detalles)
      .filter(([llave]) => !omitir.includes(llave))
      .sort(([a], [b]) => posicionDetalle(a) - posicionDetalle(b))
      .map(([llave, valor]) => (FORMATO_DETALLE[llave] ? FORMATO_DETALLE[llave](valor, entrada) : llave + ': ' + JSON.stringify(valor)));
  } else if (detalles !== null && detalles !== undefined) {
    partes = [JSON.stringify(detalles)];
  }
  return [entrada.hospital_nombre, entrada.region && nombreRegion(entrada.region), ...partes].filter(Boolean).join(' · ');
}

// Filtros del estado de la pantalla a parametros de la API; una categoria sin accion elegida manda todas las suyas
function parametros(filtros) {
  const categoria = CATEGORIAS.find((c) => c.valor === filtros.categoria);
  const { categoria: _, accion, ...resto } = filtros;
  return { ...resto, accion: accion || (categoria ? categoria.acciones.join(',') : '') };
}

// Rapida: solo lo nuevo desde la ultima verificacion. Completa: todas las cadenas (el servidor tambien la hace una vez al dia)
function textoVerificacion(estado) {
  const { verificacion_logs: logs, verificacion_donaciones: donaciones } = estado;
  // Sin punto final tras la fecha: fechaHora ya termina en "a.m." o "p.m."
  const ultima = logs.ultima_completa ? 'Última verificación completa: ' + fechaHora(logs.ultima_completa) : 'Todavía no hay una verificación completa.';
  if (logs.modo === 'completa') return 'Verificación completa: se recalcularon todos los registros. ' + ultima;
  const nuevos = logs.revisados + donaciones.revisados;
  return 'Verificación rápida: ' + (nuevos === 1 ? 'se revisó 1 registro nuevo' : 'se revisaron ' + nuevos + ' registros nuevos') + ' desde la anterior. ' + ultima;
}

export default function Auditoria() {
  const { usuario } = useSesion();
  const rutaConstancias = usuario.rol === 'auditor' ? '/auditor/constancias' : '/admin/constancias';
  const consultaEstado = useConsulta(() => auditoria.estado());
  const [estadoCompleto, setEstadoCompleto] = useState(null);
  const [verificandoTodo, setVerificandoTodo] = useState(false);
  const [errorTodo, setErrorTodo] = useState(null);

  async function verificarTodo() {
    setVerificandoTodo(true);
    setErrorTodo(null);
    try {
      setEstadoCompleto((await auditoria.estado({ completa: true })).estado);
    } catch (e) {
      setErrorTodo(e.message);
    } finally {
      setVerificandoTodo(false);
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoría"
        acciones={<Link to={rutaConstancias} className={clasesBoton('contorno')}>Constancias de integridad</Link>}
      />

      <EstadoConsulta consulta={consultaEstado}>
        {({ estado: estadoRapido }) => {
          const estado = estadoCompleto || estadoRapido;
          const integra = estado.verificacion_donaciones.integra && estado.verificacion_logs.integra;
          const Icono = integra ? ShieldCheck : ShieldAlert;
          // La bitacora es la herramienta diaria: arriba solo el estado; sellos y explicacion se pliegan
          // y se abren solos si una cadena esta rota
          return (
          <>
            <section
              aria-labelledby="titulo-estado"
              className={'flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-5 py-4 ' + (integra ? 'border-emerald-200 bg-emerald-50' : 'border-red-300 bg-red-50')}
            >
              <div className="flex min-w-0 flex-1 basis-72 items-start gap-3">
                <Icono className={'mt-0.5 size-5 shrink-0 ' + (integra ? 'text-emerald-700' : 'text-red-700')} aria-hidden="true" />
                <div className="min-w-0">
                  <h2 id="titulo-estado" className={'text-sm font-semibold ' + (integra ? 'text-emerald-900' : 'text-red-900')}>
                    {integra ? 'Ningún registro ha cambiado' : 'Hay registros alterados: revisa los sellos abajo'}
                  </h2>
                  <p className="mt-0.5 text-sm text-gray-700">
                    {estado.total_donaciones} donaciones de {estado.donantes_con_historial} donantes y {estado.total_logs} acciones selladas. {textoVerificacion(estado)}
                  </p>
                </div>
              </div>
              <Boton variante="contorno" cargando={verificandoTodo} onClick={verificarTodo}>Verificar todo</Boton>
              {errorTodo && <Aviso className="w-full">{errorTodo}</Aviso>}
            </section>

            <details open={!integra} className="group mt-4 rounded-xl border border-gray-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 [&::-webkit-details-marker]:hidden">
                Sellos actuales y qué demuestra esto
                <ChevronDown className="size-4 shrink-0 text-gray-600 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 border-t border-gray-100 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="min-w-0 space-y-6">
                  <BloqueIntegridad verificacion={estado.verificacion_donaciones} titulo="Libro de donaciones: cada donación registrada por un hospital" />
                  <BloqueIntegridad verificacion={estado.verificacion_logs} titulo="Bitácora: cada acción hecha en el sistema" />
                </div>
                <QueDemuestra estado={estado} rutaConstancias={rutaConstancias} />
              </div>
            </details>

            <Bitacora idRoto={estado.verificacion_logs.integra ? null : estado.verificacion_logs.id_roto} />
          </>
          );
        }}
      </EstadoConsulta>
    </>
  );
}

// Lista paginada de la bitacora; las paginas siguientes se acumulan debajo de la primera
function Bitacora({ idRoto }) {
  const [eslabon, setEslabon] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [usuarioEscrito, setUsuarioEscrito] = useState('');
  const [solicitudEscrita, setSolicitudEscrita] = useState('');
  const [registroEscrito, setRegistroEscrito] = useState('');
  const [mas, setMas] = useState(SIN_MAS);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [avisoExportar, setAvisoExportar] = useState(null);
  const consultaHospitales = useConsulta(() => hospitales.listar());
  const consulta = useConsulta(() => auditoria.bitacora(parametros(filtros)), [JSON.stringify(filtros)]);

  const categoria = CATEGORIAS.find((c) => c.valor === filtros.categoria);
  const hayFiltros = usuarioEscrito !== '' || solicitudEscrita !== '' || Object.values(filtros).some(Boolean);
  const opcionesHospital = (consultaHospitales.datos?.hospitales || []).map((h) => ({ valor: String(h.id), texto: h.nombre }));

  function cambiar(cambios) {
    setFiltros((previo) => {
      const nuevo = { ...previo, ...cambios };
      return JSON.stringify(nuevo) === JSON.stringify(previo) ? previo : nuevo;
    });
    setMas(SIN_MAS);
    setErrorMas(null);
  }

  // El correo y la solicitud se aplican al dejar de escribir para no consultar en cada tecla
  useEffect(() => {
    const id = setTimeout(() => cambiar({ usuario: usuarioEscrito.trim(), id_solicitud: numeroEscrito(solicitudEscrita) }), 400);
    return () => clearTimeout(id);
  }, [usuarioEscrito, solicitudEscrita]);

  function limpiar() {
    setUsuarioEscrito('');
    setSolicitudEscrita('');
    cambiar(FILTROS_VACIOS);
  }

  // Descarga lo que coincide con los filtros, pagina por pagina, para revisarlo fuera del sistema
  async function exportar() {
    setExportando(true);
    setAvisoExportar(null);
    try {
      const entradas = [];
      let antes;
      let hayMas = true;
      while (hayMas && entradas.length < MAXIMO_EXPORTACION) {
        const pagina = await auditoria.bitacora({ ...parametros(filtros), limite: 100, antes });
        entradas.push(...pagina.entradas);
        hayMas = pagina.hay_mas && pagina.entradas.length > 0;
        antes = pagina.entradas.at(-1)?.id;
      }
      const filas = entradas.slice(0, MAXIMO_EXPORTACION);
      descargarArchivo('bitacora-' + new Date().toISOString().slice(0, 10) + '.csv', aCsv([COLUMNAS_CSV, ...filas.map(filaCsv)]), 'text/csv;charset=utf-8');
      setAvisoExportar(hayMas
        ? { tono: 'aviso', texto: 'Se exportaron los ' + MAXIMO_EXPORTACION + ' registros más recientes. Usa los filtros (por ejemplo, fechas) para exportar el resto.' }
        : { tono: 'exito', texto: filas.length + (filas.length === 1 ? ' registro exportado.' : ' registros exportados.') });
    } catch (e) {
      setAvisoExportar({ tono: 'error', texto: e.message });
    } finally {
      setExportando(false);
    }
  }

  // Abre la ficha de un registro por su numero, por ejemplo el que cita una constancia
  function abrirRegistro(evento) {
    evento.preventDefault();
    const id = numeroEscrito(registroEscrito);
    if (id) setEslabon(Number(id));
  }

  // El rango nunca queda invertido: mover un extremo arrastra al otro
  function cambiarDesde(desde) {
    cambiar(filtros.hasta && desde > filtros.hasta ? { desde, hasta: desde } : { desde });
  }

  function cambiarHasta(hasta) {
    cambiar(filtros.desde && hasta && hasta < filtros.desde ? { desde: hasta, hasta } : { hasta });
  }

  async function cargarMas(antes) {
    setCargandoMas(true);
    setErrorMas(null);
    try {
      const respuesta = await auditoria.bitacora({ ...parametros(filtros), antes });
      setMas((previo) => ({ entradas: [...previo.entradas, ...respuesta.entradas], hayMas: respuesta.hay_mas }));
    } catch (e) {
      setErrorMas(e.message);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <section className="mt-8" aria-labelledby="titulo-bitacora">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="titulo-bitacora" className="text-lg font-semibold text-gray-900">Bitácora de acciones</h2>
          <p className="mt-1 text-sm text-gray-600">Quién hizo qué, cuándo y desde qué IP, de lo más reciente a lo más antiguo.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {hayFiltros && <Boton variante="contorno" onClick={limpiar}>Limpiar filtros</Boton>}
          <Boton variante="contorno" cargando={exportando} onClick={exportar}>
            {!exportando && <Download className="size-4" aria-hidden="true" />}
            {hayFiltros ? 'Exportar lo filtrado (CSV)' : 'Exportar CSV'}
          </Boton>
          <form onSubmit={abrirRegistro} className="flex items-end gap-2" role="search" aria-label="Abrir un registro por su número">
            <Campo
              etiqueta="Ir al registro"
              id="ir-registro"
              inputMode="numeric"
              placeholder="#"
              className="w-28"
              value={registroEscrito}
              onChange={(e) => setRegistroEscrito(e.target.value)}
            />
            <Boton type="submit" variante="contorno" disabled={!numeroEscrito(registroEscrito)}>Abrir</Boton>
          </form>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
        <fieldset>
          <legend className="text-sm font-medium text-gray-800">Acción</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip activo={!filtros.categoria} alPulsar={() => cambiar({ categoria: '', accion: '' })}>Todas</Chip>
            {CATEGORIAS.map((c) => (
              <Chip key={c.valor} activo={filtros.categoria === c.valor} alPulsar={() => cambiar({ categoria: c.valor, accion: '' })}>{c.texto}</Chip>
            ))}
          </div>
          {categoria && categoria.acciones.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2 border-l-2 border-acento-200 pl-3" role="group" aria-label={'Acciones de ' + categoria.texto}>
              <Chip activo={!filtros.accion} alPulsar={() => cambiar({ accion: '' })}>Todas las de {categoria.texto.toLowerCase()}</Chip>
              {categoria.acciones.map((a) => (
                <Chip key={a} activo={filtros.accion === a} alPulsar={() => cambiar({ accion: a })}>{NOMBRE_ACCION[a]}</Chip>
              ))}
            </div>
          )}
        </fieldset>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Campo
            etiqueta="Usuario"
            id="filtro-usuario"
            type="search"
            placeholder="Correo o parte de él"
            value={usuarioEscrito}
            onChange={(e) => setUsuarioEscrito(e.target.value)}
          />
          <Campo
            etiqueta="Solicitud"
            id="filtro-solicitud"
            type="search"
            inputMode="numeric"
            placeholder="Número de solicitud"
            value={solicitudEscrita}
            onChange={(e) => setSolicitudEscrita(e.target.value)}
          />
          <Selector
            etiqueta="Hospital"
            id="filtro-hospital"
            vacio="Todos los hospitales"
            opciones={opcionesHospital}
            value={filtros.id_hospital}
            onChange={(e) => cambiar({ id_hospital: e.target.value })}
          />
          <Selector
            etiqueta="Región"
            id="filtro-region"
            vacio="Todas las regiones"
            opciones={OPCIONES_REGION}
            value={filtros.region}
            onChange={(e) => cambiar({ region: e.target.value })}
          />
          <Campo etiqueta="Desde" id="filtro-desde" type="date" value={filtros.desde} onChange={(e) => cambiarDesde(e.target.value)} />
          <Campo etiqueta="Hasta" id="filtro-hasta" type="date" value={filtros.hasta} onChange={(e) => cambiarHasta(e.target.value)} />
        </div>
      </div>

      {avisoExportar && <Aviso tono={avisoExportar.tono} className="mb-4">{avisoExportar.texto}</Aviso>}

      {idRoto && (
        <Aviso className="mb-4">El registro #{idRoto} cambió después de guardarse. Está marcado en rojo en la lista; ábralo con «Comprobar» para ver qué no cuadra.</Aviso>
      )}

      <EstadoConsulta consulta={consulta}>
        {(datos) => {
          const entradas = [...datos.entradas, ...mas.entradas];
          const hayMas = mas.hayMas ?? datos.hay_mas;
          if (entradas.length === 0) {
            return <Vacio titulo="Sin acciones registradas">{hayFiltros ? 'Ninguna acción coincide con estos filtros.' : 'Todavía no hay acciones en la bitácora.'}</Vacio>;
          }

          return (
            <div className="rounded-xl border border-gray-200 bg-white">
              <ul className="divide-y divide-gray-100 lg:grid lg:grid-cols-2 lg:divide-y-0 2xl:hidden">
                {entradas.map((e) => (
                  <li key={e.id} className={'px-5 py-4 lg:border-b lg:border-gray-100 lg:odd:border-r ' + (e.id === idRoto ? 'bg-red-50' : '')}>
                    <div className="flex items-start justify-between gap-3">
                      <BadgeAccion entrada={e} alterada={e.id === idRoto} />
                      <span className="shrink-0 text-xs tabular-nums text-gray-600">#{e.id}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-900 [overflow-wrap:anywhere]"><Usuario entrada={e} /></p>
                    {textoDetalles(e) && <p className="mt-1 text-sm text-gray-700">{textoDetalles(e)}</p>}
                    <p className="mt-2 text-xs text-gray-600">{fechaHora(e.fecha)} · IP {textoIp(e)}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="truncate font-mono text-xs text-gray-600" title={e.hash_actual}>Sello {selloLegible(e.hash_actual)}</p>
                      <BotonComprobar id={e.id} alPulsar={setEslabon} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto 2xl:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-gray-600">
                      <th className="px-5 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-3 py-2.5 font-medium">Acción</th>
                      <th className="px-3 py-2.5 font-medium">Usuario</th>
                      <th className="px-3 py-2.5 font-medium">Detalles</th>
                      <th className="px-3 py-2.5 font-medium">IP</th>
                      <th className="px-5 py-2.5 font-medium">Sello</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                    {entradas.map((e) => (
                      <tr key={e.id} className={e.id === idRoto ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-5 py-3 tabular-nums text-gray-600">{e.id}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-700">{fechaHora(e.fecha)}</td>
                        <td className="px-3 py-3"><BadgeAccion entrada={e} alterada={e.id === idRoto} /></td>
                        <td className="min-w-60 px-3 py-3 text-gray-900 [overflow-wrap:anywhere]"><Usuario entrada={e} /></td>
                        <td className="min-w-48 px-3 py-3 text-gray-700">{textoDetalles(e) || '—'}</td>
                        <td className={'whitespace-nowrap px-3 py-3 text-xs text-gray-700 ' + (e.ip_origen ? 'font-mono' : '')}>{textoIp(e)}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="block font-mono text-xs text-gray-600" title={e.hash_actual}>{selloLegible(e.hash_actual)}</span>
                          <BotonComprobar id={e.id} alPulsar={setEslabon} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
                <p className="text-sm text-gray-600">{entradas.length} {entradas.length === 1 ? 'acción mostrada' : 'acciones mostradas'}</p>
                {hayMas && (
                  <Boton variante="contorno" cargando={cargandoMas} onClick={() => cargarMas(entradas[entradas.length - 1].id)}>
                    Cargar más
                  </Boton>
                )}
              </div>
              {errorMas && <Aviso className="mx-5 mb-4">{errorMas}</Aviso>}
            </div>
          );
        }}
      </EstadoConsulta>

      {eslabon && <FichaEslabon id={eslabon} alCambiar={setEslabon} alCerrar={() => setEslabon(null)} />}
    </section>
  );
}

function Chip({ activo, alPulsar, children }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={alPulsar}
      className={'rounded-full px-3 py-1.5 text-sm ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 motion-reduce:transition-none ' + (activo ? 'bg-acento-50 font-semibold text-acento-700 ring-acento-200' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50')}
    >
      {children}
    </button>
  );
}

// La IP en claro se borra al vencer su plazo; su huella sigue en la cadena
// 50 paginas de 100, por debajo del limite general de peticiones por minuto del backend
const MAXIMO_EXPORTACION = 5000;

const COLUMNAS_CSV = ['Registro', 'Fecha (hora local)', 'Fecha ISO', 'Acción', 'Descripción', 'Usuario', 'Rol', 'Detalles', 'IP', 'Detalles JSON', 'Sello'];

function filaCsv(e) {
  return [
    e.id,
    fechaHora(e.fecha),
    e.fecha,
    e.accion,
    NOMBRE_ACCION[e.accion] || e.accion,
    e.email || textoSinCuenta(e),
    NOMBRE_ROL[e.rol] || e.rol || '',
    textoDetalles(e),
    textoIp(e),
    e.detalles === null ? '' : JSON.stringify(e.detalles),
    e.hash_actual
  ];
}

function textoSinCuenta(entrada) {
  return ACCIONES_DEL_SISTEMA.includes(entrada.accion) ? 'Sistema (mantenimiento diario)' : 'Sin cuenta identificada';
}

function textoIp(entrada) {
  if (entrada.ip_origen) return entrada.ip_origen;
  return entrada.ip_borrada ? 'Borrada por plazo' : '—';
}

function BadgeAccion({ entrada, alterada }) {
  if (alterada) return <Badge tono="rojo">Alterado: {NOMBRE_ACCION[entrada.accion] || entrada.accion}</Badge>;
  return <Badge tono={ACCIONES_FALLIDAS.includes(entrada.accion) ? 'rojo' : 'gris'}>{NOMBRE_ACCION[entrada.accion] || entrada.accion}</Badge>;
}

function Usuario({ entrada }) {
  if (!entrada.email) return <span className="text-gray-600">{textoSinCuenta(entrada)}</span>;
  return (
    <>
      {entrada.email}
      <span className="block text-xs text-gray-600">{NOMBRE_ROL[entrada.rol] || entrada.rol}</span>
    </>
  );
}

function BotonComprobar({ id, alPulsar }) {
  return (
    <button
      type="button"
      onClick={() => alPulsar(id)}
      aria-label={'Comprobar el sello del registro #' + id}
      className="rounded py-1 text-xs font-semibold text-acento-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
    >
      Comprobar
    </button>
  );
}

// Explicacion para quien no es tecnico: el libro foliado. Si la cadena esta rota, el dibujo marca el eslabon roto
function QueDemuestra({ estado, rutaConstancias }) {
  const rota = [estado.verificacion_logs, estado.verificacion_donaciones].find((v) => !v.integra);
  const eslabones = rota
    ? [{ texto: '#' + (rota.id_roto - 1), tono: 'ok' }, { texto: '#' + rota.id_roto, tono: 'roto' }, { texto: '#' + (rota.id_roto + 1), tono: 'gris' }]
    : [{ texto: 'Registro 1', tono: 'ok' }, { texto: 'Registro 2', tono: 'ok' }, { texto: 'Registro 3', tono: 'ok' }];
  const TONO = {
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    roto: 'border-red-400 bg-red-50 text-red-800',
    gris: 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
  };

  return (
    <Panel titulo="¿Qué demuestra esto?" className="xl:sticky xl:top-8">
      <p className="text-sm text-gray-700">
        Piense en un libro de actas con folios. Cada registro recibe un <strong className="font-semibold text-gray-900">sello</strong>: un
        código calculado con lo que dice el registro y con el sello del registro anterior.
      </p>

      <div className="my-4 flex items-center gap-1.5" aria-hidden="true">
        {eslabones.map((eslabon, indice) => (
          <div key={eslabon.texto} className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className={'min-w-0 flex-1 rounded-lg border px-2 py-2 text-center text-xs font-semibold ' + TONO[eslabon.tono]}>
              <span className="block truncate">{eslabon.texto}</span>
              <span className="block font-mono text-[10px] font-normal">{eslabon.tono === 'roto' ? 'no cuadra' : eslabon.tono === 'gris' ? 'ya no cuadra' : 'sello ok'}</span>
            </div>
            {indice < eslabones.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-gray-400" />}
          </div>
        ))}
      </div>

      <ol className="space-y-3 text-sm text-gray-700">
        <li><strong className="font-semibold text-gray-900">1. Si alguien cambia un dato,</strong> el sello de ese registro ya no corresponde a lo que dice.</li>
        <li><strong className="font-semibold text-gray-900">2. Como cada sello incluye el anterior,</strong> todos los registros siguientes dejan de cuadrar. No se puede corregir uno sin que se note.</li>
        <li>
          <strong className="font-semibold text-gray-900">3. Para no depender de lo que diga el sistema,</strong> imprima una constancia con el sello de hoy y guárdela.
          Cuando quiera, compruébela: si la historia ya no produce ese sello, alguien la reescribió.
        </li>
      </ol>
      <p className="mt-3 text-sm text-gray-700">
        En la bitácora, «Comprobar» vuelve a calcular el sello de un registro en su propio navegador.
      </p>
      <Link to={rutaConstancias} className={clasesBoton('suave') + ' mt-4 w-full'}>Emitir o comprobar una constancia</Link>
    </Panel>
  );
}

const ETIQUETA_CAMPO = { id_usuario: 'Usuario (id)', accion: 'Acción', detalles: 'Detalles', ip_hmac: 'Huella de la IP', fecha: 'Fecha y hora (UTC)' };

// Ficha de un eslabon: lo que entro al sello, el sello anterior y el sello recalculado en este navegador.
// El recalculo no usa la verificacion del servidor; solo SHA-256 sobre los mismos datos
function FichaEslabon({ id, alCambiar, alCerrar }) {
  const consulta = useConsulta(() => auditoria.eslabon(id), [id]);
  const [recalculado, setRecalculado] = useState(null);
  const [errorCalculo, setErrorCalculo] = useState(null);
  const datos = consulta.datos?.eslabon;

  useEffect(() => {
    setRecalculado(null);
    setErrorCalculo(null);
    if (!datos) return undefined;
    let vigente = true;
    calcularSello(datos.campos, datos.sello_anterior)
      .then((sello) => vigente && setRecalculado(sello))
      .catch((e) => vigente && setErrorCalculo(e.message));
    return () => { vigente = false; };
  }, [datos]);

  useEffect(() => {
    const alTeclear = (evento) => evento.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);

  const coincide = recalculado && datos && recalculado === datos.sello;
  const valorCampo = (llave, valor) => (llave === 'detalles' ? canonico(valor) || '(sin detalles)' : valor === null || valor === undefined ? '(vacío)' : String(valor));

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-gray-900/40 p-0 sm:items-center sm:p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-eslabon"
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-eslabon" className="text-base font-bold text-gray-900">Comprobar el registro #{id}</h3>
            {datos && <p className="text-sm text-gray-600">{NOMBRE_ACCION[datos.campos.accion] || datos.campos.accion} · {fechaHora(datos.campos.fecha)}</p>}
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="size-5" />
          </button>
        </div>

        {consulta.cargando ? <Cargando /> : consulta.error ? <Aviso>{consulta.error.message}</Aviso> : (
          <div className="space-y-5">
            <div className={'rounded-xl border p-4 ' + (errorCalculo ? 'border-amber-300 bg-amber-50' : !recalculado ? 'border-gray-200 bg-gray-50' : coincide ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50')}>
              {errorCalculo ? (
                <p className="text-sm text-amber-900">{errorCalculo}</p>
              ) : !recalculado ? (
                <p className="text-sm text-gray-700">Calculando el sello en su navegador...</p>
              ) : coincide ? (
                <p className="flex items-start gap-2 text-sm text-emerald-900">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span><strong className="font-semibold">El sello cuadra.</strong> Su navegador volvió a calcularlo con los datos de abajo y dio exactamente el sello guardado: este registro no cambió desde que se selló.</span>
                </p>
              ) : (
                <p className="flex items-start gap-2 text-sm text-red-900">
                  <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span><strong className="font-semibold">El sello no cuadra.</strong> Con los datos actuales sale un sello distinto al guardado: este registro, o el anterior, cambió después de sellarse.</span>
                </p>
              )}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-3">
                <dt className="text-xs text-gray-600">Sello guardado</dt>
                <dd className="font-mono text-base font-semibold tracking-wider text-gray-900">{selloLegible(datos.sello)}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <dt className="text-xs text-gray-600">Sello recalculado en su navegador</dt>
                <dd className={'font-mono text-base font-semibold tracking-wider ' + (recalculado && !coincide ? 'text-red-700' : 'text-gray-900')}>{recalculado ? selloLegible(recalculado) : '—'}</dd>
              </div>
            </dl>

            <section>
              <h4 className="text-sm font-semibold text-gray-900">Qué se selló, en este orden</h4>
              <dl className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
                {Object.keys(ETIQUETA_CAMPO).map((llave) => (
                  <div key={llave} className="grid gap-1 px-3 py-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
                    <dt className="text-gray-600">{ETIQUETA_CAMPO[llave]}</dt>
                    <dd className="break-all font-mono text-xs text-gray-900">{valorCampo(llave, datos.campos[llave])}</dd>
                  </div>
                ))}
                <div className="grid gap-1 px-3 py-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
                  <dt className="text-gray-600">Sello anterior</dt>
                  <dd className="break-all font-mono text-xs text-gray-900">
                    {datos.id_anterior ? datos.sello_anterior + ' (registro #' + datos.id_anterior + ')' : datos.sello_anterior + ' (primer registro: sello inicial de ceros)'}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-gray-600">
                El sello es SHA-256 de esos valores unidos con «|». La IP se sella como huella para poder borrarla a los 90 días sin romper la cadena.
              </p>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <Boton variante="contorno" disabled={!datos.id_anterior} onClick={() => alCambiar(datos.id_anterior)}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Registro anterior
              </Boton>
              <p className="text-xs text-gray-600">{datos.id_siguiente ? 'El registro #' + datos.id_siguiente + ' usa este sello como anterior.' : 'Es el registro más reciente.'}</p>
              <Boton variante="contorno" disabled={!datos.id_siguiente} onClick={() => alCambiar(datos.id_siguiente)}>
                Registro siguiente <ArrowRight className="size-4" aria-hidden="true" />
              </Boton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
