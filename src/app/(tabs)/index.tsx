// src/app/(tabs)/index.tsx — Hoy (pantalla de inicio)
// Muestra el recorte de HOY del cronograma ya generado. No calcula nada:
// lee los bloques guardados y le pide a sistema/ los de la fecha de hoy.
//
// Cómo funciona una pantalla en React:
// - La pantalla es una FUNCIÓN que devuelve lo que se dibuja (el "JSX", las <Etiquetas>).
// - Cada vez que cambia un "state" (useState), React vuelve a llamar la
//   función y redibuja solo. No hay que actualizar la pantalla a mano.
import React, { useState, useEffect, useCallback } from "react";
// View = un contenedor (como un <div> o un Panel); Text = un texto
import { View, Text, StyleSheet, AppState } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  obtenerBloques,
  obtenerEmpresas,
  obtenerPaquetes,
  obtenerJornada,
  guardarEmpresasYBloques,
} from "../../storage/index";
import {
  armarAgendaDelDia,
  fechaLocalISO,
  JORNADA_POR_DEFECTO,
  SesionDelDia,
} from "../../sistema/cronograma";
import { aplicarChequeoDiario } from "../../sistema/prioridad";
import { horasTotales } from "../../sistema/calendario";
import { Pantalla, Tarjeta, Aviso, Vacio, BotonIcono, colores, espacio, fuentes, tipo } from "../../components/kit";
import { TarjetaSesion } from "../../components/tarjeta-sesion";
import { fechaLarga, textoHoras } from "../../components/formato";

/**
 * Calcula cuánto falta para que cambie el día (medianoche, hora local del celular).
 * Se usa para programar el timer que actualiza la pantalla a las 00:00.
 * @param ahora momento actual
 * @returns milisegundos que faltan hasta la próxima medianoche
 */
function msHastaMedianoche(ahora: Date): number {
  const medianoche = new Date(ahora);
  medianoche.setHours(24, 0, 0, 0); // hora 24 = 00:00 del día siguiente
  return medianoche.getTime() - ahora.getTime();
}

/**
 * Pantalla Hoy: resumen del día y las sesiones de hoy ordenadas por hora.
 * Se recarga al volver a la pestaña y cambia de día sola a la medianoche.
 * El botón de arriba a la derecha abre la jornada laboral.
 */
