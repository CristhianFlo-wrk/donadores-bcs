import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function BloqueIntegridad({ verificacion, titulo = 'Último registro verificado' }) {
  const integra = verificacion.integra;
  const hash = verificacion.ultimo_hash;
  const Icono = integra ? ShieldCheck : ShieldAlert;

  // Sin registros no hay nada que verificar: ni verde ni el hash genesis de ceros
  if (integra && verificacion.total === 0) {
    return (
      <section aria-label="Estado de integridad" className="rounded-xl bg-gray-950 p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Shield className="size-4" aria-hidden="true" />
          Sin registros todavía
        </p>
        <p className="mt-3 text-xs text-gray-400">Cada registro nuevo se encadena con SHA-256 y se verifica aquí.</p>
      </section>
    );
  }

  return (
    <section aria-label="Estado de integridad" className="rounded-xl bg-gray-950 p-5 text-white">
      <p className={'flex items-center gap-2 text-sm font-semibold ' + (integra ? 'text-emerald-400' : 'text-red-400')}>
        <Icono className="size-4" aria-hidden="true" />
        {integra ? 'Integridad verificada' : 'Integridad comprometida'}
      </p>
      <p className="mt-1 text-sm text-gray-300">{titulo}</p>
      <p className="mt-3 break-all rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-gray-300">
        {integra ? hash : 'Registro alterado: #' + verificacion.id_roto}
      </p>
      <p className="mt-3 text-xs text-gray-400">
        {integra
          ? verificacion.total + (verificacion.total === 1 ? ' registro encadenado' : ' registros encadenados') + ' con SHA-256. Ninguno ha sido alterado.'
          : verificacion.mensaje}
      </p>
    </section>
  );
}
