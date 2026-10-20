# Mi Desorden

**Mi Desorden** es una aplicación de inventario compartido donde apuntás a la estantería con la **cámara del teléfono**, la app reconoce los productos y el inventario se actualiza en vivo para todo tu equipo. 
## Arquitectura

```
Raiz del Monorepo (Turbo / Bun)
 ┣━━ apps/client (Expo / React Native)
 ┃    ┣━━ app/                 (Rutas y pantallas)
 ┃    ┣━━ api/                 (Modulos de comunicacion con el backend)
 ┃    ┣━━ components/          (Componentes de interfaz reutilizables)
 ┃    ┗━━ lib/                 (Utilidades, estado global y logica de negocio-cliente)
 ┃
 ┣━━ apps/api (NestJS)
 ┃    ┣━━ src/modules/         (Modulos funcionales)
 ┃    ┣━━ src/shared/          (Filtros, decoradores, configuracion y servicios de auth)
 ┃    ┣━━ src/utils/           (Utilidades de fecha, paginacion, seguridad y Swagger)
 ┃    ┗━━ test/                (Pruebas E2E y unitarias)
 ┃
 ┣━━ packages/core
 ┃    ┗━━ src/                 (Tipos comunes, clientes y logica compartida entre apps)
 ┃
 ┗━━ supabase
      ┣━━ migrations/          (Esquemas SQL: inventarios, fotos, invitaciones, categorias)
      ┗━━ templates/           (Plantillas HTML para correos de confirmacion y recuperacion)
```

## Stack de Desarrollador

- **Frontend Móvil:** React Native, Expo, Expo Router.
- **Backend:** NestJS, TypeScript, Bun (como gestor de paquetes y runtime).
- **Base de datos y Autenticación:** Supabase (PostgreSQL, JWT, migraciones SQL).
- **Herramientas de Monorepo:** Turbo, ESLint, Prettier, Doppler.
## Inicio Rápido y Ejecución

Para iniciar y levantar el proyecto en tu entorno local, sigue estos pasos:

1. **Instalar dependencias:**
    
    Asegúrate de tener instalado [Bun](https://bun.sh/) y ejecuta en la raíz del monorepo:
    
      
    
    Bash
    
    ```
    bun install
    ```
    
2. **Configurar las variables de entorno (con Doppler):**
    
    Inicia sesión y configura el entorno con Doppler (respaldado por el archivo `doppler.yaml`):
    
      
    
    Bash
    
    ```
    doppler login
    doppler setup
    ```
    
3. **Levantar el proyecto:**
    
    Puedes iniciar los servicios de desarrollo de forma unificada o por partes utilizando Turbo:
    
      
    - **Modo general (Monorepo completo):**
        
        Inicia todas las aplicaciones y paquetes de forma concurrente inyectando las variables de Doppler:
        
          
        
        Bash
        
        ```
        doppler run -- bun run dev
        ```
        
    - **Levantar componentes específicos:**
        
        Si prefieres correr únicamente el backend o la aplicación cliente de manera independiente:
        
          
        - **API (NestJS):** `bun --filter api dev`
            
              
            
        - **Cliente (Expo/React Native):** `bun --filter client dev`
            
              
            
    - **Scripts auxiliares:** El proyecto incluye scripts en la raíz (`scripts/`) para configuraciones iniciales o pruebas específicas en dispositivos (como `dev-setup.ts` o `dev-telefono.ts`):
        
        Bash
        
        ```
        bun run scripts/dev-setup.ts
        ```
## Documentación Adicional

Para más detalles técnicos sobre el funcionamiento interno, consulta la documentación en la carpeta `docs/`:

- **Arquitectura:** `docs/ARQUITECTURA.md`
- **Estrategia de Branching:** `docs/BRANCHING.md`
- **Registro de Decisiones (ADR):** `docs/DECISIONES.md`
- **Guía de Inicio Rápido detallada:** `docs/QUICKSTART.md`
- **Hoja de Ruta (Roadmap):** `docs/ROADMAP.md`