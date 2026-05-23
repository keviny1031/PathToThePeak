const STORAGE_KEY = "pokemon-tcg-live-practice-tracker-v1";

const state = {
  decks: [],
  opponentDecks: [],
  games: [],
  activeDeckId: null,
  trendDeckId: "all",
  matchupDeckId: "all",
  matchupOpponent: "all"
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  tabs: document.querySelectorAll(".tab"),
  trackPanel: document.querySelector("#trackPanel"),
  trendsPanel: document.querySelector("#trendsPanel"),
  matchupsPanel: document.querySelector("#matchupsPanel"),
  totalGames: document.querySelector("#totalGames"),
  recordText: document.querySelector("#recordText"),
  winRateText: document.querySelector("#winRateText"),
  currentDeckMetric: document.querySelector("#currentDeckMetric"),
  deckSelect: document.querySelector("#deckSelect"),
  trendDeckSelect: document.querySelector("#trendDeckSelect"),
  matchupDeckSelect: document.querySelector("#matchupDeckSelect"),
  matchupOpponentSelect: document.querySelector("#matchupOpponentSelect"),
  deckForm: document.querySelector("#deckForm"),
  deckName: document.querySelector("#deckName"),
  gameDate: document.querySelector("#gameDate"),
  opponentDeck: document.querySelector("#opponentDeck"),
  opponentDeckOptions: document.querySelector("#opponentDeckOptions"),
  logWinButton: document.querySelector("#logWinButton"),
  logLossButton: document.querySelector("#logLossButton"),
  renameDeckButton: document.querySelector("#renameDeckButton"),
  deleteDeckButton: document.querySelector("#deleteDeckButton"),
  clearGamesButton: document.querySelector("#clearGamesButton"),
  deckSummaryText: document.querySelector("#deckSummaryText"),
  deckList: document.querySelector("#deckList"),
  historyList: document.querySelector("#historyList"),
  trendChart: document.querySelector("#trendChart"),
  emptyChart: document.querySelector("#emptyChart"),
  trendStats: document.querySelector("#trendStats"),
  dailyTable: document.querySelector("#dailyTable"),
  matchupStats: document.querySelector("#matchupStats"),
  matchupTable: document.querySelector("#matchupTable")
};

const chartContext = els.trendChart.getContext("2d");

function createId(prefix) {
  if (window.crypto && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, options);
}

function normalizeTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getUniqueTitles(titles) {
  const titlesByKey = new Map();

  titles.forEach((title) => {
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) return;

    const key = normalizedTitle.toLowerCase();
    if (!titlesByKey.has(key)) {
      titlesByKey.set(key, normalizedTitle);
    }
  });

  return [...titlesByKey.values()].sort((a, b) => a.localeCompare(b));
}

function clampRate(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toPercent(value) {
  return `${Math.round(clampRate(value))}%`;
}

function getStats(games) {
  const wins = games.filter((game) => game.result === "win").length;
  const losses = games.filter((game) => game.result === "loss").length;
  const total = wins + losses;
  const rate = total ? (wins / total) * 100 : 0;
  return { wins, losses, total, rate };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return;

    state.decks = Array.isArray(saved.decks)
      ? saved.decks.filter((deck) => deck && deck.id && deck.name)
      : [];
    state.opponentDecks = Array.isArray(saved.opponentDecks)
      ? getUniqueTitles(saved.opponentDecks)
      : [];
    state.games = Array.isArray(saved.games)
      ? saved.games
          .filter((game) => game && game.deckId && game.result && game.date)
          .map((game) => ({
            ...game,
            opponentDeck: normalizeTitle(game.opponentDeck)
          }))
      : [];
    state.activeDeckId = saved.activeDeckId || null;
    state.trendDeckId = saved.trendDeckId || "all";
    state.matchupDeckId = saved.matchupDeckId || "all";
    state.matchupOpponent = saved.matchupOpponent || "all";
  } catch (error) {
    console.warn("Could not load saved tracker data.", error);
  }

  state.opponentDecks = getUniqueTitles([
    ...state.opponentDecks,
    ...state.games.map((game) => game.opponentDeck)
  ]);

  if (!state.decks.some((deck) => deck.id === state.activeDeckId)) {
    state.activeDeckId = state.decks[0]?.id || null;
  }

  if (state.trendDeckId !== "all" && !state.decks.some((deck) => deck.id === state.trendDeckId)) {
    state.trendDeckId = "all";
  }

  if (state.matchupDeckId !== "all" && !state.decks.some((deck) => deck.id === state.matchupDeckId)) {
    state.matchupDeckId = "all";
  }

  if (
    state.matchupOpponent !== "all" &&
    !getOpponentDeckTitles().includes(state.matchupOpponent)
  ) {
    state.matchupOpponent = "all";
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      decks: state.decks,
      opponentDecks: state.opponentDecks,
      games: state.games,
      activeDeckId: state.activeDeckId,
      trendDeckId: state.trendDeckId,
      matchupDeckId: state.matchupDeckId,
      matchupOpponent: state.matchupOpponent
    })
  );
}

