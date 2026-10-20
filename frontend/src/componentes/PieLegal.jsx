const URL_LEY = 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf';

export default function PieLegal() {
  return (
    <footer className="mt-12 border-t border-gray-200 pt-4 text-xs text-gray-500">
      <p>
        Los datos personales se guardan cifrados (nombre y teléfono) y la CURP solo como huella irreversible. Su tratamiento se rige por la{' '}
        <a href={URL_LEY} target="_blank" rel="noreferrer" className="underline hover:text-gray-700">
          Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados
        </a>
        .
      </p>
      <p className="mt-1">Donadores BCS · Proyecto académico de la UABCS.</p>
    </footer>
  );
}
