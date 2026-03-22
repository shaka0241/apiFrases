# Guía Paso a Paso: API de Frases con Express, MongoDB y Vercel

## ¿Qué vamos a construir?

Una **API REST** que permite guardar y consultar frases célebres. La API está escrita en **TypeScript**, usa **Express** como servidor web, **MongoDB** como base de datos, y se despliega en la nube con **Vercel**.

---

## Conceptos clave antes de empezar

| Concepto | ¿Qué es? |
|---|---|
| **API REST** | Un servidor que recibe peticiones HTTP y devuelve datos en formato JSON |
| **Express** | Framework de Node.js para crear servidores web fácilmente |
| **MongoDB** | Base de datos NoSQL que guarda documentos en formato JSON |
| **Mongoose** | Librería que nos ayuda a conectar y trabajar con MongoDB desde Node.js |
| **TypeScript** | JavaScript con tipos; nos ayuda a detectar errores antes de ejecutar el código |
| **Vercel** | Plataforma gratuita para desplegar proyectos en la nube |
| **dotenv** | Librería para cargar variables secretas desde un archivo `.env` |

---

## Estructura del proyecto

```
apiFrases/
├── api/
│   └── index.ts       ← Todo el código de la API
├── package.json        ← Dependencias y scripts del proyecto
├── vercel.json         ← Configuración para el despliegue en Vercel
└── .env                ← Variables de entorno (¡nunca subir a Git!)
```

---

## Paso 1 — Inicializar el proyecto

Abrimos la terminal en la carpeta donde queremos crear el proyecto y ejecutamos:

```bash
mkdir apiFrases
cd apiFrases
npm init -y
```

`npm init -y` crea el archivo `package.json` con valores predeterminados. Este archivo es el "pasaporte" del proyecto: define su nombre, versión y dependencias.

---

## Paso 2 — Instalar las dependencias

### Dependencias de producción (las que necesita el servidor en ejecución)

```bash
npm install express mongoose dotenv
```

- **express** → el servidor web
- **mongoose** → el conector con MongoDB
- **dotenv** → para leer variables de entorno

### Dependencias de desarrollo (solo para escribir y compilar el código)

```bash
npm install -D typescript @types/express @types/node
```

- **typescript** → el compilador de TypeScript
- **@types/express** y **@types/node** → definiciones de tipos para TypeScript

Después de esto, el `package.json` quedará así:

```json
{
  "name": "apifrases",
  "version": "1.0.0",
  "type": "commonjs",
  "dependencies": {
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "mongoose": "^9.3.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^25.5.0",
    "typescript": "^5.9.3"
  }
}
```

---

## Paso 3 — Configurar Vercel

Creamos el archivo `vercel.json` en la raíz del proyecto:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index.ts"
    }
  ]
}
```

**¿Qué hace esto?**  
Le dice a Vercel que **toda petición** que llegue al servidor (sin importar la ruta) debe ser dirigida a nuestro archivo `api/index.ts`. Esto convierte nuestra aplicación Express en una **función serverless**.

---

## Paso 4 — Crear las variables de entorno

Creamos un archivo `.env` en la raíz del proyecto:

```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/miBaseDeDatos
DB_NAME=apiFrases
```

> **Importante:** Este archivo contiene datos sensibles (contraseñas, URIs de conexión). Nunca debe subirse a Git. Agrégalo a `.gitignore`:
> ```
> .env
> node_modules/
> ```

- `MONGODB_URI` → la cadena de conexión que nos da MongoDB Atlas
- `DB_NAME` → el nombre de la base de datos que queremos usar (opcional, ya que puede estar incluido en la URI)

---

## Paso 5 — Escribir el código: `api/index.ts`

Creamos la carpeta `api` y dentro el archivo `index.ts`. Vamos a entender el código sección por sección.

### 5.1 — Importaciones y configuración inicial

```typescript
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Activamos las variables de entorno (nuestro archivo secreto)
dotenv.config();

// Creamos la aplicación Express
const app = express();
app.use(express.json()); // Permite que nuestra API entienda formato JSON
```

- `dotenv.config()` lee el archivo `.env` y carga las variables en `process.env`
- `express.json()` es un **middleware**: intercepta cada petición y convierte el cuerpo JSON en un objeto JavaScript usable

### 5.2 — Conexión a MongoDB (lazy connection)

```typescript
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("Falta la variable de entorno MONGODB_URI");
}

const mongoUriValidated: string = mongoUri;

let isMongoConnected = false;
let currentDatabase = "";

async function connectToMongo() {
  if (isMongoConnected) return; // Evita conectar dos veces

  const dbNameFromEnv = process.env.DB_NAME;
  const connectionOptions = dbNameFromEnv
    ? { dbName: dbNameFromEnv }
    : undefined;

  await mongoose.connect(mongoUriValidated, connectionOptions);
  currentDatabase = mongoose.connection.name;

  isMongoConnected = true;
  console.log("¡Conectado a la Base de Datos!");
}
```

**Patrón importante — Lazy Connection:**  
En lugar de conectar a MongoDB al iniciar el servidor, nos conectamos **la primera vez que llega una petición**. Esto es ideal para entornos serverless (como Vercel) donde el servidor puede "dormir" entre peticiones.

La variable `isMongoConnected` actúa como guardia: si ya estamos conectados, no vuelve a conectar.

### 5.3 — El Esquema y Modelo de Mongoose

```typescript
const FraseSchema = new mongoose.Schema(
  {
    texto: String,
    autor: String,
  },
  {
    collection: "frases",
  }
);

