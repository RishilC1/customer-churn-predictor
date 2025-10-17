import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import FormData from "form-data";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ML_URL = process.env.ML_URL || "http://ml:8000";

const upload = multer({ storage: multer.memoryStorage() });

type UserRecord = { id: string; email: string; passwordHash: string; createdAt: string };
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]), "utf8");

function readUsers(): UserRecord[] {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; }
}
function writeUsers(users: UserRecord[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

type UserId = string;
interface JwtPayload { uid: UserId }

function makeToken(uid: UserId) {
  return jwt.sign({ uid } as JwtPayload, JWT_SECRET, { expiresIn: "7d" });
}
function authGuard(req: Request & { uid?: UserId }, res: Response, next: NextFunction) {
  const m = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Missing token" });
  try {
    const decoded = jwt.verify(m[1], JWT_SECRET) as JwtPayload;
    req.uid = decoded.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.get("/", (_req, res) => res.send("API ok"));

app.post("/auth/signup", async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const users = readUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user: UserRecord = { id: randomUUID(), email, passwordHash, createdAt: new Date().toISOString() };
    users.push(user); writeUsers(users);

    return res.json({ token: makeToken(user.id) });
  } catch (e: any) {
    console.error("Signup error:", e?.message || e);
    return res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const users = readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ token: makeToken(user.id) });
  } catch (e: any) {
    console.error("Login error:", e?.message || e);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.get("/me", authGuard, (req: Request & { uid?: UserId }, res: Response) => {
  const users = readUsers();
  const me = users.find(u => u.id === req.uid);
  return res.json(me ? { id: me.id, email: me.email, createdAt: me.createdAt } : null);
});

app.post("/predict", authGuard, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Create a proper FormData object for the ML service
    const fd = new FormData();
    fd.append("file", req.file.buffer, {
      filename: req.file.originalname || "data.csv",
      contentType: req.file.mimetype || "text/csv"
    });

    const r = await fetch(`${ML_URL}/predict-csv`, {
      method: "POST",
      body: fd,
      headers: fd.getHeaders()
    });
    
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("ML service error:", text);
      return res.status(502).json({ error: "ML service error", details: text });
    }
    
    const data = await r.json();
    return res.json(data);
  } catch (e: any) {
    console.error("Predict error:", e?.message || e);
    return res.status(500).json({ error: "Prediction failed", details: e?.message });
  }
});

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
