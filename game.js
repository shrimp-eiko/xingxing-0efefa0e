(() => {
  "use strict";

  const config = window.GAME_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const state = {
    fragments: 0,
    currentLevel: 0,
    audioStarted: false,
    audioFallbackTried: false,
    selectedPeople: new Set(),
    memoryLocked: false,
    firstCard: null
  };

  const screens = {
    intro: $("#screen-intro"),
    "level-1": $("#screen-level-1"),
    "level-2": $("#screen-level-2"),
    "level-3": $("#screen-level-3"),
    "level-4": $("#screen-level-4"),
    "level-5": $("#screen-level-5"),
    final: $("#screen-final")
  };

  const bgm = $("#bgm");
  const fragments = $$("#fragments i");

  function showScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      screen.classList.toggle("active", key === name);
      if (key === name) screen.scrollTop = 0;
    });
    $("#topbar").classList.toggle("hidden", name === "intro");
    document.body.dataset.screen = name;
  }

  function collectFragment(index) {
    state.fragments = Math.max(state.fragments, index);
    fragments.forEach((dot, dotIndex) => {
      dot.classList.toggle("collected", dotIndex < state.fragments);
    });
  }

  function setLevel(index) {
    state.currentLevel = Math.max(state.currentLevel, index);
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));
    setTimeout(() => {
      node.classList.remove("show");
      setTimeout(() => node.remove(), 350);
    }, 1600);
  }

  let audioContext;

  function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playTone(frequency = 660, duration = 0.13, type = "sine", volume = 0.025) {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }

  function playSuccess() {
    playTone(523, 0.16, "sine", 0.026);
    setTimeout(() => playTone(659, 0.16, "sine", 0.024), 100);
    setTimeout(() => playTone(784, 0.24, "sine", 0.022), 200);
  }

  function tryPlayBgm() {
    if (state.audioStarted) return;
    state.audioStarted = true;

    const sources = config.bgmSources || [];
    let index = 0;

    const playNext = () => {
      if (index >= sources.length) {
        state.audioFallbackTried = true;
        return;
      }

      const source = sources[index++];
      bgm.src = source;
      const attempt = bgm.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {
          setTimeout(playNext, 120);
        });
      }
    };

    bgm.addEventListener("error", playNext);
    bgm.addEventListener("canplay", () => {
      const attempt = bgm.play();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
    }, { once: true });

    playNext();
  }

  function initStars() {
    const canvas = $("#starCanvas");
    const context = canvas.getContext("2d");
    let stars = [];
    let raf = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const count = Math.max(65, Math.floor((rect.width * rect.height) / 6500));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        radius: Math.random() * 1.15 + 0.25,
        alpha: Math.random() * 0.55 + 0.18,
        speed: Math.random() * 0.012 + 0.004,
        phase: Math.random() * Math.PI * 2
      }));
    }

    function draw(time) {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
      stars.forEach((star) => {
        const shimmer = Math.sin(time * star.speed + star.phase) * 0.22;
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 250, 225, ${Math.max(0.08, star.alpha + shimmer)})`;
        context.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    resize();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize, { passive: true });
  }

  function buildFireflies() {
    const field = $("#fireflyField");
    $$(".firefly", field).forEach((node) => node.remove());
    const positions = [
      [17, 17], [39, 26], [67, 15], [82, 42], [63, 53],
      [28, 57], [48, 42]
    ];

    positions.forEach(([x, y], index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "firefly";
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
      button.style.animationDelay = `${index * -0.22}s`;
      button.setAttribute("aria-label", `点亮第 ${index + 1} 只萤火虫`);
      button.addEventListener("click", () => {
        if (button.classList.contains("collected")) return;
        button.classList.add("collected");
        playTone(720 + index * 45, 0.11, "sine", 0.02);
        const left = positions.length - $$(".firefly.collected", field).length;
        $("#level1Hint").textContent = left > 0 ? `还没有点亮：${left}` : "七只萤火虫都亮了。";
        if (left === 0) {
          collectFragment(1);
          $("#screen-level-1 .next-button").disabled = false;
          playSuccess();
        }
      });
      field.appendChild(button);
    });
  }

  function initTrainLevel() {
    const trainWindow = $("#trainWindow");
    const actionButton = $("#trainAction");
    const caption = $("#trainCaption");
    const stateLabel = $("#trainState");
    const cityLabel = $("#trainCity");
    const memoryLabel = $("#trainMemory");
    const hint = $("#level2Hint");
    const ticketRail = $("#ticketRail");
    const rainLayer = $("#rainLayer");
    const scenes = $$(".scene", trainWindow);
    const nextButton = $("#screen-level-2 .next-button");
    const cities = config.cities;
    const lastStation = cities.length - 1;

    let stationIndex = 0;
    let arrived = false;
    let transitioning = false;
    let dragging = false;
    let dragStartX = 0;
    let rainProgress = 0;
    let holding = false;
    let holdFrame = 0;
    let holdStart = 0;
    let holdProgress = 0;

    for (let index = 0; index < 28; index += 1) {
      const drop = document.createElement("i");
      drop.style.left = `${-5 + Math.random() * 110}%`;
      drop.style.top = `${-22 - Math.random() * 32}%`;
      drop.style.setProperty("--rain-speed", `${0.55 + Math.random() * 0.62}s`);
      drop.style.setProperty("--rain-delay", `${-Math.random() * 1.3}s`);
      rainLayer.appendChild(drop);
    }

    const tickets = cities.map((city, index) => {
      const ticket = document.createElement("div");
      ticket.className = "ticket";
      ticket.dataset.index = String(index);
      ticket.innerHTML = `<span>${city.name}</span><small>羊羊子 → 杏杏子</small>`;
      ticketRail.appendChild(ticket);
      return ticket;
    });

    function pulseCaption() {
      caption.classList.remove("pop");
      requestAnimationFrame(() => caption.classList.add("pop"));
    }

    function setCaption(state, city, memory) {
      stateLabel.textContent = state;
      cityLabel.textContent = city.name;
      memoryLabel.textContent = memory;
      pulseCaption();
    }

    function stopHolding(reset = false) {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(holdFrame);
      if (reset && holdProgress < 1) {
        holdProgress = 0;
        trainWindow.style.setProperty("--hold", "0");
      }
    }

    function arrive() {
      if (arrived || transitioning) return;
      arrived = true;
      trainWindow.classList.add("arrived");
      rainLayer.classList.remove("active");
      stopHolding();

      const city = cities[stationIndex];
      tickets[stationIndex].classList.add("collected");
      setCaption("已到站", city, city.memory);
      hint.textContent = `已到站：${stationIndex + 1} / ${cities.length}`;
      playSuccess();

      actionButton.classList.remove("hidden");
      actionButton.disabled = stationIndex === lastStation;
      actionButton.textContent = stationIndex === lastStation ? "三站都到了" : "继续出发";

      if (stationIndex === lastStation) {
        collectFragment(2);
        nextButton.disabled = false;
      }
    }

    function setStage(index) {
      stationIndex = index;
      arrived = false;
      transitioning = false;
      dragging = false;
      holding = false;
      rainProgress = 0;
      holdProgress = 0;
      cancelAnimationFrame(holdFrame);
      trainWindow.dataset.stage = String(index);
      trainWindow.classList.remove("arrived");
      trainWindow.style.setProperty("--hold", "0");
      scenes.forEach((scene, sceneIndex) => scene.classList.toggle("active", sceneIndex === index));

      const city = cities[index];
      actionButton.classList.remove("hidden");
      actionButton.disabled = false;

      if (index === 0) {
        rainLayer.classList.remove("active");
        setCaption("下一站", city, "点击车窗，让列车停一下。");
        actionButton.textContent = `停靠${city.name}`;
        hint.textContent = "列车正在驶入第一站";
        return;
      }

      if (index === 1) {
        rainProgress = 0;
        rainLayer.classList.add("active");
        rainLayer.style.setProperty("--rain-opacity", "1");
        actionButton.classList.add("hidden");
        setCaption("正在经过", city, "雨点落在了车窗上。");
        hint.textContent = "在车窗上左右滑动，擦开雨雾";
        return;
      }

      rainLayer.classList.remove("active");
      actionButton.classList.add("hidden");
      setCaption("列车正在减速", city, "按住车窗，让列车慢下来。");
      hint.textContent = "按住车窗，不要松手";
    }

    function startHold() {
      if (stationIndex !== lastStation || arrived || holding) return;
      holding = true;
      holdStart = performance.now();
      holdProgress = 0;

      const update = (time) => {
        if (!holding) return;
        holdProgress = Math.min(1, (time - holdStart) / 1350);
        trainWindow.style.setProperty("--hold", String(holdProgress * 100));
        if (holdProgress >= 1) {
          holding = false;
          arrive();
          return;
        }
        holdFrame = requestAnimationFrame(update);
      };

      holdFrame = requestAnimationFrame(update);
    }

    function finishPointer() {
      if (dragging) {
        dragging = false;
        if (rainProgress >= 0.72) arrive();
      }
      stopHolding(true);
    }

    actionButton.addEventListener("click", () => {
      if (arrived && stationIndex < lastStation) {
        setStage(stationIndex + 1);
        playTone(410, 0.18, "triangle", 0.018);
        return;
      }
      if (!arrived && stationIndex === 0) arrive();
    });

    trainWindow.addEventListener("click", () => {
      if (!arrived && stationIndex === 0) arrive();
    });

    trainWindow.addEventListener("pointerdown", (event) => {
      if (arrived || transitioning || event.button > 0) return;

      if (stationIndex === 1) {
        dragging = true;
        dragStartX = event.clientX;
        trainWindow.setPointerCapture?.(event.pointerId);
      }

      if (stationIndex === lastStation) {
        startHold();
        trainWindow.setPointerCapture?.(event.pointerId);
      }
    });

    trainWindow.addEventListener("pointermove", (event) => {
      if (!dragging || stationIndex !== 1) return;
      rainProgress = Math.max(rainProgress, Math.min(1, Math.abs(event.clientX - dragStartX) / 135));
      rainLayer.style.setProperty("--rain-opacity", String(Math.max(0.04, 1 - rainProgress * 0.96)));

      if (rainProgress >= 0.96) {
        dragging = false;
        arrive();
      }
    });

    trainWindow.addEventListener("pointerup", finishPointer);
    trainWindow.addEventListener("pointercancel", finishPointer);

    setStage(0);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[random]] = [copy[random], copy[index]];
    }
    return copy;
  }

  function buildMemoryGame() {
    const grid = $("#memoryGrid");
    const pairs = [
      { id: "sheep", icon: "🐑", label: "羊羊子" },
      { id: "shrimp", icon: "🦐", label: "杏杏子" },
      { id: "cities", icon: "🗺️", label: "走过的路" },
      { id: "song", icon: "🎵", label: "我们的歌" }
    ];
    const cards = shuffle([...pairs, ...pairs]);
    grid.innerHTML = "";
    state.memoryLocked = false;
    state.firstCard = null;
    let matched = 0;

    cards.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "memory-card";
      card.dataset.pair = item.id;
      card.innerHTML = `
        <span class="memory-card-inner">
          <span class="memory-face memory-front"></span>
          <span class="memory-face memory-back">
            <span class="memory-icon">${item.icon}</span>
            <small>${item.label}</small>
          </span>
        </span>
      `;

      card.addEventListener("click", () => {
        if (state.memoryLocked || card.classList.contains("matched") || card === state.firstCard) return;
        card.classList.add("flipped");
        playTone(610, 0.08, "triangle", 0.015);

        if (!state.firstCard) {
          state.firstCard = card;
          return;
        }

        const first = state.firstCard;
        const isMatch = first.dataset.pair === card.dataset.pair;
        state.firstCard = null;

        if (isMatch) {
          first.classList.add("matched");
          card.classList.add("matched");
          matched += 1;
          playTone(780, 0.12, "sine", 0.021);
          $("#level3Hint").textContent = `已配对：${matched} / ${pairs.length}`;

          if (matched === pairs.length) {
            collectFragment(3);
            $("#screen-level-3 .next-button").disabled = false;
            $("#secretReveal").classList.add("show");
            playSuccess();
          }
          return;
        }

        state.memoryLocked = true;
        setTimeout(() => {
          first.classList.remove("flipped");
          card.classList.remove("flipped");
          state.memoryLocked = false;
        }, 720);
      });

      grid.appendChild(card);
    });
  }

  function initRecordLevel() {
    const lines = $$("#recordLines p");
    const vinyl = $("#vinyl");
    let clicked = 0;

    vinyl.addEventListener("click", () => {
      if (clicked >= lines.length) {
        vinyl.classList.toggle("playing");
        return;
      }
      lines[clicked].classList.add("show");
      clicked += 1;
      playTone(430 + clicked * 68, 0.14, "sine", 0.019);

      if (clicked === lines.length) {
        vinyl.classList.add("playing");
        collectFragment(4);
        $("#screen-level-4 .next-button").disabled = false;
        playSuccess();
      }
    });
  }

  function initFutureLevel() {
    const people = $$(".person-star");
    const hint = $("#level5Hint");
    const button = $("#futureButton");

    people.forEach((person) => {
      person.addEventListener("click", () => {
        const id = person.dataset.person;
        if (state.selectedPeople.has(id)) return;
        state.selectedPeople.add(id);
        person.classList.add("selected");
        playTone(id === "her" ? 690 : 560, 0.15, "sine", 0.021);
        hint.textContent = state.selectedPeople.size === 1 ? "再找到另一颗星" : "两颗星已经靠近了";

        if (state.selectedPeople.size === 2) {
          $(".future-map").classList.add("connected");
          button.disabled = false;
          playSuccess();
        }
      });
    });

    button.addEventListener("click", () => {
      if (button.disabled) return;
      collectFragment(5);
      setLevel(5);
      button.disabled = true;
      setTimeout(() => startFinal(), 550);
    });
  }

  function loadPhotos() {
    $$(".photo-strip img").forEach((image, index) => {
      const source = config.photos[index];
      if (!source) return;
      image.addEventListener("load", () => image.classList.add("loaded"), { once: true });
      image.addEventListener("error", () => image.remove(), { once: true });
      image.src = source;
    });
  }

  async function playFinalSequence() {
    const paragraphs = $$("#letterCard p");
    for (const paragraph of paragraphs) {
      paragraph.classList.add("show");
      await sleep(520);
    }
    const button = $("#revealButton");
    button.disabled = false;
    button.textContent = "看看羊羊子藏的话";
  }

  function startFinal() {
    showScreen("final");
    playFinalSequence();
  }

  function createConfetti() {
    const colors = ["#ff79ad", "#ffd98a", "#88dfff", "#b78cff", "#fff4f8"];
    for (let index = 0; index < 80; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--duration", `${2.5 + Math.random() * 2.2}s`);
      piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
      piece.style.setProperty("--spin", `${360 + Math.random() * 760}deg`);
      piece.style.animationDelay = `${Math.random() * 0.65}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 5600);
    }
  }

  function revealFinal() {
    $("#letterCard").style.maxHeight = "0px";
    $("#letterCard").style.opacity = "0";
    $("#revealButton").classList.add("hidden");
    $("#finalReveal").classList.add("show");
    playSuccess();
    createConfetti();
  }

  function answerFinal() {
    $("#answerMessage").classList.add("show");
    $$(".answer-button").forEach((button) => {
      button.disabled = true;
      button.style.opacity = ".55";
    });
    playTone(784, 0.3, "sine", 0.025);
    setTimeout(() => playTone(988, 0.5, "sine", 0.022), 180);
    createConfetti();
  }

  function bindNavigation() {
    $("#startButton").addEventListener("click", () => {
      tryPlayBgm();
      playTone(660, 0.18, "sine", 0.024);
      setLevel(1);
      showScreen("level-1");
    });

    $$(".next-button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;
        playTone(650, 0.13, "sine", 0.02);
        showScreen(`level-${button.dataset.next.split("-")[1]}`);
      });
    });

    $("#skipButton").addEventListener("click", () => {
      const confirmed = window.confirm("要直接去看最后的彩蛋吗？");
      if (!confirmed) return;
      state.fragments = 5;
      fragments.forEach((dot) => dot.classList.add("collected"));
      startFinal();
    });

    $("#revealButton").addEventListener("click", () => {
      if ($("#revealButton").disabled) return;
      revealFinal();
    });

    $$(".answer-button").forEach((button) => {
      button.addEventListener("click", answerFinal);
    });
  }

  function init() {
    initStars();
    buildFireflies();
    initTrainLevel();
    buildMemoryGame();
    initRecordLevel();
    initFutureLevel();
    loadPhotos();
    bindNavigation();
    showScreen("intro");
  }

  init();
})();
