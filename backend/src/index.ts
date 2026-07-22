import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDb } from "./cloud/db/index.ts";
import { connectRedis } from "./cloud/redis/index.ts";
import routes from "./routes/index.ts";

dotenv.config();

if (!process.env.PORT) {
  throw new Error("Missing environment variable: PORT");
}

const PORT = Number(process.env.PORT);
const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/api", routes);

try {
  await connectDb();
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}