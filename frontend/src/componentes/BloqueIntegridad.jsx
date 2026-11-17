import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { selloLegible } from '../utils/formato.js';

// Resultado de verificar una cadena, en lenguaje para quien no es tecnico. El detalle tecnico queda al final, en letra chica.
// paraDonante: el aviso de cambio le habla de tu y omite el numero de registro y el detalle tecnico
export default function BloqueIntegridad({ verificacion, titulo = 'Último registro verificado', paraDonante = false }) {
  const integra = verificacion.integra;
  const hash = verificacion.ultimo_hash;
  const Icono = integra ? ShieldCheck : ShieldAlert;

  // Sin registros no hay nada que verificar: ni verde ni el sello inicial de ceros
  if (integra && verificacion.total === 0) {
    return (
      <section aria-label="Estado de integridad" className="rounded-xl bg-gray-950 p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <Shield className="size-4" aria-hidden="true" />
          Sin registros todavía
        </p>
        <p className="mt-1 text-sm text-gray-300">{titulo}</p>
        <p className="mt-3 text-xs text-gray-400">Cada registro nuevo recibirá un sello y se comprobará aquí.</p>
      </section>
    );
  }

  if (!integra) {
    return (
      <section aria-label="Estado de integridad" className="rounded-xl bg-gray-950 p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-red-400">
          <Icono className="size-4" aria-hidden="true" />
          Se detectó un cambio
        </p>
        <p className="mt-1 text-sm text-gray-300">{titulo}</p>
        {paraDonante ? (
          <>
            <p className="mt-3 text-sm text-white">
              Una de tus donaciones registradas cambió después de guardarse, así que por ahora tu historial no es confiable. No es algo que hayas hecho tú.
            </p>
            <p className="mt-2 text-sm text-gray-300">Qué hacer: toma una captura de esta pantalla y avisa al hospital donde donaste o al administrador del sistema.</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-white">
              El registro #{verificacion.id_roto} cambió después de guardarse. Los registros posteriores dependen de su sello, por eso la
              cadena deja de cuadrar a partir de ahí.
            </p>
            <p className="mt-2 text-sm text-gray-300">Qué hacer: guarde esta pantalla como evidencia y avise al responsable del sistema.</p>
            <p className="mt-3 text-xs text-gray-400">Detalle técnico: {verificacion.mensaje}</p>
          </>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Estado de integridad" className="rounded-xl bg-gray-950 p-5 text-white">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
        <Icono className="size-4" aria-hidden="true" />
        Ningún registro ha cambiado
      </p>
      <p className="mt-1 text-sm text-gray-300">{titulo}</p>
      <p className="mt-3 text-xs text-gray-400">Sello actual</p>
      <p className="font-mono text-xl font-semibold tracking-wider text-white">{selloLegible(hash)}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-gray-400">{hash}</p>
      <p className="mt-3 text-xs text-gray-400">
        {verificacion.total + (verificacion.total === 1 ? ' registro sellado.' : ' registros sellados.')} Cada sello se calculó con el
        contenido del registro y el sello del anterior, y todos siguen cuadrando.
      </p>
    </section>
  );
}
