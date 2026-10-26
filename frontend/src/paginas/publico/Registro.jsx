import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import MarcoPublico from '../../componentes/MarcoPublico.jsx';
import { Aviso, Boton, Campo, Selector } from '../../componentes/ui.jsx';
import { rutaInicioPorRol, useSesion } from '../../contexto/SesionContext.jsx';
import { auth, ubicaciones } from '../../api/servicios.js';
import { useConsulta } from '../../hooks/useConsulta.js';
import { nombreRegion } from '../../utils/formato.js';

const REGEX_CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORMULARIO_INICIAL = {
  nombre_completo: '',
  email: '',
  password: '',
  confirmar: '',
  curp: '',
  fecha_nacimiento: '',
  sexo: '',
  telefono: '',
  id_tipo_sangre: '',
  peso_kg: '',
  id_municipio: '',
  id_colonia: '',
  colonia_personalizada: ''
};

function calcularEdad(fechaTexto) {
  const nacimiento = new Date(fechaTexto + 'T00:00:00');
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad -= 1;
  return edad;
}

// Mismas reglas que el backend, para avisar antes de enviar
function validar(formulario, esOtra) {
  const errores = {};
  if (!formulario.nombre_completo.trim()) errores.nombre_completo = 'Escribe tu nombre completo';
  if (!REGEX_EMAIL.test(formulario.email.trim())) errores.email = 'Correo no válido';
  if (formulario.password.length < 8) errores.password = 'Mínimo 8 caracteres';
  if (formulario.confirmar !== formulario.password) errores.confirmar = 'Las contraseñas no coinciden';
  if (!REGEX_CURP.test(formulario.curp.trim().toUpperCase())) errores.curp = 'CURP con formato no válido (18 caracteres)';

  const edad = calcularEdad(formulario.fecha_nacimiento);
  if (edad === null) errores.fecha_nacimiento = 'Indica tu fecha de nacimiento';
  else if (edad < 18 || edad > 65) errores.fecha_nacimiento = 'Para donar debes tener entre 18 y 65 años';

  if (!formulario.id_tipo_sangre) errores.id_tipo_sangre = 'Selecciona tu tipo de sangre';
  if (formulario.peso_kg && Number(formulario.peso_kg) < 50) errores.peso_kg = 'El peso mínimo para donar es 50 kg';
  if (formulario.telefono && !/^\d{10}$/.test(formulario.telefono)) errores.telefono = 'Teléfono de 10 dígitos';
  if (!formulario.id_colonia) errores.id_colonia = 'Selecciona tu colonia';
  if (esOtra && !formulario.colonia_personalizada.trim()) errores.colonia_personalizada = 'Escribe el nombre de tu colonia';
  return errores;
}

