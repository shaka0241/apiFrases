import express, { Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// 1. Activamos las variables de entorno (nuestro archivo secreto)
dotenv.config();

// 2. Creamos la aplicación Express
const app = express();
app.use(express.json()); // Permite que nuestra API entienda formato JSON

// 3. Conexión a MongoDB
// Usamos ! al final para prometerle a TypeScript que esta variable existirá
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => console.log("¡Conectado a la Base de Datos!"))
  .catch((err) => console.error("Error al conectar:", err));

// 4. Creamos el "Molde" (Esquema) para nuestras frases
const FraseSchema = new mongoose.Schema({
  texto: String,
  autor: String,
});
const Frase = mongoose.model("Frase", FraseSchema);

// 5. RUTAS DE NUESTRA API

// Ruta GET: Sirve para LEER todas las frases
app.get("/api/frases", async (req: Request, res: Response) => {
  const frases = await Frase.find(); // Busca todas las frases en MongoDB
  res.json(frases);
});

// Ruta POST: Sirve para CREAR una nueva frase
app.post("/api/frases", async (req: Request, res: Response) => {
  const nuevaFrase = new Frase(req.body); // Toma los datos que envía el usuario
  await nuevaFrase.save(); // Los guarda en MongoDB
  res.status(201).json(nuevaFrase); // Responde con la frase recién creada
});

// 6. Exportamos la app para que Vercel pueda encenderla
export default app;
