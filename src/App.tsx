import React, { useState, useEffect, useRef, type ChangeEvent } from "react";
import queryString from "query-string";

// === Spotify OAuth + Helper ===
const CLIENT_ID = "<YOUR_SPOTIFY_CLIENT_ID>";
const REDIRECT_URI = window.location.origin;
const SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "user-read-playback-state",
];
function getAuthToken(): string | null {
  const { access_token } = queryString.parse(window.location.hash);
  return typeof access_token === "string" ? access_token : null;
}
function redirectToSpotifyAuth() {
  const authUrl = `https://accounts.spotify.com/authorize?${queryString.stringify({
    client_id: CLIENT_ID,
    response_type: "token",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    show_dialog: true,
  })}`;
  window.location.href = authUrl;
}

interface PomodoroSpotifyPlayerProps {}
const PomodoroSpotifyPlayer: React.FC<PomodoroSpotifyPlayerProps> = () => {
  // === Auth State (hook always declared) ===
  const [accessToken, setAccessToken] = useState<string | null>(getAuthToken());

  // === Pomodoro Settings (hooks always declared) ===
  const [workMinutes, setWorkMinutes] = useState<number>(25);
  const [breakMinutes, setBreakMinutes] = useState<number>(5);
  const [totalPomodoros, setTotalPomodoros] = useState<number>(4);
  const [currentPomodoro, setCurrentPomodoro] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isWorking, setIsWorking] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<number>(workMinutes * 60);
  const [timerComplete, setTimerComplete] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const endRef = useRef<number>(0);
  const programmaticRef = useRef<boolean>(false);

  // === Spotify Player (hooks always declared) ===
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  // === Track/Playlist Input (hooks always declared) ===
  const [uriInput, setUriInput] = useState<string>("");
  const [uri, setUri] = useState<string>("");

  // === Auth Effects ===
  useEffect(() => {
    if (!accessToken && window.location.hash) {
      const token = getAuthToken();
      if (token) {
        setAccessToken(token);
        window.history.replaceState({}, document.title, REDIRECT_URI);
      }
    }
  }, [accessToken]);

  // === SDK Load Effect ===
  useEffect(() => {
    if (!accessToken) return;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(script);
    window.onSpotifyWebPlaybackSDKReady = () => {
      playerRef.current = new window.Spotify.Player({
        name: "Pomodoro Spotify Player",
        getOAuthToken: cb => cb(accessToken!),
      });
      playerRef.current.addListener("ready", ({ device_id }) => setDeviceId(device_id));
      playerRef.current.addListener("player_state_changed", state => {
        if (!state) return;
        if (!programmaticRef.current) {
          if (!state.paused && !isRunning) setIsRunning(true);
          if (state.paused && isRunning) setIsRunning(false);
        }
      });
      playerRef.current.connect();
    };
    return () => { playerRef.current?.disconnect(); };
  }, [accessToken, isRunning]);

  // === Play/Pause Sync Effect ===
  useEffect(() => {
    if (!playerRef.current || !deviceId) return;
    programmaticRef.current = true;
    const endpoint = isWorking && isRunning ?
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` :
      `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`;
    const body = isWorking && isRunning && uri ? JSON.stringify({ uris: [uri] }) : null;
    fetch(endpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(body ? { body } : {}),
    });
    setTimeout(() => (programmaticRef.current = false), 100);
  }, [accessToken, deviceId, isWorking, isRunning, uri]);

  // === Timer Logic Effect ===
  useEffect(() => {
    if (isRunning && !timerComplete) {
      if (!intervalRef.current) {
        startRef.current = Date.now();
        endRef.current = startRef.current + timeLeft * 1000;
      }
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const remaining = endRef.current - now;
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setTimeLeft(0);
          if (isWorking) {
            const next = currentPomodoro + 1;
            if (next >= totalPomodoros) {
              setTimerComplete(true);
              setIsRunning(false);
            } else {
              setIsWorking(false);
              setCurrentPomodoro(next);
              setTimeLeft(breakMinutes * 60);
            }
          } else {
            setIsWorking(true);
            setTimeLeft(workMinutes * 60);
          }
          return;
        }
        setTimeLeft(Math.ceil(remaining / 1000));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current!); };
  }, [isRunning, isWorking, timeLeft, breakMinutes, workMinutes, currentPomodoro, totalPomodoros, timerComplete]);

  // === Handlers ===
  const handleUriSubmit = () => { if (uriInput) setUri(uriInput); };
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };
  const toggleTimer = () => {
    if (timerComplete) {
      setIsWorking(true);
      setCurrentPomodoro(0);
      setTimeLeft(workMinutes * 60);
      setTimerComplete(false);
    }
    setIsRunning(!isRunning);
  };
  const resetTimer = () => {
    setIsRunning(false);
    setIsWorking(true);
    setCurrentPomodoro(0);
    setTimeLeft(workMinutes * 60);
    setTimerComplete(false);
  };

  // === Render ===
  if (!accessToken) {
    return (
      <div className="flex justify-center items-center h-screen">
        <button
          onClick={redirectToSpotifyAuth}
          className="px-6 py-3 bg-green-600 text-white rounded-lg"
        >
          Log in with Spotify
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-8 max-w-4xl mx-auto bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold mb-6">Pomodoro Spotify Player</h1>
      {/* URI Input */}
      <div className="w-full mb-4 flex gap-2">
        <input
          type="text"
          value={uriInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUriInput(e.target.value)}
          placeholder="Paste track/playlist URI here"
          className="flex-1 p-3 border rounded-lg"
          disabled={isRunning}
        />
        <button onClick={handleUriSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg" disabled={isRunning}>
          Load
        </button>
      </div>
      {/* Pomodoro Controls */}
      <div className="grid grid-cols-3 gap-4 w-full mb-6">
        {[{
            label: 'Work Minutes',
            value: workMinutes,
            set: (v: number) => { setWorkMinutes(v); if(!isRunning&&isWorking) setTimeLeft(v*60); }
          },{
            label: 'Break Minutes',
            value: breakMinutes,
            set: (v: number) => { setBreakMinutes(v); if(!isRunning&&!isWorking) setTimeLeft(v*60); }
          },{
            label: 'Pomodoros',
            value: totalPomodoros,
            set: (v: number) => setTotalPomodoros(v)
          }].map(({ label, value, set }) => (
          <div key={label} className="flex flex-col">
            <label className="mb-1 font-medium">{label}</label>
            <input
              type="number"
              min="1"
              value={value}
              onChange={e => set(parseInt(e.target.value, 10))}
              className="p-2 border rounded"
              disabled={isRunning}
            />
          </div>
        ))}
      </div>
      {/* Timer Display & Buttons */}
      <div className="text-6xl font-mono mb-4">{formatTime(timeLeft)}</div>
      <div className="flex gap-4 mb-6">
        <button onClick={toggleTimer} className={`px-6 py-2 rounded-lg text-white ${isRunning? 'bg-yellow-500':'bg-green-500'}`}>  
          {isRunning ? 'Pause' : timerComplete ? 'Restart' : 'Start'}
        </button>
        <button onClick={resetTimer} className="px-6 py-2 bg-gray-300 rounded-lg" disabled={!isRunning && timeLeft===workMinutes*60}>
          Reset
        </button>
      </div>
      <div className="text-sm text-gray-600">Device ID: {deviceId||'—'}</div>
    </div>
  );
};
export default PomodoroSpotifyPlayer;
