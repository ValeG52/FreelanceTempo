// src/app/(tabs)/calendario.tsx — Calendario (semana / mes)
// Muestra el cronograma completo ya generado. No calcula sesiones: lee los
// bloques guardados y le pide a sistema/calendario las fechas a mostrar.
import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { obtenerBloques, obtenerEmpresas } from "../../storage/index";
import { fechaLocalISO } from "../../sistema/cronograma";
import {
  VistaCalendario,
  diasDeSemana,
  grillaDelMes,
  moverPeriodo,
  agendaDeVariosDias,
  horasTotales,
} from "../../sistema/calendario";
import { BloqueHorario, Empresa } from "../../type";
import {
  Pantalla,
  Selector,
  BotonIcono,
  Boton,
  Tarjeta,
  colores,
  colorDeEmpresa,
  espacio,
  fuentes,
  borde,
  tipo,
} from "../../components/kit";
import { TarjetaSesion } from "../../components/tarjeta-sesion";
import { fechaLarga, diaCorto, numeroDeDia, mesYAnio, rangoDeSemana, textoHoras } from "../../components/formato";

const INICIALES_DIAS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Pantalla de calendario: vista SEMANA (lista día por día) o MES (grilla;
 * al tocar un día se ven sus sesiones debajo). Las flechas mueven el
 * período y "Hoy" vuelve al día actual.
 */
