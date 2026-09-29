import { useState, useEffect, useCallback } from 'react';
import { api, loadSession, saveSession, setExpiredHandler } from './api.js';

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [notice, setNotice] = useState(null);
  const [weatherQuery, setWeatherQuery] = useState(null);

  const flash = useCallback((text, type = 'err') => setNotice({ text, type }), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const logout = useCallback(() => { saveSession(null); setSession(null); setWeatherQuery(null); }, []);
  useEffect(() => setExpiredHandler(logout), [logout]);

  const admin = session?.role === 'ADMIN';

  return (
    <>
      <header>
        <h1>Weather Desk</h1>
        {session && (
          <>
            <span>{session.user}</span>
            <span className={'badge' + (admin ? ' admin' : '')}>{session.role}</span>
            <button className="ghost sm" onClick={logout}>Log out</button>
          </>
        )}
      </header>
      <main>
        {notice && <div className={'msg ' + notice.type} role="status">{notice.text}</div>}
        {!session ? (
          <AuthPanel flash={flash} onLoggedIn={setSession} />
        ) : (
          <Dashboard admin={admin} flash={flash} weatherQuery={weatherQuery} setWeatherQuery={setWeatherQuery} />
        )}
      </main>
    </>
  );
}

function AuthPanel({ flash, onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', password: '', role: 'USER' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.register({ username: f.username.trim(), password: f.password, role: f.role });
        flash('Account created. Log in to continue.', 'ok');
        setMode('login'); setF({ ...f, password: '' });
      } else {
        const d = await api.login({ username: f.username.trim(), password: f.password });
        const s = { access: d.accessToken, refresh: d.refreshToken, user: f.username.trim(), role: d.role };
        saveSession(s);
        onLoggedIn(s);
      }
    } catch (err) { flash(err.message); }
    setBusy(false);
  }

  return (
    <form className="panel auth" onSubmit={submit}>
      <div className="tabs">
        <button type="button" className={mode === 'login' ? '' : 'ghost'} onClick={() => setMode('login')}>Log in</button>
        <button type="button" className={mode === 'register' ? '' : 'ghost'} onClick={() => setMode('register')}>Register</button>
      </div>
      <label htmlFor="u">Username</label>
      <input id="u" value={f.username} onChange={set('username')} autoComplete="username" required />
      <label htmlFor="p">Password</label>
      <input id="p" type="password" value={f.password} onChange={set('password')} autoComplete="current-password" required />
      {mode === 'register' && (
        <>
          <label htmlFor="r">Role</label>
          <select id="r" value={f.role} onChange={set('role')}><option>USER</option><option>ADMIN</option></select>
          <p className="mute">Password: at least 6 characters, letters and numbers only.</p>
        </>
      )}
      <p><button style={{ width: '100%' }} disabled={busy}>{mode === 'register' ? 'Create account' : 'Log in'}</button></p>
    </form>
  );
}

function Dashboard({ admin, flash, weatherQuery, setWeatherQuery }) {
  const [reload, setReload] = useState(0);
  return (
    <>
      <div className="grid">
        <WeatherPanel flash={flash} query={weatherQuery} />
        {admin && <AddCityPanel flash={flash} onAdded={() => setReload((n) => n + 1)} />}
      </div>
      <CityTable admin={admin} flash={flash} reload={reload} onWeather={setWeatherQuery} onChanged={() => setReload((n) => n + 1)} />
    </>
  );
}