const Frase = mongoose.models.Frase || mongoose.model("Frase", FraseSchema);
```

- **Schema (Esquema):** Es el "molde" de nuestro documento. Define qué campos tiene y de qué tipo son.
- **Model (Modelo):** Es la clase que usamos para crear, leer, actualizar y borrar documentos en MongoDB.

La expresión `mongoose.models.Frase || mongoose.model(...)` evita un error en entornos serverless donde el modelo podría haberse registrado en una ejecución anterior.

### 5.4 — Las rutas de la API

#### Ruta de diagnóstico: `GET /api/debug-db`

```typescript
app.get("/api/debug-db", async (req: Request, res: Response) => {
  try {
    await connectToMongo();
    res.json({
      database: currentDatabase,
      collection: Frase.collection.name,
      readyState: mongoose.connection.readyState,
    });
  } catch (error) {
    res.status(500).json({ error: "No se pudo inspeccionar la conexion" });
  }
});
```

Nos dice a qué base de datos y colección estamos conectados. Muy útil para depurar problemas.

#### Ruta GET: `GET /api/frases` — Leer todas las frases

```typescript
app.get("/api/frases", async (req: Request, res: Response) => {
  try {
    await connectToMongo();
    const frases = await Frase.find(); // Busca TODOS los documentos
    res.json(frases);
  } catch (error) {
    res.status(500).json({ error: "No se pudieron obtener las frases" });
  }
});
```

`Frase.find()` sin argumentos devuelve **todos** los documentos de la colección `frases`.

#### Ruta POST: `POST /api/frases` — Crear una nueva frase

```typescript
app.post("/api/frases", async (req: Request, res: Response) => {
  try {
    const { texto, autor } = req.body;

    if (!texto || !autor) {
      res.status(400).json({ error: "Debes enviar texto y autor" });
      return;
    }

    await connectToMongo();
    const nuevaFrase = new Frase({ texto, autor });
    await nuevaFrase.save();
    res.status(201).json(nuevaFrase);
  } catch (error) {
    res.status(500).json({ error: "No se pudo guardar la frase" });
  }
});
```

- Se extraen `texto` y `autor` del cuerpo de la petición (`req.body`)
- Se valida que ambos campos existan; si no, se responde con `400 Bad Request`
- Se crea un documento nuevo y se guarda en MongoDB con `.save()`
- Se responde con `201 Created` y el documento recién creado

### 5.5 — Exportación para Vercel

```typescript
export default app;
```

En lugar de llamar a `app.listen(puerto)` (como haríamos en un servidor tradicional), **exportamos** la aplicación. Vercel se encarga de "encenderla" como función serverless al recibir una petición.

---

## Paso 6 — Resumen de los códigos HTTP usados

| Código | Significado | Cuándo se usa en este proyecto |
|---|---|---|
| `200` | OK | Respuesta exitosa por defecto (GET) |
| `201` | Created | Frase creada correctamente (POST) |
| `400` | Bad Request | Faltan campos en el cuerpo de la petición |
| `500` | Internal Server Error | Error al conectar a MongoDB u otro error interno |

---

## Paso 7 — Despliegue en Vercel

### Instalar la CLI de Vercel (una sola vez)

```bash
npm install -g vercel
```

### Iniciar sesión

```bash
vercel login
```

### Desplegar

```bash
vercel
```

Vercel te hará algunas preguntas (nombre del proyecto, carpeta raíz). Al finalizar, te dará una **URL pública** donde tu API estará disponible.

### Agregar las variables de entorno en Vercel

En el panel de Vercel → tu proyecto → **Settings → Environment Variables**, agrega:

- `MONGODB_URI` → tu cadena de conexión de MongoDB Atlas
- `DB_NAME` → el nombre de tu base de datos

---

## Paso 8 — Probar la API

### Con el navegador (solo GET)

```
https://tu-proyecto.vercel.app/api/frases
```

### Con Thunder Client, Postman o Insomnia

**Leer todas las frases:**
```
GET https://tu-proyecto.vercel.app/api/frases
```

**Crear una frase:**
```
POST https://tu-proyecto.vercel.app/api/frases
Content-Type: application/json

{
  "texto": "La imaginación es más importante que el conocimiento",
  "autor": "Albert Einstein"
}
```

**Ver información de la conexión:**
```
GET https://tu-proyecto.vercel.app/api/debug-db
```

---

## Diagrama del flujo completo

```
Cliente (navegador / Postman)
        │
        │  HTTP Request
        ▼
    Vercel (Edge)
        │
        │  Redirige todo a api/index.ts
        ▼
    Express App
        │
        ├── GET /api/frases    → conecta a Mongo → Frase.find() → JSON[]
        ├── POST /api/frases   → valida body → new Frase().save() → JSON
        └── GET /api/debug-db  → info de conexión → JSON
        │
        ▼
    MongoDB Atlas (en la nube)
```

---

## Errores comunes y cómo resolverlos

| Error | Causa probable | Solución |
|---|---|---|
| `Falta la variable de entorno MONGODB_URI` | No existe el archivo `.env` o no está configurado en Vercel | Crear `.env` o agregar la variable en el panel de Vercel |
| `MongooseServerSelectionError` | IP no permitida en MongoDB Atlas | En Atlas → Network Access → agregar `0.0.0.0/0` |
| `400 Bad Request` en POST | Se envió el cuerpo sin `texto` o sin `autor` | Asegurarse de enviar ambos campos en el JSON |
| La API devuelve HTML en vez de JSON | Vercel no reconoce el archivo | Verificar que `vercel.json` esté en la raíz del proyecto |
