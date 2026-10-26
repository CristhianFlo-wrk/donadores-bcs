import { useState } from 'react';
import { Link } from 'react-router';
import { donantes } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { EncabezadoPagina, FichaSangre, Panel, TituloSeccion } from '../../componentes/ui.jsx';
import TablaCompatibilidad from '../../componentes/TablaCompatibilidad.jsx';
import { PUEDE_DONAR_A, TIPOS_SANGRE, puedeRecibirDe } from '../../utils/compatibilidad.js';
import { fecha } from '../../utils/formato.js';


const URL_GUIA = 'https://www.gob.mx/cms/uploads/attachment/file/943510/9-GuIa_de_seleccion_de_donadores_v3.pdf';
const URL_NOM = 'https://dof.gob.mx/nota_detalle.php?codigo=5800942&fecha=12/10/2026';

const REQUISITOS = [
  { tema: 'Edad', detalle: 'De 18 a 65 años.' },
  { tema: 'Peso', detalle: 'Más de 50 kg.' },
  { tema: 'Identificación', detalle: 'Oficial, vigente y con fotografía. Llévala el día de la donación.' },
  { tema: 'Comida', detalle: 'No necesitas ayunar. Un día antes come bajo en grasas y toma suficientes líquidos.' },
  { tema: 'Alcohol', detalle: 'Como máximo una copa en las 72 horas previas. No acudas bajo sus efectos.' },
  { tema: 'Tatuajes, perforaciones y acupuntura', detalle: 'Espera 12 meses desde el último procedimiento (4 meses si el banco de sangre hace pruebas NAT).' },
  { tema: 'Embarazo y lactancia', detalle: 'Espera 6 meses después del término del embarazo y hasta suspender la lactancia.' },
  { tema: 'Frecuencia', detalle: 'Al menos 8 semanas entre donaciones de sangre total. Este sistema te vuelve a avisar a los 90 días.' }
];

const DIA_DE_LA_DONACION = [
  { titulo: 'Registro', detalle: 'El personal comprueba tu identidad con tu identificación oficial.' },
  { titulo: 'Somatometría', detalle: 'Te miden altura, peso, presión arterial, temperatura y frecuencia cardiaca.' },
  { titulo: 'Evaluación médica', detalle: 'En privado, un médico revisa tu historia clínica. Su decisión de aceptar o diferir la donación es definitiva y te explica el motivo.' },
  { titulo: 'Líquidos', detalle: 'Antes de la extracción se sugiere tomar entre 300 y 400 mL de líquidos para evitar mareos.' },
  { titulo: 'Extracción', detalle: 'Se extraen alrededor de 450 mL de sangre, nunca más del 13 % de tu volumen sanguíneo.' },
  { titulo: 'Autoexclusión confidencial', detalle: 'Recibes un talón para indicar, en privado, si consideras que tu sangre no debe usarse.' }
];

const DESPUES_DE_DONAR = [
  { titulo: 'Toma el refrigerio', detalle: 'El banco de sangre te da un refrigerio para reponer líquidos y calorías, bajo supervisión del personal.' },
  { titulo: 'Si tu trabajo es de riesgo', detalle: 'Bomberos, choferes, operadores de grúa y oficios similares: deja más de 12 horas antes de volver a trabajar (pilotos, más de 24 horas).' },
  { titulo: 'Avisa si te enfermas', detalle: 'Si en los días siguientes presentas síntomas de una infección (por ejemplo, dengue en los primeros 5 días o chikungunya en los primeros 14), comunícalo al banco de sangre.' },
  { titulo: 'Tu siguiente donación', detalle: 'El sistema te pausa las alertas 90 días y te avisa cuando puedas volver a donar.' }
];

