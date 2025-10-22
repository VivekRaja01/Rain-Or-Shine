import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import Chart from "chart.js/auto";

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [forecast36, setForecast36] = useState([]);
  const [error, setError] = useState("");
  const [unit] = useState("metric");
  const [loading, setLoading] = useState(false);
  const [themeColor, setThemeColor] = useState("#1e3a8a");
  const [activeGraph, setActiveGraph] = useState("temperature");
  const [showTopBtn, setShowTopBtn] = useState(false);

  const API_KEY = "3a8abf0b7543b61aad8cd18f2c749599";
  const cancelTokenRef = useRef(null);

  const formatTimeForLocation = (unixSec, tzOffsetSeconds = 0) => {
    const date = new Date((unixSec + tzOffsetSeconds) * 1000);
    const hours = date.getUTCHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = ((hours + 11) % 12) + 1;
    return `${displayHour}${ampm}`;
  };

  const formatDateForLocation = (tzOffsetSeconds = 0) => {
    const nowUtcSec = Math.floor(Date.now() / 1000);
    const date = new Date((nowUtcSec + tzOffsetSeconds) * 1000);
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${days[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  };

  const getPrecipitation = (data) => data?.rain?.["1h"] || data?.snow?.["1h"] || 0;

  const fetchWeather = async () => {
    if (!city.trim()) {
      setError("Please enter a city or village.");
      return;
    }

    setError("");
    setWeather(null);
    setForecast([]);
    setForecast36([]);
    setLoading(true);

    if (cancelTokenRef.current) cancelTokenRef.current.cancel("New request started");
    cancelTokenRef.current = axios.CancelToken.source();

    try {
      const geoRes = await axios.get("https://api.openweathermap.org/geo/1.0/direct", {
        params: { q: city, limit: 1, appid: API_KEY },
        cancelToken: cancelTokenRef.current.token,
      });

      if (!geoRes.data.length) {
        setError("City not found. Try another name.");
        setLoading(false);
        return;
      }

      const { lat, lon, name, state, country } = geoRes.data[0];

      const weatherRes = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: { lat, lon, units: unit, appid: API_KEY },
        cancelToken: cancelTokenRef.current.token,
      });

      const forecastRes = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
        params: { lat, lon, units: unit, appid: API_KEY },
        cancelToken: cancelTokenRef.current.token,
      });

      const airRes = await axios.get("https://api.openweathermap.org/data/2.5/air_pollution", {
        params: { lat, lon, appid: API_KEY },
        cancelToken: cancelTokenRef.current.token,
      });

      const airQualityIndex = airRes.data.list[0].main.aqi;
      const aqiText = ["Good", "Fair", "Moderate", "Poor", "Very Poor"][airQualityIndex - 1];
      const aqiColor = ["#22c55e", "#a3e635", "#facc15", "#f97316", "#ef4444"][airQualityIndex - 1];

      const clouds = weatherRes.data.clouds.all;
      const temp = weatherRes.data.main.temp;
      const uvIndex = Math.max(0.5, Math.min(11, (temp / 6) - (clouds / 25)));

      const brightness =
        uvIndex < 1.5 && clouds > 80
          ? 1
          : uvIndex < 3 && clouds > 60
          ? 2
          : uvIndex < 5 && clouds > 40
          ? 3
          : 4;

      const visibility = weatherRes.data.visibility / 1000;
      const cloudCeiling = clouds > 75 ? 800 : clouds > 50 ? 1500 : 2500;

      setWeather({
        ...weatherRes.data,
        name,
        state,
        country,
        aqi: aqiText,
        aqiColor,
        uv: uvIndex,
        brightness,
        cloudCover: clouds,
        visibility,
        cloudCeiling,
      });

      setForecast(forecastRes.data.list.slice(0, 6));

      // 36-hour forecast
      const next36h = [];
      let hoursCounted = 0;
      for (let i = 0; i < forecastRes.data.list.length && hoursCounted < 36; i++) {
        const item = forecastRes.data.list[i];
        next36h.push(item);
        hoursCounted += 3;
      }
      setForecast36(next36h);

    } catch (err) {
      if (!axios.isCancel(err)) setError("Failed to fetch weather. Try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearWeather = () => {
    setCity("");
    setWeather(null);
    setForecast([]);
    setForecast36([]);
    setError("");
    setActiveGraph("temperature");
  };

  const getWeatherBackground = (condition) => {
    if (!condition) return `linear-gradient(to bottom right, ${themeColor}, #111827)`;
    const main = condition.toLowerCase();
    switch(main) {
      case "clear": return "linear-gradient(to bottom right, #facc15, #f97316)";
      case "clouds": return "linear-gradient(to bottom right, #9ca3af, #4b5563)";
      case "rain":
      case "drizzle": return "linear-gradient(to bottom right, #3b82f6, #1e40af)";
      case "thunderstorm": return "linear-gradient(to bottom right, #6366f1, #1e3a8a)";
      case "snow": return "linear-gradient(to bottom right, #e0f2fe, #bae6fd)";
      case "mist":
      case "fog":
      case "haze": return "linear-gradient(to bottom right, #6b7280, #374151)";
      default: return `linear-gradient(to bottom right, ${themeColor}, #111827)`;
    }
  };

  // Smooth scroll & Back-to-top
  useEffect(() => {
    const handleScroll = () => setShowTopBtn(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const TemperatureSVG = ({ data, tzOffset }) => {
    const width = 400, height = 220, pad = 40;
    const temps = data.map(f => f.main.temp);
    const maxT = Math.max(...temps) + 2;
    const minT = Math.min(...temps) - 2;

    const points = data.map((f, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = height - pad - ((f.main.temp - minT) / (maxT - minT)) * (height - pad * 2);
      return { x, y, temp: f.main.temp, label: formatTimeForLocation(f.dt, tzOffset) };
    });

    const circleRef = useRef(null);
    const pathRef = useRef(null);

    useEffect(() => {
      if (!pathRef.current || !circleRef.current) return;
      const path = pathRef.current;
      const circle = circleRef.current;
      let start = null;

      const animate = (timestamp) => {
        if (!start) start = timestamp;
        const progress = ((timestamp - start) / 3000) % 1;
        const length = path.getTotalLength();
        const point = path.getPointAtLength(progress * length);
        circle.setAttribute("cx", point.x);
        circle.setAttribute("cy", point.y);
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, [points]);

    const gradientId = "tempGradient";
    const minColor = "#3b82f6"; 
    const maxColor = "#f97316"; 

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(" ");
    const areaD = pathD + ` L${points[points.length-1].x},${height-pad} L${points[0].x},${height-pad} Z`;

    const [hover, setHover] = useState(null);

    return (
      <svg width={width} height={height} className="bg-gray-800 mt-4 rounded p-2">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={maxColor} />
            <stop offset="100%" stopColor={minColor} />
          </linearGradient>
        </defs>

        {[0,1,2,3,4].map(i => {
          const temp = minT + i * (maxT - minT)/4;
          const y = height - pad - ((temp - minT)/(maxT - minT))*(height - pad*2);
          return <text key={i} x={pad-10} y={y+4} fill="white" fontSize="12" textAnchor="end">{Math.round(temp)}°</text>
        })}

        {points.map((p,i)=><text key={i} x={p.x} y={height-5} fill="white" fontSize="12" textAnchor="middle">{p.label}</text>)}

        <path ref={pathRef} d={pathD} fill="none" stroke={`url(#${gradientId})`} strokeWidth={3} strokeLinecap="round" />
        <path d={areaD} fill={`url(#${gradientId})`} opacity={0.2} />
        <circle ref={circleRef} r={7} fill="white" stroke="black" strokeWidth={1} />
        {points.map((p,i)=>(<circle key={i} cx={p.x} cy={p.y} r={5} fill="white" onMouseEnter={()=>setHover(p)} onMouseLeave={()=>setHover(null)} />))}
        {hover && <text x={hover.x+5} y={hover.y-10} fontSize="12" fill="white">{hover.temp}°C</text>}
      </svg>
    );
  };

  const PrecipitationRechart = ({ data, tzOffset }) => {
    const chartData = data.map(f => ({ time: formatTimeForLocation(f.dt, tzOffset), precip: getPrecipitation(f) }));
    return (
      <LineChart width={400} height={220} data={chartData} className="mt-4 bg-gray-800 p-2 rounded">
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" tick={{ fill: "white" }} />
        <YAxis tick={{ fill: "white" }} />
        <Tooltip contentStyle={{ backgroundColor: "#1f2937", color: "#fff" }} />
        <Line type="monotone" dataKey="precip" stroke="#facc15" strokeWidth={2} activeDot={{ r: 6 }} />
      </LineChart>
    );
  };

  const WindChartJS = ({ data, tzOffset }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
      const ctx = canvasRef.current.getContext("2d");
      const chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.map(f => formatTimeForLocation(f.dt, tzOffset)),
          datasets: [{ label: "Wind (m/s)", data: data.map(f => f.wind.speed), borderColor: "#22d3ee", borderWidth: 2, tension: 0.4, pointRadius: 5, pointHoverRadius: 7 }]
        },
        options: { plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: "#1f2937", titleColor: "#fff", bodyColor: "#fff" } }, scales: { x:{ ticks:{color:"white"}}, y:{ticks:{color:"white"}} } }
      });
      return () => chartInstance.destroy();
    }, [data, tzOffset]);
    return <canvas ref={canvasRef} width={400} height={220} className="mt-4 bg-gray-800 p-2 rounded"></canvas>;
  };

  const backgroundStyle = { 
    background: getWeatherBackground(weather?.weather[0].main), 
    minHeight:"100vh", 
    color:"white", 
    transition:"all 1s ease-in-out",
    scrollBehavior:"smooth"
  };

  return (
    <div style={backgroundStyle} className="p-4">
      <div className="max-w-3xl mx-auto">
        <div className="sticky top-0 bg-gray-900/50 backdrop-blur-md z-50 p-4 rounded mb-4">
          <h1 className="text-4xl font-bold mb-4">Weatherly</h1>

          <div className="mb-4 flex items-center gap-2">
            <label>Theme color:</label>
            <input type="color" value={themeColor} onChange={e=>setThemeColor(e.target.value)} />
          </div>

          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Enter city" value={city} onChange={e=>setCity(e.target.value)} className="px-3 py-2 text-black flex-1 rounded"/>
            <button onClick={fetchWeather} className="px-4 py-2 bg-white text-black rounded">Search</button>
            <button onClick={clearWeather} className="px-4 py-2 bg-red-500 text-white rounded">Clear</button>
          </div>
        </div>

        {error && <div className="text-red-400 mb-4">{error}</div>}

        {weather && (
          <div className="bg-gray-800 rounded p-4 mb-6">
            <h2 className="text-2xl font-semibold mb-2">{weather.name}{weather.state ? `, ${weather.state}`:""}, {weather.country}</h2>
            <div className="mb-2 text-sm opacity-80">{formatDateForLocation(weather.timezone)}</div>

            <div className="grid grid-cols-2 gap-4">
              <div>Temperature: {Math.round(weather.main.temp)}°C</div>
              <div>Humidity: {weather.main.humidity}%</div>
              <div>Wind: {weather.wind.speed} m/s</div>
              <div className="flex items-center gap-2">
                <span>Air Quality:</span>
                <span className="px-2 py-1 rounded text-black font-semibold" style={{backgroundColor: weather.aqiColor}}>{weather.aqi}</span>
              </div>
              <div>Max UV Index: {weather.uv.toFixed(1)}</div>
              <div>AccuLumen Brightness Index™: {weather.brightness}</div>
              <div>Cloud Cover: {weather.cloudCover}%</div>
              <div>Visibility: {weather.visibility} km</div>
              <div>Cloud Ceiling: {weather.cloudCeiling} m</div>
              <div className="col-span-2 capitalize">Condition: {weather.weather[0].description}</div>
            </div>
          </div>
        )}

        {forecast36.length>0 && (
          <div className="bg-gray-800 rounded p-4 mt-2">
            <h2 className="text-xl font-semibold mb-2">36-Hour Forecast (2-hour intervals)</h2>
            <div className="overflow-x-auto flex gap-4 text-white">
              {forecast36.map((f,i)=>{
                const bgBlock = getWeatherBackground(f.weather[0].main);
                return (
                  <div key={i} className="min-w-[80px] p-2 rounded flex flex-col items-center relative group" style={{background:bgBlock}}>
                    <div>{formatTimeForLocation(f.dt, weather?.timezone || 0)}</div>
                    <div>{Math.round(f.main.temp)}°C</div>
                    <div>{f.weather[0].main}</div>
                    <div>💧 {getPrecipitation(f)} mm</div>
                    <div>💨 {f.wind.speed} m/s</div>
                    <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 bg-gray-900/90 text-white text-xs px-2 py-1 rounded transition-opacity">
                      Humidity: {f.main.humidity}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {forecast.length>0 && (
          <>
            <div className="flex gap-2 mt-4 mb-4">
              <button onClick={()=>setActiveGraph("temperature")} className={`px-4 py-2 rounded ${activeGraph==="temperature"?"bg-white text-black":"bg-white/20 text-white"}`}>Temperature</button>
              <button onClick={()=>setActiveGraph("precipitation")} className={`px-4 py-2 rounded ${activeGraph==="precipitation"?"bg-white text-black":"bg-white/20 text-white"}`}>Precipitation</button>
              <button onClick={()=>setActiveGraph("wind")} className={`px-4 py-2 rounded ${activeGraph==="wind"?"bg-white text-black":"bg-white/20 text-white"}`}>Wind</button>
            </div>

            {activeGraph==="temperature" && <TemperatureSVG data={forecast} tzOffset={weather?.timezone || 0} />}
            {activeGraph==="precipitation" && <PrecipitationRechart data={forecast} tzOffset={weather?.timezone || 0} />}
            {activeGraph==="wind" && <WindChartJS data={forecast} tzOffset={weather?.timezone || 0} />}
          </>
        )}

        {loading && <div className="mt-4 text-white">Loading...</div>}

        {showTopBtn && (
          <button onClick={scrollToTop} className="fixed bottom-4 right-4 bg-white text-black px-4 py-2 rounded shadow-lg hover:bg-gray-200 transition-all">
            ↑ Top
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
