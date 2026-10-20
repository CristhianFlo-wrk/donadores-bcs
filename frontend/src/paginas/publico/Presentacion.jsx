import { Link } from 'react-router';
import { BellRing, ClipboardPlus, Droplet, EyeOff, HeartHandshake, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { COLOR_REGION, NOMBRES_REGION } from '../../utils/formato.js';

// Municipios atendidos por region (coinciden con el catalogo de la base)
const COBERTURA = [
  { region: 'norte', municipios: ['Mulegé'] },
  { region: 'centro', municipios: ['Loreto', 'Comondú'] },
  { region: 'sur', municipios: ['La Paz', 'Los Cabos'] }
];

const PASOS = [
  {
    icono: ClipboardPlus,
    titulo: 'El hospital publica la necesidad',
    texto: 'Indica el tipo de sangre, las unidades requeridas y la urgencia de la solicitud.'
  },
  {
    icono: BellRing,
    titulo: 'Avisamos a donantes compatibles',
    texto: 'El sistema identifica a los donantes compatibles, disponibles y que ya cumplieron el tiempo de espera entre donaciones, y les envía una alerta.'
  },
  {
    icono: HeartHandshake,
    titulo: 'El donante confirma y acude',
    texto: 'Responde desde su celular, se presenta con su código de asistencia y el hospital registra la donación.'
  }
];

const SEGURIDAD = [
  {
    icono: LockKeyhole,
    titulo: 'Datos personales cifrados',
    texto: 'Nombre y teléfono se guardan cifrados con AES-256; la CURP nunca se almacena en texto plano.'
  },
  {
    icono: EyeOff,
    titulo: 'Privacidad del donante',
    texto: 'El hospital no ve nombres: cada donante se identifica con un código de asistencia.'
  },
  {
    icono: ShieldCheck,
    titulo: 'Historial a prueba de alteraciones',
    texto: 'Cada donación y movimiento queda encadenado con hashes SHA-256 que permiten detectar cualquier cambio.'
  },
  {
    icono: KeyRound,
    titulo: 'Acceso por roles',
    texto: 'Donantes, hospitales y administradores solo ven y hacen lo que les corresponde.'
  }
];

export default function Presentacion() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-red-600">
              <Droplet className="size-5 fill-white text-white" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold text-gray-900">Donadores BCS</span>
          </Link>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-red-700 text-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Conectamos a hospitales con donantes compatibles en Baja California Sur
            </h1>
            <p className="mt-5 max-w-xl text-lg text-red-50">
              Cuando un hospital necesita sangre, el sistema localiza a los donantes disponibles del tipo adecuado y les avisa al momento.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/registro"
                className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Quiero ser donante
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="titulo-pasos">
          <h2 id="titulo-pasos" className="text-2xl font-bold tracking-tight text-gray-900">Tres pasos, de la solicitud a la donación</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {PASOS.map((paso, indice) => (
              <li key={paso.titulo} className={'rounded-xl p-5 ' + (indice === 0 ? 'bg-red-50' : 'border border-gray-200 bg-white')}>
                <paso.icono className="size-6 text-red-600" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-gray-900">{paso.titulo}</h3>
                <p className="mt-1 text-sm text-gray-700">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-gray-200 bg-white" aria-labelledby="titulo-cobertura">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 id="titulo-cobertura" className="text-2xl font-bold tracking-tight text-gray-900">Los cinco municipios del estado</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-700">
              Donantes y hospitales se organizan en tres regiones, de modo que cada hospital puede convocar a los donantes de su zona.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {COBERTURA.map((zona) => (
                <div key={zona.region} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <span className={'inline-block size-2 rounded-full ' + COLOR_REGION[zona.region]} aria-hidden="true" />
                    {NOMBRES_REGION[zona.region]}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">{zona.municipios.join(' · ')}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="titulo-seguridad">
          <div className="rounded-xl bg-gray-950 p-6 sm:p-8">
            <h2 id="titulo-seguridad" className="text-2xl font-bold tracking-tight text-white">Seguridad desde el diseño</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SEGURIDAD.map((punto) => (
                <div key={punto.titulo} className="rounded-xl bg-white/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <punto.icono className="size-4" aria-hidden="true" />
                    {punto.titulo}
                  </p>
                  <p className="mt-1 text-sm text-gray-300">{punto.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl bg-red-50 p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Una donación puede ayudar hasta a tres pacientes</h2>
              <p className="mt-1 text-sm text-gray-700">Regístrate en minutos y recibe avisos solo cuando tu sangre sea compatible.</p>
            </div>
            <Link
              to="/registro"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Quiero ser donante
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-6 text-xs text-gray-600 sm:flex-row sm:justify-between">
          <p>Donadores BCS • Baja California Sur</p>
          <p>Proyecto de Ingeniería en Desarrollo de Software, UABCS</p>
        </div>
      </footer>
    </div>
  );
}
