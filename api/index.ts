import express, { Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// 1. Activamos las variables de entorno (nuestro archivo secreto)
dotenv.config();

// 2. Creamos la aplicación Express
const app = express();
app.use(express.json()); // Permite que nuestra API entienda formato JSON

// 3. Conexión a MongoDB
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("Falta la variable de entorno MONGODB_URI");
}

const mongoUriValidated: string = mongoUri;

let isMongoConnected = false;
let currentDatabase = "FraseAlbertoDB"; // Valor por defecto, se actualizará al conectar

async function connectToMongo() {
  if (isMongoConnected) return;

  await mongoose.connect(mongoUriValidated);

  // Usa el nombre de DB de la variable de entorno o extrae de la URI
  const dbNameFromEnv = process.env.DB_NAME;
  if (dbNameFromEnv) {
    currentDatabase = dbNameFromEnv;
  } else {
    currentDatabase = mongoose.connection.name;
  }

  isMongoConnected = true;
  console.log("¡Conectado a la Base de Datos!");
}

// 4. Creamos el "Molde" (Esquema) para nuestras frases
const FraseSchema = new mongoose.Schema(
  {
    texto: String,
    autor: String,
  },
  {
    collection: "frases",
  },
);
const Frase = mongoose.models.Frase || mongoose.model("Frase", FraseSchema);

function getMongoDebugInfo() {
  return {
    database: currentDatabase || mongoose.connection.name,
    collection: Frase.collection.name,
    readyState: mongoose.connection.readyState,
  };
}

// 5. RUTAS DE NUESTRA API

app.get("/api/debug-db", async (req: Request, res: Response) => {
  try {
    await connectToMongo();
    res.json(getMongoDebugInfo());
  } catch (error) {
    console.error("Error al inspeccionar MongoDB:", error);
    res.status(500).json({
      error: "No se pudo inspeccionar la conexion",
      detail: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Ruta GET: Sirve para LEER todas las frases
app.get("/api/frases", async (req: Request, res: Response) => {
  try {
    await connectToMongo();
    const frases = await Frase.find(); // Busca todas las frases en MongoDB
    res.json(frases);
  } catch (error) {
    console.error("Error al leer frases:", error);
    res.status(500).json({
      error: "No se pudieron obtener las frases",
      detail: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Ruta POST: Sirve para CREAR una nueva frase
app.post("/api/frases", async (req: Request, res: Response) => {
  try {
    const { texto, autor } = req.body;

    if (!texto || !autor) {
      res.status(400).json({ error: "Debes enviar texto y autor" });
      return;
    }

    await connectToMongo();
    const nuevaFrase = new Frase({ texto, autor }); // Toma los datos que envía el usuario
    await nuevaFrase.save(); // Los guarda en MongoDB
    res.status(201).json(nuevaFrase); // Responde con la frase recién creada
  } catch (error) {
    console.error("Error al crear frase:", error);
    res.status(500).json({
      error: "No se pudo guardar la frase",
      detail: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// 6. Exportamos la app para que Vercel pueda encenderla
export default app;
