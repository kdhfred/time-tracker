class TimeTracker {
  constructor() {
    this.shortcuts = new Map();
    this.currentSession = null;
    this.timer = null;
    this.startTime = null;
    this.isPaused = false;
    this.pausedTime = 0;
    this.isSettingsPanelOpen = false;
    this.showMilliseconds = false;
    this.pauseStartTime = null;
    this.pauseIntervals = [];
    this.isSessionLogExpanded = false;
    this.playSound = true;
    this.audioContext = null;
    this.loadSettings();

    this.loadShortcuts();
    this.setupEventListeners();
    this.updateDisplay();
    this.loadShortcutsFromUrl();
    this.loadSettings();
    this.updateShortcutsList();
    this.checkFirstVisit();
  }

  loadShortcuts() {
    const savedShortcuts = localStorage.getItem("shortcuts");
    if (savedShortcuts) {
      this.shortcuts = new Map(JSON.parse(savedShortcuts));
    }
  }

  saveShortcuts() {
    localStorage.setItem("shortcuts", JSON.stringify([...this.shortcuts]));
  }

  setupEventListeners() {
    document.addEventListener("keypress", (e) => {
      if (!this.isSettingsPanelOpen) {
        this.handleKeyPress(e);
      }
    });

    document.getElementById("shortcut-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.addShortcut();
    });

    document.getElementById("settings-toggle").addEventListener("click", () => {
      const settingsPanel = document.getElementById("settings-panel");
      const modalBackdrop = document.getElementById("modal-backdrop");
      settingsPanel.classList.toggle("show");
      modalBackdrop.classList.toggle("show");
      this.isSettingsPanelOpen = settingsPanel.classList.contains("show");
    });

    document
      .getElementById("shortcuts-container")
      .addEventListener("click", (e) => {
        const key = e.target.dataset.key;
        if (!key) return;

        if (e.target.classList.contains("delete-button")) {
          this.deleteShortcut(key);
        } else if (e.target.classList.contains("edit-button")) {
          this.editShortcut(key);
        }
      });

    document.getElementById("share-button").addEventListener("click", () => {
      const url = this.generateShareUrl();
      navigator.clipboard.writeText(url).then(() => {
        alert("URL이 클립보드에 복사되었습니다!");
      });
    });

    document.getElementById("pause-button").addEventListener("click", () => {
      this.togglePause();
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePause();
      }
    });

    document.getElementById("clear-sessions").addEventListener("click", () => {
      this.clearAllSessions();
    });

    document
      .getElementById("show-milliseconds")
      .addEventListener("change", (e) => {
        this.showMilliseconds = e.target.checked;
        localStorage.setItem("showMilliseconds", this.showMilliseconds);
      });

    document.getElementById("modal-backdrop").addEventListener("click", () => {
      const settingsPanel = document.getElementById("settings-panel");
      const modalBackdrop = document.getElementById("modal-backdrop");
      settingsPanel.classList.remove("show");
      modalBackdrop.classList.remove("show");
      this.isSettingsPanelOpen = false;
    });

    document.getElementById("settings-panel").addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.getElementById("session-log").addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-session")) {
        const index = parseInt(e.target.dataset.index);
        this.deleteSession(index);
      }
    });

    document.getElementById('help-button').addEventListener('click', () => {
        this.showWelcomeModal();
    });

    document.getElementById('toggle-sessions').addEventListener('click', () => {
        this.toggleSessionLog();
    });

    document.getElementById("play-sound").addEventListener("change", (e) => {
      this.playSound = e.target.checked;
      localStorage.setItem("playSound", this.playSound);
      
      if (this.playSound) {
        this.createBeep();
      }
    });

    document.getElementById("test-sound").addEventListener("click", () => {
      if (this.playSound) {
        this.createBeep();
      }
    });
  }

  addShortcut() {
    const shortcut = document.getElementById("shortcut").value.toLowerCase();

    if (shortcut === " ") {
      alert("스페이스바는 단축키로 설정할 수 없습니다.");
      return;
    }

    const category = document.getElementById("category").value;
    const timerInput = document.getElementById("timer").value;
    const timer = timerInput === "" ? 0 : parseInt(timerInput);

    this.shortcuts.set(shortcut, { category, timer });
    this.saveShortcuts();
    this.updateShortcutsList();

    document.getElementById("shortcut-form").reset();
  }

  handleKeyPress(e) {
    const key = e.key.toLowerCase();
    if (this.shortcuts.has(key)) {
      this.startSession(key);
    }
  }

  startSession(key) {
    if (this.currentSession) {
      this.endSession();
    }

    const { category, timer } = this.shortcuts.get(key);
    this.currentSession = { category, startTime: new Date(), timer };
    this.startTime = new Date();
    this.isPaused = false;
    this.pausedTime = 0;

    document.getElementById("current-category").textContent = category;

    const pauseButton = document.getElementById("pause-button");
    pauseButton.disabled = false;
    pauseButton.textContent = "일시정지";
    pauseButton.classList.remove("paused");

    if (timer > 0) {
      this.startTimer(timer * 60);
    } else {
      this.startStopwatch();
    }
  }

  endSession() {
    if (!this.currentSession) return;

    const endTime = new Date();
    let duration;

    if (this.isPaused) {
      duration = this.pausedTime / 1000;
    } else {
      duration = (endTime - this.currentSession.startTime) / 1000;
    }

    this.saveSession({
      category: this.currentSession.category,
      startTime: this.currentSession.startTime,
      endTime: endTime,
      duration: duration,
    });

    this.currentSession = null;
    this.isPaused = false;
    this.pausedTime = 0;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const pauseButton = document.getElementById("pause-button");
    pauseButton.disabled = true;
    pauseButton.textContent = "일시정지";
    pauseButton.classList.remove("paused");
  }

  startTimer(seconds) {
    let remaining = seconds;
    this.updateTimerDisplay(remaining);

    this.timer = setInterval(() => {
      remaining--;
      this.updateTimerDisplay(remaining);

      if (remaining <= 0) {
        if (this.playSound) {
          this.createBeep();
        }
        this.endSession();
        this.updateDisplay();
      }
    }, 1000);
  }

  startStopwatch() {
    this.timer = setInterval(
      () => {
        const elapsed = (new Date() - this.startTime) / 1000;
        this.updateTimerDisplay(elapsed);
      },
      this.showMilliseconds ? 100 : 1000
    );
  }

  updateTimerDisplay(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);

    const display = this.showMilliseconds
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
          s
        ).padStart(2, "0")}.${ms}`
      : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
          s
        ).padStart(2, "0")}`;

    document.getElementById("time").textContent = display;

    const currentCategory =
      document.getElementById("current-category").textContent;
    if (currentCategory === "카테고리를 택하세요") {
      document.title = `${display} - 사용 시간 측정기`;
    } else {
      document.title = `${display} - ${currentCategory}`;
    }
  }

  saveSession(session) {
    let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("sessions", JSON.stringify(sessions));
    this.updateDisplay();
  }

  updateDisplay() {
    let display;
    if (this.currentSession) {
      const currentTime = this.isPaused
        ? this.pausedTime
        : new Date() - this.startTime;
      const seconds = Math.floor(currentTime / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      display = `${String(h).padStart(2, "0")}:${String(m).padStart(
        2,
        "0"
      )}:${String(s).padStart(2, "0")}`;
    } else {
      display = "00:00:00";
    }

    document.getElementById("time").textContent = display;

    const currentCategory =
      document.getElementById("current-category").textContent;
    if (currentCategory === "카테고리를 선택하세요") {
      document.title = `${display} - 사용 시 측정기`;
    } else {
      document.title = `${display} - ${currentCategory}`;
    }

    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    const reversedSessions = [...sessions].reverse();

    const sessionLogHeader = document.querySelector('.session-log-header h2');
    sessionLogHeader.textContent = `세션 기록 (${sessions.length})`;

    const sessionLog = document.getElementById("session-log");
    sessionLog.innerHTML = "";
    
    if (!this.isSessionLogExpanded) {
      sessionLog.classList.remove('expanded');
      document.querySelector('.toggle-icon').style.transform = 'rotate(-90deg)';
    }

    const categoryList = document.getElementById("category-list");
    categoryList.innerHTML = "";

    const categoryShortcuts = new Map();
    this.shortcuts.forEach((value, key) => {
      categoryShortcuts.set(value.category, key);
    });

    const allCategories = new Map();
    this.shortcuts.forEach(({category}) => {
      allCategories.set(category, 0);
    });

    sessions.forEach((session) => {
      const current = allCategories.get(session.category) || 0;
      allCategories.set(session.category, current + session.duration);
    });

    allCategories.forEach((totalSeconds, category) => {
      const div = document.createElement("div");
      div.className = "session category-item";
      
      const shortcutKey = categoryShortcuts.get(category);
      const shortcutBadge = shortcutKey ? 
        `<span class="shortcut-badge">${shortcutKey}</span>` : '';

      div.innerHTML = `
        <h3>${category}</h3>
        <p>${this.formatTime(totalSeconds)}</p>
        ${shortcutBadge}
      `;

      if (shortcutKey) {
        div.addEventListener('click', () => {
          this.startSession(shortcutKey);
        });
      }

      categoryList.appendChild(div);
    });

    reversedSessions.forEach((session, displayIndex) => {
      const div = document.createElement("div");
      div.className = "session-entry";
      const startDate = new Date(session.startTime);
      const endDate = new Date(session.endTime);

      const formatTimeString = (date) => {
        return date.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      };

      const startTime = formatTimeString(startDate);
      const endTime = formatTimeString(endDate);

      const totalTimeSeconds = (endDate - startDate) / 1000;
      const activeTimeSeconds = session.duration;
      const pausedTimeSeconds = totalTimeSeconds - activeTimeSeconds;

      let pauseDetails = "";
      if (pausedTimeSeconds > 0) {
        const pauseMinutes = Math.floor(pausedTimeSeconds / 60);
        const pauseSeconds = Math.floor(pausedTimeSeconds % 60);
        pauseDetails = `<span class="paused-time">
                    (일시정지: ${pauseMinutes}분 ${pauseSeconds}초)
                </span>`;
      }

      div.innerHTML = `
                <div class="session-header">
                    <div class="time">
                        ${startDate.toLocaleDateString()} 
                        <br>
                        ${startTime} - ${endTime}
                        ${pauseDetails}
                    </div>
                    <button class="button button-danger delete-session" data-index="${
                      sessions.length - 1 - displayIndex
                    }">삭제</button>
                </div>
                <div>${session.category}</div>
                <div class="duration">${this.formatTime(session.duration)}</div>
            `;
      sessionLog.appendChild(div);
    });
  }

  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}시간 ${m}분 ${s}초`;
  }

  loadShortcutsFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const shortcutsParam = urlParams.get("shortcuts");

    if (shortcutsParam) {
      try {
        const decodedData = decodeURIComponent(atob(shortcutsParam));
        const shortcuts = new Map(JSON.parse(decodedData));
        this.shortcuts = shortcuts;
        this.saveShortcuts();
        this.updateShortcutsList();
      } catch (e) {
        console.error("URL 파라미터 처리 중 오류 발생:", e);
      }
    }
  }

  generateShareUrl() {
    try {
      const shortcutsArray = Array.from(this.shortcuts.entries());
      const shortcutsData = JSON.stringify(shortcutsArray);
      const encodedData = btoa(encodeURIComponent(shortcutsData));
      const url = `${window.location.origin}${window.location.pathname}?shortcuts=${encodedData}`;
      return url;
    } catch (e) {
      console.error("URL 생성 중 오류 발생:", e);
      return window.location.href;
    }
  }

  updateShortcutsList() {
    const container = document.getElementById("shortcuts-container");
    container.innerHTML = "";

    this.shortcuts.forEach((value, key) => {
      const item = document.createElement("div");
      item.className = "shortcut-item";
      item.innerHTML = `
                <div class="shortcut-info">
                    <strong>${key}</strong> → ${value.category} 
                    ${value.timer > 0 ? `(${value.timer}분)` : "(스톱워치)"}
                </div>
                <div class="shortcut-actions">
                    <button class="button button-primary edit-button" data-key="${key}">수정</button>
                    <button class="button button-danger delete-button" data-key="${key}">삭제</button>
                </div>
            `;
      container.appendChild(item);
    });
  }

  deleteShortcut(key) {
    this.shortcuts.delete(key);
    this.saveShortcuts();
    this.updateShortcutsList();
  }

  editShortcut(key) {
    const shortcut = this.shortcuts.get(key);
    document.getElementById("shortcut").value = key;
    document.getElementById("category").value = shortcut.category;
    document.getElementById("timer").value = shortcut.timer || "";
    this.deleteShortcut(key);
  }

  togglePause() {
    if (!this.currentSession) return;

    this.isPaused = !this.isPaused;
    const pauseButton = document.getElementById("pause-button");

    if (this.isPaused) {
      clearInterval(this.timer);
      this.pausedTime = new Date() - this.startTime;
      this.pauseStartTime = new Date();
      pauseButton.textContent = "재개";
      pauseButton.classList.add("button-success");
      pauseButton.classList.remove("button-primary");
    } else {
      if (this.pauseStartTime) {
        this.pauseIntervals.push({
          start: this.pauseStartTime,
          end: new Date(),
        });
      }
      this.startTime = new Date() - this.pausedTime;
      if (this.currentSession.timer > 0) {
        const remainingTime = Math.max(
          0,
          this.currentSession.timer * 60 - this.pausedTime / 1000
        );
        this.startTimer(remainingTime);
      } else {
        this.startStopwatch();
      }
      pauseButton.textContent = "일시정지";
      pauseButton.classList.add("button-primary");
      pauseButton.classList.remove("button-success");
    }
  }

  clearAllSessions() {
    if (
      confirm(
        "모든 세션 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다."
      )
    ) {
      localStorage.removeItem("sessions");
      this.updateDisplay();
    }
  }

  loadSettings() {
    const showMilliseconds = localStorage.getItem("showMilliseconds");
    if (showMilliseconds !== null) {
      this.showMilliseconds = showMilliseconds === "true";
      document.getElementById("show-milliseconds").checked =
        this.showMilliseconds;
    }

    const playSound = localStorage.getItem("playSound");
    if (playSound !== null) {
      this.playSound = playSound === "true";
      document.getElementById("play-sound").checked = this.playSound;
    }
  }

  deleteSession(index) {
    let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    if (confirm("이 세션�� 삭제하시겠습니까?")) {
      sessions.splice(index, 1);
      localStorage.setItem("sessions", JSON.stringify(sessions));
      this.updateDisplay();
    }
  }

  checkFirstVisit() {
    if (!localStorage.getItem('hasVisited')) {
        this.showWelcomeModal();
    }
  }

  showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    modal.classList.add('show');

    const closeButton = document.getElementById('welcome-close');
    const confirmButton = document.getElementById('welcome-confirm');

    const closeModal = () => {
        modal.classList.remove('show');
        if (!localStorage.getItem('hasVisited')) {
            localStorage.setItem('hasVisited', 'true');
        }
    };

    closeButton.removeEventListener('click', closeModal);
    confirmButton.removeEventListener('click', closeModal);
    
    closeButton.addEventListener('click', closeModal);
    confirmButton.addEventListener('click', closeModal);

    const modalClickHandler = (e) => {
        if (e.target === modal) {
            alert('설명서를 끝까지 읽어주세요! 우측 상단의 X 버튼이나 하단의 확인 버튼을 눌러주세요.');
        }
    };

    modal.removeEventListener('click', modalClickHandler);
    modal.addEventListener('click', modalClickHandler);

    const contentClickHandler = (e) => {
        e.stopPropagation();
    };

    const welcomeContent = modal.querySelector('.welcome-content');
    welcomeContent.removeEventListener('click', contentClickHandler);
    welcomeContent.addEventListener('click', contentClickHandler);
  }

  toggleSessionLog() {
    const sessionLog = document.getElementById('session-log');
    const toggleIcon = document.querySelector('.toggle-icon');
    this.isSessionLogExpanded = !this.isSessionLogExpanded;
    
    if (this.isSessionLogExpanded) {
      sessionLog.classList.add('expanded');
      toggleIcon.style.transform = 'rotate(0deg)';
    } else {
      sessionLog.classList.remove('expanded');
      toggleIcon.style.transform = 'rotate(-90deg)';
    }
  }

  createBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const beepDuration = 0.2; // 각 비프음의 길이
      const beepInterval = 0.3; // 비프음 사이의 간격
      const beepCount = 3; // 비프음 횟수
      
      for (let i = 0; i < beepCount; i++) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime + (i * beepInterval));
        
        // 각 비프음의 볼륨 제어
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + (i * beepInterval));
        gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + (i * beepInterval) + 0.02);
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime + (i * beepInterval) + beepDuration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + (i * beepInterval) + beepDuration);
        
        oscillator.start(this.audioContext.currentTime + (i * beepInterval));
        oscillator.stop(this.audioContext.currentTime + (i * beepInterval) + beepDuration);
      }
    } catch (error) {
      console.error('오디오 재생 중 오류 발생:', error);
    }
  }
}

const tracker = new TimeTracker();
