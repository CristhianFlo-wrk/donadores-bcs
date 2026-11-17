import { useState } from 'react';
import { notificaciones } from '../api/servicios.js';
import { codigoAsistencia } from '../utils/formato.js';
import { Aviso, Boton, Campo, Dialogo } from './ui.jsx';

// Antes de sellar la donacion se pide la CURP de la identificacion de quien llego; el backend la compara
// con la del donante que confirmo. Tambien es la confirmacion: la donacion sellada no se puede borrar
export default function DialogoDonacion({ notificacion, detalle, alCerrar, alRegistrar }) {
  const [curp, setCurp] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const codigo = codigoAsistencia(notificacion.id);
  const curpLimpia = curp.replace(/\s/g, '').toUpperCase();

  async function registrar(evento) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await notificaciones.registrarDonacion(notificacion.id, curpLimpia);
      alRegistrar('Donación ' + codigo + ' registrada en el historial del donante.');
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <Dialogo id="titulo-donacion" titulo={'Registrar donación ' + codigo} subtitulo={detalle} alCerrar={alCerrar}>
      <form onSubmit={registrar} className="space-y-4" noValidate>
        <p className="text-sm text-gray-700">
          Pide una identificación oficial y escribe la CURP tal como aparece. Solo se registra si coincide con la del donante que confirmó este código.
        </p>
        <Campo
          etiqueta="CURP de la identificación"
          id="curp-donacion"
          value={curp}
          onChange={(e) => setCurp(e.target.value)}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          ayuda="18 caracteres"
        />
        <Aviso>{error}</Aviso>
        <p className="text-xs text-gray-600">La donación queda en el historial sellado del donante y no se puede borrar.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="neutro" disabled={enviando} onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={enviando} disabled={curpLimpia.length !== 18}>Registrar donación</Boton>
        </div>
      </form>
    </Dialogo>
  );
}
