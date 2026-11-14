# Sistema de condominios

Prototipo autocontenido para administrar condominios y ofrecer un portal local para residentes. Está construido con HTML, CSS y JavaScript sin dependencias de compilación ni backend; conserva los datos en `localStorage` del navegador.

## Ejecutar el prototipo

Abre `Sistema_Condominios_Prototipo_Corregido.html` en un navegador moderno. Los cambios quedan en el almacenamiento local de ese navegador y perfil. No uses información real: este prototipo no implementa una base de datos central, autenticación segura ni envío de comunicaciones externas.

## Pruebas de lógica

Requiere Node.js 18 o posterior. Desde esta carpeta, ejecuta:

```sh
node --test tests/business-logic.test.cjs
```

Las pruebas usan funciones del HTML actual y datos aislados en memoria; no abren el prototipo ni escriben en el almacenamiento del navegador.
