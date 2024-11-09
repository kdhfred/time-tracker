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

    // 다크모드 관련 코드
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    // 저장된 테마 설정 불러오기
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
      darkModeToggle.checked = savedTheme === "dark";
    } else {
      // 시스템 설정에 따라 초기 테마 설정
      if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute("data-theme", "dark");
        darkModeToggle.checked = true;
      }
    }

    // 다크모드 토글 이벤트 리스너
    darkModeToggle.addEventListener("change", () => {
      const theme = darkModeToggle.checked ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);

      // 타이틀 업데이트 (타이머가 실행 중인 경우)
      if (currentTime) {
        updateTitle(formatTime(currentTime));
      }

      // 통계 차트가 열려있는 경우 업데이트
      if (document.getElementById("stats-modal").classList.contains("show")) {
        this.updateStatsChart();
      }
    });

    // 시스템 테마 변경 감지
    prefersDarkScheme.addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        const theme = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);
        darkModeToggle.checked = e.matches;

        // 통계 차트가 열려있는 경우 업데이트
        if (document.getElementById("stats-modal").classList.contains("show")) {
          this.updateStatsChart();
        }
      }
    });

    this.currentDate = new Date();
    this.currentDate.setHours(0, 0, 0, 0);

    document.getElementById("prev-date").addEventListener("click", () => {
      this.changeDate(-1);
    });

    document.getElementById("next-date").addEventListener("click", () => {
      this.changeDate(1);
    });

    // 통계 버튼 이벤트 리스너 추가
    document.getElementById("stats-button").addEventListener("click", () => {
      this.showStatsModal();
    });

    document.getElementById("stats-prev-date").addEventListener("click", () => {
      this.changeStatsDate(-1);
    });

    document.getElementById("stats-next-date").addEventListener("click", () => {
      this.changeStatsDate(1);
    });
  }

  changeDate(offset) {
    this.currentDate.setDate(this.currentDate.getDate() + offset);
    this.updateStatsDateDisplay();
    this.updateDisplay();
    // 통계 모달이 열려있는 경우 차트 업데이트
    if (document.getElementById("stats-modal").classList.contains("show")) {
      this.updateStatsChart();
    }
  }

  updateStatsDateDisplay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    let dateText = this.currentDate.toLocaleDateString('ko-KR', options);
    
    if (this.currentDate.getTime() === today.getTime()) {
      dateText = '오늘';
    } else if (this.currentDate.getTime() === today.getTime() - 86400000) {
      dateText = '어제';
    }
    
    document.getElementById("stats-current-date").textContent = dateText;
    document.getElementById("current-date").textContent = dateText;
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

    document.getElementById("help-button").addEventListener("click", () => {
      this.showWelcomeModal();
    });

    document.getElementById("toggle-sessions").addEventListener("click", () => {
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

    document.getElementById("export-csv").addEventListener("click", () => {
      this.exportSessionsToCSV();
    });

    document.getElementById("import-csv").addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        this.importSessionsFromCSV(e.target.files[0]);
        e.target.value = ''; // 파일 입력 초기화
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

    const sessionLogHeader = document.querySelector(".session-log-header h2");
    sessionLogHeader.textContent = `세션 기록 (${sessions.length})`;

    const sessionLog = document.getElementById("session-log");
    sessionLog.innerHTML = "";

    if (!this.isSessionLogExpanded) {
      sessionLog.classList.remove("expanded");
      document.querySelector(".toggle-icon").style.transform = "rotate(-90deg)";
    }

    const categoryList = document.getElementById("category-list");
    categoryList.innerHTML = "";

    const categoryShortcuts = new Map();
    this.shortcuts.forEach((value, key) => {
      categoryShortcuts.set(value.category, key);
    });

    const allCategories = new Map();
    this.shortcuts.forEach(({ category }) => {
      allCategories.set(category, 0);
    });

    const startOfDay = new Date(this.currentDate);
    const endOfDay = new Date(this.currentDate);
    endOfDay.setDate(endOfDay.getDate() + 1);

    sessions.forEach((session) => {
      const sessionDate = new Date(session.startTime);
      if (sessionDate >= startOfDay && sessionDate < endOfDay) {
        const current = allCategories.get(session.category) || 0;
        allCategories.set(session.category, current + session.duration);
      }
    });

    allCategories.forEach((totalSeconds, category) => {
      if (totalSeconds > 0) {
        const div = document.createElement("div");
        div.className = "session category-item";

        const shortcutKey = categoryShortcuts.get(category);
        const shortcutBadge = shortcutKey
          ? `<span class="shortcut-badge">${shortcutKey}</span>`
          : "";

        div.innerHTML = `
          <h3>${category}</h3>
          <p>${this.formatTime(totalSeconds)}</p>
          ${shortcutBadge}
        `;

        if (shortcutKey) {
          div.addEventListener("click", () => {
            this.startSession(shortcutKey);
          });
        }

        categoryList.appendChild(div);
      }
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
    if (confirm("이 세션 삭제하시겠습니까?")) {
      sessions.splice(index, 1);
      localStorage.setItem("sessions", JSON.stringify(sessions));
      this.updateDisplay();
    }
  }

  checkFirstVisit() {
    if (!localStorage.getItem("hasVisited")) {
      this.showWelcomeModal();
    }
  }

  showWelcomeModal() {
    const modal = document.getElementById("welcome-modal");
    modal.classList.add("show");

    const closeButton = document.getElementById("welcome-close");
    const confirmButton = document.getElementById("welcome-confirm");

    const closeModal = () => {
      modal.classList.remove("show");
      if (!localStorage.getItem("hasVisited")) {
        localStorage.setItem("hasVisited", "true");
      }
    };

    closeButton.removeEventListener("click", closeModal);
    confirmButton.removeEventListener("click", closeModal);

    closeButton.addEventListener("click", closeModal);
    confirmButton.addEventListener("click", closeModal);

    const modalClickHandler = (e) => {
      if (e.target === modal) {
        alert(
          "설명서를 끝까지 읽어주세요! 우측 상단의 X 버튼이나 하단의 확인 버튼을 눌러주세요."
        );
      }
    };

    modal.removeEventListener("click", modalClickHandler);
    modal.addEventListener("click", modalClickHandler);

    const contentClickHandler = (e) => {
      e.stopPropagation();
    };

    const welcomeContent = modal.querySelector(".welcome-content");
    welcomeContent.removeEventListener("click", contentClickHandler);
    welcomeContent.addEventListener("click", contentClickHandler);
  }

  toggleSessionLog() {
    const sessionLog = document.getElementById("session-log");
    const toggleIcon = document.querySelector(".toggle-icon");
    this.isSessionLogExpanded = !this.isSessionLogExpanded;

    if (this.isSessionLogExpanded) {
      sessionLog.classList.add("expanded");
      toggleIcon.style.transform = "rotate(0deg)";
    } else {
      sessionLog.classList.remove("expanded");
      toggleIcon.style.transform = "rotate(-90deg)";
    }
  }

  createBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      const beepDuration = 0.2; // 각 비프음의 길이
      const beepInterval = 0.3; // 비프음 사이의 간격
      const beepCount = 3; // 비프음 횟수

      for (let i = 0; i < beepCount; i++) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          880,
          this.audioContext.currentTime + i * beepInterval
        );

        // 각 비프음의 볼륨 제어
        gainNode.gain.setValueAtTime(
          0,
          this.audioContext.currentTime + i * beepInterval
        );
        gainNode.gain.linearRampToValueAtTime(
          0.3,
          this.audioContext.currentTime + i * beepInterval + 0.02
        );
        gainNode.gain.setValueAtTime(
          0.3,
          this.audioContext.currentTime + i * beepInterval + beepDuration - 0.02
        );
        gainNode.gain.linearRampToValueAtTime(
          0,
          this.audioContext.currentTime + i * beepInterval + beepDuration
        );

        oscillator.start(this.audioContext.currentTime + i * beepInterval);
        oscillator.stop(
          this.audioContext.currentTime + i * beepInterval + beepDuration
        );
      }
    } catch (error) {
      console.error("오디오 재생 중 오류 발생:", error);
    }
  }

  showStatsModal() {
    const modal = document.getElementById("stats-modal");
    modal.classList.add("show");
    
    this.updateStatsDateDisplay();
    this.updateStatsChart();
  }

  updateStatsChart() {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    
    // 현재 날짜 기준 최근 14일의 날짜 배열 생성
    const dates = [];
    const categories = new Set();
    const categoryData = new Map();
    
    // 최근 14일 날짜 배열 생성
    for (let i = 13; i >= 0; i--) {
      const date = new Date(this.currentDate);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }

    // 모든 카테고리와 날짜별 데이터 초기화
    sessions.forEach(session => {
      categories.add(session.category);
    });

    categories.forEach(category => {
      categoryData.set(category, new Array(14).fill(0));
    });

    // 세션 데이터 집계
    sessions.forEach(session => {
      const sessionDate = new Date(session.startTime);
      sessionDate.setHours(0, 0, 0, 0);
      
      const dateIndex = dates.findIndex(date => 
        date.getTime() === sessionDate.getTime()
      );
      
      if (dateIndex !== -1) {
        const categoryValues = categoryData.get(session.category);
        categoryValues[dateIndex] += session.duration / 3600; // 시간 단위로 변환
      }
    });

    // 차트 데이터셋 생성
    const datasets = Array.from(categories).map((category, index) => {
      const hue = (index * 137.5) % 360; // 골든 앵글을 사용하여 색상 분배
      return {
        label: category,
        data: categoryData.get(category),
        backgroundColor: `hsla(${hue}, 70%, 60%, 0.8)`,
        borderColor: `hsla(${hue}, 70%, 50%, 1)`,
        borderWidth: 1
      };
    });

    // 날짜 레이블 포맷팅
    const labels = dates.map(date => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (date.getTime() === today.getTime()) {
        return '오늘';
      } else if (date.getTime() === today.getTime() - 86400000) {
        return '어제';
      } else {
        return date.toLocaleDateString('ko-KR', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    });

    // 기존 차트 제거
    const chartCanvas = document.getElementById("stats-chart");
    if (window.statsChart) {
      window.statsChart.destroy();
    }

    // 현재 테마에 따른 텍스트 색상 설정
    const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDarkMode ? '#e5e7eb' : '#2c3e50';

    // 새 차트 생성
    window.statsChart = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              color: textColor
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: '시간',
              color: textColor
            },
            ticks: {
              color: textColor
            },
            grid: {
              color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: '최근 14일간 카테고리별 사용 시간',
            color: textColor,
            font: {
              size: 16
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 20,
              color: textColor
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const hours = Math.floor(context.raw);
                const minutes = Math.round((context.raw - hours) * 60);
                return `${context.dataset.label}: ${hours}시간 ${minutes}분`;
              }
            }
          }
        }
      }
    });
  }

  changeStatsDate(offset) {
    this.currentDate.setDate(this.currentDate.getDate() + offset);
    this.updateStatsDateDisplay();
    this.updateDisplay();
    this.updateStatsChart();
  }

  exportSessionsToCSV() {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    
    if (sessions.length === 0) {
      alert("내보낼 세션 기록이 없습니다.");
      return;
    }

    // CSV 헤더
    let csvContent = "시작 시간,종료 시간,카테고리,소요 시간(초)\n";

    // 세션 데이터를 CSV 형식으로 변환
    sessions.forEach(session => {
      const startTime = new Date(session.startTime).toLocaleString();
      const endTime = new Date(session.endTime).toLocaleString();
      const row = [
        `"${startTime}"`,
        `"${endTime}"`,
        `"${session.category}"`,
        session.duration
      ].join(",");
      csvContent += row + "\n";
    });

    // CSV 파일 생성 및 다운로드
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `time-tracker-sessions-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  importSessionsFromCSV(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = text.split('\n').slice(1); // 헤더 제외
        const sessions = [];

        rows.forEach(row => {
          if (!row.trim()) return; // 빈 줄 무시

          // CSV 파싱 (따옴표로 묶인 필드 처리)
          const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (!matches || matches.length !== 4) return;

          const [startTimeStr, endTimeStr, category, durationStr] = matches.map(
            str => str.replace(/^"(.*)"$/, '$1') // 따옴표 제거
          );

          const session = {
            startTime: new Date(startTimeStr).toISOString(),
            endTime: new Date(endTimeStr).toISOString(),
            category: category,
            duration: parseFloat(durationStr)
          };

          if (!isNaN(new Date(session.startTime).getTime()) && 
              !isNaN(new Date(session.endTime).getTime()) && 
              !isNaN(session.duration)) {
            sessions.push(session);
          }
        });

        if (sessions.length === 0) {
          throw new Error("가져올 수 있는 세션 데이터가 없습니다.");
        }

        // 기존 세션과 병합 여부 확인
        const mergeConfirmed = confirm(
          `${sessions.length}개의 세션을 가져왔습니다.\n` +
          "'확인'을 누르면 기존 세션 기록과 병합됩니다.\n" +
          "'취소'를 누르면 작업이 취소됩니다."
        );

        if (!mergeConfirmed) {
          return; // 취소를 누르면 함수 종료
        }

        // 기존 세션과 병합
        const existingSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
        const newSessions = [...existingSessions, ...sessions];
        localStorage.setItem("sessions", JSON.stringify(newSessions));
        this.updateDisplay();
        alert(`${sessions.length}개의 세션을 성공적으로 가져왔습니다.`);

      } catch (error) {
        console.error("CSV 파일 처리 중 오류 발생:", error);
        alert("CSV 파일 처리 중 오류가 발생했습니다: " + error.message);
      }
    };

    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
    };

    reader.readAsText(file, 'UTF-8');
  }
}

const tracker = new TimeTracker();
