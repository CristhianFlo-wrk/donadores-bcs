import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { solicitudes } from '../api/servicios.js';
import { Boton, Dialogo } from './ui.jsx';

function Foto({ idSolicitud, idImagen, alt, className }) {
  const [url, setUrl] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    let creada = null;
    solicitudes.imagen(idSolicitud, idImagen)
      .then((blob) => {
        if (!vigente) return;
        creada = URL.createObjectURL(blob);
        setUrl(creada);
      })
      .catch(() => vigente && setFallo(true));
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [idSolicitud, idImagen]);

  if (fallo) {
    return (
      <span className={'flex flex-col items-center justify-center gap-1 bg-gray-100 text-xs text-gray-600 ' + className}>
        <ImageOff className="size-5" aria-hidden="true" />
        No se pudo cargar
      </span>
    );
  }
  if (!url) return <span className={'block animate-pulse bg-gray-100 motion-reduce:animate-none ' + className} />;
  return <img src={url} alt={alt} className={className} />;
}


export default function FotosSolicitud({ solicitud, alQuitar }) {
  const [ampliada, setAmpliada] = useState(null);
  const [porQuitar, setPorQuitar] = useState(null);
  const [quitando, setQuitando] = useState(false);
  const { imagenes } = solicitud;
  const total = imagenes.length;
  if (total === 0) return null;

  const alt = (indice) => 'Foto ' + (indice + 1) + ' de ' + total + ' compartida por quien pidió la sangre';
  const columnas = total === 1 ? 'grid-cols-1' : total === 2 ? 'grid-cols-2' : 'grid-cols-3';

  async function quitar(idImagen) {
    setQuitando(true);
    try {
      await alQuitar(idImagen);
    } finally {
      setQuitando(false);
      setPorQuitar(null);
    }
  }

  return (
    <>
      <ul className={'grid gap-2 ' + columnas}>
        {imagenes.map((imagen, indice) => (
          <li key={imagen.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setAmpliada(indice)}
              aria-label={'Ampliar ' + alt(indice).toLowerCase()}
              className="block w-full overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-600"
            >
              <Foto idSolicitud={solicitud.id} idImagen={imagen.id} alt={alt(indice)} className={'w-full object-cover ' + (total === 1 ? 'aspect-[4/3]' : 'aspect-square')} />
            </button>
            {alQuitar && (porQuitar === imagen.id ? (
              <div className="mt-2 flex gap-1">
                <Boton variante="peligro" className="flex-1 px-2 py-1.5 text-xs" cargando={quitando} onClick={() => quitar(imagen.id)}>Sí, quitar</Boton>
                <Boton variante="neutro" className="flex-1 px-2 py-1.5 text-xs" disabled={quitando} onClick={() => setPorQuitar(null)}>No</Boton>
              </div>
            ) : (
              <Boton variante="contorno" className="mt-2 w-full px-2 py-1.5 text-xs" onClick={() => setPorQuitar(imagen.id)}>Quitar foto</Boton>
            ))}
          </li>
        ))}
      </ul>

      {ampliada !== null && (
        <Dialogo id="titulo-foto" titulo={'Foto ' + (ampliada + 1) + ' de ' + total} alCerrar={() => setAmpliada(null)} className="max-w-3xl">
          <Foto idSolicitud={solicitud.id} idImagen={imagenes[ampliada].id} alt={alt(ampliada)} className="max-h-[70dvh] w-full rounded-lg bg-gray-50 object-contain" />
          {total > 1 && (
            <div className="mt-4 flex justify-between gap-2">
              <Boton variante="contorno" disabled={ampliada === 0} onClick={() => setAmpliada(ampliada - 1)}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </Boton>
              <Boton variante="contorno" disabled={ampliada === total - 1} onClick={() => setAmpliada(ampliada + 1)}>
                Siguiente
                <ChevronRight className="size-4" aria-hidden="true" />
              </Boton>
            </div>
          )}
        </Dialogo>
      )}
    </>
  );
}
