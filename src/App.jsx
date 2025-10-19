import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  WifiOff,
  Bot,
  UsersRound,
  Globe,
  Home,
  Palette,
} from "lucide-react";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 12;
const PADDLE_SPEED = 6;
const INITIAL_BALL_SPEED = 4;
const POWERUP_SIZE = 20;
const FPS = 60;
const FRAME_INTERVAL = 1000 / FPS;

const POWERUP_TYPES = [
  { id: "shrink", color: "#ef4444", emoji: "📉" },
  { id: "grow", color: "#10b981", emoji: "📈" },
  { id: "point", color: "#fbbf24", emoji: "⭐" },
  { id: "speedUp", color: "#3b82f6", emoji: "⚡" },
  { id: "slowDown", color: "#8b5cf6", emoji: "🐌" },
  { id: "multiBall", color: "#ec4899", emoji: "🎯" },
];

// Theme configurations
const THEMES = {
  neon: {
    name: "Neon Cyber",
    background: "#0f172a",
    centerLine: "#334155",
    p1Color: "#06b6d4",
    p2Color: "#f43f5e",
    ballColor: "#fbbf24",
    ballGlow: "#fbbf24",
    textColor: "#ffffff",
    gradient: "from-slate-900 via-purple-900 to-slate-900",
    buttonGradient: "from-cyan-500 to-blue-500",
    borderColor: "border-slate-700",
  },
  retro: {
    name: "Retro Arcade",
    background: "#000000",
    centerLine: "#00ff00",
    p1Color: "#ff0000",
    p2Color: "#0000ff",
    ballColor: "#ffff00",
    ballGlow: "#ffff00",
    textColor: "#00ff00",
    gradient: "from-gray-900 via-green-900 to-gray-900",
    buttonGradient: "from-red-500 to-yellow-500",
    borderColor: "border-green-700",
  },
  sunset: {
    name: "Sunset Glow",
    background: "#1e1b4b",
    centerLine: "#f97316",
    p1Color: "#ec4899",
    p2Color: "#f59e0b",
    ballColor: "#84cc16",
    ballGlow: "#84cc16",
    textColor: "#fef3c7",
    gradient: "from-violet-900 via-orange-900 to-rose-900",
    buttonGradient: "from-pink-500 to-yellow-500",
    borderColor: "border-orange-700",
  },
  ocean: {
    name: "Ocean Depth",
    background: "#0c4a6e",
    centerLine: "#22d3ee",
    p1Color: "#38bdf8",
    p2Color: "#2dd4bf",
    ballColor: "#f0f9ff",
    ballGlow: "#f0f9ff",
    textColor: "#e0f2fe",
    gradient: "from-blue-900 via-cyan-900 to-teal-900",
    buttonGradient: "from-blue-500 to-teal-500",
    borderColor: "border-cyan-700",
  },
  matrix: {
    name: "The Matrix",
    background: "#000000",
    centerLine: "#00ff41",
    p1Color: "#008f11",
    p2Color: "#00ff41",
    ballColor: "#ffffff",
    ballGlow: "#00ff41",
    textColor: "#00ff41",
    gradient: "from-green-900 via-black to-green-900",
    buttonGradient: "from-green-500 to-emerald-500",
    borderColor: "border-green-700",
  },
  candy: {
    name: "Candy Land",
    background: "#fdf2f8",
    centerLine: "#f472b6",
    p1Color: "#ec4899",
    p2Color: "#a855f7",
    ballColor: "#fbbf24",
    ballGlow: "#fbbf24",
    textColor: "#831843",
    gradient: "from-pink-100 via-purple-100 to-rose-100",
    buttonGradient: "from-pink-400 to-purple-400",
    borderColor: "border-pink-300",
  },
};

