// src/app/_layout.tsx — layout raíz de la app
// Carga las fuentes y arma la navegación principal (un Stack):
// - (tabs): las 4 pestañas de abajo (Hoy, Calendario, Empresas, Paquetes)
// - (modals): Agregar Empresa / Agregar Paquete / Nota de una sesión, que se abren como modal
// - jornada: ajustes de jornada laboral, que se abre encima de las pestañas
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { colores } from "../components/kit";

// la pantalla de carga (splash) queda visible hasta que estén las fuentes
SplashScreen.preventAutoHideAsync();

/** Layout raíz: espera las fuentes y define las pantallas del Stack principal. */
export default function RootLayout() {
  // useFonts carga las fuentes y devuelve [ya cargaron?, error si falló]
  const [cargadas, error] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    // si falla la carga igual sigo: se ven con la fuente del sistema
    if (cargadas || error) SplashScreen.hideAsync();
  }, [cargadas, error]);

  if (!cargadas && !error) return null; // devolver null = no dibujar nada todavía

  return (
    <>
      <StatusBar style="dark" />
      {/* Stack = pila de pantallas: abrir una la pone encima, volver la saca */}
      <Stack
        // {{ }} doble: las de afuera son "acá va código", las de adentro son el objeto
        screenOptions={{
          headerShown: false, // cada pantalla dibuja su propio encabezado
          contentStyle: { backgroundColor: colores.fondo },
        }}
      >
        {/* name = la carpeta o archivo de src/app/ que corresponde a esa pantalla */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)/AgregarEmpresa" options={{ presentation: "modal" }} />
        <Stack.Screen name="(modals)/AgregarPaquete" options={{ presentation: "modal" }} />
        <Stack.Screen name="(modals)/NotaSesion" options={{ presentation: "modal" }} />
        <Stack.Screen name="jornada" />
      </Stack>
    </>
  );
}
