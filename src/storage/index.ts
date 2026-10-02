import AsyncStorage from "@react-native-async-storage/async-storage";
import { Paquete, Empresa, BloqueHorario, JornadaLaboral } from "../type/index";

const KEY_PAQUETES = "paquetes";
const KEY_EMPRESAS = "empresas";
const KEY_BLOQUES = "bloques";
const KEY_JORNADA = "jornada";

// PAQUETES

export async function guardarPaquete(paquete: Paquete) {
  const paquetesActuales = await obtenerPaquetes();
  const nuevaLista = [...paquetesActuales, paquete];
  await AsyncStorage.setItem(KEY_PAQUETES, JSON.stringify(nuevaLista));
}

export async function obtenerPaquetes(): Promise<Paquete[]> {
  const data = await AsyncStorage.getItem(KEY_PAQUETES);
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
  await AsyncStorage.multiSet([
    [KEY_EMPRESAS, JSON.stringify(empresas)],
    [KEY_BLOQUES, JSON.stringify(bloques)],
  ]);
}

// JORNADA LABORAL

// Devuelve null si el usuario todavía no configuró su jornada
export async function obtenerJornada(): Promise<JornadaLaboral | null> {
  const data = await AsyncStorage.getItem(KEY_JORNADA);
  return data ? JSON.parse(data) : null;
}

export async function guardarJornada(jornada: JornadaLaboral) {
  await AsyncStorage.setItem(KEY_JORNADA, JSON.stringify(jornada));
}
