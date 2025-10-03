import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: ["http://localhost:5173"], credentials: true }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

type UserJwt = { uid: string; email: string };

function auth(req: Request & { user?: UserJwt }, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwt;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Auth
app.post("/auth/signup", async (req: Request, res: Response) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, password: hash } });
  const token = jwt.sign({ uid: user.id, email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password || "", user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ uid: user.id, email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

app.get("/me", auth, async (req: Request & { user?: UserJwt }, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.uid },
    include: { datasets: { include: { predictions: true } } }
  });
  res.json(user);
});

const upload = multer({ storage: multer.memoryStorage() });

app.post("/datasets/upload", auth, upload.single("file"), async (req: Request & { user?: UserJwt }, res: Response) => {
  const name = (req.body as any)?.name || `dataset-${Date.now()}`;
  if (!req.file) return res.status(400).json({ error: "Missing file" });

  const rows: Record<string, string>[] = await new Promise((resolve, reject) => {
    const out: any[] = [];
    parse(req.file!.buffer, { columns: true, skip_empty_lines: true })
      .on("data", (r) => out.push(r))
      .on("end", () => resolve(out))
      .on("error", reject);
  });

  const mlResp = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows })
  });

  if (!mlResp.ok) {
    const msg = await mlResp.text();
    return res.status(502).json({ error: "ML service error", details: msg });
  }

  const { probabilities, feature_importances } = await mlResp.json() as {
    probabilities: number[];
    feature_importances: Record<string, number>;
  };

  const dataset = await prisma.dataset.create({
    data: { name, ownerId: req.user!.uid }
  });

  const preds = rows.map((r, i) => ({
    customerId: r.customer_id ?? null,
    probability: probabilities[i],
    features: r,
    datasetId: dataset.id
  }));
  await prisma.prediction.createMany({ data: preds });

  res.json({ datasetId: dataset.id, count: preds.length, feature_importances });
});

app.get("/datasets/:id/predictions", auth, async (req: Request & { user?: UserJwt }, res: Response) => {
  const ds = await prisma.dataset.findUnique({
    where: { id: req.params.id },
    include: { predictions: true }
  });
  if (!ds) return res.status(404).json({ error: "Not found" });
  if (ds.ownerId !== req.user!.uid) return res.status(403).json({ error: "Forbidden" });
  res.json(ds.predictions);
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));