// Pasos en rejilla: cada panel ocupa todo el ancho y sus celdas comparten altura por fila
function ListaPasos({ pasos, columnas }) {
  return (
    <ol className={'grid gap-px bg-gray-100 sm:grid-cols-2 ' + columnas}>
      {pasos.map((paso, indice) => (
        <li key={paso.titulo} className="flex gap-4 bg-white px-5 py-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-acento-50 text-xs font-semibold tabular-nums text-acento-700" aria-hidden="true">
            {indice + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{paso.titulo}</p>
            <p className="mt-0.5 text-sm text-gray-700">{paso.detalle}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Arranca en el tipo del donante; elegir otro sirve para consultar a familiares o conocidos
function GuiaCompatibilidad({ tipoPropio }) {
  const [elegido, setElegido] = useState(null);
  const tipo = elegido || tipoPropio || 'A+';
  const receptores = PUEDE_DONAR_A[tipo];

  return (
    <section aria-labelledby="titulo-compatibilidad" className="mt-8">
      <TituloSeccion id="titulo-compatibilidad">A quién puede ayudar tu sangre</TituloSeccion>
      <p className="-mt-1 mb-3 text-sm text-gray-600">
        Compatibilidad de glóbulos rojos por grupo ABO y factor Rh. Elige un tipo para ver su fila resaltada. El hospital confirma con pruebas de laboratorio antes de cada transfusión.
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8" role="radiogroup" aria-label="Tipo de sangre">
          {TIPOS_SANGRE.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => setElegido(t)}
              className={'flex flex-col items-center rounded-lg py-3 text-center text-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600 ' +
                (tipo === t ? 'bg-red-50 text-red-700 ring-2 ring-inset ring-red-600' : 'bg-white text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-50')}
            >
              {t}
              {t === tipoPropio && <span className="text-xs font-medium text-gray-600">Tu tipo</span>}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel titulo={'Un donante ' + tipo + ' puede donar a'}>
            <div key={tipo} className="flex animate-aparecer flex-wrap gap-1.5 motion-reduce:animate-none">
              {receptores.map((t) => <FichaSangre key={t} tipo={t} tamano="md" />)}
            </div>
            <p className="mt-3 text-sm text-gray-700">
              {receptores.length === TIPOS_SANGRE.length
                ? 'Sirve a pacientes de cualquier tipo.'
                : receptores.length === 1
                  ? 'Solo a pacientes de su mismo tipo.'
                  : 'Sirve a pacientes de ' + receptores.length + ' tipos.'}
            </p>
          </Panel>
          <Panel titulo={'Un paciente ' + tipo + ' puede recibir de'}>
            <div key={tipo} className="flex animate-aparecer flex-wrap gap-1.5 motion-reduce:animate-none">
              {puedeRecibirDe(tipo).map((t) => <FichaSangre key={t} tipo={t} tamano="md" />)}
            </div>
          </Panel>
        </div>
        <TablaCompatibilidad resaltar={tipo} modo="donante" />
      </div>
    </section>
  );
}

// En celular y tablet "Tu situacion" va antes del contenido largo; en escritorio queda en la columna lateral
export default function AntesDeDonar() {
  const consultaPerfil = useConsulta(() => donantes.perfil());
  const consultaStats = useConsulta(() => donantes.stats());
  const tipo = consultaPerfil.datos?.perfil?.tipo_sangre;
  const stats = consultaStats.datos?.stats;

  return (
    <>
      <EncabezadoPagina
        titulo="Antes de donar"
        descripcion="Requisitos, qué pasa el día de la donación y cuidados después. El médico del banco de sangre confirma si puedes donar el mismo día."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Panel titulo="Requisitos" className="overflow-hidden" cuerpo="">
            <dl className="grid gap-px bg-gray-100 sm:grid-cols-2 2xl:grid-cols-4">
              {REQUISITOS.map((r) => (
                <div key={r.tema} className="bg-white px-5 py-4">
                  <dt className="text-sm font-semibold text-gray-900">{r.tema}</dt>
                  <dd className="mt-1 text-sm text-gray-700">{r.detalle}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel titulo="El día de la donación" className="mt-6 overflow-hidden" cuerpo="">
            <ListaPasos pasos={DIA_DE_LA_DONACION} columnas="2xl:grid-cols-3" />
          </Panel>
          <Panel titulo="Después de donar" className="mt-6 overflow-hidden" cuerpo="">
            <ListaPasos pasos={DESPUES_DE_DONAR} columnas="2xl:grid-cols-4" />
          </Panel>

          <GuiaCompatibilidad tipoPropio={tipo} />

          <p className="mt-6 text-xs text-gray-600">
            Fuentes:{' '}
            <a href={URL_GUIA} target="_blank" rel="noreferrer" className="underline hover:text-gray-900">
              Guía Nacional de Criterios para la Selección de Donantes, CNTS (versión 3, julio 2024)
            </a>
            , a la que remite la{' '}
            <a href={URL_NOM} target="_blank" rel="noreferrer" className="underline hover:text-gray-900">NOM-253-SSA1-2025</a>
            {' '}(publicada el 12 de octubre de 2026).
          </p>
        </div>

        <aside className="order-first space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:sticky xl:top-8 xl:order-none xl:block xl:space-y-4">
          <Panel titulo="Tu situación">
            {tipo ? (
              <div className="flex items-center gap-3">
                <FichaSangre tipo={tipo} tamano="lg" />
                <p className="text-sm text-gray-700">
                  Tu sangre puede ayudar a {PUEDE_DONAR_A[tipo].length === 8 ? 'personas de cualquier tipo' : 'personas con sangre ' + PUEDE_DONAR_A[tipo].join(', ')}.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Cargando tu tipo de sangre...</p>
            )}
            {stats && (
              <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-700">
                {stats.puede_donar
                  ? 'Ya cumpliste el periodo de espera: puedes donar de nuevo.'
                  : 'Podrás volver a donar a partir del ' + fecha(new Date(new Date(stats.ultima_donacion).getTime() + (stats.dias_desde_ultima + stats.dias_para_poder_donar) * 86400000)) + '.'}
              </p>
            )}
          </Panel>
          <div className="rounded-xl bg-acento-50 p-5">
            <p className="text-sm font-semibold text-acento-800">¿Te llegó una alerta?</p>
            <p className="mt-1 text-sm text-gray-700">Confírmala para recibir tu código de asistencia y preséntalo en el hospital.</p>
            <Link to="/donante/alertas" className="mt-3 inline-block text-sm font-semibold text-acento-700 underline hover:text-acento-800">Ver mis alertas</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
