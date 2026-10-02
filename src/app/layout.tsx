// src/app/layout.tsx
import { Tabs } from "expo-router";
//import { useSearchParams } from "expo-router";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Inicio"
    >
      <Tabs.Screen name="Inicio" options={{ title: "Inicio" }} />
      <Tabs.Screen name="MisPaquetes" options={{ title: "Mis Paquetes" }} />
      <Tabs.Screen name="MisEmpresas" options={{ title: "Mis Empresas" }} />
    </Tabs>
  );
}