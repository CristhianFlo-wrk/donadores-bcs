import { Link } from 'react-router';
import { BellRing, Droplet, MonitorSmartphone, ShieldCheck } from 'lucide-react';

const PUNTOS = [
  { Icono: BellRing, texto: 'Alertas a donantes compatibles por tipo de sangre y región.' },
  { Icono: ShieldCheck, texto: 'Datos cifrados e historial de donaciones a prueba de alteraciones.' },
  { Icono: MonitorSmartphone, texto: 'Disponible en celular, tablet y computadora.' }
];

function Logo({ claro = false }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className={'flex size-10 items-center justify-center rounded-lg ' + (claro ? 'bg-white' : 'bg-red-600')}>
        <Droplet className={'size-5 ' + (claro ? 'fill-red-600 text-red-600' : 'fill-white text-white')} aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className={'text-sm font-bold ' + (claro ? 'text-white' : 'text-gray-900')}>Donadores BCS</p>
        <p className={'text-sm ' + (claro ? 'text-red-50' : 'text-gray-600')}>Red estatal de donación de sangre</p>
      </div>
    </Link>
  );
}

export default function MarcoPublico({ titulo, subtitulo, ancho = 'max-w-sm', children }) {
  return (
    <div className="tono-rojo min-h-dvh bg-fondo lg:grid lg:grid-cols-2">
      <aside className="hidden bg-red-700 text-white lg:block">
        <div className="sticky top-0 flex h-dvh flex-col justify-between p-12">
          <Logo claro />
          <div>
            <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
              Conectamos a hospitales con donantes compatibles en Baja California Sur
            </h2>
            <ul className="mt-8 space-y-4">
              {PUNTOS.map(({ Icono, texto }) => (
                <li key={texto} className="flex items-start gap-3 text-base text-white">
                  <Icono className="mt-0.5 size-5 shrink-0 text-red-200" aria-hidden="true" />
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-red-100">Universidad Autónoma de Baja California Sur</p>
        </div>
      </aside>

      <div className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
        <div className={'w-full ' + ancho}>
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{titulo}</h1>
            {subtitulo && <p className="mt-1 text-sm text-gray-600">{subtitulo}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