export default function Registro() {
  const { usuario, iniciarSesion } = useSesion();
  const navegar = useNavigate();
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const consultaTipos = useConsulta(() => ubicaciones.tiposSangre());
  const consultaMunicipios = useConsulta(() => ubicaciones.municipios());
  const consultaColonias = useConsulta(
    () => (formulario.id_municipio ? ubicaciones.colonias(formulario.id_municipio) : Promise.resolve(null)),
    [formulario.id_municipio]
  );

  if (usuario) return <Navigate to={rutaInicioPorRol(usuario.rol)} replace />;

  const colonias = consultaColonias.datos?.colonias || [];
  const coloniaElegida = colonias.find((c) => String(c.id) === formulario.id_colonia);
  const esOtra = coloniaElegida?.nombre === 'Otra';
  const municipioElegido = (consultaMunicipios.datos?.municipios || []).find((m) => String(m.id) === formulario.id_municipio);

  function cambiar(evento) {
    const { name, value } = evento.target;
    setFormulario((anterior) => {
      const siguiente = { ...anterior, [name]: value };
      if (name === 'id_municipio') {
        siguiente.id_colonia = '';
        siguiente.colonia_personalizada = '';
      }
      return siguiente;
    });
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrorGeneral('');
    const encontrados = validar(formulario, esOtra);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      setErrorGeneral('Revisa los campos marcados.');
      return;
    }

    const datos = {
      nombre_completo: formulario.nombre_completo.trim(),
      email: formulario.email.trim(),
      password: formulario.password,
      curp: formulario.curp.trim().toUpperCase(),
      fecha_nacimiento: formulario.fecha_nacimiento,
      id_tipo_sangre: Number(formulario.id_tipo_sangre),
      id_colonia: Number(formulario.id_colonia)
    };
    if (formulario.sexo) datos.sexo = formulario.sexo;
    if (formulario.telefono) datos.telefono = formulario.telefono;
    if (formulario.peso_kg) datos.peso_kg = Number(formulario.peso_kg);
    if (esOtra) datos.colonia_personalizada = formulario.colonia_personalizada.trim();

    setEnviando(true);
    try {
      await auth.registro(datos);
      await iniciarSesion(datos.email, datos.password);
      navegar('/donante', { replace: true });
    } catch (e) {
      setErrorGeneral(e.message);
      setEnviando(false);
    }
  }

  const propsCampo = (nombre) => ({ id: nombre, name: nombre, value: formulario[nombre], onChange: cambiar, error: errores[nombre] });

  return (
    <MarcoPublico titulo="Registro de donante" subtitulo="Tus datos personales se guardan cifrados." ancho="max-w-xl">
      <form onSubmit={enviar} className="space-y-6" noValidate>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-gray-900">Cuenta</legend>
          <Campo etiqueta="Nombre completo" autoComplete="name" className="sm:col-span-2" {...propsCampo('nombre_completo')} />
          <Campo etiqueta="Correo electrónico" type="email" autoComplete="email" className="sm:col-span-2" {...propsCampo('email')} />
          <Campo etiqueta="Contraseña" type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres" {...propsCampo('password')} />
          <Campo etiqueta="Confirmar contraseña" type="password" autoComplete="new-password" {...propsCampo('confirmar')} />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-gray-900">Datos del donante</legend>
          <Campo etiqueta="CURP" autoCapitalize="characters" maxLength={18} className="sm:col-span-2" {...propsCampo('curp')} />
          <Campo etiqueta="Fecha de nacimiento" type="date" {...propsCampo('fecha_nacimiento')} />
          <Selector
            etiqueta="Sexo (opcional)"
            id="sexo"
            name="sexo"
            value={formulario.sexo}
            onChange={cambiar}
            vacio="Prefiero no decir"
            opciones={[{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }, { valor: 'otro', texto: 'Otro' }]}
          />
          <div>
            <Selector
              etiqueta="Tipo de sangre"
              id="id_tipo_sangre"
              name="id_tipo_sangre"
              value={formulario.id_tipo_sangre}
              onChange={cambiar}
              opciones={(consultaTipos.datos?.tipos || []).map((t) => ({ valor: String(t.id), texto: t.codigo }))}
            />
            {errores.id_tipo_sangre && <p className="mt-1 text-xs text-red-700">{errores.id_tipo_sangre}</p>}
          </div>
          <Campo etiqueta="Peso en kg (opcional)" type="number" inputMode="decimal" min="50" max="300" {...propsCampo('peso_kg')} />
          <Campo etiqueta="Teléfono (opcional)" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} className="sm:col-span-2" ayuda="Para avisos por SMS" {...propsCampo('telefono')} />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold text-gray-900">Ubicación</legend>
          <Selector
            etiqueta="Municipio"
            id="id_municipio"
            name="id_municipio"
            value={formulario.id_municipio}
            onChange={cambiar}
            opciones={(consultaMunicipios.datos?.municipios || []).map((m) => ({ valor: String(m.id), texto: m.nombre }))}
          />
          <div>
            <Selector
              etiqueta="Colonia"
              id="id_colonia"
              name="id_colonia"
              value={formulario.id_colonia}
              onChange={cambiar}
              disabled={!formulario.id_municipio}
              vacio={formulario.id_municipio ? 'Selecciona tu colonia' : 'Primero elige el municipio'}
              opciones={colonias.map((c) => ({ valor: String(c.id), texto: c.nombre }))}
            />
            {errores.id_colonia && <p className="mt-1 text-xs text-red-700">{errores.id_colonia}</p>}
          </div>
          {esOtra && (
            <Campo etiqueta="Nombre de tu colonia" className="sm:col-span-2" {...propsCampo('colonia_personalizada')} />
          )}
          {municipioElegido && (
            <p className="text-xs text-gray-500 sm:col-span-2">
              Recibirás alertas de la {nombreRegion(municipioElegido.region)} y alertas críticas de todo el estado.
            </p>
          )}
        </fieldset>

        <Aviso>{errorGeneral}</Aviso>
        <Boton type="submit" cargando={enviando} className="w-full">Crear cuenta</Boton>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-red-600 hover:underline">Inicia sesión</Link>
      </p>
    </MarcoPublico>
  );
}
