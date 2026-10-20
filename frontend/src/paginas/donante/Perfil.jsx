import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { donantes, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { useSesion } from '../../contexto/SesionContext.jsx';
import { Aviso, Boton, Campo, EncabezadoPagina, EstadoConsulta, FichaSangre, Selector, Tarjeta } from '../../componentes/ui.jsx';
import { TarjetaInstalar } from '../../componentes/Pwa.jsx';
import { fecha, nombreRegion } from '../../utils/formato.js';

export default function Perfil() {
  const { cerrarSesion } = useSesion();
  const consulta = useConsulta(() => donantes.perfil());
  const [editando, setEditando] = useState(false);

  return (
    <>
      <EncabezadoPagina titulo="Mi perfil" descripcion="Tus datos personales se guardan cifrados. El hospital nunca ve tu nombre ni tu teléfono." />

      <EstadoConsulta consulta={consulta}>
        {({ perfil }) => (
          <div className="divide-y divide-gray-200">
            <FilaAjuste titulo="Identidad" descripcion="Tu tipo de sangre decide qué solicitudes te avisan.">
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5">
                <FichaSangre tipo={perfil.tipo_sangre} tamano="lg" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-gray-900">{perfil.nombre_completo}</p>
                  <p className="truncate text-sm text-gray-600">{perfil.email}</p>
                </div>
              </div>
            </FilaAjuste>

            <FilaAjuste
              titulo="Datos personales"
              descripcion="Teléfono, peso y ubicación se pueden actualizar. Tu región define a qué hospitales atiendes primero."
            >
              {editando ? (
                <FormularioPerfil
                  perfil={perfil}
                  alTerminar={async (guardado) => {
                    if (guardado) await consulta.recargar();
                    setEditando(false);
                  }}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white">
                  <dl className="divide-y divide-gray-100 px-5 text-sm">
                    <Dato etiqueta="Teléfono" valor={perfil.telefono || 'Sin registrar'} />
                    <Dato etiqueta="Fecha de nacimiento" valor={fecha(perfil.fecha_nacimiento + 'T12:00:00')} />
                    <Dato etiqueta="Peso" valor={perfil.peso_kg ? perfil.peso_kg + ' kg' : 'Sin registrar'} />
                    <Dato etiqueta="Colonia" valor={perfil.ubicacion.colonia} />
                    <Dato etiqueta="Municipio" valor={perfil.ubicacion.municipio} />
                    <Dato etiqueta="Región" valor={nombreRegion(perfil.ubicacion.region)} />
                    <Dato etiqueta="Última donación" valor={perfil.ultima_donacion ? fecha(perfil.ultima_donacion) : 'Ninguna'} />
                  </dl>
                  <div className="border-t border-gray-100 px-5 py-3">
                    <Boton variante="suave" className="px-3 py-1.5" onClick={() => setEditando(true)}>Editar datos</Boton>
                  </div>
                </div>
              )}
            </FilaAjuste>

            <FilaAjuste titulo="Aplicación" descripcion="Instálala para abrirla desde tu pantalla de inicio y recibir avisos más rápido.">
              <TarjetaInstalar sinOpcion={<p className="text-sm text-gray-600">La app ya está instalada o tu navegador no permite instalarla.</p>} />
            </FilaAjuste>

            <FilaAjuste titulo="Sesión" descripcion="Cierra la sesión en este dispositivo.">
              <Boton variante="contorno" onClick={cerrarSesion}>
                <LogOut className="size-4" aria-hidden="true" />
                Cerrar sesión
              </Boton>
            </FilaAjuste>
          </div>
        )}
      </EstadoConsulta>
    </>
  );
}

function FilaAjuste({ titulo, descripcion, children }) {
  return (
    <section className="grid gap-4 py-6 first:pt-0 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
        <p className="mt-1 text-sm text-gray-600">{descripcion}</p>
      </div>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </section>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-gray-600">{etiqueta}</dt>
      <dd className="text-right font-medium text-gray-900">{valor}</dd>
    </div>
  );
}

// Solo envia los campos que cambiaron; la colonia se manda junto con su municipio elegido
function FormularioPerfil({ perfil, alTerminar }) {
  const [telefono, setTelefono] = useState(perfil.telefono || '');
  const [peso, setPeso] = useState(perfil.peso_kg ? String(perfil.peso_kg) : '');
  const [idMunicipio, setIdMunicipio] = useState('');
  const [idColonia, setIdColonia] = useState('');
  const [coloniaPersonalizada, setColoniaPersonalizada] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const consultaMunicipios = useConsulta(() => ubicaciones.municipios());
  const consultaColonias = useConsulta(
    () => (idMunicipio ? ubicaciones.colonias(idMunicipio) : Promise.resolve(null)),
    [idMunicipio]
  );
  const colonias = consultaColonias.datos?.colonias || [];
  const esOtra = colonias.find((c) => String(c.id) === idColonia)?.nombre === 'Otra';

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    const cambios = {};
    if (telefono !== (perfil.telefono || '')) {
      if (telefono && !/^\d{10}$/.test(telefono)) return setError('El teléfono debe tener 10 dígitos.');
      cambios.telefono = telefono || null;
    }
    if (peso && Number(peso) !== perfil.peso_kg) {
      if (Number(peso) < 50) return setError('El peso mínimo para donar es 50 kg.');
      cambios.peso_kg = Number(peso);
    }
    if (idColonia) {
      cambios.id_colonia = Number(idColonia);
      if (esOtra) {
        if (!coloniaPersonalizada.trim()) return setError('Escribe el nombre de tu colonia.');
        cambios.colonia_personalizada = coloniaPersonalizada.trim();
      }
    }
    if (Object.keys(cambios).length === 0) return alTerminar(false);

    setGuardando(true);
    try {
      await donantes.actualizarPerfil(cambios);
      await alTerminar(true);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <>
      <Tarjeta>
        <form onSubmit={guardar} className="grid gap-4 lg:grid-cols-2" noValidate>
          <Campo etiqueta="Teléfono" id="telefono" type="tel" inputMode="numeric" maxLength={10} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Campo etiqueta="Peso en kg" id="peso" type="number" inputMode="decimal" min="50" max="300" value={peso} onChange={(e) => setPeso(e.target.value)} />
          <Selector
            etiqueta="Cambiar municipio (opcional)"
            id="municipio"
            value={idMunicipio}
            onChange={(e) => { setIdMunicipio(e.target.value); setIdColonia(''); }}
            vacio="Mantener ubicación actual"
            opciones={(consultaMunicipios.datos?.municipios || []).map((m) => ({ valor: String(m.id), texto: m.nombre }))}
          />
          {idMunicipio && (
            <Selector
              etiqueta="Colonia"
              id="colonia"
              value={idColonia}
              onChange={(e) => setIdColonia(e.target.value)}
              opciones={colonias.map((c) => ({ valor: String(c.id), texto: c.nombre }))}
            />
          )}
          {esOtra && (
            <Campo etiqueta="Nombre de tu colonia" id="colonia_personalizada" value={coloniaPersonalizada} onChange={(e) => setColoniaPersonalizada(e.target.value)} />
          )}
          <Aviso className="lg:col-span-2">{error}</Aviso>
          <div className="flex gap-2 lg:col-span-2">
            <Boton type="submit" cargando={guardando} className="flex-1">Guardar</Boton>
            <Boton variante="neutro" onClick={() => alTerminar(false)} disabled={guardando}>Cancelar</Boton>
          </div>
        </form>
      </Tarjeta>
    </>
  );
}
