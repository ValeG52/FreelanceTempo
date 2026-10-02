# Contexto del proyecto — FreelanceTempo

Resumen del trabajo hecho hasta ahora: cómo está organizado el código, qué
decisiones se tomaron, qué funciona y qué falta. Las reglas de negocio
completas están en `CLAUDE.md`; acá va lo que se implementó y por qué.

Última actualización: 2026-10-02.

---

## Estructura

```
src/
├── app/                        # pantallas (Expo Router)
│   ├── index.tsx               # Cronograma (inicio) — todavía no muestra bloques
│   ├── mis-empresas.tsx        # lista + switch de prioridad alta + eliminar
│   ├── mis-paquetes.tsx        # lista + eliminar
│   └── (modals)/
│       ├── AgregarEmpresa.tsx  # crea la empresa y genera su cronograma
│       └── AgregarPaquete.tsx
├── components/
│   └── boton-eliminar.tsx      # botón con confirmación en dos toques
├── sistema/                    # lógica de negocio pura (sin React ni storage)
│   ├── cronograma.ts           # algoritmo: generación normal, x4, recálculo
│   ├── prioridad.ts            # prender/apagar el switch de prioridad alta
│   └── eliminacion.ts          # borrar empresas, validar borrado de paquetes
├── storage/
│   └── index.ts                # AsyncStorage: paquetes, empresas, bloques, jornada
└── type/
    └── index.ts                # Paquete, Empresa, BloqueHorario, JornadaLaboral...
```

### Cómo se conectan las capas

`sistema/` no importa nada de React ni de `storage/`. Cada pantalla hace
siempre lo mismo:

1. **Lee** del storage todo lo que necesita (empresas, paquetes, bloques, jornada).
2. **Llama** a una función de `sistema/`, que devuelve las listas completas ya actualizadas.
3. **Guarda** el resultado y actualiza el state.

Así la pantalla no tiene reglas de negocio y el algoritmo se puede probar
sin el celular.

### Qué se guarda en AsyncStorage

| Clave | Contenido |
|---|---|
| `paquetes` | `Paquete[]` |
| `empresas` | `Empresa[]` |
| `bloques` | `BloqueHorario[]`: el cronograma ya generado, completo |
| `jornada` | `JornadaLaboral`, o nada si el usuario todavía no la configuró |

Empresas y bloques se guardan juntos con `guardarEmpresasYBloques` (un solo
`multiSet`), para que no quede guardada una cosa sin la otra si la app se
cierra en el medio.

---

## Qué se hizo

### 1. Cronograma al crear una empresa
- `AgregarEmpresa` llama a `crearEmpresaConCronograma`, que arma todas las
  sesiones del paquete dentro de la ventana de la empresa.
- Si no entran todas: aparece "No hay cupos" y **no se guarda nada**, ni
  siquiera la empresa (regla de negocio: sin asignaciones parciales).
- `fechaAlta` se guarda como `"YYYY-MM-DD"` en hora local.

### 2. Switch de prioridad alta (Mis Empresas)
- **Al prender** (`aplicarActivacionAlta`):
  - se guarda `fechaActivacionPrioridad` con fecha y hora, que define el orden FIFO;
  - se borran los bloques normales de la empresa de mañana en adelante;
  - se genera el bloque x4 de hoy, corriendo a las empresas que estorban.
- **Al apagar** (`aplicarDesactivacionAlta`):
  - la empresa vuelve a `"media"`;
  - se calculan las horas consumidas y se reparten las restantes con bloque
    normal en lo que queda de su ventana original;
  - las empresas que había desplazado se recalculan para volver a su patrón
    habitual.
- Si algo no entra, se muestra un aviso en la pantalla.
- Mientras se guarda, todos los switches y botones quedan deshabilitados.

### 3. Eliminar empresas y paquetes
- **Empresa:** se borran ella y todos sus bloques (libera su espacio). A las
  demás no se las reordena.
- **Paquete:** solo se puede borrar si ninguna empresa lo usa. Si alguna lo
  usa, se muestra un aviso con los nombres.
- La confirmación es en dos toques (ELIMINAR → ¿SEGURO? SÍ / NO). No se usa
  `Alert` porque en web no muestra botones.

### 4. Correcciones al algoritmo (`cronograma.ts`, antes `.tsx`)
| Problema | Solución |
|---|---|
| Las sesiones se ponían en días seguidos | Se reparten espaciadas en la ventana (10 sesiones en 30 días = una cada 3 días) |
| En Argentina la fecha podía correrse un día de noche | Las fechas se manejan siempre en UTC; "hoy" se calcula con hora local (`fechaLocalISO`) |
| La ventana tenía un día de más | Ahora es de 30/7 días contando el día de alta |
| El bloque x4 siempre iba al inicio de la jornada y podía pisar a otra empresa en alta | Respeta FIFO (no pisa a las que activaron antes) y elige la posición que menos minutos de otras empresas obliga a mover |
| Los bloques desplazados tenían un tope fijo de 30 días | Solo se mueven dentro de la ventana de su propia empresa |
| La última sesión siempre era de tamaño completo | Puede ser más corta (15 h en bloques de 2 h → la última dura 1 h) |

