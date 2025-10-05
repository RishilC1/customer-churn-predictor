import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios, { type AxiosInstance } from "axios";

const API = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";

function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });
  useEffect(() => {
    const cls = document.documentElement.classList;
    if (dark) { cls.add("dark"); localStorage.setItem("theme","dark"); (document.documentElement as any).style.setProperty('--bg', '#0b0b0b'); }
    else { cls.remove("dark"); localStorage.setItem("theme","light"); (document.documentElement as any).style.setProperty('--bg', '#f6f7fb'); }
  }, [dark]);
  return { dark, setDark };
}

function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const client: AxiosInstance = useMemo(() => {
    const c = axios.create({ baseURL: API, withCredentials: false });
    if (token) c.defaults.headers.common.Authorization = `Bearer ${token}`;
    return c;
  }, [token]);
  const signIn = (t: string) => { localStorage.setItem("token", t); setToken(t); };
  const signOut = () => { localStorage.removeItem("token"); setToken(null); };
  return { token, client, signIn, signOut, authed: !!token };
}

function Auth({ onAuthed }: { onAuthed: () => void }) {
  const { dark, setDark } = useTheme();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState<string|null>(null);

  async function submit() {
    setErr(null); setLoading(true);
    try {
      const url = mode === "signup" ? "/auth/signup" : "/auth/login";
      const res = await axios.post(API + url, { email, password });
      localStorage.setItem("token", res.data.token);
      onAuthed();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  return (
    <div className="center">
      <div className="card">
        <div className="title">Churn Predictor</div>
        <p className="muted" style={{marginTop:-8}}>{mode==="login"?"Sign in to your account":"Create your account"}</p>
        <div className="stack">
          <input type="email" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <div style={{height:10}}/>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={()=>setDark(!dark)}>{dark?"🌞 Light":"🌙 Dark"}</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? (mode==="login"?"Signing in...":"Creating...") : (mode==="login"?"Sign in":"Sign up")}
          </button>
        </div>
        <div style={{height:10}}/>
        <p className="muted">
          {mode==="login"?"Don't have an account?":"Already have an account?"}{" "}
          <a href="#" onClick={(e)=>{e.preventDefault(); setMode(mode==="login"?"signup":"login");}}>
            {mode==="login"?"sign up":"sign in"}
          </a>
        </p>
        {err && <div style={{color:"#ef4444", textAlign:"center", marginTop:8}}>{err}</div>}
      </div>
    </div>
  );
}

function Dashboard({ client, onSignOut }: { client: AxiosInstance; onSignOut: () => void; }) {
  const { dark, setDark } = useTheme();
  const [me, setMe] = useState<any>(null);
  const [file, setFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(0.6);

  useEffect(() => { client.get("/me").then(r => setMe(r.data)).catch(()=>{}); }, [client]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await client.post("/predict", fd);
      setRows(r.data?.predictions || []);
    } catch (e) {
      console.error(e);
      alert("Prediction failed");
    } finally { setBusy(false); }
  }

  const flagged = rows.filter(r => r.probability >= threshold);

  return (
    <div>
      <div className="toolbar">
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <strong>Churn Predictor</strong>
          <span className="muted" style={{fontSize:13}}>Dashboard</span>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button type="button" className="btn btn-ghost" onClick={()=>setDark(!dark)}>{dark?"🌞 Light":"🌙 Dark"}</button>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div style={{padding:20}}>
        <h2 style={{marginTop:0}}>Welcome, {me?.email}</h2>

        <div style={{display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", margin:"16px 0"}}>
          <input type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0] || null)} />
          <button className="btn btn-primary" type="button" disabled={!file || busy} onClick={upload}>
            {busy ? "Uploading..." : "Upload CSV & Predict"}
          </button>
          <label className="muted" style={{display:"flex", alignItems:"center", gap:8}}>
            Risk threshold:
            <input type="number" min={0} max={1} step={0.05} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value)||0)} style={{width:90}}/>
          </label>
          <span>High-risk count: <b>{flagged.length}</b></span>
        </div>

        <div style={{overflowX:"auto"}}>
          <table>
            <thead>
              <tr><th>customer_id</th><th>probability</th><th>features</th></tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.customerId ?? i} style={{background: p.probability >= threshold ? "rgba(239,68,68,.08)" : "transparent"}}>
                  <td>{p.customerId ?? "-"}</td>
                  <td>{p.probability.toFixed(3)}</td>
                  <td><code>{JSON.stringify(p.features)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && (
          <div className="muted" style={{marginTop:18}}>
            CSV example cols: <code>customer_id, tenure_months, contract_month_to_month, num_support_tickets, monthly_spend, last_login_days</code>.
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const { authed, client, signOut } = useAuth();
  const [ready, setReady] = useState(authed);

  useEffect(() => {
    const id = client.interceptors.response.use(
      (r) => r,
      (err) => { if (err?.response?.status === 401) signOut(); return Promise.reject(err); }
    );
    return () => client.interceptors.response.eject(id);
  }, [client, signOut]);

  useEffect(() => { setReady(authed); }, [authed]);
  return ready ? <Dashboard client={client} onSignOut={signOut} /> : <Auth onAuthed={() => setReady(true)} />;
}

createRoot(document.getElementById("root")!).render(<App />);
