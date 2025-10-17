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
    if (dark) { 
      cls.remove("light");
      cls.add("dark"); 
      localStorage.setItem("theme","dark"); 
    }
    else { 
      cls.remove("dark");
      cls.add("light"); 
      localStorage.setItem("theme","light"); 
    }
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
  const signOut = () => { 
    localStorage.removeItem("token"); 
    setToken(null); 
    window.location.reload(); // Force page reload to reset state
  };
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
  const [error, setError] = useState<string|null>(null);

  useEffect(() => { client.get("/me").then(r => setMe(r.data)).catch(()=>{}); }, [client]);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Send directly to ML service to avoid API proxy issues
      const fd = new FormData();
      fd.append("file", file);
      
      const r = await fetch("http://localhost:8000/predict-csv", {
        method: "POST",
        body: fd,
      });
      
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`ML service error: ${text}`);
      }
      
      const data = await r.json();
      setRows(data?.predictions || []);
    } catch (e: any) {
      console.error("Upload error:", e);
      const errorMsg = e?.message || "Prediction failed";
      setError(`Prediction failed: ${errorMsg}`);
    } finally { setBusy(false); }
  }

  const flagged = rows.filter(r => r.probability >= threshold);

  return (
    <div style={{minHeight: "100vh", background: "var(--bg)"}}>
      <div className="toolbar">
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <strong>🎯 Churn Predictor</strong>
          <span className="muted" style={{fontSize:14}}>Analytics Dashboard</span>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button type="button" className="btn btn-ghost" onClick={()=>setDark(!dark)}>
            {dark?"☀️ Light":"🌙 Dark"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            👋 Sign out
          </button>
        </div>
      </div>

      <div style={{padding: "32px 24px", maxWidth: "1200px", margin: "0 auto"}}>
        <div style={{marginBottom: "32px"}}>
          <h1 style={{margin: "0 0 8px 0", fontSize: "32px", fontWeight: "700"}}>
            Welcome back, {me?.email?.split("@")[0]}! 👋
          </h1>
          <p className="muted" style={{fontSize: "16px", margin: 0}}>
            Upload your customer data to predict churn risk
          </p>
        </div>

        <div className="stats">
          <div className="stat-card">
            <div className="stat-number">{rows.length}</div>
            <div className="stat-label">Total Customers</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{flagged.length}</div>
            <div className="stat-label">High Risk</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {rows.length > 0 ? ((flagged.length / rows.length) * 100).toFixed(1) : 0}%
            </div>
            <div className="stat-label">Risk Rate</div>
          </div>
        </div>

        <div style={{background: "var(--card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)", marginBottom: "24px"}}>
          <h3 style={{margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600"}}>📊 Upload Customer Data</h3>
          
          <div className="upload-area">
            <input 
              type="file" 
              accept=".csv" 
              onChange={e=>setFile(e.target.files?.[0] || null)}
              style={{marginBottom: "16px"}}
            />
            <p className="muted" style={{margin: "8px 0", fontSize: "14px"}}>
              📁 Select a CSV file with customer data
            </p>
          </div>

          <div style={{display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", margin:"16px 0"}}>
            <button className="btn btn-primary" type="button" disabled={!file || busy} onClick={upload}>
              {busy ? "⏳ Processing..." : "🚀 Analyze Data"}
            </button>
            
            <label className="muted" style={{display:"flex", alignItems:"center", gap:8}}>
              Risk threshold:
              <input 
                type="number" 
                min={0} 
                max={1} 
                step={0.05} 
                value={threshold} 
                onChange={e=>setThreshold(parseFloat(e.target.value)||0)} 
                style={{width:80, padding: "8px 12px"}}
              />
            </label>
          </div>

          {error && (
            <div style={{background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--danger)", borderRadius: "8px", padding: "12px", margin: "16px 0", color: "var(--danger)"}}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div style={{background: "var(--card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)"}}>
            <h3 style={{margin: "0 0 16px 0", fontSize: "18px", fontWeight: "600"}}>📈 Prediction Results</h3>
            <div style={{overflowX:"auto"}}>
              <table>
                <thead>
                  <tr>
                    <th>Customer ID</th>
                    <th>Churn Probability</th>
                    <th>Risk Level</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    const isHighRisk = p.probability >= threshold;
                    return (
                      <tr key={p.customerId ?? i} className={isHighRisk ? "high-risk" : ""}>
                        <td style={{fontWeight: "500"}}>{p.customerId ?? "-"}</td>
                        <td>
                          <span style={{fontWeight: "600", color: isHighRisk ? "var(--danger)" : "var(--success)"}}>
                            {(p.probability * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <span style={{padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "500", background: isHighRisk ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: isHighRisk ? "var(--danger)" : "var(--success)"}}>
                            {isHighRisk ? "🔴 High Risk" : "🟢 Low Risk"}
                          </span>
                        </td>
                        <td><code>{JSON.stringify(p.features)}</code></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!rows.length && (
          <div style={{background: "var(--card)", borderRadius: "16px", padding: "24px", border: "1px solid var(--border)", textAlign: "center"}}>
            <div className="muted" style={{fontSize: "16px"}}>
              <p style={{margin: "0 0 12px 0"}}>📋 Expected CSV columns:</p>
              <code style={{display: "block", background: "var(--border)", padding: "12px", borderRadius: "8px", fontSize: "14px"}}>
                customer_id, tenure_months, contract_month_to_month, num_support_tickets, monthly_spend, last_login_days
              </code>
            </div>
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
