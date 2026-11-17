import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { hospitales, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { Aviso, Badge, Boton, Campo, Dialogo, EncabezadoPagina, EstadoConsulta, Panel, Pestanas, Selector, Vacio } from '../../componentes/ui.jsx';
import { nombreRegion } from '../../utils/formato.js';

const VISTAS = [
  { valor: 'hospitales', texto: 'Hospitales' },
  { valor: 'colonias', texto: 'Colonias' }
];

const NOMBRE_INSTITUCION = {
  IMSS: 'IMSS',
  'IMSS-BIENESTAR': 'IMSS-Bienestar',
  ISSSTE: 'ISSSTE',
  SSBCS: 'Secretaría de Salud BCS',
  privado: 'Privado',
  otro: 'Otra institución'
};

// Ya existe en cada municipio y el backend la reserva: no se edita ni se desactiva
const COLONIA_OTRA = 'Otra';

// "24.1481, -110.3168" tal como lo copia Google Maps; vacio manda las dos vacias (sin coordenadas)
function leerCoordenadas(texto) {
  if (!texto.trim()) return { latitud: '', longitud: '' };
  const [latitud, longitud] = texto.split(',').map((parte) => parte.trim());
  return { latitud, longitud: longitud ?? '' };
}

const escribirCoordenadas = (registro) => (registro.latitud === null || registro.latitud === undefined ? '' : registro.latitud + ', ' + registro.longitud);

// Formulario de alta que tambien edita: al elegir un registro se llena con sus datos y se lleva a la vista
// (scroll-mt-20 deja libre la cabecera fija del celular)
function useFormulario(vacio, aDatos, editando) {
  const [datos, setDatos] = useState(vacio);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef(null);

  useEffect(() => {
    setAviso(null);
    setDatos(editando ? aDatos(editando) : vacio);
    if (editando) {
      formulario.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      formulario.current?.querySelector('input')?.focus({ preventScroll: true });
    }
  }, [editando]);

  const cambiar = (campo) => (e) => setDatos((actual) => ({ ...actual, [campo]: e.target.value }));

  async function enviar(evento, guardar) {
    evento.preventDefault();
    setAviso(null);
    setEnviando(true);
    try {
      await guardar();
    } catch (e) {
      setAviso({ tono: 'error', texto: e.message });
    } finally {
      setEnviando(false);
    }
  }

  return { datos, setDatos, aviso, setAviso, enviando, cambiar, enviar, formulario };
}

export default function Catalogos() {
  const [vista, setVista] = useState('hospitales');
  const consultaMunicipios = useConsulta(() => ubicaciones.municipios());
  const municipios = (consultaMunicipios.datos?.municipios || []).map((m) => ({ valor: String(m.id), texto: m.nombre + ' (' + nombreRegion(m.region) + ')' }));

  return (
    <>
      <EncabezadoPagina titulo="Hospitales y colonias" descripcion="Los hospitales reciben cuentas y solicitudes; las colonias aparecen en el registro de donantes." />
      <Pestanas opciones={VISTAS} valor={vista} alCambiar={setVista} etiqueta="Catálogo" />
      <div className="mt-6">
        {vista === 'hospitales' ? <Hospitales municipios={municipios} /> : <Colonias municipios={municipios} />}
      </div>
    </>
  );
}

function Hospitales({ municipios }) {
  const consulta = useConsulta(() => hospitales.listar({ incluir_inactivos: true }));
  const [editando, setEditando] = useState(null);
  const [porDesactivar, setPorDesactivar] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function cambiarActivo(hospital, activo) {
    setAviso(null);
    try {
      const respuesta = await hospitales.cambiarActivo(hospital.id, activo);
      const cuentas = respuesta.cuentas_desactivadas;
      setAviso({
        tono: 'exito',
        texto: activo
          ? hospital.nombre + ' está activo otra vez. Sus cuentas siguen desactivadas: actívalas en Usuarios si siguen vigentes.'
          : hospital.nombre + ' quedó desactivado' + (cuentas ? ' junto con ' + cuentas + (cuentas === 1 ? ' cuenta.' : ' cuentas.') : '.')
      });
      if (editando?.id === hospital.id) setEditando(null);
      await consulta.recargar();
    } catch (e) {
      setAviso({ tono: 'error', texto: e.message });
    } finally {
      setPorDesactivar(null);
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0" aria-label="Hospitales registrados">
        {aviso && <Aviso tono={aviso.tono} className="mb-4">{aviso.texto}</Aviso>}
        <EstadoConsulta consulta={consulta}>
          {({ hospitales: lista }) => {
            const activos = lista.filter((h) => h.activo).length;
            return (
              <div className="rounded-xl border border-gray-200 bg-white">
                <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                  {activos} {activos === 1 ? 'hospital activo' : 'hospitales activos'}
                  {lista.length > activos && ' y ' + (lista.length - activos) + (lista.length - activos === 1 ? ' desactivado' : ' desactivados')}
                </p>
                <ul className="divide-y divide-gray-100">
                  {lista.map((h) => (
                    <li key={h.id} className={'flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between ' + (editando?.id === h.id ? 'bg-acento-50' : '')}>
                      <div className={'min-w-0 ' + (h.activo ? '' : 'text-gray-500')}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className={'font-semibold ' + (h.activo ? 'text-gray-900' : 'text-gray-600')}>{h.nombre}</p>
                          <Badge tono={h.activo ? 'azul' : 'gris'}>{NOMBRE_INSTITUCION[h.institucion] || h.institucion}</Badge>
                          {!h.activo && <Badge tono="gris">Desactivado</Badge>}
                        </div>
                        <p className={'mt-1 text-sm ' + (h.activo ? 'text-gray-700' : '')}>{h.direccion}</p>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                          <span>{[h.municipio, nombreRegion(h.region)].filter(Boolean).join(' · ')}</span>
                          {h.telefono && <span>Tel. {h.telefono}</span>}
                          {h.clues && <span>CLUES {h.clues}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Boton variante="contorno" className="px-3 py-1.5" onClick={() => setEditando(h)} aria-label={'Editar ' + h.nombre}>Editar</Boton>
                        {h.activo
                          ? <Boton variante="peligro" className="px-3 py-1.5" onClick={() => setPorDesactivar(h)} aria-label={'Desactivar ' + h.nombre}>Desactivar</Boton>
                          : <Boton variante="suave" className="px-3 py-1.5" onClick={() => cambiarActivo(h, true)} aria-label={'Reactivar ' + h.nombre}>Reactivar</Boton>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }}
        </EstadoConsulta>
      </section>
      <FormularioHospital municipios={municipios} editando={editando} alTerminar={() => setEditando(null)} alGuardar={consulta.recargar} />
      {porDesactivar && (
        <Dialogo id="titulo-desactivar" titulo={'¿Desactivar ' + porDesactivar.nombre + '?'} alCerrar={() => setPorDesactivar(null)}>
          <ul className="list-disc space-y-1.5 pl-5 text-gray-700">
            <li>Ya no aparecerá para nuevas solicitudes ni para crear cuentas.</li>
            <li>Sus cuentas de acceso se desactivan en este momento.</li>
            <li>Sus solicitudes y donaciones pasadas se conservan. Puedes reactivarlo después.</li>
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setPorDesactivar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => cambiarActivo(porDesactivar, false)}>Desactivar hospital</Boton>
          </div>
        </Dialogo>
      )}
    </div>
  );
}

const HOSPITAL_VACIO = { nombre: '', institucion: '', id_municipio: '', direccion: '', telefono: '', clues: '', coordenadas: '' };

const datosDeHospital = (h) => ({
  nombre: h.nombre,
  institucion: h.institucion || '',
  id_municipio: h.id_municipio ? String(h.id_municipio) : '',
  direccion: h.direccion || '',
  telefono: h.telefono || '',
  clues: h.clues || '',
  coordenadas: escribirCoordenadas(h)
});

function FormularioHospital({ municipios, editando, alTerminar, alGuardar }) {
  const { datos, aviso, setAviso, enviando, cambiar, enviar, formulario, setDatos } = useFormulario(HOSPITAL_VACIO, datosDeHospital, editando);

  function guardar(evento) {
    return enviar(evento, async () => {
      const { coordenadas, ...resto } = datos;
      const cuerpo = { ...resto, id_municipio: Number(resto.id_municipio), ...leerCoordenadas(coordenadas) };
      if (editando) {
        const { hospital } = await hospitales.editar(editando.id, cuerpo);
        alTerminar();
        await alGuardar();
        setAviso({ tono: 'exito', texto: 'Se guardaron los cambios de ' + hospital.nombre + '.' });
      } else {
        const { hospital } = await hospitales.crear(cuerpo);
        setDatos(HOSPITAL_VACIO);
        await alGuardar();
        setAviso({ tono: 'exito', nombre: hospital.nombre });
      }
    });
  }

  const ancho = 'md:col-span-2 xl:col-span-1';
  return (
    <div ref={formulario} className="scroll-mt-20 xl:sticky xl:top-8">
      <Panel titulo={editando ? 'Editar hospital' : 'Nuevo hospital'} detalle={editando ? editando.nombre : 'Después créale su cuenta en Usuarios'}>
        <form onSubmit={guardar} className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <Campo etiqueta="Nombre del hospital" id="hospital-nombre" required minLength={3} maxLength={200} className={ancho} placeholder="Hospital General de Guerrero Negro" value={datos.nombre} onChange={cambiar('nombre')} />
          <Selector etiqueta="Institución" id="hospital-institucion" required vacio="Selecciona la institución" opciones={Object.entries(NOMBRE_INSTITUCION).map(([valor, texto]) => ({ valor, texto }))} value={datos.institucion} onChange={cambiar('institucion')} />
          <Selector etiqueta="Municipio" id="hospital-municipio" required vacio="Selecciona el municipio" opciones={municipios} value={datos.id_municipio} onChange={cambiar('id_municipio')} />
          <Campo etiqueta="Dirección" id="hospital-direccion" required minLength={10} maxLength={300} className={ancho} ayuda="Calle, número, colonia y localidad: la verán los donantes que vayan a donar" value={datos.direccion} onChange={cambiar('direccion')} />
          <Campo etiqueta="Teléfono del banco de sangre (opcional)" id="hospital-telefono" type="tel" inputMode="tel" ayuda="10 dígitos" value={datos.telefono} onChange={cambiar('telefono')} />
          <Campo etiqueta="CLUES (opcional)" id="hospital-clues" maxLength={11} placeholder="BSIMS000013" ayuda="Clave de 11 caracteres del catálogo de la Secretaría de Salud" className="[&_input]:uppercase" value={datos.clues} onChange={cambiar('clues')} />
          <Campo etiqueta="Coordenadas (opcional)" id="hospital-coordenadas" placeholder="24.1481, -110.3168" className={ancho} ayuda="En Google Maps, clic derecho sobre el hospital copia las dos" value={datos.coordenadas} onChange={cambiar('coordenadas')} />
          {aviso && (
            <Aviso tono={aviso.tono} className={ancho}>
              {aviso.nombre ? <>Se agregó {aviso.nombre}. <Link to="/admin/usuarios" className="font-semibold underline">Crear su cuenta</Link></> : aviso.texto}
            </Aviso>
          )}
          <div className={'flex flex-col gap-2 ' + ancho}>
            <Boton type="submit" cargando={enviando} className="w-full">{editando ? 'Guardar cambios' : 'Agregar hospital'}</Boton>
            {editando && <Boton variante="contorno" className="w-full" onClick={alTerminar}>Cancelar edición</Boton>}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function Colonias({ municipios }) {
  const [idMunicipio, setIdMunicipio] = useState('');
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const consulta = useConsulta(
    () => (idMunicipio ? ubicaciones.colonias(idMunicipio, { incluir_inactivas: true }) : Promise.resolve(null)),
    [idMunicipio]
  );

  function elegirMunicipio(valor) {
    setIdMunicipio(valor);
    setEditando(null);
    setAviso(null);
  }

  async function cambiarActivo(colonia) {
    setAviso(null);
    try {
      await ubicaciones.cambiarActivoColonia(colonia.id, !colonia.activo);
      setAviso({
        tono: 'exito',
        texto: colonia.activo
          ? colonia.nombre + ' ya no aparece en el registro. Los donantes que viven ahí la conservan.'
          : colonia.nombre + ' vuelve a aparecer en el registro.'
      });
      if (editando?.id === colonia.id) setEditando(null);
      await consulta.recargar();
    } catch (e) {
      setAviso({ tono: 'error', texto: e.message });
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0" aria-label="Colonias del municipio">
        <Selector etiqueta="Municipio" id="colonias-municipio" vacio="Selecciona un municipio" className="max-w-sm" opciones={municipios} value={idMunicipio} onChange={(e) => elegirMunicipio(e.target.value)} />
        {aviso && <Aviso tono={aviso.tono} className="mt-4">{aviso.texto}</Aviso>}
        <div className="mt-4">
          {!idMunicipio ? (
            <Vacio titulo="Elige un municipio">Verás sus colonias antes de agregar una, para no repetirla.</Vacio>
          ) : (
            <EstadoConsulta consulta={consulta}>
              {(datos) => {
                // Al cambiar de municipio hay un render antes de que la consulta marque que carga
                if (!datos) return null;
                const lista = datos.colonias.filter((c) => c.nombre !== COLONIA_OTRA);
                const activas = lista.filter((c) => c.activo).length;
                return (
                  <div className="rounded-xl border border-gray-200 bg-white">
                    <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-600">
                      {activas} {activas === 1 ? 'colonia' : 'colonias'} en {datos.municipio}
                      {lista.length > activas && ' y ' + (lista.length - activas) + (lista.length - activas === 1 ? ' desactivada' : ' desactivadas')}
                      , más "Otra" para quien no encuentre la suya
                    </p>
                    <ul className="divide-y divide-gray-100">
                      {lista.map((c) => (
                        <li key={c.id} className={'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 ' + (editando?.id === c.id ? 'bg-acento-50' : '')}>
                          <span className="flex min-w-0 items-baseline gap-3">
                            <span className={'text-sm ' + (c.activo ? 'text-gray-900' : 'text-gray-500 line-through')}>{c.nombre}</span>
                            <span className="text-xs tabular-nums text-gray-600">{c.codigo_postal}</span>
                            {!c.activo && <Badge tono="gris">Desactivada</Badge>}
                          </span>
                          <span className="flex shrink-0 gap-1">
                            <button type="button" className="rounded-md px-2 py-1 text-sm font-medium text-acento-700 hover:bg-acento-50" onClick={() => setEditando(c)} aria-label={'Editar ' + c.nombre}>Editar</button>
                            <button type="button" className={'rounded-md px-2 py-1 text-sm font-medium ' + (c.activo ? 'text-red-700 hover:bg-red-50' : 'text-acento-700 hover:bg-acento-50')} onClick={() => cambiarActivo(c)} aria-label={(c.activo ? 'Desactivar ' : 'Reactivar ') + c.nombre}>
                              {c.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }}
            </EstadoConsulta>
          )}
        </div>
      </section>
      <FormularioColonia
        idMunicipio={idMunicipio}
        municipio={municipios.find((m) => m.valor === idMunicipio)}
        editando={editando}
        alTerminar={() => setEditando(null)}
        alGuardar={consulta.recargar}
      />
    </div>
  );
}

const COLONIA_VACIA = { nombre: '', codigo_postal: '', coordenadas: '' };
const datosDeColonia = (c) => ({ nombre: c.nombre, codigo_postal: c.codigo_postal || '', coordenadas: escribirCoordenadas(c) });

function FormularioColonia({ idMunicipio, municipio, editando, alTerminar, alGuardar }) {
  const { datos, aviso, setAviso, enviando, cambiar, enviar, formulario, setDatos } = useFormulario(COLONIA_VACIA, datosDeColonia, editando);

  function guardar(evento) {
    return enviar(evento, async () => {
      const { coordenadas, ...resto } = datos;
      const cuerpo = { ...resto, ...leerCoordenadas(coordenadas) };
      if (editando) {
        const { colonia } = await ubicaciones.editarColonia(editando.id, cuerpo);
        alTerminar();
        await alGuardar();
        setAviso({ tono: 'exito', texto: 'Se guardaron los cambios de ' + colonia.nombre + '.' });
      } else {
        const { colonia } = await ubicaciones.crearColonia({ ...cuerpo, id_municipio: Number(idMunicipio) });
        setDatos(COLONIA_VACIA);
        await alGuardar();
        setAviso({ tono: 'exito', texto: 'Se agregó ' + colonia.nombre + '. Ya aparece en el registro de donantes.' });
      }
    });
  }

  const ancho = 'md:col-span-2 xl:col-span-1';
  const detalle = editando ? editando.nombre : municipio ? 'En ' + municipio.texto : 'Primero elige el municipio';
  return (
    <div ref={formulario} className="scroll-mt-20 xl:sticky xl:top-8">
      <Panel titulo={editando ? 'Editar colonia' : 'Nueva colonia'} detalle={detalle}>
        <form onSubmit={guardar} className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <fieldset disabled={!idMunicipio} className="contents">
            <Campo etiqueta="Nombre de la colonia" id="colonia-nombre" required minLength={2} maxLength={150} placeholder="Como aparece en el catálogo de Correos de México" value={datos.nombre} onChange={cambiar('nombre')} />
            <Campo etiqueta="Código postal" id="colonia-cp" required inputMode="numeric" pattern="23[0-9]{3}" maxLength={5} placeholder="23000" ayuda="5 dígitos; en BCS empiezan con 23" value={datos.codigo_postal} onChange={cambiar('codigo_postal')} />
            <Campo etiqueta="Coordenadas del centro (opcional)" id="colonia-coordenadas" placeholder="24.1426, -110.3128" className={ancho} value={datos.coordenadas} onChange={cambiar('coordenadas')} />
            {aviso && <Aviso tono={aviso.tono} className={ancho}>{aviso.texto}</Aviso>}
            <div className={'flex flex-col gap-2 ' + ancho}>
              <Boton type="submit" cargando={enviando} className="w-full">{editando ? 'Guardar cambios' : 'Agregar colonia'}</Boton>
              {editando && <Boton variante="contorno" className="w-full" onClick={alTerminar}>Cancelar edición</Boton>}
            </div>
          </fieldset>
        </form>
      </Panel>
    </div>
  );
}