### 5. Cambios en el modelo de datos
- `Empresa.empresasDesplazadas?: string[]`: ids de las empresas que corrió
  mientras estuvo en alta, para saber a quién recalcular al apagar.

---

## Decisiones tomadas

Son decisiones que no estaban definidas en las reglas de negocio. Se pueden
cambiar.

- **Jornada provisoria de 09:00 a 18:00** (`JORNADA_POR_DEFECTO`) mientras no
  exista la pantalla de jornada.
- **Horas consumidas** = la duración de todos los bloques de la empresa de
  hoy para atrás, incluido el de hoy. No se lleva un registro aparte.
- **Al prender el switch** se borran los bloques normales de la empresa de
  mañana en adelante (los de hoy quedan). Si no, tendría a la vez los
  normales y los x4.
- **Si el bloque x4 no entra entero hoy**, el resto pasa a los días
  siguientes (hasta 30 días). Esto vale tanto si excede la jornada como si
  el lugar lo ocupan empresas en alta con prioridad FIFO.
- **Orden al apagar**: primero se recalcula la empresa que se apaga y
  después las desplazadas, por fecha de alta. Si alguna no entra, queda con
  su horario anterior y se avisa.
- **Las desplazadas que están en alta** no se recalculan al apagar otra
  empresa: las maneja su propio bloque x4.
- **No se puede borrar un paquete en uso.** La alternativa (borrarlo junto
  con sus empresas) se descartó por ser destructiva.

---

## Qué funciona y cómo se verificó

- `npx tsc --noEmit` pasa sin errores.
- El algoritmo se probó fuera del celular con 3 empresas de ejemplo
  (10 h/mes, 30 h/mes y 8 h/semana):
  - las tres se crean bien, sin bloques superpuestos;
  - al prender la empresa de 30 h (x4 = 12 h, jornada de 9 h), se usa lo
    libre de hoy, el resto pasa a mañana y la empresa semanal se corre
    dentro de su semana;
  - al prender una segunda empresa, no pisa a la primera (FIFO);
  - al apagar la primera, se calculan 8 h consumidas y las 22 h restantes se
    reparten hasta el día 27, sin superposiciones.

**Sin verificar:**
- No se probó en el celular (Expo Go).
- No se corrió `npx expo lint` porque `eslint` no está instalado en el proyecto.

---

## Qué falta

### Para que el cronograma funcione de punta a punta
- [ ] **Chequeo diario**: llamar a `generarDiaUrgente` una vez por día para
      cada empresa en alta, en orden FIFO (`empresasEnAltaPorOrdenFIFO` ya
      existe). Hoy una empresa en alta solo recibe el bloque x4 del día en
      que se prendió el switch. También tiene que acumular las nuevas
      empresas desplazadas en `empresasDesplazadas`.
- [ ] **Pantalla de inicio**: mostrar los bloques de hoy. Hoy muestra una
      grilla vacía de 9 a 22 h.
- [ ] **Pantalla de jornada laboral** (fija o variable), que usa
      `guardarJornada`.

### Limitaciones conocidas
- **Horarios ya pasados:** el bloque de hoy puede quedar en un horario que
  ya pasó (por ejemplo, si se prende el switch a las 15 h, el bloque puede
  quedar a las 10 h). Lo mismo al crear una empresa a la tarde.
- **Empresas viejas:** las creadas antes de estos cambios no tienen bloques,
  y algunas tienen `fechaAlta` con formato ISO completo. Conviene borrarlas
  y volver a crearlas.
- **Sesiones perdidas:** si un bloque desplazado no entra en la ventana de su
  empresa, se saca del cronograma y se muestra un aviso. Las reglas de
  negocio asumen que las urgencias duran poco y no definen qué hacer en ese
  caso.

### Pendientes de producto (de `CLAUDE.md`)
- [ ] Confirmar la tabla de tamaño de bloque con datos reales.
- [ ] Vista de calendario semana/mes.
- [ ] Vinculación con el calendario nativo.
- [ ] Decidir si se suma backend y cuentas de usuario.
- [ ] (Futuro) Versión de escritorio sincronizada.

### Detalles menores
- `AgregarEmpresa` recibe una prop `onClose` que Expo Router nunca le pasa.
  No rompe nada, pero se puede borrar.
- `actualizarEmpresa` en `storage/` quedó sin uso.
