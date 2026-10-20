import { Link } from 'react-router';
import { ArrowLeft, LoaderCircle } from 'lucide-react';

// Componentes visuales base. "acento" es el color del rol activo (rojo donante, azul panel),
// definido en index.css; ver frontendContext/frontContext.md

const VARIANTES_BOTON = {
  primario: 'bg-acento-600 text-white hover:bg-acento-700',
  suave: 'bg-acento-50 text-acento-700 hover:bg-acento-100',
  neutro: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  contorno: 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50',
  peligro: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50'
};

export const CLASES_BOTON = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 disabled:cursor-not-allowed disabled:opacity-60 ';

export function clasesBoton(variante = 'primario') {
  return CLASES_BOTON + VARIANTES_BOTON[variante];
}

export function Boton({ variante = 'primario', cargando = false, className = '', children, disabled, type = 'button', ...resto }) {
  return (
    <button type={type} disabled={disabled || cargando} className={clasesBoton(variante) + ' ' + className} {...resto}>
      {cargando && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function EnlaceBoton({ variante = 'primario', className = '', children, ...resto }) {
  return (
    <Link className={clasesBoton(variante) + ' ' + className} {...resto}>
      {children}
    </Link>
  );
}

export function Tarjeta({ className = '', children, ...resto }) {
  return (
    <div className={'rounded-xl border border-gray-200 bg-white p-5 ' + className} {...resto}>
      {children}
    </div>
  );
}

// Tarjeta con encabezado propio: titulo a la izquierda y una accion opcional a la derecha
export function Panel({ titulo, detalle, accion, className = '', cuerpo = 'p-5', children, ...resto }) {
  return (
    <section className={'rounded-xl border border-gray-200 bg-white ' + className} {...resto}>
      {(titulo || accion) && (
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
            {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
          </div>
          {accion}
        </header>
      )}
      <div className={cuerpo}>{children}</div>
    </section>
  );
}

// Titulo de cada pantalla: un h1 de 24px, una linea opcional y las acciones a la derecha
export function EncabezadoPagina({ titulo, descripcion, acciones, volver, antes }) {
  return (
    <div className="mb-6">
      {volver && (
        <Link to={volver.ruta} className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {volver.texto}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {antes}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{titulo}</h1>
            {descripcion && <div className="mt-1 text-sm text-gray-600">{descripcion}</div>}
          </div>
        </div>
        {acciones && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{acciones}</div>}
      </div>
    </div>
  );
}

const TONOS_BADGE = {
  rojo: 'bg-red-50 text-red-700 ring-red-200',
  amarillo: 'bg-amber-50 text-amber-800 ring-amber-200',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  azul: 'bg-blue-50 text-blue-700 ring-blue-200',
  acento: 'bg-acento-50 text-acento-700 ring-acento-200',
  gris: 'bg-gray-50 text-gray-600 ring-gray-200'
};

export function Badge({ tono = 'gris', className = '', children }) {
  return (
    <span className={'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ' + TONOS_BADGE[tono] + ' ' + className}>
      {children}
    </span>
  );
}

export function Punto({ color = 'bg-emerald-500' }) {
  return <span className={'inline-block size-2 shrink-0 rounded-full ' + color} aria-hidden="true" />;
}

const MEDIDAS_FICHA = {
  sm: 'h-8 min-w-10 px-1.5 text-sm',
  md: 'h-11 min-w-12 px-2 text-base',
  lg: 'h-14 min-w-16 px-3 text-xl'
};

// El tipo de sangre es el objeto central del sistema: siempre se muestra con esta ficha
export function FichaSangre({ tipo, tamano = 'md', className = '' }) {
  return (
    <span
      className={'inline-flex shrink-0 items-center justify-center rounded-lg bg-red-50 font-bold text-red-700 ring-1 ring-inset ring-red-200 ' + MEDIDAS_FICHA[tamano] + ' ' + className}
      aria-label={'Tipo de sangre ' + tipo}
    >
      {tipo}
    </span>
  );
}

// Varias cifras del mismo nivel en un solo contenedor dividido
export function TiraMetricas({ metricas, className = '' }) {
  const columnas = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5' }[metricas.length] || 'sm:grid-cols-3';
  return (
    <dl className={'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 ' + columnas + ' ' + className}>
      {metricas.map((m, indice) => (
        <div
          key={m.etiqueta}
          className={'bg-white px-5 py-4 ' + (metricas.length % 2 === 1 && indice === metricas.length - 1 ? 'col-span-2 sm:col-span-1' : '')}
        >
          <dt className="text-sm text-gray-600">{m.etiqueta}</dt>
          <dd className={'mt-1 text-2xl font-semibold tabular-nums ' + (m.color || 'text-gray-900')}>{m.valor}</dd>
          {m.detalle && <dd className="mt-0.5 text-xs text-gray-500">{m.detalle}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function BarraProgreso({ valor, maximo, etiqueta, className = '' }) {
  const completa = valor >= maximo;
  const porcentaje = maximo > 0 ? Math.min(100, Math.round((valor * 100) / maximo)) : 0;
  return (
    <div
      className={'h-2 overflow-hidden rounded-full ' + (completa ? 'bg-emerald-100' : 'bg-acento-100') + ' ' + className}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={maximo}
      aria-valuenow={valor}
    >
      <div className={'h-full rounded-full ' + (completa ? 'bg-emerald-600' : 'bg-acento-600')} style={{ width: porcentaje + '%' }} />
    </div>
  );
}

// Pestanas subrayadas sobre una linea; se desplazan de lado en celular sin mover la pagina
export function Pestanas({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div className="border-b border-gray-200">
      <div className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button
            key={o.texto}
            type="button"
            role="tab"
            aria-selected={valor === o.valor}
            onClick={() => alCambiar(o.valor)}
            className={'whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors ' + (valor === o.valor ? 'border-acento-600 font-semibold text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800')}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

const CLASES_CAMPO = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-acento-600 focus:outline-none focus:ring-2 focus:ring-acento-100 disabled:bg-gray-50';

export function Campo({ etiqueta, id, ayuda, error, className = '', ...resto }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-800">{etiqueta}</label>
      <input id={id} className={CLASES_CAMPO} aria-invalid={Boolean(error)} {...resto} />
      {ayuda && !error && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function AreaTexto({ etiqueta, id, ayuda, className = '', ...resto }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-800">{etiqueta}</label>
      <textarea id={id} className={CLASES_CAMPO} {...resto} />
      {ayuda && <p className="mt-1 text-xs text-gray-500">{ayuda}</p>}
    </div>
  );
}

export function Selector({ etiqueta, id, opciones, vacio = 'Selecciona una opción', className = '', ...resto }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-800">{etiqueta}</label>
      <select id={id} className={CLASES_CAMPO} {...resto}>
        <option value="">{vacio}</option>
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>{opcion.texto}</option>
        ))}
      </select>
    </div>
  );
}

const TONOS_AVISO = {
  error: 'border-red-200 bg-red-50 text-red-800',
  exito: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  aviso: 'border-amber-200 bg-amber-50 text-amber-900'
};

export function Aviso({ tono = 'error', children, className = '' }) {
  if (!children) return null;
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={'rounded-lg border px-3 py-2 text-sm ' + TONOS_AVISO[tono] + ' ' + className}>
      {children}
    </div>
  );
}

export function Cargando({ texto = 'Cargando...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500" role="status">
      <LoaderCircle className="size-5 animate-spin text-acento-600" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function Vacio({ titulo, children, className = '' }) {
  return (
    <div className={'rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center ' + className}>
      <p className="text-sm font-semibold text-gray-800">{titulo}</p>
      {children && <p className="mt-1 text-sm text-gray-600">{children}</p>}
    </div>
  );
}

// Envuelve el resultado de useConsulta: muestra carga, error con reintento o el contenido
export function EstadoConsulta({ consulta, children }) {
  if (consulta.cargando) return <Cargando />;
  if (consulta.error) {
    return (
      <Aviso>
        {consulta.error.message}{' '}
        <button type="button" className="font-semibold underline" onClick={consulta.recargar}>Reintentar</button>
      </Aviso>
    );
  }
  return children(consulta.datos);
}

export function TituloSeccion({ children, accion, id, className = '' }) {
  return (
    <div className={'mb-3 flex items-center justify-between gap-3 ' + className}>
      <h2 id={id} className="text-base font-semibold text-gray-900">{children}</h2>
      {accion}
    </div>
  );
}
