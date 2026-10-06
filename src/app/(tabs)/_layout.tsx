// src/app/(tabs)/_layout.tsx — barra de pestañas de abajo
// Desde cualquier pestaña se vuelve al cronograma (Hoy) con un toque.
import { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Icono, NombreIcono, colores, fuentes, borde } from "../../components/kit";

/**
 * Arma el ícono de una pestaña. Devuelve una función porque la barra la
 * llama con el color que corresponde (activa / inactiva).
 */
// (función que crea y devuelve otra función: como un método que devuelve un Func<> en C#)
function iconoPestana(nombre: NombreIcono) {
  function IconoDePestana({ color }: { color: ColorValue }) {
    return <Icono nombre={nombre} color={color} tamano={22} />;
  }
  return IconoDePestana;
}

/** Layout de pestañas: Hoy · Calendario · Empresas · Paquetes. */
export default function TabsLayout() {
  return (
    // Tabs = barra de pestañas; cada <Tabs.Screen> es una pestaña (name = archivo de esta carpeta)
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.tinta,
        tabBarInactiveTintColor: colores.tintaTenue,
        tabBarActiveBackgroundColor: colores.acento, // la pestaña activa se pinta de amarillo
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopWidth: borde.ancho,
          borderTopColor: colores.tinta,
        },
        tabBarLabelStyle: {
          fontFamily: fuentes.semi,
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: colores.fondo },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hoy",
          tabBarIcon: iconoPestana({ ios: "sun.max.fill", android: "today", web: "today" }),
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          title: "Calendario",
          tabBarIcon: iconoPestana({ ios: "calendar", android: "calendar_month", web: "calendar_month" }),
        }}
      />
      <Tabs.Screen
        name="mis-empresas"
        options={{
          title: "Empresas",
          tabBarIcon: iconoPestana({ ios: "building.2.fill", android: "business", web: "business" }),
        }}
      />
      <Tabs.Screen
        name="mis-paquetes"
        options={{
          title: "Paquetes",
          tabBarIcon: iconoPestana({ ios: "shippingbox.fill", android: "inventory_2", web: "inventory_2" }),
        }}
      />
    </Tabs>
  );
}
