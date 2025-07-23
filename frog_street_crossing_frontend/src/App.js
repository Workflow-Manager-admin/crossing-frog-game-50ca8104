import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

/**
 * PUBLIC_INTERFACE
 * The main Frog Street Crossing game React component.
 * Implements game canvas, mechanics, keyboard/touch controls, four lanes, collision, sound, scores, win/lose, theming and responsive UI.
 */
function App() {
  // Colors pulled from work description
  const COLORS = {
    primary: "#388e3c",
    secondary: "#1e88e5",
    accent: "#ffd600",
    frog: "#43a047",
    road: "#232323",
    laneBorder: "#111a",
    carRed: "#e53935",
    carBlue: "#1976d2",
    carYellow: "#ffd600",
    carPurple: "#8e24aa",
    text: "#fff",
    // override text colors for dark/light
    score: "#ffd600",
    lose: "#e53935",
    win: "#43a047",
  };

  // Game config
  const NUM_LANES = 4;
  const LANE_WIDTH = 60;
  const LANE_HEIGHT = 70;
  const LANE_MARGIN = 16;
  const FROG_SIZE = 36;
  const CAR_WIDTH = 55;
  const CAR_HEIGHT = 36;
  const CARS_PER_LANE = 2;

  // Responsive size
  const [canvasWidth, setCanvasWidth] = useState(400);
  const [canvasHeight, setCanvasHeight] = useState(420);

  // Theme management
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme((th) => (th === "light" ? "dark" : "light"));
  };

  // Game state
  const [frog, setFrog] = useState({ x: 0, y: 0 }); // grid position
  const [cars, setCars] = useState([]);
  const [gameStatus, setGameStatus] = useState("waiting"); // 'playing' | 'win' | 'lose' | 'waiting'
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => {
    try {
      return Number(localStorage.getItem("frog_high") || 0);
    } catch {
      return 0;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Track key states for smooth controls
  const keysPressed = useRef({});
  const canvasRef = useRef(null);

  // Utility to play a simple sound effect
  const playSound = useCallback(
    (type) => {
      if (!soundEnabled) return;
      // Little synth beep for each event type, using the Web Audio API
      if (!window.AudioContext && !window.webkitAudioContext) return;
      try {
        const ctx =
          window.AudioContext
            ? new window.AudioContext()
            : new window.webkitAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (type === "hop") {
          osc.type = "sine";
          osc.frequency.value = 530;
          gain.gain.value = 0.18;
        } else if (type === "win") {
          osc.type = "triangle";
          osc.frequency.value = 880;
          gain.gain.value = 0.24;
        } else if (type === "lose") {
          osc.type = "square";
          osc.frequency.value = 220;
          gain.gain.value = 0.22;
        } else if (type === "hit") {
          osc.type = "sawtooth";
          osc.frequency.value = 100;
          gain.gain.value = 0.3;
        }
        osc.start();

        setTimeout(() => {
          gain.gain.setValueAtTime(0, ctx.currentTime + 0.10);
          osc.stop(ctx.currentTime + 0.11);
          setTimeout(() => ctx.close(), 120);
        }, type === "win" ? 250 : 110);
      } catch (_) {
        // Ignore errors if AudioContext fails
      }
    },
    [soundEnabled]
  );

  // Resets game to start
  const resetGame = useCallback(() => {
    setGameStatus("playing");
    // Frog starts at bottom center
    setFrog({
      x: Math.floor(cols / 2),
      y: NUM_LANES,
    });
    // Make cars: Each lane gets cars at even intervals, direction alternates
    setCars(() => {
      let arr = [];
      for (let lane = 0; lane < NUM_LANES; lane++) {
        let dir = lane % 2 === 0 ? 1 : -1;
        for (let i = 0; i < CARS_PER_LANE; i++) {
          arr.push({
            id: lane * 10 + i,
            lane,
            x:
              (i * 0.5 + (Math.random() * 0.5)) *
                (cols - 1) *
                dir +
              (dir === 1 ? 0 : cols - 1),
            speed:
              (1 + Math.random() * 0.4) *
              (1.2 + lane * 0.2) *
              dir,
            color:
              lane === 0
                ? COLORS.carRed
                : lane === 1
                ? COLORS.carBlue
                : lane === 2
                ? COLORS.carYellow
                : COLORS.carPurple,
          });
        }
      }
      return arr;
    });
    playSound("hop");
  }, [playSound]);

  // Responsive sizing: fit everything and keep aspect ratio
  useEffect(() => {
    function handleResize() {
      const maxW = Math.min(window.innerWidth, 480);
      const maxH = Math.max(Math.min(window.innerHeight * 0.78, 680), 320);
      // Columns = 7 cells wide + padding
      let w = Math.floor(maxW - 20);
      let laneW = LANE_WIDTH * cols;
      if (w > laneW + 40) w = laneW + 40;
      let h =
        NUM_LANES * LANE_HEIGHT +
        2 * LANE_MARGIN +
        FROG_SIZE +
        52;
      if (h > maxH) h = maxH;
      setCanvasWidth(w);
      setCanvasHeight(h);
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line
  }, []);

  // Layout math
  const cols = 7;
  // For responsive drawing, we want each cell = laneHeight x laneWidth

  // Advance car positions, collision, win/lose, etc
  useEffect(() => {
    if (gameStatus !== "playing") return;
    let stopped = false;

    function step() {
      if (stopped) return;

      setCars((currentCars) => {
        // advance each car
        return currentCars.map((car) => {
          let newX = car.x + car.speed * 0.11;
          // Off-road wrap
          if (car.speed > 0 && newX > cols - 0.2)
            newX = -1;
          else if (car.speed < 0 && newX < -1)
            newX = cols - 0.2;
          return { ...car, x: newX };
        });
      });

      // Check collision after cars update
      setFrog((currFrog) => {
        if (currFrog.y < 1) return currFrog; // top row == win zone
        let lane = currFrog.y - 1;
        for (let car of cars) {
          if (car.lane !== lane) continue;
          let frogX = currFrog.x;
          let carX = Math.round(car.x);
          // If frog's x matches car cell, check for overlap
          if (
            Math.abs(frogX - car.x) < 0.7 // allow partial col overlap
          ) {
            setGameStatus("lose");
            playSound("lose");
            // Save highscore if needed
            setHigh((h) => {
              if (score > h) {
                try {
                  localStorage.setItem("frog_high", String(score));
                } catch {}
                return score;
              }
              return h;
            });
            stopped = true;
            return currFrog;
          }
        }
        // Win check
        if (currFrog.y === 0) {
          setGameStatus("win");
          setScore((s) => {
            const ns = s + 1;
            setHigh((h) => {
              if (ns > h) {
                try {
                  localStorage.setItem("frog_high", String(ns));
                } catch {}
                return ns;
              }
              return h;
            });
            return ns;
          });
          playSound("win");
          stopped = true;
        }
        return currFrog;
      });
    }

    let interval = setInterval(step, 55);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [gameStatus, cars, playSound, score]);

  // Handle keyboard controls
  useEffect(() => {
    if (gameStatus !== "playing") return;

    function onKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
        keysPressed.current[e.key] = true;
        handleMove(e.key);
        e.preventDefault();
      }
    }
    function onKeyUp(e) {
      if (Object.keys(keysPressed.current).includes(e.key))
        keysPressed.current[e.key] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line
  }, [gameStatus, frog]);

  // Keyboard/touch movement
  const handleMove = (dir) => {
    setFrog((f) => {
      let x = f.x, y = f.y;
      if (["ArrowUp", "w"].includes(dir)) y--;
      if (["ArrowDown", "s"].includes(dir)) y++;
      if (["ArrowLeft", "a"].includes(dir)) x--;
      if (["ArrowRight", "d"].includes(dir)) x++;
      // clamp
      x = Math.max(0, Math.min(cols - 1, x));
      y = Math.max(0, Math.min(NUM_LANES, y));
      if (x === f.x && y === f.y) return f;
      playSound("hop");
      return { x, y };
    });
  };

  // Touch controls for mobile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let touchStart = null;
    const handleTouchStart = (e) => {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    };
    const handleTouchEnd = (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      let dx = t.clientX - touchStart.x;
      let dy = t.clientY - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        // horizontal swipe
        if (dx > 24) handleMove("ArrowRight");
        else if (dx < -24) handleMove("ArrowLeft");
      } else {
        if (dy > 24) handleMove("ArrowDown");
        else if (dy < -24) handleMove("ArrowUp");
      }
      touchStart = null;
    };
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      if (canvas) {
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchend", handleTouchEnd);
      }
    };
    // eslint-disable-next-line
  }, [canvasRef, gameStatus]);

  // Draw everything on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw roads/lanes
    for (let lane = 0; lane < NUM_LANES; lane++) {
      const yTop =
        LANE_MARGIN +
        lane * LANE_HEIGHT;
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(
        0,
        yTop,
        canvasWidth,
        LANE_HEIGHT
      );
      // Lane border line
      ctx.strokeStyle = COLORS.laneBorder;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, yTop + LANE_HEIGHT);
      ctx.lineTo(canvasWidth, yTop + LANE_HEIGHT);
      ctx.stroke();
    }
    // Draw finish (the grass)
    ctx.fillStyle = COLORS.primary;
    ctx.fillRect(
      0,
      0,
      canvasWidth,
      LANE_MARGIN
    );
    // Draw sidewalk/start
    ctx.fillStyle = "#666";
    ctx.fillRect(
      0,
      canvasHeight - (LANE_MARGIN + FROG_SIZE / 2),
      canvasWidth,
      LANE_MARGIN + FROG_SIZE / 2
    );
    // Draw cars
    for (let car of cars) {
      const laneTop =
        LANE_MARGIN +
        car.lane * LANE_HEIGHT;
      const cellW = canvasWidth / cols;
      const carX = car.x * cellW + (cellW - CAR_WIDTH) / 2;
      const carY =
        laneTop + (LANE_HEIGHT - CAR_HEIGHT) / 2;
      ctx.fillStyle = car.color;
      ctx.strokeStyle = "#fff7";
      ctx.lineWidth = 2;
      ctx.fillRect(carX, carY, CAR_WIDTH, CAR_HEIGHT);
      ctx.strokeRect(carX, carY, CAR_WIDTH, CAR_HEIGHT);
      // Headlights/taillights
      ctx.fillStyle = "#fff";
      if (car.speed > 0) {
        ctx.fillRect(carX + CAR_WIDTH - 8, carY + 7, 6, 8);
        ctx.fillRect(carX + CAR_WIDTH - 8, carY + CAR_HEIGHT - 15, 6, 8);
      } else {
        ctx.fillRect(carX + 2, carY + 7, 6, 8);
        ctx.fillRect(carX + 2, carY + CAR_HEIGHT - 15, 6, 8);
      }
      // Windshield
      ctx.fillStyle = "#ddd";
      ctx.fillRect(carX + (car.speed > 0 ? 7 : CAR_WIDTH - 14), carY + 8, 12, 20);
      // Wheels
      ctx.fillStyle = "#111";
      ctx.fillRect(carX + 8, carY + 2, 8, 6);
      ctx.fillRect(carX + CAR_WIDTH - 16, carY + 2, 8, 6);
      ctx.fillRect(carX + 8, carY + CAR_HEIGHT - 8, 8, 6);
      ctx.fillRect(carX + CAR_WIDTH - 16, carY + CAR_HEIGHT - 8, 8, 6);
    }
    // Draw frog
    const frogCellW = canvasWidth / cols;
    const fx = frog.x * frogCellW + (frogCellW - FROG_SIZE) / 2;
    const fy =
      LANE_MARGIN +
      frog.y * LANE_HEIGHT +
      (LANE_HEIGHT - FROG_SIZE) / 2;
    if (gameStatus !== "waiting") {
      // Frog body
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        fx + FROG_SIZE / 2,
        fy + FROG_SIZE / 2,
        FROG_SIZE / 2,
        FROG_SIZE / 2.4,
        0,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = COLORS.frog;
      ctx.globalAlpha = 0.98;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Eyes
      ctx.beginPath();
      ctx.arc(fx + FROG_SIZE * 0.28, fy + FROG_SIZE * 0.24, 5, 0, 2 * Math.PI);
      ctx.arc(fx + FROG_SIZE * 0.72, fy + FROG_SIZE * 0.24, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(fx + FROG_SIZE * 0.28, fy + FROG_SIZE * 0.25, 2, 0, 2 * Math.PI);
      ctx.arc(fx + FROG_SIZE * 0.72, fy + FROG_SIZE * 0.25, 2, 0, 2 * Math.PI);
      ctx.fillStyle = "#222";
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.arc(fx + FROG_SIZE * 0.5, fy + FROG_SIZE * 0.55, 7, 0, Math.PI, false);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1.7;
      ctx.stroke();
      ctx.restore();
    }
    // Results overlay
    if (["win", "lose", "waiting"].includes(gameStatus)) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle =
        gameStatus === "win"
          ? COLORS.win
          : gameStatus === "lose"
          ? COLORS.lose
          : "#232323aa";
      ctx.fillRect(36, canvasHeight / 2 - 70, canvasWidth - 72, 110);
      ctx.globalAlpha = 1.0;
      ctx.font = "bold 2.1rem Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(
        gameStatus === "win"
          ? "You Win!"
          : gameStatus === "lose"
          ? "Oops! Hit!"
          : "Frog Street Crossing",
        canvasWidth / 2,
        canvasHeight / 2 - 20
      );
      ctx.font = "1.1rem Arial, sans-serif";
      ctx.fillStyle = COLORS.text;
      ctx.fillText(
        gameStatus === "win"
          ? "Good job, Frog! Tap/click or press Enter to try again."
          : gameStatus === "lose"
          ? "Car collided! Tap/click or press Enter to restart."
          : "Get the frog to the top! Use ⬆️⬇️⬅️➡️ or swipe.",
        canvasWidth / 2,
        canvasHeight / 2 + 16
      );
      ctx.font = "1.2rem Arial, sans-serif";
      if (gameStatus !== "waiting")
        ctx.fillText(
          `Current Score: ${score} | High: ${high}`,
          canvasWidth / 2,
          canvasHeight / 2 + 44
        );
      ctx.restore();
    }
    // Score UI overlay
    ctx.save();
    ctx.font = "bold 1.1rem Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.score;
    ctx.fillText(`Score: ${score}`, 14, 26);
    ctx.textAlign = "right";
    ctx.fillText(
      gameStatus === "playing" ? "🟩 To Grass!" : "",
      canvasWidth - 14,
      26
    );
    ctx.restore();
    // Controls reminders for mobile
    if (window.innerWidth < 700 && ["playing"].includes(gameStatus)) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.font = "bold 1rem Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.secondary;
      ctx.fillText(
        "Swipe: move  🟢",
        canvasWidth / 2,
        canvasHeight - 20
      );
      ctx.restore();
    }
  }, [
    cars,
    frog,
    gameStatus,
    canvasWidth,
    canvasHeight,
    high,
    score,
    theme,
    COLORS,
    NUM_LANES,
    cols,
  ]);

  // Handle click/tap or Enter to start/restart
  const handleCanvasClick = () => {
    if (["win", "lose", "waiting"].includes(gameStatus)) {
      resetGame();
    }
  };
  useEffect(() => {
    const handleEnter = (e) => {
      if (
        ["Enter", " "].includes(e.key) &&
        ["win", "lose", "waiting"].includes(gameStatus)
      ) {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
    // eslint-disable-next-line
  }, [gameStatus]);

  // Initialize game on mount
  useEffect(() => {
    setFrog({
      x: Math.floor(cols / 2),
      y: NUM_LANES,
    });
    setScore(0);
    setGameStatus("waiting");
  }, [cols]);

  // Sound toggle
  const handleSoundToggle = () => setSoundEnabled((s) => !s);

  // PUBLIC_INTERFACE
  return (
    <div className="App" style={{ backgroundColor: COLORS.primary, minHeight: "100vh" }}>
      <header className="App-header" style={{ background: theme === "light" ? COLORS.secondary : COLORS.road }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          tabIndex={0}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <button
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: COLORS.accent,
            border: "none",
            color: "#222",
            borderRadius: 8,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            zIndex: 15,
            opacity: soundEnabled ? 0.94 : 0.62,
            outline: 0,
          }}
          onClick={handleSoundToggle}
          aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
        >
          {soundEnabled ? "🔊 Sound" : "🔇 Muted"}
        </button>
        <div style={{ width: canvasWidth, margin: "0 0 10px 0", position: "relative" }}>
          <canvas
            id="game-canvas"
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            tabIndex={0}
            style={{
              background: COLORS.secondary,
              boxShadow: `0 2px 16px ${theme === "dark" ? "#060d" : "#b1b1b176"}`,
              borderRadius: 18,
              marginTop: 34,
              border: `3px solid ${COLORS.accent}`,
              display: "block",
              maxWidth: "100%",
              outline: 0,
              touchAction: "none",
              cursor: ["win", "lose", "waiting"].includes(gameStatus)
                ? "pointer"
                : "default",
            }}
            onClick={handleCanvasClick}
            onTouchStart={e => e.target.focus()}
            aria-label="Frog Street Crossing game area"
          />
        </div>
        <div
          className="controls"
          style={{
            width: canvasWidth,
            margin: "0 auto",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
            marginBottom: 7,
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 15 }}>
            Score: <span style={{ color: COLORS.score }}>{score}</span>
          </div>
          <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 15 }}>
            High: <span style={{ color: COLORS.accent }}>{high}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#fff", marginTop: 12, opacity: 0.88, maxWidth: canvasWidth }}>
          <span role="img" aria-label="frog">
            🐸
          </span>{" "}
          Use keyboard arrows or swipe on the game! Avoid cars and reach the grass!
        </div>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 18, color: COLORS.accent, fontWeight: 600, fontSize: 16 }}
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
