// storage/index.ts
// Guarda y lee los datos del celular con AsyncStorage (un almacén de
// clave → texto). No tiene reglas de negocio: solo guarda y lee.

// "import X from" trae lo que el otro archivo exporta por defecto;
// "import { A, B } from" trae cosas puntuales por su nombre
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Paquete, Empresa, BloqueHorario, JornadaLaboral, DatosApp } from "../type/index";

// const = variable que no se puede reasignar (como readonly)
const KEY_PAQUETES = "paquetes";
const KEY_EMPRESAS = "empresas";
const KEY_BLOQUES = "bloques";
const KEY_JORNADA = "jornada";

// PAQUETES

// "async" = la función tarda (lee/escribe en el celular) y devuelve una
// Promise, como un Task en C#. "await" espera a que termine.
export async function guardarPaquete(paquete: Paquete) {
  const paquetesActuales = await obtenerPaquetes();
  // [...lista, x] = lista nueva con todo lo de antes más x al final
  const nuevaLista = [...paquetesActuales, paquete];
  // AsyncStorage solo guarda texto: JSON.stringify convierte la lista a texto JSON
  await AsyncStorage.setItem(KEY_PAQUETES, JSON.stringify(nuevaLista));
}

// Promise<Paquete[]> = cuando termine, devuelve una lista de paquetes (Task<List<Paquete>>)
export async function obtenerPaquetes(): Promise<Paquete[]> {
  const data = await AsyncStorage.getItem(KEY_PAQUETES); // null si nunca se guardó nada
  // condición ? siSí : siNo  →  si hay texto lo convierte a lista; si no, lista vacía
  return data ? JSON.parse(data) : [];
}

// Pisa la lista entera de paquetes (por ej. después de borrar uno)
export async function guardarPaquetes(paquetes: Paquete[]) {
  await AsyncStorage.setItem(KEY_PAQUETES, JSON.stringify(paquetes));
}

// EMPRESAS

export async function guardarEmpresa(empresa: Empresa) {
  const empresasActuales = await obtenerEmpresas();
  const nuevaLista = [...empresasActuales, empresa];
  await AsyncStorage.setItem(KEY_EMPRESAS, JSON.stringify(nuevaLista));
}

export async function obtenerEmpresas(): Promise<Empresa[]> {
  const data = await AsyncStorage.getItem(KEY_EMPRESAS);
  return data ? JSON.parse(data) : [];
}

// Reemplaza la empresa con el mismo id por la versión nueva
export async function actualizarEmpresa(empresa: Empresa) {
  const empresasActuales = await obtenerEmpresas();
  // map = transforma cada elemento (como Select en LINQ)
  // "(e) => ..." es una función flecha: recibe e y devuelve lo de la derecha (como una lambda)
  const nuevaLista = empresasActuales.map((e) => (e.id === empresa.id ? empresa : e));
  await AsyncStorage.setItem(KEY_EMPRESAS, JSON.stringify(nuevaLista));
}

// BLOQUES HORARIOS (el cronograma ya generado)

export async function obtenerBloques(): Promise<BloqueHorario[]> {
  const data = await AsyncStorage.getItem(KEY_BLOQUES);
  return data ? JSON.parse(data) : [];
}

// Pisa la lista entera: el sistema siempre devuelve la lista completa actualizada
export async function guardarBloques(bloques: BloqueHorario[]) {
  await AsyncStorage.setItem(KEY_BLOQUES, JSON.stringify(bloques));
}

// Guarda empresas y bloques en una sola operación (multiSet), para que no
// quede una cosa guardada y la otra no si la app se cierra en el medio
export async function guardarEmpresasYBloques(empresas: Empresa[], bloques: BloqueHorario[]) {
  // multiSet recibe una lista de pares [clave, valor]
  await AsyncStorage.multiSet([
    [KEY_EMPRESAS, JSON.stringify(empresas)],
    [KEY_BLOQUES, JSON.stringify(bloques)],
  ]);
}

// JORNADA LABORAL

// "JornadaLaboral | null" = devuelve una jornada o null (si todavía no se configuró)
export async function obtenerJornada(): Promise<JornadaLaboral | null> {
  const data = await AsyncStorage.getItem(KEY_JORNADA);
  return data ? JSON.parse(data) : null;
}

export async function guardarJornada(jornada: JornadaLaboral) {
  await AsyncStorage.setItem(KEY_JORNADA, JSON.stringify(jornada));
}

// Guarda la jornada nueva junto con el cronograma ya acomodado a ella, en una
// sola operación (multiSet): nunca queda una jornada con bloques fuera de horario
export async function guardarJornadaYBloques(jornada: JornadaLaboral, bloques: BloqueHorario[]) {
  await AsyncStorage.multiSet([
    [KEY_JORNADA, JSON.stringify(jornada)],
    [KEY_BLOQUES, JSON.stringify(bloques)],
  ]);
}

// RESPALDO (todos los datos juntos)

// Lee todo lo guardado de una vez (para armar un respaldo)
export async function obtenerTodo(): Promise<DatosApp> {
  const [paquetes, empresas, bloques, jornada] = await Promise.all([
    obtenerPaquetes(),
    obtenerEmpresas(),
    obtenerBloques(),
    obtenerJornada(),
  ]);
  return { paquetes, empresas, bloques, jornada };
}

// Reemplaza TODOS los datos por los de un respaldo, en una sola operación.
// Si el respaldo no tiene jornada, se borra la guardada (vuelve a la de por defecto).
export async function reemplazarTodo(datos: DatosApp) {
  await AsyncStorage.multiSet([
    [KEY_PAQUETES, JSON.stringify(datos.paquetes)],
    [KEY_EMPRESAS, JSON.stringify(datos.empresas)],
    [KEY_BLOQUES, JSON.stringify(datos.bloques)],
  ]);
  if (datos.jornada) {
    await AsyncStorage.setItem(KEY_JORNADA, JSON.stringify(datos.jornada));
  } else {
    await AsyncStorage.removeItem(KEY_JORNADA);
  }
}
