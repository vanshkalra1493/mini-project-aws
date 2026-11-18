// Mini Weather — uses the free Open-Meteo API (no API key required)
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = "https://api.open-meteo.com/v1/forecast";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

let useFahrenheit = false;
let lastPlace = null; // { name, lat, lon }

// WMO weather codes -> [emoji, description]
const CODES = {
  0: ["☀️", "Clear sky"], 1: ["🌤️", "Mainly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  61: ["🌧️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
  71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"],
  80: ["🌦️", "Rain showers"], 81: ["🌧️", "Heavy showers"], 82: ["⛈️", "Violent showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Thunderstorm, hail"], 99: ["⛈️", "Severe thunderstorm"],
};
const info = (code) => CODES[code] || ["🌡️", "Unknown"];

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#fed7d7" : "";
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error (" + res.status + ")");
  return res.json();
}

async function searchCity(query) {
  const data = await getJSON(`${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
  if (!data.results || !data.results.length) throw new Error("City not found");
  const r = data.results[0];
  return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lon: r.longitude };
}

async function loadWeather(place) {
  setStatus("Loading weather…");
  const unit = useFahrenheit ? "fahrenheit" : "celsius";
  const wind = useFahrenheit ? "mph" : "kmh";
  const url = `${WX_URL}?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&forecast_days=5&timezone=auto&temperature_unit=${unit}&wind_speed_unit=${wind}`;
  const data = await getJSON(url);
  lastPlace = place;
  render(place.name, data);
  setStatus("");
}

function render(name, data) {
  const c = data.current;
  const deg = useFahrenheit ? "°F" : "°C";
  const [icon, desc] = info(c.weather_code);

  $("place").textContent = name;
  $("icon").textContent = icon;
  $("temp").textContent = Math.round(c.temperature_2m) + deg;
  $("desc").textContent = desc;
  $("feels").textContent = Math.round(c.apparent_temperature) + deg;
  $("humidity").textContent = c.relative_humidity_2m + "%";
  $("wind").textContent = Math.round(c.wind_speed_10m) + (useFahrenheit ? " mph" : " km/h");
  $("precip").textContent = c.precipitation + " mm";
  $("current").classList.remove("hidden");

  // Background mood
  document.body.classList.toggle("night", c.is_day === 0);
  document.body.classList.toggle("rain", [51,53,55,61,63,65,80,81,82,95,96,99].includes(c.weather_code));

  // 5-day forecast
  const f = $("forecast");
  f.innerHTML = "";
  data.daily.time.forEach((t, i) => {
    const day = new Date(t + "T00:00").toLocaleDateString(undefined, { weekday: "short" });
    const el = document.createElement("div");
    el.className = "day";
    el.innerHTML = `<div>${i === 0 ? "Today" : day}</div>
      <div class="ico">${info(data.daily.weather_code[i])[0]}</div>
      <div class="hi">${Math.round(data.daily.temperature_2m_max[i])}°</div>
      <div class="lo">${Math.round(data.daily.temperature_2m_min[i])}°</div>`;
    f.appendChild(el);
  });
  f.classList.remove("hidden");
}

async function run(fn) {
  try { await fn(); }
  catch (err) { setStatus(err.message || "Something went wrong", true); }
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("city-input").value.trim();
  if (q) run(async () => { setStatus("Searching…"); await loadWeather(await searchCity(q)); });
});

$("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Geolocation not supported", true);
  setStatus("Getting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => run(() => loadWeather({ name: "Your location", lat: pos.coords.latitude, lon: pos.coords.longitude })),
    () => setStatus("Location permission denied", true)
  );
});

$("unit-btn").addEventListener("click", () => {
  useFahrenheit = !useFahrenheit;
  $("unit-btn").textContent = useFahrenheit ? "Switch to °C" : "Switch to °F";
  if (lastPlace) run(() => loadWeather(lastPlace));
});

// Default city on first load
run(() => loadWeather({ name: "New Delhi, India", lat: 28.6139, lon: 77.209 }));
