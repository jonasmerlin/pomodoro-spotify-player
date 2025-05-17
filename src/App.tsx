import React, { useState, useEffect, useRef } from "react";

// Main component for Spotify PKCE Auth with Pomodoro Timer
const SpotifyPomodoroPlayer = () => {
  // Spotify Auth States
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [playbackState, setPlaybackState] = useState(null);

  // Pomodoro States
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalPomodoros, setTotalPomodoros] = useState(4);
  const [currentPomodoro, setCurrentPomodoro] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isWorking, setIsWorking] = useState(true);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerComplete, setTimerComplete] = useState(false);

  // Refs for precise timing
  const intervalRef = useRef(null);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);
  const isRunningRef = useRef(false);
  const programmaticChangeRef = useRef(false);

  // Spotify Configuration
  const CLIENT_ID = "53c4eb5899c84af1ab26e7de292f01a8";
  const REDIRECT_URI = window.location.origin;
  const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
  const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
  const SCOPES = [
    "streaming",
    "user-read-email",
    "user-modify-playback-state",
    "user-read-playback-state",
  ];

  // Update document title with time left
  useEffect(() => {
    const formattedTime = formatTime(timeLeft);
    const status = isWorking ? "Work" : "Break";

    if (timerComplete) {
      document.title = "Pomodoro Complete";
    } else if (isRunning) {
      document.title = `${formattedTime} - ${status} | Pomodoro Spotify`;
    } else {
      document.title = "Pomodoro Spotify Player";
    }

    return () => {
      document.title = "Pomodoro Spotify Player";
    };
  }, [timeLeft, isWorking, isRunning, timerComplete]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Update ref when isRunning changes
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Generate a random string for code verifier
  const generateCodeVerifier = (length = 128) => {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let text = "";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  // Generate code challenge from verifier
  const generateCodeChallenge = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  // Handle login
  const handleLogin = async () => {
    setIsLoading(true);

    // Generate and store PKCE challenge
    const codeVerifier = generateCodeVerifier();
    localStorage.setItem("code_verifier", codeVerifier);

    try {
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.searchParams.append("client_id", CLIENT_ID);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.append("scope", SCOPES.join(" "));
      authUrl.searchParams.append("code_challenge_method", "S256");
      authUrl.searchParams.append("code_challenge", codeChallenge);

      window.location.href = authUrl.toString();
    } catch (err) {
      setIsLoading(false);
      setError("Failed to generate challenge: " + err.message);
    }
  };

  // Exchange code for token
  const getToken = async (code) => {
    setIsLoading(true);

    try {
      const codeVerifier = localStorage.getItem("code_verifier");

      if (!codeVerifier) {
        throw new Error("No code verifier found in storage");
      }

      const payload = new URLSearchParams();
      payload.append("client_id", CLIENT_ID);
      payload.append("grant_type", "authorization_code");
      payload.append("code", code);
      payload.append("redirect_uri", REDIRECT_URI);
      payload.append("code_verifier", codeVerifier);

      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      });

      if (!response.ok) {
        throw new Error("HTTP status " + response.status);
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("expires_in", data.expires_in);
      localStorage.setItem(
        "expires_at",
        new Date().getTime() + data.expires_in * 1000
      );

      setToken(data.access_token);
      return data.access_token;
    } catch (err) {
      setError("Failed to get token: " + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Get user info
  const getUserInfo = async (accessToken) => {
    try {
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("HTTP status " + response.status);
      }

      const data = await response.json();
      setUserInfo(data);
    } catch (err) {
      setError("Failed to get user info: " + err.message);
    }
  };

  // Get playback state
  const getPlaybackState = async (accessToken) => {
    try {
      const response = await fetch("https://api.spotify.com/v1/me/player", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 204) {
        setPlaybackState({ message: "No active device found" });
        return;
      }

      if (!response.ok) {
        throw new Error("HTTP status " + response.status);
      }

      const data = await response.json();
      setPlaybackState(data);
    } catch (err) {
      setError("Failed to get playback state: " + err.message);
    }
  };

  // Control playback - Play
  const handlePlay = async () => {
    if (!token) return;

    try {
      programmaticChangeRef.current = true;
      await fetch("https://api.spotify.com/v1/me/player/play", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Refresh playback state
      setTimeout(() => {
        getPlaybackState(token);
        programmaticChangeRef.current = false;
      }, 1000);
    } catch (err) {
      setError("Failed to start playback: " + err.message);
      programmaticChangeRef.current = false;
    }
  };

  // Control playback - Pause
  const handlePause = async () => {
    if (!token) return;

    try {
      programmaticChangeRef.current = true;
      await fetch("https://api.spotify.com/v1/me/player/pause", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Refresh playback state
      setTimeout(() => {
        getPlaybackState(token);
        programmaticChangeRef.current = false;
      }, 1000);
    } catch (err) {
      setError("Failed to pause playback: " + err.message);
      programmaticChangeRef.current = false;
    }
  };

  // Pomodoro timer control - Start/pause timer
  const toggleTimer = () => {
    if (timerComplete) {
      setIsWorking(true);
      setCurrentPomodoro(0);
      setTimeLeft(workMinutes * 60);
      setTimerComplete(false);
    }
    setIsRunning(!isRunning);
  };

  // Pomodoro timer control - Reset timer
  const resetTimer = () => {
    setIsRunning(false);
    setIsWorking(true);
    setCurrentPomodoro(0);
    setTimeLeft(workMinutes * 60);
    setTimerComplete(false);
  };

  // Set pomodoro preset timings
  const setPreset = (workMins, breakMins) => {
    setWorkMinutes(workMins);
    setBreakMinutes(breakMins);

    // Update the current timer display if not running
    if (!isRunning) {
      if (isWorking) {
        setTimeLeft(workMins * 60);
      } else {
        setTimeLeft(breakMins * 60);
      }
    }
  };

  // Timer logic with timestamp-based accuracy
  useEffect(() => {
    if (isRunning && !timerComplete) {
      // On start or resume, set start and end timestamps
      if (!intervalRef.current) {
        startTimeRef.current = Date.now();
        endTimeRef.current = startTimeRef.current + timeLeft * 1000;
      }

      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        const remainingMs = endTimeRef.current - now;
        if (remainingMs <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setTimeLeft(0);

          // Switch states at end
          if (isWorking) {
            const nextPomodoro = currentPomodoro + 1;
            if (nextPomodoro >= totalPomodoros) {
              setTimerComplete(true);
              setIsRunning(false);
              handlePause(); // Pause Spotify when all pomodoros complete
            } else {
              setIsWorking(false);
              setCurrentPomodoro(nextPomodoro);
              setTimeLeft(breakMinutes * 60);
              handlePause(); // Pause Spotify during break
            }
          } else {
            setIsWorking(true);
            setTimeLeft(workMinutes * 60);
            handlePlay(); // Resume Spotify for work session
          }
          return;
        }
        setTimeLeft(Math.ceil(remainingMs / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    isRunning,
    isWorking,
    breakMinutes,
    workMinutes,
    currentPomodoro,
    totalPomodoros,
    timerComplete,
  ]);

  // Synchronize Spotify playback with Pomodoro state
  useEffect(() => {
    if (token) {
      if (isWorking && isRunning) {
        handlePlay();
      } else {
        handlePause();
      }
    }
  }, [isWorking, isRunning, token]);

  // Visibility detection to resync timer
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && isRunning && !timerComplete) {
        // Recalculate endTime based on current time
        const now = Date.now();
        const remaining = endTimeRef.current - now;
        setTimeLeft(Math.max(0, Math.ceil(remaining / 1000)));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isRunning, timerComplete]);

  // Get token from URL on callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      // Remove code from URL to prevent re-requesting tokens on page refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      getToken(code).then((accessToken) => {
        if (accessToken) {
          getUserInfo(accessToken);
          getPlaybackState(accessToken);
        }
      });
    } else {
      // Check if we have a token in localStorage
      const storedToken = localStorage.getItem("access_token");
      const expiresAt = localStorage.getItem("expires_at");

      if (
        storedToken &&
        expiresAt &&
        new Date().getTime() < parseInt(expiresAt)
      ) {
        setToken(storedToken);
        getUserInfo(storedToken);
        getPlaybackState(storedToken);
      }
    }
  }, []);

  // Refresh playback state periodically
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      getPlaybackState(token);
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-md">
      <h1 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
        Spotify Pomodoro Player
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error: </strong>
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      )}

      {!token ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-sm">
          <p className="mb-4 text-gray-700">
            Connect your Spotify account to use this application
          </p>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-all duration-300"
          >
            Connect with Spotify
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left column: Account info and Pomodoro controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* User Info Card */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-2 text-gray-800">
                Account
              </h2>
              {userInfo ? (
                <>
                  <div className="flex items-center">
                    {userInfo.images && userInfo.images.length > 0 && (
                      <img
                        src={userInfo.images[0].url || "/api/placeholder/80/80"}
                        alt="Profile"
                        className="w-12 h-12 rounded-full mr-4"
                      />
                    )}
                    <div>
                      <p className="font-medium">{userInfo.display_name}</p>
                      <p className="text-gray-600 text-sm">{userInfo.email}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("refresh_token");
                        localStorage.removeItem("expires_in");
                        localStorage.removeItem("expires_at");
                        localStorage.removeItem("code_verifier");
                        setToken(null);
                        setUserInfo(null);
                        setPlaybackState(null);
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-1 px-3 rounded text-sm"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Loading user information...</p>
              )}
            </div>

            {/* Pomodoro Settings */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Pomodoro Settings
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={workMinutes}
                    onChange={(e) => {
                      setWorkMinutes(parseInt(e.target.value, 10));
                      if (!isRunning && isWorking) {
                        setTimeLeft(parseInt(e.target.value, 10) * 60);
                      }
                    }}
                    className="p-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Break Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={breakMinutes}
                    onChange={(e) => {
                      setBreakMinutes(parseInt(e.target.value, 10));
                      if (!isRunning && !isWorking) {
                        setTimeLeft(parseInt(e.target.value, 10) * 60);
                      }
                    }}
                    className="p-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pomodoros
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={totalPomodoros}
                    onChange={(e) =>
                      setTotalPomodoros(parseInt(e.target.value, 10))
                    }
                    className="p-2 border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none"
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex gap-2 flex-wrap">
                <div className="text-xs text-gray-600 flex items-center">
                  Common Timings:
                </div>
                <button
                  onClick={() => setPreset(25, 5)}
                  className="bg-white border border-indigo-200 text-indigo-700 px-3 py-1 text-sm rounded-md hover:bg-indigo-50 transition-colors duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  25/5
                </button>
                <button
                  onClick={() => setPreset(45, 15)}
                  className="bg-white border border-indigo-200 text-indigo-700 px-3 py-1 text-sm rounded-md hover:bg-indigo-50 transition-colors duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  45/15
                </button>
                <button
                  onClick={() => setPreset(60, 30)}
                  className="bg-white border border-indigo-200 text-indigo-700 px-3 py-1 text-sm rounded-md hover:bg-indigo-50 transition-colors duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRunning}
                >
                  60/30
                </button>
              </div>
            </div>
          </div>

          {/* Right column: Timer display and playback state */}
          <div className="lg:col-span-3 space-y-6">
            {/* Timer Display */}
            <div className="w-full mb-4">
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${
                          isWorking ? "bg-red-500" : "bg-green-500"
                        } ${isRunning ? "animate-pulse" : ""}`}
                      ></div>
                      <span
                        className={`font-medium ${
                          isWorking ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isWorking ? "WORK SESSION" : "BREAK TIME"}
                      </span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-full shadow-sm">
                      <span className="font-medium text-gray-600">
                        Pomodoro
                      </span>
                      <span className="ml-2 font-bold text-indigo-700">
                        {currentPomodoro + 1}/{totalPomodoros}
                      </span>
                    </div>
                  </div>

                  <div className="text-center mb-6">
                    <span className="text-6xl font-bold text-gray-800 font-mono tracking-wider">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-center gap-4 p-4 bg-white">
                  <button
                    onClick={toggleTimer}
                    className={`px-8 py-3 rounded-lg font-medium shadow-sm transition-all duration-300 ${
                      isRunning
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-md text-white"
                    }`}
                  >
                    {isRunning ? "Pause" : timerComplete ? "Restart" : "Start"}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-3 rounded-lg font-medium shadow-sm transition-all duration-300 disabled:opacity-50"
                    disabled={!isRunning && timeLeft === workMinutes * 60}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Current Playback */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-2 text-gray-800">
                Now Playing
              </h2>
              {playbackState ? (
                <div>
                  {playbackState.message ? (
                    <p className="p-6 text-center text-gray-500">
                      {playbackState.message}
                    </p>
                  ) : (
                    <div>
                      {playbackState.item ? (
                        <div className="flex items-center">
                          {playbackState.item.album?.images &&
                            playbackState.item.album.images.length > 0 && (
                              <img
                                src={playbackState.item.album.images[0].url || "/api/placeholder/80/80"}
                                alt="Album Art"
                                className="w-20 h-20 mr-4 rounded-md shadow-sm"
                              />
                            )}
                          <div>
                            <p className="font-medium text-lg">
                              {playbackState.item.name}
                            </p>
                            <p className="text-gray-600">
                              {playbackState.item.artists
                                .map((artist) => artist.name)
                                .join(", ")}
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                              {playbackState.item.album?.name}
                            </p>
                            <p className="text-xs mt-2 inline-block px-2 py-1 bg-gray-100 rounded-full">
                              {playbackState.is_playing ? "Playing" : "Paused"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="p-6 text-center text-gray-500">
                          No track currently playing
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="p-6 text-center text-gray-500">
                  Loading playback information...
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="p-4 bg-white rounded-lg shadow-sm border-l-4 border-indigo-500">
              <p className="text-gray-700">
                <span className="font-bold text-indigo-700">How it works:</span>{" "}
                Start playing music on Spotify, then use the Pomodoro timer to
                manage your work sessions. Music will automatically play during
                work intervals and pause during breaks.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-xs text-gray-500">
        <p>
          Note: You need to have Spotify Premium to use the playback control
          features.
        </p>
        <p>
          Make sure you have an active Spotify device open (like the Spotify app
          on your phone or computer).
        </p>
      </div>
    </div>
  );
};

export default SpotifyPomodoroPlayer;
