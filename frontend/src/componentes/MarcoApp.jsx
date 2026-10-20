import { NavLink } from 'react-router';
import { Droplet, LogOut } from 'lucide-react';
import PieLegal from './PieLegal.jsx';

function Marca({ alcance }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-acento-600">
        <Droplet className="size-4 fill-white text-white" aria-hidden="true" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-bold text-gray-900">Donadores BCS</span>
        <span className="block truncate text-xs text-gray-600">{alcance}</span>
      </span>
    </div>
  );
}

function Contador({ valor, etiqueta, className = '' }) {
  if (!valor) return null;
  return (
    <span className={'inline-flex min-w-5 items-center justify-center rounded-full bg-acento-600 px-1.5 text-[11px] font-semibold leading-5 text-white ' + className}>
      {valor}
      <span className="sr-only"> {etiqueta}</span>
    </span>
  );
}


export default function MarcoApp({ tono, alcance, secciones, correo, alSalir, children }) {
  return (
    <div className={'tono-' + tono + ' min-h-dvh bg-fondo lg:grid lg:grid-cols-[248px_minmax(0,1fr)]'}>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-gray-200/80 px-3 py-5 lg:flex">
        <div className="px-2">
          <Marca alcance={alcance} />
        </div>

        <nav aria-label="Secciones" className="mt-8 flex-1">
          <ul className="space-y-0.5">
            {secciones.map(({ ruta, texto, Icono, exacta, contador }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  end={exacta}
                  className={({ isActive }) =>
                    'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ' +
                    (isActive ? 'bg-acento-50 font-semibold text-acento-800' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icono className={'size-4 ' + (isActive ? 'text-acento-600' : 'text-gray-500 group-hover:text-gray-700')} aria-hidden="true" />
                      <span className="flex-1">{texto}</span>
                      <Contador valor={contador?.valor} etiqueta={contador?.etiqueta} />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-gray-200 px-2 pt-4">
          <p className="truncate text-xs text-gray-600" title={correo}>{correo}</p>
          <button
            type="button"
            onClick={alSalir}
            className="mt-2 inline-flex items-center gap-2 rounded-lg py-1 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 md:px-8 lg:hidden">
        <Marca alcance={alcance} />
        <button
          type="button"
          onClick={alSalir}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Salir</span>
          <span className="sr-only sm:hidden">Cerrar sesión</span>
        </button>
      </header>

      <div className="min-w-0">
        <main className="px-4 pb-28 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pb-10 xl:px-12">
          {children}
          <PieLegal />
        </main>
      </div>

      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="mx-auto flex max-w-xl">
          {secciones.map(({ ruta, texto, textoCorto, Icono, exacta, contador }) => (
            <li key={ruta} className="flex-1">
              <NavLink
                to={ruta}
                end={exacta}
                className={({ isActive }) =>
                  'relative flex flex-col items-center gap-1 px-1 pb-2 pt-2 text-[11px] ' +
                  (isActive ? 'font-semibold text-acento-700' : 'text-gray-600 hover:text-gray-900')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={'flex h-7 w-12 items-center justify-center rounded-full ' + (isActive ? 'bg-acento-50' : '')}>
                      <Icono className="size-5" aria-hidden="true" />
                    </span>
                    {textoCorto || texto}
                    <Contador valor={contador?.valor} etiqueta={contador?.etiqueta} className="absolute left-1/2 top-1 ml-2" />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