// "const Hoy = () => { ... }" = la pantalla es una función sin parámetros
const Hoy = () => {
  // los "use..." son "hooks": funciones especiales de React; van siempre al principio
  const router = useRouter(); // para navegar a otra pantalla

  // useState(valorInicial) devuelve [valor, funciónParaCambiarlo].
  // Llamar a setFechaHoy(x) cambia el valor Y redibuja la pantalla.
  // "Hoy" como "YYYY-MM-DD". Es state para que la pantalla se redibuje sola
  // cuando cambia el día.
  const [fechaHoy, setFechaHoy] = useState<string>(fechaLocalISO(new Date()));
  const [sesiones, setSesiones] = useState<SesionDelDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Lee todo del storage, corre el chequeo diario (genera el bloque x4 de hoy
   * a las empresas en prioridad alta que todavía no lo tengan, y guarda si
   * hubo cambios), y después arma la agenda de esa fecha en el state
   * `sesiones` (eso redibuja la lista).
   * Si algo falla, o el chequeo tiene algo que avisar (prioridad apagada por
   * paquete agotado, sesiones que no se pudieron reubicar), deja el mensaje
   * en `error`.
   * useCallback hace que la función sea siempre la misma entre renders,
   * para poder ponerla en las dependencias de los efectos sin que se repitan.
   * @param fecha día a mostrar, "YYYY-MM-DD"
   */
  const cargarAgenda = useCallback(async (fecha: string) => {
    try {
      // Promise.all = Task.WhenAll en C#: las cuatro lecturas en paralelo
      const [empresasGuardadas, paquetes, bloquesGuardados, jornadaGuardada] = await Promise.all([
        obtenerEmpresas(),
        obtenerPaquetes(),
        obtenerBloques(),
        obtenerJornada(),
      ]);
      const jornada = jornadaGuardada ?? JORNADA_POR_DEFECTO;

      // la regla vive en sistema/: si hoy ya se generó todo, no cambia nada
      // (renueva paquetes vencidos y genera el x4 de hoy de las empresas en alta)
      const chequeo = aplicarChequeoDiario(empresasGuardadas, paquetes, jornada, bloquesGuardados, new Date());
      if (chequeo.huboCambios) {
        await guardarEmpresasYBloques(chequeo.empresas, chequeo.bloques);
      }

      setSesiones(armarAgendaDelDia(fecha, chequeo.bloques, chequeo.empresas));

      // junto los avisos del chequeo en un solo texto (null = no mostrar nada)
      const avisos: string[] = [];
      if (chequeo.empresasRenovadas.length > 0) {
        // map saca los nombres; join(", ") los une en un solo texto (como string.Join)
        const nombres = chequeo.empresasRenovadas.map((e) => e.nombre).join(", ");
        avisos.push(`Se renovó el paquete de ${nombres}: arrancó una ventana nueva.`);
      }
      if (chequeo.empresasSinCupoRenovacion.length > 0) {
        const nombres = chequeo.empresasSinCupoRenovacion.map((e) => e.nombre).join(", ");
        avisos.push(`No hay cupos para renovar el paquete de ${nombres}. Se vuelve a intentar mañana.`);
      }
      if (chequeo.empresasFueraDeJornada.length > 0) {
        const nombres = chequeo.empresasFueraDeJornada.map((e) => e.nombre).join(", ");
        avisos.push(`${nombres} tiene sesiones en fin de semana o fuera de horario que no entran en otro día.`);
      }
      if (chequeo.empresasFinalizadas.length > 0) {
        const nombres = chequeo.empresasFinalizadas.map((e) => e.nombre).join(", ");
        avisos.push(`${nombres} consumió todas las horas del paquete: se apagó la prioridad alta.`);
      }
      if (chequeo.empresasSinCupo.length > 0) {
        const nombres = chequeo.empresasSinCupo.map((e) => e.nombre).join(", ");
        avisos.push(`No hay cupos para recalcular: ${nombres}. Quedaron con su horario anterior.`);
      }
      if (chequeo.bloquesPerdidos.length > 0) {
        avisos.push(
          `${chequeo.bloquesPerdidos.length} sesión(es) de otras empresas no entraron en su ventana y se quitaron del cronograma.`
        );
      }
      setError(avisos.length > 0 ? avisos.join("\n") : null);
    } catch (e) {
      // try/catch/finally igual que en C#. instanceof = "es de este tipo" (como "is")
      setError(e instanceof Error ? e.message : "No se pudo leer el cronograma.");
    } finally {
      setCargando(false);
    }
  }, []); // [] = lista de dependencias vacía: la función se crea una sola vez

  // useFocusEffect corre cada vez que la pantalla vuelve a estar visible
  // (por ej. al cerrar el modal de Agregar Empresa o volver de otra pestaña),
  // así siempre muestra los bloques recién guardados.
  useFocusEffect(
    useCallback(() => {
      // por si la app quedó abierta de un día para el otro
      const hoy = fechaLocalISO(new Date());
      setFechaHoy(hoy);
      cargarAgenda(hoy);
    }, [cargarAgenda])
  );

  // Actualización automática cada día:
  // 1) un timer que salta a la medianoche, y
  // 2) al volver la app del segundo plano (en el celular los timers se
  //    pausan cuando la app no está abierta, así que el 1 solo no alcanza).
  // useEffect(función, [dependencias]) = correr algo después de dibujar,
  // y de nuevo cada vez que cambie alguna de las dependencias
  useEffect(() => {
    /**
     * Toma la fecha de hoy del reloj del celular, la guarda en el state y
     * recarga la agenda. La llaman el timer de medianoche y el AppState.
     */
    const revisarFecha = () => {
      const hoy = fechaLocalISO(new Date());
      // si la fecha no cambió, React no redibuja (mismo valor)
      setFechaHoy(hoy);
      cargarAgenda(hoy);
    };

    // setTimeout(función, ms) = ejecutar la función dentro de X milisegundos
    const timer = setTimeout(revisarFecha, msHastaMedianoche(new Date()) + 1000);
    // AppState avisa cuando la app pasa a primer plano ("active") o a segundo plano
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") revisarFecha();
    });

    // la función que devuelve useEffect es la "limpieza" (como Dispose en C#)
    return () => {
      clearTimeout(timer);
      suscripcion.remove();
    };
  }, [fechaHoy, cargarAgenda]); // al cambiar el día se vuelve a programar el timer

  // Set saca los repetidos; size = cuántos quedan (empresas distintas de hoy)
  const empresasDeHoy = new Set(sesiones.map((s) => s.bloque.empresaId)).size;

  // Lo que devuelve la función es lo que se dibuja (JSX: parece HTML, pero es código).
  // <Pantalla titulo="Hoy"> = usar el componente Pantalla pasándole "props" (parámetros).
  // Las llaves { } dentro del JSX = "acá va código", por ej. {fechaLarga(fechaHoy)}.
  return (
    <Pantalla
      antetitulo={fechaLarga(fechaHoy)}
      titulo="Hoy"
      accion={
        <BotonIcono
          icono={{ ios: "gearshape.fill", android: "settings", web: "settings" }}
          etiquetaAccesible="Jornada laboral"
          onPress={() => router.push("/jornada")} // al tocar: ir a la pantalla de jornada
        />
      }
    >
      {/* resumen del día: tres números grandes */}
      <View style={styles.resumen}>
        <Dato valor={String(sesiones.length)} etiqueta={sesiones.length === 1 ? "sesión" : "sesiones"} />
        <Dato valor={textoHoras(horasTotales(sesiones))} etiqueta="agendadas" />
        <Dato valor={String(empresasDeHoy)} etiqueta={empresasDeHoy === 1 ? "empresa" : "empresas"} />
      </View>

      {/* {condición && <X />} = dibujar X solo si la condición es verdadera */}
      {error && <Aviso texto={error} />}

      {!cargando && sesiones.length === 0 && (
        <Vacio
          icono={{ ios: "cup.and.saucer.fill", android: "coffee", web: "coffee" }}
          titulo="Sin sesiones hoy"
          detalle="No hay bloques asignados para este día."
        />
      )}

      {/* map dibuja una tarjeta por sesión; "key" es un id único que React necesita en las listas */}
      {/* en Hoy cada tarjeta tiene el botón de nota: abre el modal con el id del bloque */}
      {sesiones.map((sesion) => (
        <TarjetaSesion
          key={sesion.bloque.id}
          sesion={sesion}
          onEditarNota={() => router.push({ pathname: "/NotaSesion", params: { bloqueId: sesion.bloque.id } })}
        />
      ))}
    </Pantalla>
  );
};