const ModernPong = () => {
  const canvasRef = useRef(null);
  const [gameMode, setGameMode] = useState(null);
  const [gameState, setGameState] = useState("menu");
  const [winPoints, setWinPoints] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [mobileControls, setMobileControls] = useState({
    p1Up: false,
    p1Down: false,
    p2Up: false,
    p2Down: false,
  });
  const [onlineStatus, setOnlineStatus] = useState("disconnected");
  const [searchingMatch, setSearchingMatch] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [enteredRoomId, setEnteredRoomId] = useState("");
  const [currentTheme, setCurrentTheme] = useState("neon");
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const keysRef = useRef({});
  const peerRef = useRef(null);
  const connectionRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const lastPowerupTimeRef = useRef(0);
  const scoreRef = useRef({ p1: 0, p2: 0 });
  const particlesRef = useRef([]);

  const gameObjectsRef = useRef({
    paddle1: {
      x: 30,
      y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED,
    },
    paddle2: {
      x: CANVAS_WIDTH - 30 - PADDLE_WIDTH,
      y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED,
    },
    balls: [
      {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        dx: INITIAL_BALL_SPEED,
        dy: INITIAL_BALL_SPEED,
        speed: INITIAL_BALL_SPEED,
      },
    ],
    powerups: [],
  });

  // Get current theme
  const theme = THEMES[currentTheme];

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playSound = useCallback((frequency, duration, type = "sine") => {
    if (!audioContextRef.current) return;
    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContextRef.current.currentTime + duration
      );

      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + duration);
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, []);

  const createParticles = useCallback((x, y, color) => {
    const newParticles = [];
    for (let i = 0; i < 15; i++) {
      newParticles.push({
        x,
        y,
        dx: (Math.random() - 0.5) * 8,
        dy: (Math.random() - 0.5) * 8,
        life: 1,
        color,
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  }, []);

  const sendToOpponent = useCallback((data) => {
    if (connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send(data);
    }
  }, []);

  function generateShortId(length = 6) {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  const initOnlineMode = useCallback(() => {
    if (!window.Peer) {
      alert("PeerJS not loaded. Please refresh the page.");
      return;
    }

    setSearchingMatch(true);
    const peer = new window.Peer(generateShortId());
    peerRef.current = peer;

    peer.on("open", (id) => {
      setRoomId(id);
      setOnlineStatus("searching");
    });

    peer.on("connection", (conn) => {
      connectionRef.current = conn;
      setIsHost(true);
      setSearchingMatch(false);
      setOnlineStatus("connected");

      conn.on("data", (data) => {
        if (data.type === "paddle") {
          gameObjectsRef.current.paddle2.y = data.y;
        } else if (data.type === "gameState") {
          gameObjectsRef.current = data.state;
          scoreRef.current = data.score;
        }
      });

      conn.on("close", () => {
        disconnectOnline();
      });

      startGame();
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setOnlineStatus("error");
    });
  }, []);

  const connectToOpponent = useCallback((peerId) => {
    if (!peerRef.current) return;

    const conn = peerRef.current.connect(peerId);
    connectionRef.current = conn;

    conn.on("open", () => {
      setIsHost(false);
      setSearchingMatch(false);
      setOnlineStatus("connected");

      conn.on("data", (data) => {
        if (data.type === "paddle") {
          gameObjectsRef.current.paddle2.y = data.y;
        } else if (data.type === "gameState") {
          gameObjectsRef.current = data.state;
          scoreRef.current = data.score;
        }
      });

      conn.on("close", () => {
        disconnectOnline();
      });

      startGame();
    });
  }, []);

  const disconnectOnline = useCallback((s = true) => {
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setOnlineStatus("disconnected");
    setSearchingMatch(false);
    setGameState("menu");
    if (s) {
      setGameMode(null);
    }
    setEnteredRoomId("");
  }, []);

  const resetBall = useCallback((ballIndex = 0) => {
    const balls = gameObjectsRef.current.balls;
    balls[ballIndex] = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED,
      dy: (Math.random() - 0.5) * INITIAL_BALL_SPEED,
      speed: INITIAL_BALL_SPEED,
    };
  }, []);

  const resetGame = useCallback(() => {
    gameObjectsRef.current = {
      paddle1: {
        x: 30,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        speed: PADDLE_SPEED,
      },
      paddle2: {
        x: CANVAS_WIDTH - 30 - PADDLE_WIDTH,
        y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
        width: PADDLE_WIDTH,
        height: PADDLE_HEIGHT,
        speed: PADDLE_SPEED,
      },
      balls: [
        {
          x: CANVAS_WIDTH / 2,
          y: CANVAS_HEIGHT / 2,
          dx: INITIAL_BALL_SPEED,
          dy: INITIAL_BALL_SPEED,
          speed: INITIAL_BALL_SPEED,
        },
      ],
      powerups: [],
    };
    scoreRef.current = { p1: 0, p2: 0 };
    particlesRef.current = [];
    setIsPaused(false);
    lastPowerupTimeRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("playing");
  }, [resetGame]);

  const applyPowerup = useCallback(
    (powerup, collector) => {
      const { paddle1, paddle2 } = gameObjectsRef.current;
      const isP1 = collector === "p1";
      const playerPaddle = isP1 ? paddle1 : paddle2;
      const opponentPaddle = isP1 ? paddle2 : paddle1;

      playSound(800, 0.2, "square");
      createParticles(powerup.x, powerup.y, powerup.color);

      switch (powerup.type) {
        case "shrink":
          opponentPaddle.height = Math.max(50, opponentPaddle.height - 20);
          setTimeout(() => (opponentPaddle.height = PADDLE_HEIGHT), 5000);
          break;
        case "grow":
          playerPaddle.height = Math.min(150, playerPaddle.height + 20);
          setTimeout(() => (playerPaddle.height = PADDLE_HEIGHT), 5000);
          break;
        case "point":
          scoreRef.current[collector]++;
          if (scoreRef.current[collector] >= winPoints) {
            setGameState("gameOver");
            playSound(600, 0.5, "triangle");
          }
          break;
        case "speedUp":
          playerPaddle.speed = PADDLE_SPEED * 1.5;
          setTimeout(() => (playerPaddle.speed = PADDLE_SPEED), 5000);
          break;
        case "slowDown":
          opponentPaddle.speed = PADDLE_SPEED * 0.5;
          setTimeout(() => (opponentPaddle.speed = PADDLE_SPEED), 5000);
          break;
        case "multiBall":
          if (gameObjectsRef.current.balls.length < 3) {
            const newBall = {
              x: CANVAS_WIDTH / 2,
              y: CANVAS_HEIGHT / 2,
              dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED,
              dy: (Math.random() - 0.5) * INITIAL_BALL_SPEED,
              speed: INITIAL_BALL_SPEED,
            };
            gameObjectsRef.current.balls.push(newBall);
          }
          break;
      }
    },
    [playSound, createParticles]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center line
    ctx.strokeStyle = theme.centerLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Score
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = theme.p1Color;
    ctx.fillText(scoreRef.current.p1, CANVAS_WIDTH / 4, 60);
    ctx.fillStyle = theme.p2Color;
    ctx.fillText(scoreRef.current.p2, (CANVAS_WIDTH * 3) / 4, 60);

    const { paddle1, paddle2, balls, powerups } = gameObjectsRef.current;

    // Paddles with glow
    const drawPaddle = (paddle, color) => {
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
      ctx.shadowBlur = 0;
    };

    drawPaddle(paddle1, theme.p1Color);
    drawPaddle(paddle2, theme.p2Color);

    // Balls with trail
    balls.forEach((ball) => {
      ctx.shadowBlur = 25;
      ctx.shadowColor = theme.ballGlow;
      ctx.fillStyle = theme.ballColor;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_SIZE, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Powerups
    powerups.forEach((powerup) => {
      ctx.save();
      ctx.translate(powerup.x, powerup.y);
      ctx.rotate(powerup.rotation);
      ctx.shadowBlur = 15;
      ctx.shadowColor = powerup.color;
      ctx.fillStyle = powerup.color;
      ctx.fillRect(
        -POWERUP_SIZE / 2,
        -POWERUP_SIZE / 2,
        POWERUP_SIZE,
        POWERUP_SIZE
      );
      ctx.shadowBlur = 0;
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(powerup.emoji, 0, 0);
      ctx.restore();
    });

    // Particles
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = `${p.color}${Math.floor(p.life * 255)
        .toString(16)
        .padStart(2, "0")}`;
      ctx.fillRect(p.x, p.y, 3, 3);
    });

    // Pause overlay
    if (isPaused) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.font = "bold 72px Arial";
      ctx.fillStyle = theme.textColor;
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [isPaused, theme]);

  const gameLoop = useCallback(
    (currentTime) => {
      if (gameState !== "playing") return;

      // Frame rate limiting
      const deltaTime = currentTime - lastFrameTimeRef.current;
      if (deltaTime < FRAME_INTERVAL) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      lastFrameTimeRef.current = currentTime - (deltaTime % FRAME_INTERVAL);

      if (!isPaused) {
        const { paddle1, paddle2, balls, powerups } = gameObjectsRef.current;

        // Update paddle1 (local player or P1 in local multiplayer)
        if (gameMode !== "online" || isHost) {
          if (keysRef.current.ArrowUp || mobileControls.p1Up) {
            paddle1.y = Math.max(0, paddle1.y - paddle1.speed);
          }
          if (keysRef.current.ArrowDown || mobileControls.p1Down) {
            paddle1.y = Math.min(
              CANVAS_HEIGHT - paddle1.height,
              paddle1.y + paddle1.speed
            );
          }

          if (gameMode === "online" && isHost) {
            sendToOpponent({ type: "paddle", y: paddle1.y });
          }
        }

        // Update paddle2
        if (gameMode === "local") {
          if (keysRef.current.w || keysRef.current.W || mobileControls.p2Up) {
            paddle2.y = Math.max(0, paddle2.y - paddle2.speed);
          }
          if (keysRef.current.s || keysRef.current.S || mobileControls.p2Down) {
            paddle2.y = Math.min(
              CANVAS_HEIGHT - paddle2.height,
              paddle2.y + paddle2.speed
            );
          }
        } else if (gameMode === "ai" && balls.length > 0) {
          const mainBall = balls[0];
          const paddle2Center = paddle2.y + paddle2.height / 2;
          const diff = mainBall.y - paddle2Center;
          if (Math.abs(diff) > 10) {
            paddle2.y +=
              Math.sign(diff) * Math.min(paddle2.speed * 0.7, Math.abs(diff));
            paddle2.y = Math.max(
              0,
              Math.min(CANVAS_HEIGHT - paddle2.height, paddle2.y)
            );
          }
        } else if (gameMode === "online" && !isHost) {
          if (keysRef.current.ArrowUp || mobileControls.p1Up) {
            paddle2.y = Math.max(0, paddle2.y - paddle2.speed);
          }
          if (keysRef.current.ArrowDown || mobileControls.p1Down) {
            paddle2.y = Math.min(
              CANVAS_HEIGHT - paddle2.height,
              paddle2.y + paddle2.speed
            );
          }
          sendToOpponent({ type: "paddle", y: paddle2.y });
        }

        // Update balls
        balls.forEach((ball, index) => {
          ball.x += ball.dx;
          ball.y += ball.dy;

          // Wall collision
          if (ball.y <= 0 || ball.y >= CANVAS_HEIGHT) {
            ball.dy *= -1;
            playSound(300, 0.1);
            createParticles(ball.x, ball.y, theme.p1Color);
          }

          // Paddle collision
          if (
            ball.dx < 0 &&
            ball.x <= paddle1.x + paddle1.width &&
            ball.y >= paddle1.y &&
            ball.y <= paddle1.y + paddle1.height
          ) {
            ball.dx = -ball.dx + 0.2;
            ball.dy += (ball.y - paddle1.y - paddle1.height / 2) / 20;
            playSound(400, 0.15);
            createParticles(ball.x, ball.y, theme.p1Color);
          }

          if (
            ball.dx > 0 &&
            ball.x >= paddle2.x &&
            ball.y >= paddle2.y &&
            ball.y <= paddle2.y + paddle2.height
          ) {
            ball.dx = -ball.dx - 0.2;
            ball.dy += (ball.y - paddle2.y - paddle2.height / 2) / 20;
            playSound(400, 0.15);
            createParticles(ball.x, ball.y, theme.p2Color);
          }

          // Score
          if (ball.x < 0) {
            scoreRef.current.p2++;
            if (scoreRef.current.p2 >= winPoints) {
              setGameState("gameOver");
              playSound(600, 0.5, "triangle");
            } else {
              playSound(200, 0.3);
              if (balls.length > 1) {
                balls.splice(index, 1);
              } else {
                resetBall(index);
              }
            }
          }

          if (ball.x > CANVAS_WIDTH) {
            scoreRef.current.p1++;
            if (scoreRef.current.p1 >= winPoints) {
              setGameState("gameOver");
              playSound(600, 0.5, "triangle");
            } else {
              playSound(200, 0.3);
              if (balls.length > 1) {
                balls.splice(index, 1);
              } else {
                resetBall(index);
              }
            }
          }
        });

        // Spawn powerups
        const now = Date.now();
        if (
          now - lastPowerupTimeRef.current > 8000 &&
          powerups.length < 2 &&
          Math.random() < 0.02
        ) {
          const powerupType =
            POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
          powerups.push({
            x: CANVAS_WIDTH / 4 + Math.random() * (CANVAS_WIDTH / 2),
            y: 50 + Math.random() * (CANVAS_HEIGHT - 100),
            type: powerupType.id,
            color: powerupType.color,
            emoji: powerupType.emoji,
            rotation: 0,
          });
          lastPowerupTimeRef.current = now;
        }

        // Update powerups
        powerups.forEach((powerup, index) => {
          powerup.rotation += 0.05;

          balls.forEach((ball) => {
            const dx = ball.x - powerup.x;
            const dy = ball.y - powerup.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < POWERUP_SIZE) {
              const collector = ball.dx < 0 ? "p2" : "p1";
              applyPowerup(powerup, collector);
              powerups.splice(index, 1);
            }
          });
        });

        // Update particles
        particlesRef.current = particlesRef.current
          .map((p) => ({
            ...p,
            x: p.x + p.dx,
            y: p.y + p.dy,
            dy: p.dy + 0.2,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0);

        // Sync game state for online mode
        if (gameMode === "online" && isHost) {
          sendToOpponent({
            type: "gameState",
            state: gameObjectsRef.current,
            score: scoreRef.current,
          });
        }
      }

      draw();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    },
    [
      gameState,
      gameMode,
      isPaused,
      mobileControls,
      winPoints,
      isHost,
      playSound,
      createParticles,
      resetBall,
      applyPowerup,
      sendToOpponent,
      draw,
      theme,
    ]
  );

  useEffect(() => {
    if (gameState === "playing") {
      lastFrameTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Load PeerJS
  useEffect(() => {
    if (!window.Peer) {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/peerjs@1.5.2/dist/peerjs.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleModeSelect = (mode) => {
    setGameMode(mode);
    if (mode === "online") {
      initOnlineMode();
    } else {
      setSearchingMatch(false);
      disconnectOnline(false);
      startGame();
    }
  };

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-4`}
    >
      <div className="w-full max-w-4xl">
        {/* Theme Selector */}
        <div className="fixed top-4 right-4 z-10">
          <button
            onClick={() => setShowThemeSelector(!showThemeSelector)}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-white p-3 rounded-lg backdrop-blur transition-all duration-300 flex items-center gap-2"
          >
            <Palette size={20} />
            <span className="hidden sm:inline">Theme</span>
          </button>

          {showThemeSelector && (
            <div className="absolute top-14 right-0 bg-slate-800/90 backdrop-blur rounded-lg p-4 shadow-2xl border border-slate-700 min-w-48">
              <h3 className="text-white font-bold mb-3 text-center">
                Select Theme
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(THEMES).map(([key, themeConfig]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentTheme(key);
                      setShowThemeSelector(false);
                    }}
                    className={`p-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      currentTheme === key
                        ? "ring-2 ring-white bg-slate-700"
                        : "bg-slate-600/50 hover:bg-slate-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-6 h-6 rounded-full border border-white/30"
                        style={{
                          background: `linear-gradient(135deg, ${themeConfig.p1Color}, ${themeConfig.p2Color})`,
                        }}
                      />
                      <span className="text-white">{themeConfig.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {gameState === "menu" && (
          <div className="text-center space-y-8">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-8">
              NEON PONG
            </h1>

            <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg">
              <label className="block text-cyan-300 text-lg mb-3">
                Win Points
              </label>
              <select
                value={winPoints}
                onChange={(e) => setWinPoints(Number(e.target.value))}
                className="bg-slate-700 text-white px-6 py-3 rounded-lg text-lg cursor-pointer hover:bg-slate-600 transition"
              >
                <option value={3}>3 Points</option>
                <option value={5}>5 Points</option>
                <option value={7}>7 Points</option>
                <option value={10}>10 Points</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleModeSelect("ai")}
                className="flex justify-center items-center gap-2 cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-6 rounded-lg text-xl font-bold transition transform hover:scale-105 shadow-lg"
              >
                <Bot /> VS AI
              </button>
              <button
                onClick={() => handleModeSelect("local")}
                className="flex justify-center items-center gap-2 cursor-pointer bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-6 rounded-lg text-xl font-bold transition transform hover:scale-105 shadow-lg"
              >
                <UsersRound /> Local 2P
              </button>
              <button
                onClick={() => handleModeSelect("online")}
                className="flex justify-center items-center gap-2 cursor-pointer bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-6 rounded-lg text-xl font-bold transition transform hover:scale-105 shadow-lg"
              >
                <Globe /> Online
              </button>
            </div>
          </div>
        )}

        {searchingMatch && (
          <div className="text-center space-y-6 mt-4">
            <div className="text-lg text-white bg-slate-800 p-4 rounded-lg inline-block">
              Your Room ID:{" "}
              <span className="text-cyan-300 font-mono">{roomId}</span>
            </div>
            <div className="text-sm text-gray-400">
              Enter a room id bellow and then click Enter
            </div>
            <div>
              <input
                type="text"
                placeholder="Or enter opponent's Room ID"
                className="bg-slate-700 text-white px-4 py-3 rounded-lg w-full max-w-md"
                onInput={(e) => setEnteredRoomId(e.target.value)}
              />
            </div>
            <div className="flex justify-center items-center gap-3 my-2">
              <button
                onClick={() => connectToOpponent(enteredRoomId)}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-bold cursor-pointer"
              >
                Enter
              </button>
              <button
                onClick={() => {
                  setSearchingMatch(false);
                  disconnectOnline();
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {gameMode !== "online" && (
                <>
                  <button
                    onClick={() => {
                      setGameState("menu");
                      setGameMode(null);
                      resetGame();
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition"
                  >
                    <Home size={20} />
                  </button>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition"
                  >
                    {isPaused ? <Play size={20} /> : <Pause size={20} />}
                  </button>
                  <button
                    onClick={resetGame}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg transition"
                  >
                    <RotateCcw size={20} />
                  </button>
                </>
              )}
              {gameMode === "online" && (
                <button
                  onClick={disconnectOnline}
                  className="flex justify-center items-center gap-2 bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg transition"
                >
                  <WifiOff size={20} /> Disconnect
                </button>
              )}
            </div>

            <div className="relative mx-auto" style={{ maxWidth: "800px" }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className={`w-full border-4 ${theme.borderColor} rounded-lg shadow-2xl`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 md:hidden">
              <div className="space-y-2">
                <div className="text-center text-cyan-400 font-bold">P1</div>
                <button
                  onTouchStart={() =>
                    setMobileControls((p) => ({ ...p, p1Up: true }))
                  }
                  onTouchEnd={() =>
                    setMobileControls((p) => ({ ...p, p1Up: false }))
                  }
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-4 rounded-lg font-bold"
                >
                  ↑ UP
                </button>
                <button
                  onTouchStart={() =>
                    setMobileControls((p) => ({ ...p, p1Down: true }))
                  }
                  onTouchEnd={() =>
                    setMobileControls((p) => ({ ...p, p1Down: false }))
                  }
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-4 rounded-lg font-bold"
                >
                  ↓ DOWN
                </button>
              </div>
              {gameMode === "local" && (
                <div className="space-y-2">
                  <div className="text-center text-pink-500 font-bold">P2</div>
                  <button
                    onTouchStart={() =>
                      setMobileControls((p) => ({ ...p, p2Up: true }))
                    }
                    onTouchEnd={() =>
                      setMobileControls((p) => ({ ...p, p2Up: false }))
                    }
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-4 rounded-lg font-bold"
                  >
                    ↑ UP
                  </button>
                  <button
                    onTouchStart={() =>
                      setMobileControls((p) => ({ ...p, p2Down: true }))
                    }
                    onTouchEnd={() =>
                      setMobileControls((p) => ({ ...p, p2Down: false }))
                    }
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-4 rounded-lg font-bold"
                  >
                    ↓ DOWN
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="text-center space-y-6">
            <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              GAME OVER
            </h2>
            <div className="text-3xl text-white">
              {scoreRef.current.p1 >= winPoints ? (
                <span className="text-cyan-400">Player 1 Wins! 🎉</span>
              ) : (
                <span className="text-pink-500">Player 2 Wins! 🎉</span>
              )}
            </div>
            <div className="text-2xl text-gray-300">
              Final Score: {scoreRef.current.p1} - {scoreRef.current.p2}
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  resetGame();
                  setGameState("playing");
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 rounded-lg text-xl font-bold transition transform hover:scale-105"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  if (gameMode === "online") {
                    disconnectOnline();
                  }
                  setGameState("menu");
                  setGameMode(null);
                  resetGame();
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-4 rounded-lg text-xl font-bold transition"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernPong;
