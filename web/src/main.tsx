import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const authed = !!token;
  const client = useMemo(() => {
    const c = axios.create({ baseURL: API });
    if (token) c.defaults.headers.common.Authorization = `Bearer ${token}`;
    return c;
  }, [token]);
  return { token, setToken, authed, client };
}

function Auth({ onAuthed }:{ onAuthed: ()=>void }) {
  const [email,setEmail] = useState("demo@example.com");
  const [password,setPassword] = useState("password");
  const [mode,setMode] = useState<"login"|"signup">("signup");
  const [err,setErr] = useState<string|undefined>();

  async function submit() {
    try {
      setErr(undefined);
      const url = mode==="signup"? "/auth/signup":"/auth/login";
      const res = await axios.post(API+url,{email,password});
      localStorage.setItem("token", res.data.token);
      onAuthed();
    } catch (e:any) {
      setErr(e?.response?.data?.error || "Something went wrong");
    }
  }

  return (
    <div style={{display:"grid",placeItems:"center",height:"100vh"}}>
      <div style={{width:360,padding:24,border:"1px solid #ddd",borderRadius:12}}>
        <h2>ChurnGuard</h2>
        <p style={{opacity:.7}}>Sign up or log in</p>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" style={{width:"100%",padding:10,margin:"8px 0"}}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" type="password" style={{width:"100%",padding:10,margin:"8px 0"}}/>
        <button onClick={submit} style={{width:"100%",padding:10,marginTop:8}}>
          {mode==="signup" ? "Create Account" : "Log in"}
        </button>
        <button onClick={()=>setMode(mode==="signup"?"login":"signup")} style={{width:"100%",padding:10,marginTop:8}}>
          switch to {mode==="signup"?"login":"signup"}
        </button>
        {err && <div style={{color:"red",marginTop:8}}>{err}</div>}
      </div>
    </div>
  );
}

function Dashboard({ client }:{ client: ReturnType<typeof axios.create> }) {
  const [me,setMe] = useState<any>(null);
  const [file,setFile] = useState<File|null>(null);
  const [uploading,setUploading] = useState(false);
  const [preds,setPreds] = useState<any[]>([]);
  const [datasetId,setDatasetId] = useState<string|null>(null);
  const [threshold,setThreshold] = useState(0.6);

  useEffect(()=>{
    client.get("/me").then(r=>setMe(r.data)).catch(()=>{});
  },[client]);

  async function upload() {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    const res = await client.post("/datasets/upload", fd);
    const dsId = res.data.datasetId;
    setDatasetId(dsId);
    const predsRes = await client.get(`/datasets/${dsId}/predictions`);
    setPreds(predsRes.data);
    setUploading(false);
  }

  const filtered = preds.filter(p=>p.probability >= threshold);

  return (
    <div style={{padding:24}}>
      <h2>Welcome, {me?.email}</h2>
      <div style={{display:"flex", gap:16, alignItems:"center", margin:"16px 0"}}>
        <input type="file" accept=".csv" onChange={e=>setFile(e.target.files?.[0]||null)} />
        <button disabled={!file||uploading} onClick={upload}>
          {uploading? "Uploading..." : "Upload CSV & Predict"}
        </button>
        <label>Risk threshold:
          <input type="number" min={0} max={1} step={0.05} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value)||0)} style={{marginLeft:8,width:80}}/>
        </label>
        <span>High-risk count: <b>{filtered.length}</b></span>
      </div>

      <table cellPadding={8} style={{borderCollapse:"collapse", width:"100%"}}>
        <thead>
          <tr>
            <th style={{borderBottom:"1px solid #ccc"}}>customer_id</th>
            <th style={{borderBottom:"1px solid #ccc"}}>probability</th>
            <th style={{borderBottom:"1px solid #ccc"}}>features</th>
          </tr>
        </thead>
        <tbody>
          {preds.map((p,i)=>(
            <tr key={p.id||i} style={{background:p.probability>=threshold?"#fff5f5":"white"}}>
              <td>{p.customerId ?? "-"}</td>
              <td>{p.probability.toFixed(3)}</td>
              <td style={{fontFamily:"monospace", fontSize:12}}>
                {JSON.stringify(p.features)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!datasetId && (
        <div style={{marginTop:24, opacity:.7}}>
          Tip: Your CSV should include columns like:
          <code> customer_id, tenure_months, contract_month_to_month, num_support_tickets, monthly_spend, last_login_days </code>
        </div>
      )}
    </div>
  );
}

function App(){
  const { authed, client } = useAuth();
  const [ready,setReady] = useState(authed);
  useEffect(()=>{ setReady(authed); },[authed]);
  return ready ? <Dashboard client={client}/> : <Auth onAuthed={()=>setReady(true)}/>;
}

createRoot(document.getElementById("root")!).render(<App />);