const Calendario = () => {
  const hoy = fechaLocalISO(new Date());
  const [vista, setVista] = useState<VistaCalendario>("semana");
  // día de referencia: define qué semana/mes se ve, y el día elegido en la vista mes
  const [seleccionada, setSeleccionada] = useState<string>(hoy);
  const [bloques, setBloques] = useState<BloqueHorario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // recargo cada vez que se entra a la pestaña (puede haber cambiado el cronograma)
  useFocusEffect(
    useCallback(() => {
      // .then(...) = "cuando termine, hacé esto" (otra forma de await)
      Promise.all([obtenerBloques(), obtenerEmpresas()]).then(([b, e]) => {
        setBloques(b);
        setEmpresas(e);
      });
    }, [])
  );

  /** Mueve una semana o un mes hacia adelante (1) o atrás (-1). */
  const mover = (pasos: number) => setSeleccionada(moverPeriodo(seleccionada, vista, pasos));

  // las fechas que se muestran según la vista
  const semana = diasDeSemana(seleccionada);
  const grilla = grillaDelMes(seleccionada);
  // flat() aplana la lista de semanas en una sola lista de días (como SelectMany en C#)
  const fechasVisibles = vista === "semana" ? semana : grilla.flat().map((d) => d.fecha);
  const agenda = agendaDeVariosDias(fechasVisibles, bloques, empresas);

  const tituloPeriodo = vista === "semana" ? rangoDeSemana(semana[0], semana[6]) : mesYAnio(seleccionada);

  return (
    <Pantalla antetitulo="Cronograma completo" titulo="Calendario">
      {/* <Selector<VistaCalendario>> = el Selector genérico usado con el tipo "semana" | "mes" */}
      <Selector<VistaCalendario>
        opciones={[
          { valor: "semana", texto: "SEMANA" },
          { valor: "mes", texto: "MES" },
        ]}
        valor={vista}
        onCambiar={setVista}
      />

      {/* navegación del período: ‹ título › y botón Hoy */}
      <View style={styles.navegacion}>
        <BotonIcono
          icono={{ ios: "chevron.left", android: "chevron_left", web: "chevron_left" }}
          etiquetaAccesible="Anterior"
          onPress={() => mover(-1)}
        />
        <Text style={styles.tituloPeriodo}>{tituloPeriodo}</Text>
        <BotonIcono
          icono={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
          etiquetaAccesible="Siguiente"
          onPress={() => mover(1)}
        />
      </View>
      <Boton texto="Ir a hoy" variante="acento" chico onPress={() => setSeleccionada(hoy)} style={styles.botonHoy} />

      {/* {condición ? (A) : (B)} = dibujar A o B según la condición */}
      {vista === "semana" ? (
        // ----- SEMANA: un bloque por día -----
        semana.map((fecha) => {
          const sesiones = agenda[fecha] ?? []; // agenda[fecha] = buscar en el diccionario; si no hay, lista vacía
          const esHoy = fecha === hoy;
          return (
            <View key={fecha} style={styles.dia}>
              <View style={styles.diaEncabezado}>
                <View style={[styles.diaNumero, esHoy && styles.diaNumeroHoy]}>
                  <Text style={styles.diaNumeroTexto}>{numeroDeDia(fecha)}</Text>
                </View>
                <Text style={styles.diaNombre}>{diaCorto(fecha).toUpperCase()}</Text>
                <View style={styles.linea} />
                <Text style={tipo.etiqueta}>{sesiones.length > 0 ? textoHoras(horasTotales(sesiones)) : "—"}</Text>
              </View>
              {sesiones.map((sesion) => (
                <TarjetaSesion key={sesion.bloque.id} sesion={sesion} compacta />
              ))}
            </View>
          );
        })
      ) : (
        // ----- MES: grilla + sesiones del día elegido -----
        <>
          <Tarjeta estiloInterno={styles.grilla} style={styles.margenAbajo}>
            <View style={styles.filaSemana}>
              {INICIALES_DIAS.map((inicial, i) => (
                <Text key={i} style={styles.inicialDia}>
                  {inicial}
                </Text>
              ))}
            </View>
            {grilla.map((semanaDelMes) => (
              <View key={semanaDelMes[0].fecha} style={styles.filaSemana}>
                {semanaDelMes.map(({ fecha, delMes }) => (
                  <CeldaDia
                    key={fecha}
                    fecha={fecha}
                    delMes={delMes}
                    esHoy={fecha === hoy}
                    elegida={fecha === seleccionada}
                    // ids de empresas de ese día, sin repetir (Set) y pasados a lista (Array.from)
                    empresasDelDia={Array.from(new Set((agenda[fecha] ?? []).map((s) => s.bloque.empresaId)))}
                    onPress={() => setSeleccionada(fecha)}
                  />
                ))}
              </View>
            ))}
          </Tarjeta>

          <View style={styles.diaEncabezado}>
            <Text style={tipo.seccion}>{fechaLarga(seleccionada)}</Text>
            <View style={styles.linea} />
            <Text style={tipo.etiqueta}>{textoHoras(horasTotales(agenda[seleccionada] ?? []))}</Text>
          </View>
          {(agenda[seleccionada] ?? []).length === 0 ? (
            <Text style={[tipo.secundario, styles.sinSesiones]}>Sin sesiones este día.</Text>
          ) : (
            (agenda[seleccionada] ?? []).map((sesion) => (
              <TarjetaSesion key={sesion.bloque.id} sesion={sesion} compacta />
            ))
          )}
        </>
      )}
    </Pantalla>
  );
};

/**
 * Un día de la grilla del mes: número y hasta 3 puntos con los colores de
 * las empresas que tienen sesión ese día.
 */
function CeldaDia({
  fecha,
  delMes,
  esHoy,
  elegida,
  empresasDelDia,
  onPress,
}: {
  fecha: string;
  delMes: boolean;
  esHoy: boolean;
  elegida: boolean;
  empresasDelDia: string[];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fechaLarga(fecha)}
      // cada "cond && estilo" suma ese estilo solo si la condición es verdadera
      style={[styles.celda, esHoy && styles.celdaHoy, elegida && styles.celdaElegida, !delMes && styles.celdaFuera]}
    >
      <Text style={[styles.celdaNumero, elegida && styles.celdaNumeroElegida]}>{numeroDeDia(fecha)}</Text>
      <View style={styles.puntos}>
        {empresasDelDia.slice(0, 3).map((empresaId) => (
          <View key={empresaId} style={[styles.punto, { backgroundColor: colorDeEmpresa(empresaId) }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  margenAbajo: { marginBottom: espacio.xl },
  navegacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.m,
    marginTop: espacio.l,
  },
  tituloPeriodo: {
    flex: 1,
    textAlign: "center",
    fontFamily: fuentes.negrita,
    fontSize: 18,
    color: colores.tinta,
  },
  botonHoy: {
    alignSelf: "center",
    marginTop: espacio.m,
    marginBottom: espacio.xl,
  },

  // semana
  dia: {
    marginBottom: espacio.l,
  },
  diaEncabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio.s,
    marginBottom: espacio.s,
  },
  diaNumero: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borde.ancho,
    borderColor: colores.tinta,
    borderRadius: borde.radio,
    backgroundColor: colores.superficie,
  },
  diaNumeroHoy: {
    backgroundColor: colores.acento,
  },
  diaNumeroTexto: {
    fontFamily: fuentes.monoNegrita,
    fontSize: 14,
    color: colores.tinta,
  },
  diaNombre: {
    fontFamily: fuentes.monoNegrita,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colores.tinta,
  },
  linea: {
    flex: 1,
    height: 2,
    backgroundColor: colores.tinta,
    opacity: 0.12,
  },
  sinSesiones: {
    marginBottom: espacio.l,
  },

  // mes
  grilla: {
    padding: espacio.s,
  },
  filaSemana: {
    flexDirection: "row",
  },
  inicialDia: {
    flex: 1,
    textAlign: "center",
    fontFamily: fuentes.monoNegrita,
    fontSize: 11,
    color: colores.tintaSuave,
    paddingVertical: espacio.xs,
  },
  celda: {
    flex: 1,
    minHeight: 48,
    margin: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  celdaHoy: {
    backgroundColor: colores.acento,
    borderColor: colores.tinta,
  },
  celdaElegida: {
    backgroundColor: colores.tinta,
    borderColor: colores.tinta,
  },
  celdaFuera: {
    opacity: 0.3,
  },
  celdaNumero: {
    fontFamily: fuentes.monoNegrita,
    fontSize: 14,
    color: colores.tinta,
  },
  celdaNumeroElegida: {
    color: colores.acento,
  },
  puntos: {
    flexDirection: "row",
    gap: 3,
    height: 7,
  },
  punto: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colores.tinta,
  },
});

export default Calendario;