function getDeckName(deckId) {
  return state.decks.find((deck) => deck.id === deckId)?.name || "Deleted deck";
}

function getActiveDeck() {
  return state.decks.find((deck) => deck.id === state.activeDeckId) || null;
}

function getOpponentDeckTitles() {
  return getUniqueTitles([
    ...state.opponentDecks,
    ...state.games.map((game) => game.opponentDeck)
  ]);
}

function saveOpponentDeckTitle(title) {
  const normalizedTitle = normalizeTitle(title);
  if (!normalizedTitle) return;

  state.opponentDecks = getUniqueTitles([...state.opponentDecks, normalizedTitle]);
}

function reconcileMatchupFilters() {
  if (state.matchupDeckId !== "all" && !state.decks.some((deck) => deck.id === state.matchupDeckId)) {
    state.matchupDeckId = "all";
  }

  if (
    state.matchupOpponent !== "all" &&
    !getOpponentDeckTitles().includes(state.matchupOpponent)
  ) {
    state.matchupOpponent = "all";
  }
}

function sortGamesNewest(games) {
  return [...games].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function addDeck(name) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (!normalizedName) return;

  const duplicate = state.decks.some(
    (deck) => deck.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (duplicate) {
    window.alert("That deck is already in your tracker.");
    return;
  }

  const deck = {
    id: createId("deck"),
    name: normalizedName,
    createdAt: new Date().toISOString()
  };

  state.decks.push(deck);
  state.activeDeckId = deck.id;
  saveState();
  render();
}

function renameActiveDeck() {
  const deck = getActiveDeck();
  if (!deck) return;

  const nextName = window.prompt("Rename this deck:", deck.name);
  if (nextName === null) return;

  const normalizedName = nextName.trim().replace(/\s+/g, " ");
  if (!normalizedName) return;

  const duplicate = state.decks.some(
    (candidate) =>
      candidate.id !== deck.id && candidate.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (duplicate) {
    window.alert("Another deck already has that name.");
    return;
  }

  deck.name = normalizedName;
  saveState();
  render();
}

function deleteActiveDeck() {
  const deck = getActiveDeck();
  if (!deck) return;

  const gameCount = state.games.filter((game) => game.deckId === deck.id).length;
  const message =
    gameCount > 0
      ? `Delete "${deck.name}" and its ${gameCount} logged game${gameCount === 1 ? "" : "s"}?`
      : `Delete "${deck.name}"?`;

  if (!window.confirm(message)) return;

  state.decks = state.decks.filter((candidate) => candidate.id !== deck.id);
  state.games = state.games.filter((game) => game.deckId !== deck.id);
  state.activeDeckId = state.decks[0]?.id || null;

  if (state.trendDeckId === deck.id) {
    state.trendDeckId = "all";
  }

  reconcileMatchupFilters();
  saveState();
  render();
}

function logGame(result) {
  const deck = getActiveDeck();
  if (!deck) {
    window.alert("Add a deck before logging games.");
    els.deckName.focus();
    return;
  }

  const date = els.gameDate.value || getTodayInputValue();
  const opponentDeck = normalizeTitle(els.opponentDeck.value);
  saveOpponentDeckTitle(opponentDeck);
  state.games.push({
    id: createId("game"),
    deckId: deck.id,
    opponentDeck,
    result,
    date,
    createdAt: new Date().toISOString()
  });

  saveState();
  render();
}

function deleteGame(gameId) {
  state.games = state.games.filter((game) => game.id !== gameId);
  reconcileMatchupFilters();
  saveState();
  render();
}

function clearGames() {
  if (state.games.length === 0) return;

  if (!window.confirm("Clear every logged game? Your deck list will stay intact.")) return;

  state.games = [];
  reconcileMatchupFilters();
  saveState();
  render();
}

function getFilteredGames(deckId) {
  if (deckId === "all") return [...state.games];
  return state.games.filter((game) => game.deckId === deckId);
}

function getDailyRows(deckId) {
  const byDate = new Map();

  getFilteredGames(deckId).forEach((game) => {
    if (!byDate.has(game.date)) {
      byDate.set(game.date, { date: game.date, wins: 0, losses: 0, total: 0, rate: 0 });
    }

    const row = byDate.get(game.date);
    row.total += 1;
    if (game.result === "win") row.wins += 1;
    if (game.result === "loss") row.losses += 1;
    row.rate = row.total ? (row.wins / row.total) * 100 : 0;
  });

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function getMatchupGames() {
  return state.games.filter((game) => {
    const opponentDeck = normalizeTitle(game.opponentDeck);
    const deckMatches = state.matchupDeckId === "all" || game.deckId === state.matchupDeckId;
    const opponentMatches =
      state.matchupOpponent === "all" || opponentDeck === state.matchupOpponent;

    return opponentDeck && deckMatches && opponentMatches;
  });
}

function getMatchupRows() {
  const rowsByOpponent = new Map();

  state.games.forEach((game) => {
    const opponentDeck = normalizeTitle(game.opponentDeck);
    if (!opponentDeck) return;
    if (state.matchupDeckId !== "all" && game.deckId !== state.matchupDeckId) return;
    if (state.matchupOpponent !== "all" && opponentDeck !== state.matchupOpponent) return;

    if (!rowsByOpponent.has(opponentDeck)) {
      rowsByOpponent.set(opponentDeck, { opponentDeck, wins: 0, losses: 0, total: 0, rate: 0 });
    }

    const row = rowsByOpponent.get(opponentDeck);
    row.total += 1;
    if (game.result === "win") row.wins += 1;
    if (game.result === "loss") row.losses += 1;
    row.rate = row.total ? (row.wins / row.total) * 100 : 0;
  });

  return [...rowsByOpponent.values()].sort((a, b) => {
    const totalCompare = b.total - a.total;
    if (totalCompare !== 0) return totalCompare;
    return a.opponentDeck.localeCompare(b.opponentDeck);
  });
}

function setButtonStates() {
  const hasDecks = state.decks.length > 0;
  els.logWinButton.disabled = !hasDecks;
  els.logLossButton.disabled = !hasDecks;
  els.renameDeckButton.disabled = !hasDecks;
  els.deleteDeckButton.disabled = !hasDecks;
  els.clearGamesButton.disabled = state.games.length === 0;
}

function renderDeckSelects() {
  els.deckSelect.innerHTML = "";

  if (state.decks.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Add a deck first";
    option.value = "";
    els.deckSelect.append(option);
  } else {
    state.decks.forEach((deck) => {
      const option = document.createElement("option");
      option.value = deck.id;
      option.textContent = deck.name;
      els.deckSelect.append(option);
    });
  }

  els.deckSelect.value = state.activeDeckId || "";

  els.trendDeckSelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All decks";
  els.trendDeckSelect.append(allOption);

  state.decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = deck.name;
    els.trendDeckSelect.append(option);
  });

  els.trendDeckSelect.value = state.trendDeckId;

  els.matchupDeckSelect.innerHTML = "";
  const allDecksOption = document.createElement("option");
  allDecksOption.value = "all";
  allDecksOption.textContent = "All decks";
  els.matchupDeckSelect.append(allDecksOption);

  state.decks.forEach((deck) => {
    const option = document.createElement("option");
    option.value = deck.id;
    option.textContent = deck.name;
    els.matchupDeckSelect.append(option);
  });

  if (state.matchupDeckId !== "all" && !state.decks.some((deck) => deck.id === state.matchupDeckId)) {
    state.matchupDeckId = "all";
  }
  els.matchupDeckSelect.value = state.matchupDeckId;

  const opponentTitles = getOpponentDeckTitles();
  els.opponentDeckOptions.innerHTML = "";
  opponentTitles.forEach((title) => {
    const option = document.createElement("option");
    option.value = title;
    els.opponentDeckOptions.append(option);
  });

  els.matchupOpponentSelect.innerHTML = "";
  const allOpponentsOption = document.createElement("option");
  allOpponentsOption.value = "all";
  allOpponentsOption.textContent = "All opponents";
  els.matchupOpponentSelect.append(allOpponentsOption);

  opponentTitles.forEach((title) => {
    const option = document.createElement("option");
    option.value = title;
    option.textContent = title;
    els.matchupOpponentSelect.append(option);
  });

  if (state.matchupOpponent !== "all" && !opponentTitles.includes(state.matchupOpponent)) {
    state.matchupOpponent = "all";
  }
  els.matchupOpponentSelect.value = state.matchupOpponent;
}

function renderSummary() {
  const stats = getStats(state.games);
  const activeDeck = getActiveDeck();

  els.totalGames.textContent = stats.total.toString();
  els.recordText.textContent = `${stats.wins}-${stats.losses}`;
  els.winRateText.textContent = toPercent(stats.rate);
  els.currentDeckMetric.textContent = activeDeck ? activeDeck.name : "None";
}

function renderDeckList() {
  els.deckList.innerHTML = "";

  if (state.decks.length === 0) {
    els.deckSummaryText.textContent = "Add a deck to begin.";
    els.deckList.innerHTML = `<div class="empty-state">Your decks will appear here with record and win rate.</div>`;
    return;
  }

  const activeDeckGames = getActiveDeck()
    ? state.games.filter((game) => game.deckId === state.activeDeckId)
    : [];
  const activeStats = getStats(activeDeckGames);
  els.deckSummaryText.textContent = getActiveDeck()
    ? `${getActiveDeck().name}: ${activeStats.wins}-${activeStats.losses}, ${toPercent(activeStats.rate)}`
    : "Choose a deck to view details.";

  state.decks.forEach((deck) => {
    const games = state.games.filter((game) => game.deckId === deck.id);
    const stats = getStats(games);
    const row = document.createElement("button");
    row.className = `deck-row${deck.id === state.activeDeckId ? " is-selected" : ""}`;
    row.type = "button";
    row.dataset.deckId = deck.id;
    row.innerHTML = `
      <span>
        <span class="deck-name">${escapeHtml(deck.name)}</span>
        <span class="deck-meta">${stats.wins}-${stats.losses} over ${stats.total} game${stats.total === 1 ? "" : "s"}</span>
      </span>
      <span class="deck-rate">${toPercent(stats.rate)}</span>
    `;
    els.deckList.append(row);
  });
}

function renderHistory() {
  els.historyList.innerHTML = "";

  if (state.games.length === 0) {
    els.historyList.innerHTML = `<div class="empty-state">No games logged yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  sortGamesNewest(state.games)
    .slice(0, 30)
    .forEach((game) => {
      const row = document.createElement("div");
      const opponentText = normalizeTitle(game.opponentDeck)
        ? `vs ${escapeHtml(normalizeTitle(game.opponentDeck))}`
        : "Opponent not saved";
      row.className = "history-row";
      row.innerHTML = `
        <span class="result-badge ${game.result}">${game.result === "win" ? "Win" : "Loss"}</span>
        <span>
          <strong>${escapeHtml(getDeckName(game.deckId))}</strong>
          <span class="history-meta">${formatDate(game.date)} &middot; ${opponentText}</span>
        </span>
        <button class="delete-game-button" type="button" aria-label="Delete ${escapeHtml(getDeckName(game.deckId))} game from ${formatDate(game.date)}" data-game-id="${game.id}">x</button>
      `;
      fragment.append(row);
    });

  els.historyList.append(fragment);
}

function renderTrendStats(rows) {
  const games = getFilteredGames(state.trendDeckId);
  const stats = getStats(games);
  const bestDay = rows.length
    ? rows.reduce((best, row) => (row.rate > best.rate ? row : best), rows[0])
    : null;

  els.trendStats.innerHTML = `
    <div class="trend-stat">
      <span class="trend-meta">Selected record</span>
      <strong>${stats.wins}-${stats.losses}</strong>
    </div>
    <div class="trend-stat">
      <span class="trend-meta">Selected win rate</span>
      <strong>${toPercent(stats.rate)}</strong>
    </div>
    <div class="trend-stat">
      <span class="trend-meta">Best day</span>
      <strong>${bestDay ? `${toPercent(bestDay.rate)}` : "0%"}</strong>
      <span class="trend-meta">${bestDay ? formatDate(bestDay.date, { month: "short", day: "numeric" }) : "No games yet"}</span>
    </div>
  `;
}

function renderDailyTable(rows) {
  if (rows.length === 0) {
    els.dailyTable.innerHTML = "";
    return;
  }

  const newestFirst = [...rows].reverse();
  els.dailyTable.innerHTML = `
    <div class="daily-row">
      <span>Date</span>
      <span>Record</span>
      <span>Games</span>
      <span>Win rate</span>
    </div>
    ${newestFirst
      .map(
        (row) => `
          <div class="daily-row">
            <span>${formatDate(row.date)}</span>
            <span>${row.wins}-${row.losses}</span>
            <span>${row.total}</span>
            <strong>${toPercent(row.rate)}</strong>
          </div>
        `
      )
      .join("")}
  `;
}

function drawChart(rows) {
  const canvas = els.trendChart;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * scale));
  const height = Math.max(240, Math.floor(rect.height * scale));

  canvas.width = width;
  canvas.height = height;
  chartContext.setTransform(scale, 0, 0, scale, 0, 0);

  const chartWidth = width / scale;
  const chartHeight = height / scale;
  chartContext.clearRect(0, 0, chartWidth, chartHeight);

  const hasRows = rows.length > 0;
  els.emptyChart.classList.toggle("is-visible", !hasRows);
  if (!hasRows) return;

  const padding = {
    top: 24,
    right: 24,
    bottom: 48,
    left: 52
  };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xStep = rows.length > 1 ? plotWidth / (rows.length - 1) : 0;

  chartContext.lineWidth = 1;
  chartContext.strokeStyle = "#d9ded6";
  chartContext.fillStyle = "#66716b";
  chartContext.font = "12px Inter, system-ui, sans-serif";
  chartContext.textAlign = "right";
  chartContext.textBaseline = "middle";

  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = padding.top + plotHeight - (tick / 100) * plotHeight;
    chartContext.beginPath();
    chartContext.moveTo(padding.left, y);
    chartContext.lineTo(chartWidth - padding.right, y);
    chartContext.stroke();
    chartContext.fillText(`${tick}%`, padding.left - 10, y);
  });

  chartContext.strokeStyle = "#2f65a7";
  chartContext.lineWidth = 3;
  chartContext.lineJoin = "round";
  chartContext.lineCap = "round";
  chartContext.beginPath();

  rows.forEach((row, index) => {
    const x = padding.left + (rows.length === 1 ? plotWidth / 2 : index * xStep);
    const y = padding.top + plotHeight - (row.rate / 100) * plotHeight;
    if (index === 0) {
      chartContext.moveTo(x, y);
    } else {
      chartContext.lineTo(x, y);
    }
  });

  chartContext.stroke();

  rows.forEach((row, index) => {
    const x = padding.left + (rows.length === 1 ? plotWidth / 2 : index * xStep);
    const y = padding.top + plotHeight - (row.rate / 100) * plotHeight;
    chartContext.fillStyle = "#ffffff";
    chartContext.strokeStyle = "#2f65a7";
    chartContext.lineWidth = 3;
    chartContext.beginPath();
    chartContext.arc(x, y, 5, 0, Math.PI * 2);
    chartContext.fill();
    chartContext.stroke();
  });

  chartContext.fillStyle = "#66716b";
  chartContext.textAlign = "center";
  chartContext.textBaseline = "top";

  const labelIndexes = getLabelIndexes(rows.length);
  labelIndexes.forEach((index) => {
    const row = rows[index];
    const x = padding.left + (rows.length === 1 ? plotWidth / 2 : index * xStep);
    chartContext.fillText(formatDate(row.date, { month: "short", day: "numeric" }), x, chartHeight - 34);
  });
}

function getLabelIndexes(length) {
  if (length <= 1) return [0];
  if (length <= 5) return Array.from({ length }, (_, index) => index);

  const indexes = new Set([0, length - 1]);
  const segments = 4;
  for (let index = 1; index < segments; index += 1) {
    indexes.add(Math.round(((length - 1) * index) / segments));
  }

  return [...indexes].sort((a, b) => a - b);
}

function renderTrends() {
  const rows = getDailyRows(state.trendDeckId);
  renderTrendStats(rows);
  renderDailyTable(rows);
  drawChart(rows);
}

function renderMatchups() {
  const games = getMatchupGames();
  const rows = getMatchupRows();
  const stats = getStats(games);
  const bestMatchup = rows.length
    ? rows.reduce((best, row) => (row.rate > best.rate ? row : best), rows[0])
    : null;

  els.matchupStats.innerHTML = `
    <div class="trend-stat">
      <span class="trend-meta">Matched record</span>
      <strong>${stats.wins}-${stats.losses}</strong>
    </div>
    <div class="trend-stat">
      <span class="trend-meta">Matched win rate</span>
      <strong>${toPercent(stats.rate)}</strong>
    </div>
    <div class="trend-stat">
      <span class="trend-meta">Best matchup</span>
      <strong>${bestMatchup ? toPercent(bestMatchup.rate) : "0%"}</strong>
      <span class="trend-meta">${bestMatchup ? escapeHtml(bestMatchup.opponentDeck) : "No matchup data"}</span>
    </div>
  `;

  if (rows.length === 0) {
    const emptyMessage = getOpponentDeckTitles().length
      ? "No games match these matchup filters yet."
      : "Save opponent deck titles while logging games to build matchup data.";
    els.matchupTable.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  els.matchupTable.innerHTML = `
    <div class="matchup-row">
      <span>Opponent deck</span>
      <span>Record</span>
      <span>Games</span>
      <span>Win rate</span>
    </div>
    ${rows
      .map(
        (row) => `
          <div class="matchup-row">
            <strong>${escapeHtml(row.opponentDeck)}</strong>
            <span>${row.wins}-${row.losses}</span>
            <span>${row.total}</span>
            <strong>${toPercent(row.rate)}</strong>
          </div>
        `
      )
      .join("")}
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderDeckSelects();
  renderSummary();
  renderDeckList();
  renderHistory();
  renderTrends();
  renderMatchups();
  setButtonStates();
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((candidate) => candidate.classList.remove("is-active"));
      tab.classList.add("is-active");
      els.trackPanel.classList.toggle("is-active", tab.dataset.tab === "track");
      els.trendsPanel.classList.toggle("is-active", tab.dataset.tab === "trends");
      els.matchupsPanel.classList.toggle("is-active", tab.dataset.tab === "matchups");
      if (tab.dataset.tab === "trends") {
        requestAnimationFrame(() => drawChart(getDailyRows(state.trendDeckId)));
      }
    });
  });

  els.deckForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addDeck(els.deckName.value);
    els.deckName.value = "";
    els.deckName.focus();
  });

  els.deckSelect.addEventListener("change", () => {
    state.activeDeckId = els.deckSelect.value || null;
    saveState();
    render();
  });

  els.trendDeckSelect.addEventListener("change", () => {
    state.trendDeckId = els.trendDeckSelect.value || "all";
    saveState();
    renderTrends();
  });

  els.matchupDeckSelect.addEventListener("change", () => {
    state.matchupDeckId = els.matchupDeckSelect.value || "all";
    saveState();
    renderMatchups();
  });

  els.matchupOpponentSelect.addEventListener("change", () => {
    state.matchupOpponent = els.matchupOpponentSelect.value || "all";
    saveState();
    renderMatchups();
  });

  els.logWinButton.addEventListener("click", () => logGame("win"));
  els.logLossButton.addEventListener("click", () => logGame("loss"));
  els.renameDeckButton.addEventListener("click", renameActiveDeck);
  els.deleteDeckButton.addEventListener("click", deleteActiveDeck);
  els.clearGamesButton.addEventListener("click", clearGames);

  els.deckList.addEventListener("click", (event) => {
    const row = event.target.closest(".deck-row");
    if (!row) return;
    state.activeDeckId = row.dataset.deckId;
    saveState();
    render();
  });

  els.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-game-id]");
    if (!button) return;
    deleteGame(button.dataset.gameId);
  });

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => drawChart(getDailyRows(state.trendDeckId)));
  });
}

function init() {
  els.todayLabel.textContent = formatDate(getTodayInputValue(), {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  els.gameDate.value = getTodayInputValue();
  loadState();
  bindEvents();
  render();
}

init();
