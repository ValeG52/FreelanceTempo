// src/app/index.tsx — Cronograma (pantalla de inicio)
// Muestra el recorte de HOY del cronograma ya generado. No calcula nada:
// lee los bloques guardados y le pide a sistema/ los de la fecha de hoy.
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, AppState } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { obtenerBloques, obtenerEmpresas } from "../storage/index";
import { armarAgendaDelDia, fechaLocalISO, SesionDelDia } from "../sistema/cronograma";

// Milisegundos que faltan hasta la próxima medianoche (hora local del celular)
function msHastaMedianoche(ahora: Date): number {
  const medianoche = new Date(ahora);
  medianoche.setHours(24, 0, 0, 0); // hora 24 = 00:00 del día siguiente
  return medianoche.getTime() - ahora.getTime();
}

// "09:00" - "11:30" → "2 H 30 MIN"
function textoDuracion(horaInicio: string, horaFin: string): string {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFin.split(":").map(Number);
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${horas} h`;
  if (horas === 0) return `${resto} min`;
  return `${horas} h ${resto} min`;
}

const HomeScreen = () => {
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // "Hoy" como "YYYY-MM-DD". Es state para que la pantalla se redibuje sola
  // cuando cambia el día.
  const [fechaHoy, setFechaHoy] = useState<string>(fechaLocalISO(new Date()));
  const [sesiones, setSesiones] = useState<SesionDelDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lee del storage y arma la agenda de la fecha indicada
  const cargarAgenda = useCallback(async (fecha: string) => {
    try {
      // Promise.all = Task.WhenAll en C#: las dos lecturas en paralelo
      const [bloques, empresas] = await Promise.all([obtenerBloques(), obtenerEmpresas()]);
      setSesiones(armarAgendaDelDia(fecha, bloques, empresas));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el cronograma.");
    } finally {
      setCargando(false);
    }
  }, []);

  // useFocusEffect corre cada vez que la pantalla vuelve a estar visible
  // (por ej. al cerrar el modal de Agregar Empresa o volver de Mis Empresas),
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
  useEffect(() => {
    const revisarFecha = () => {
      const hoy = fechaLocalISO(new Date());
      // si la fecha no cambió, React no redibuja (mismo valor)
      setFechaHoy(hoy);
      cargarAgenda(hoy);
    };

    const timer = setTimeout(revisarFecha, msHastaMedianoche(new Date()) + 1000);
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") revisarFecha();
    });

    // la función que devuelve useEffect es la "limpieza" (como Dispose en C#)
    return () => {
      clearTimeout(timer);
      suscripcion.remove();
    };
  }, [fechaHoy, cargarAgenda]); // al cambiar el día se vuelve a programar el timer

  // Para mostrar la fecha armo el Date con año/mes/día locales
  // (new Date("2026-10-02") sería UTC y en Argentina mostraría el día anterior)
  const [anio, mes, dia] = fechaHoy.split("-").map(Number);
  const fechaFormateada = new Date(anio, mes - 1, dia).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const opciones = [
    { label: "Agregar Paquete", onPress: () => router.push("/AgregarPaquete") },
    { label: "Agregar Empresa", onPress: () => router.push("/AgregarEmpresa") },
    { label: "Mis Empresas", onPress: () => router.push("/mis-empresas") },
    { label: "Mis Paquetes", onPress: () => router.push("/mis-paquetes") },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>CRONOGRAMA</Text>
          <Text style={styles.dateText}>{fechaFormateada}</Text>
        </View>

        <View style={styles.menuWrapper}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuAbierto((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text style={styles.menuButtonText}>MENU</Text>
          </TouchableOpacity>

          {menuAbierto && (
            <View style={styles.menuDropdown}>
              {opciones.map((opcion) => (
                <TouchableOpacity
                  key={opcion.label}
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuAbierto(false);
                    opcion.onPress();
                  }}
                >
                  <Text style={styles.menuItemText}>{opcion.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scheduleContainer}
        contentContainerStyle={styles.scheduleContent}
        showsVerticalScrollIndicator={false}
      >
        {error && <Text style={styles.avisoText}>{error}</Text>}

        {!cargando && sesiones.length === 0 && (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>Sin sesiones hoy</Text>
            <Text style={styles.vacioTexto}>No hay bloques asignados para este día.</Text>
          </View>
        )}

        {sesiones.map(({ bloque, nombreEmpresa, prioridad }) => (
          <View key={bloque.id} style={styles.sesion}>
            <View style={styles.sesionHorario}>
              <Text style={styles.sesionHoraText}>{bloque.horaInicio}</Text>
              <Text style={styles.sesionHoraFinText}>{bloque.horaFin}</Text>
            </View>
            <View style={styles.sesionInfo}>
              <Text style={styles.sesionEmpresaText}>{nombreEmpresa}</Text>
              <View style={styles.sesionDetalleRow}>
                <Text style={styles.sesionDuracionText}>
                  {textoDuracion(bloque.horaInicio, bloque.horaFin)}
                </Text>
                {prioridad === "alta" && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Alta</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f1e8",
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 52,
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 8,
  },
  title: {
    color: "#111111",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  dateText: {
    color: "#4d4d4d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  menuWrapper: {
    width: 120,
    position: "relative",
    zIndex: 10,
    alignItems: "flex-end",
  },
  menuButton: {
    backgroundColor: "#111111",
    borderWidth: 2,
    borderColor: "#111111",
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    transform: [{ skewX: "-8deg" }],
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  menuButtonText: {
    color: "#f5f1e8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    transform: [{ skewX: "8deg" }],
  },
  menuDropdown: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 210,
    backgroundColor: "#f5f1e8",
    borderWidth: 2,
    borderColor: "#111111",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    zIndex: 20,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    backgroundColor: "#f5f1e8",
  },
  menuItemText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scheduleContainer: {
    flex: 1,
    marginTop: 8,
  },
  scheduleContent: {
    paddingBottom: 20,
    paddingRight: 4, // deja ver la sombra offset de las tarjetas
  },
  pill: {
    backgroundColor: "#ffde59",
    borderWidth: 2,
    borderColor: "#111111",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    color: "#111111",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  sesion: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: "#111111",
    backgroundColor: "#ffffff",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  sesionHorario: {
    width: 78,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },
  sesionHoraText: {
    color: "#f5f1e8",
    fontSize: 16,
    fontWeight: "900",
  },
  sesionHoraFinText: {
    color: "#bdbdbd",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  sesionInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  sesionEmpresaText: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sesionDetalleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  sesionDuracionText: {
    color: "#4d4d4d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  vacio: {
    borderWidth: 2,
    borderColor: "#111111",
    borderStyle: "dashed",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  vacioTitulo: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  vacioTexto: {
    color: "#4d4d4d",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  avisoText: {
    color: "#b00020",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
});

export default HomeScreen;