/** Un número del resumen del día, con su etiqueta abajo. */
// Componente propio: recibe sus props como un objeto y saca valor y etiqueta.
// Se usa como <Dato valor="3" etiqueta="sesiones" />.
function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <Tarjeta style={styles.dato} estiloInterno={styles.datoInterno} fondo={colores.superficie}>
      <Text style={styles.datoValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      {/* style={[a, b]} = combina dos estilos; si se repite algo, gana el último */}
      <Text style={[tipo.etiqueta, styles.datoEtiqueta]}>{etiqueta.toUpperCase()}</Text>
    </Tarjeta>
  );
}

// Estilos: parecido a CSS, pero en camelCase y los números son puntos de pantalla.
// flexDirection "row" = los hijos van uno al lado del otro ("column" = uno abajo del otro).
// flex: 1 = ocupar todo el espacio que sobra (repartido entre los hermanos con flex).
const styles = StyleSheet.create({
  resumen: {
    flexDirection: "row",
    gap: espacio.s,
    marginBottom: espacio.xl,
  },
  dato: {
    flex: 1,
  },
  datoInterno: {
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.s,
    alignItems: "center",
  },
  datoValor: {
    fontFamily: fuentes.negrita,
    fontSize: 22,
    color: colores.tinta,
  },
  datoEtiqueta: {
    color: colores.tintaSuave,
    marginTop: 2,
    fontSize: 10,
  },
});

// "export default" = lo principal del archivo; Expo Router lo usa como la pantalla
export default Hoy;