function WeatherPanel({ flash, query }) {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async (c, s) => {
    setLoading(true); setData(null);
    try { setData(await api.weather(c, s)); } catch (e) { flash(e.message); }
    setLoading(false);
  }, [flash]);

  useEffect(() => {
    if (query) { setCity(query.city); setState(query.state); fetchWeather(query.city, query.state); }
  }, [query, fetchWeather]);

  return (
    <section className="panel">
      <h2>Check weather</h2>
      <form onSubmit={(e) => { e.preventDefault(); fetchWeather(city.trim(), state.trim()); }}>
        <div className="row">
          <div><label htmlFor="wc">City</label><input id="wc" value={city} onChange={(e) => setCity(e.target.value)} required /></div>
          <div><label htmlFor="ws">State</label><input id="ws" value={state} onChange={(e) => setState(e.target.value)} required /></div>
          <button>Get weather</button>
        </div>
      </form>
      {loading && <p className="mute">Loading…</p>}
      {data && (
        <div style={{ marginTop: 18 }}>
          <h3>{data.city}, {data.state} ({data.countryCode})</h3>
          <p className="mute" style={{ margin: '2px 0 10px' }}>{data.main}, {data.description}</p>
          <div className="temp">{Math.round(data.temperature)}<small>°C</small></div>
          <div className="stats">
            <div><span>Feels like</span>{Math.round(data.feelsLike)}°C</div>
            <div><span>Humidity</span>{data.humidity}%</div>
            <div><span>Wind</span>{data.windSpeed} m/s</div>
          </div>
        </div>
      )}
    </section>
  );
}

function AddCityPanel({ flash, onAdded }) {
  const empty = { city: '', state: '', countryCode: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      const c = await api.addCity({ city: f.city.trim(), state: f.state.trim(), countryCode: f.countryCode.trim() });
      flash(`Added ${c.city}, ${c.state}.`, 'ok'); setF(empty); onAdded();
    } catch (err) { flash(err.message); }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Add a city <span className="badge admin">Admin</span></h2>
      <label htmlFor="cc">City</label><input id="cc" value={f.city} onChange={set('city')} required />
      <label htmlFor="cs">State</label><input id="cs" value={f.state} onChange={set('state')} required />
      <label htmlFor="cy">Country code (2 letters)</label>
      <input id="cy" maxLength={2} value={f.countryCode} onChange={set('countryCode')} required />
      <p><button>Add city</button></p>
    </form>
  );
}

function CityTable({ admin, flash, reload, onWeather, onChanged }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    api.cities(page).then((d) => live && setData(d)).catch((e) => flash(e.message));
    return () => { live = false; };
  }, [page, reload, flash]);

  async function remove(c) {
    if (!window.confirm(`Delete ${c.city}?`)) return;
    try {
      const r = await api.deleteCity(c.id);
      flash(r.message, 'ok');
      if (data.content.length === 1 && page > 0) setPage(page - 1); else onChanged();
    } catch (e) { flash(e.message); }
  }

  const total = data ? (data.page?.totalPages ?? data.totalPages) : 1;
  const count = data ? (data.page?.totalElements ?? data.totalElements) : 0;

  return (
    <section className="panel">
      <h2>Available cities</h2>
      <table>
        <thead><tr><th>City</th><th>State</th><th>Country</th><th>Lat / Lon</th><th></th></tr></thead>
        <tbody>
          {data?.content.map((c) => (
            <tr key={c.id}>
              <td>{c.city}</td><td>{c.state}</td><td>{c.countryCode}</td>
              <td className="mute">{c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}</td>
              <td className="act">
                <button className="ghost sm" onClick={() => onWeather({ city: c.city, state: c.state, t: Date.now() })}>Weather</button>{' '}
                {admin && <button className="danger" onClick={() => remove(c)}>Delete</button>}
              </td>
            </tr>
          ))}
          {data && data.content.length === 0 && (
            <tr><td colSpan="5" className="mute">No cities yet. {admin ? 'Add one using the form.' : 'Ask an admin to add some.'}</td></tr>
          )}
        </tbody>
      </table>
      <div className="pager">
        <span>{count} cities</span>
        <span>
          <button className="ghost sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>Previous</button>{' '}
          Page {page + 1} of {Math.max(total, 1)}{' '}
          <button className="ghost sm" disabled={page + 1 >= total} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      </div>
    </section>
  );
}