/**
 * Main Application Controller for Volleyball Service Scout
 */

(function () {
  // Application State
  const state = {
    teamName: 'Team Phoenix',
    opponentName: 'Thunder Spikers',
    players: ['1', '3', '4', '7', '9', '11', '14', '18'],
    selectedPlayer: '7',
    selectedServeType: 'Jump Float',
    serves: [],
    filterMode: 'player', // 'player' | 'all'
    draftStart: null,
    draftEnd: null
  };

  const STORAGE_KEY = 'vball_scout_match_state_v1';

  // DOM Elements
  const displayTeamName = document.getElementById('displayTeamName');
  const displayOpponentName = document.getElementById('displayOpponentName');
  const playerRosterGrid = document.getElementById('playerRosterGrid');
  const playerServeCountBadge = document.getElementById('playerServeCountBadge');
  const serveTypeGrid = document.getElementById('serveTypeGrid');
  const draftStatusIndicator = document.getElementById('draftStatusIndicator');
  const courtHintText = document.getElementById('courtHintText');
  
  const outcomeAceBtn = document.getElementById('outcomeAceBtn');
  const outcomeInBtn = document.getElementById('outcomeInBtn');
  const outcomeFaultBtn = document.getElementById('outcomeFaultBtn');
  const clearCurrentDraftBtn = document.getElementById('clearCurrentDraftBtn');
  const undoBtn = document.getElementById('undoBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const filterBtn = document.getElementById('filterBtn');
  const filterLabel = document.getElementById('filterLabel');

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const csvFileInput = document.getElementById('csvFileInput');

  const toggleFullscreenBtn = document.getElementById('toggleFullscreenBtn');
  const installAppBtn = document.getElementById('installAppBtn');
  let deferredPrompt = null;

  const togglePredictionOverlay = document.getElementById('togglePredictionOverlay');
  const toggleZonesOverlay = document.getElementById('toggleZonesOverlay');

  // Prediction elements
  const predConfidenceBadge = document.getElementById('predictionConfidenceBadge');
  const predAceVal = document.getElementById('predAceVal');
  const predAceFill = document.getElementById('predAceFill');
  const predInVal = document.getElementById('predInVal');
  const predInFill = document.getElementById('predInFill');
  const predFaultVal = document.getElementById('predFaultVal');
  const predFaultFill = document.getElementById('predFaultFill');
  const predTendencyText = document.getElementById('predTendencyText');

  // Modal elements
  const setupModal = document.getElementById('setupModal');
  const openSetupBtn = document.getElementById('openSetupBtn');
  const closeSetupModalBtn = document.getElementById('closeSetupModalBtn');
  const cancelSetupBtn = document.getElementById('cancelSetupBtn');
  const saveSetupBtn = document.getElementById('saveSetupBtn');
  const teamNameInput = document.getElementById('teamNameInput');
  const oppNameInput = document.getElementById('oppNameInput');

  // Touch Roster Setup Modal State & UI Elements
  let modalSelectedPlayers = [];
  let numpadBuffer = '';

  const setupSelectedCountBadge = document.getElementById('setupSelectedCountBadge');
  const setupSelectedChips = document.getElementById('setupSelectedChips');
  const presetRoster12Btn = document.getElementById('presetRoster12Btn');
  const presetRoster18Btn = document.getElementById('presetRoster18Btn');
  const presetClearBtn = document.getElementById('presetClearBtn');
  const setupNumberToggleGrid = document.getElementById('setupNumberToggleGrid');
  const numpadDisplay = document.getElementById('numpadDisplay');
  const numpadGrid = document.getElementById('numpadGrid');
  const numpadClearBtn = document.getElementById('numpadClearBtn');
  const numpadAddBtn = document.getElementById('numpadAddBtn');

  function renderSetupRosterUI() {
    modalSelectedPlayers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    if (setupSelectedCountBadge) {
      setupSelectedCountBadge.textContent = `${modalSelectedPlayers.length} Selected`;
    }

    if (setupSelectedChips) {
      setupSelectedChips.innerHTML = '';
      if (modalSelectedPlayers.length === 0) {
        setupSelectedChips.innerHTML = `<span style="font-size: 0.8rem; color: #64748b; font-style: italic;">No players selected. Tap numbers below to add.</span>`;
      } else {
        modalSelectedPlayers.forEach(num => {
          const chip = document.createElement('span');
          chip.className = 'setup-chip';
          chip.innerHTML = `#${num} <button type="button" class="setup-chip-remove" aria-label="Remove player ${num}">&times;</button>`;
          chip.querySelector('.setup-chip-remove').addEventListener('click', () => {
            modalSelectedPlayers = modalSelectedPlayers.filter(p => p !== num);
            renderSetupRosterUI();
          });
          setupSelectedChips.appendChild(chip);
        });
      }
    }

    if (setupNumberToggleGrid) {
      setupNumberToggleGrid.innerHTML = '';
      for (let i = 1; i <= 24; i++) {
        const numStr = i.toString();
        const isSelected = modalSelectedPlayers.includes(numStr);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `jersey-toggle-btn ${isSelected ? 'selected' : ''}`;
        btn.textContent = numStr;
        btn.title = `Toggle player #${numStr}`;
        btn.addEventListener('click', () => {
          if (modalSelectedPlayers.includes(numStr)) {
            modalSelectedPlayers = modalSelectedPlayers.filter(p => p !== numStr);
          } else {
            modalSelectedPlayers.push(numStr);
          }
          renderSetupRosterUI();
        });
        setupNumberToggleGrid.appendChild(btn);
      }
    }

    if (numpadDisplay) {
      numpadDisplay.textContent = numpadBuffer ? `Typed: #${numpadBuffer}` : 'Typed: --';
    }
  }

  function openModal() {
    const modalEl = document.getElementById('setupModal');
    const teamInput = document.getElementById('teamNameInput');
    const oppInput = document.getElementById('oppNameInput');

    modalSelectedPlayers = Array.isArray(state.players) && state.players.length > 0
      ? [...state.players]
      : ['1', '3', '4', '7', '9', '11', '14', '18'];

    if (teamInput) teamInput.value = state.teamName || '';
    if (oppInput) oppInput.value = state.opponentName || '';
    numpadBuffer = '';
    
    renderSetupRosterUI();

    if (modalEl) {
      modalEl.classList.add('open');
    }
  }

  function closeModal() {
    const modalEl = document.getElementById('setupModal');
    if (modalEl) {
      modalEl.classList.remove('open');
    }
  }

  // Initialize Court Canvas
  const court = new VolleyballCourt('courtCanvas', {
    showZones: true,
    showPrediction: true,
    onTrajectoryDraftChanged: (start, end) => handleDraftChanged(start, end)
  });

  // Load persisted state
  function init() {
    loadFromLocalStorage();

    renderMatchInfo();
    renderPlayerRoster();
    renderServeTypeButtons();
    updateCourtDisplay();
    updatePredictions();
    updateUndoState();
    attachEventListeners();
  }

  function startNewGame() {
    const confirmed = confirm(
      'Start a new game? This clears all recorded serves for the current match.\n\nExport CSV first if you want to keep this data.'
    );
    if (!confirmed) return;

    state.serves = [];
    state.draftStart = null;
    state.draftEnd = null;
    court.clearDraft();
    saveToLocalStorage();

    renderPlayerRoster();
    updateCourtDisplay();
    updatePredictions();
    updateUndoState();

    setupModal.classList.add('open');
  }

  function handleDraftChanged(start, end) {
    state.draftStart = start;
    state.draftEnd = end;

    if (!start) {
      courtHintText.textContent = '👉 Tap behind baseline to set serve start point';
      draftStatusIndicator.textContent = 'Waiting for trajectory...';
      draftStatusIndicator.className = 'draft-indicator';
      setOutcomeButtonsEnabled(false);
    } else if (start && !end) {
      courtHintText.textContent = '🎯 Tap opponent court to set landing point';
      draftStatusIndicator.textContent = 'Start set. Tap landing point...';
      draftStatusIndicator.className = 'draft-indicator';
      setOutcomeButtonsEnabled(false);
    } else if (start && end) {
      const zone = VolleyballCourt.getOpponentZoneName(end.x, end.y);

      if (zone === 'Own Half (Net)' || zone === 'Out of Bounds') {
        // A serve that lands in the server's own court or outside the
        // field can never be an Ace or an In/Rally - it's always a Fault.
        recordServe('Fault');
        const reason = zone === 'Out of Bounds' ? 'landed out of bounds' : 'landed in own court / net';
        courtHintText.textContent = `🚫 Auto-recorded as FAULT (${reason}).`;
        draftStatusIndicator.textContent = 'Auto-recorded: FAULT';
        draftStatusIndicator.className = 'draft-indicator';
        setOutcomeButtonsEnabled(false);
        return;
      }

      courtHintText.textContent = `✅ Landed in ${zone}. Tap ACE, IN, or FAULT below!`;
      draftStatusIndicator.textContent = `Ready: ${zone}`;
      draftStatusIndicator.className = 'draft-indicator ready';
      setOutcomeButtonsEnabled(true);
    }
  }

  function setOutcomeButtonsEnabled(enabled) {
    outcomeAceBtn.disabled = !enabled;
    outcomeInBtn.disabled = !enabled;
    outcomeFaultBtn.disabled = !enabled;
  }

  function recordServe(outcome) {
    if (!state.draftStart || !state.draftEnd) return;

    const endZone = VolleyballCourt.getOpponentZoneName(state.draftEnd.x, state.draftEnd.y);
    const newServe = {
      id: 'srv_' + Date.now(),
      team: state.teamName,
      opponent: state.opponentName,
      player_number: state.selectedPlayer,
      serve_type: state.selectedServeType,
      outcome: outcome, // 'Ace' | 'In' | 'Fault'
      start_x: Number(state.draftStart.x.toFixed(2)),
      start_y: Number(state.draftStart.y.toFixed(2)),
      end_x: Number(state.draftEnd.x.toFixed(2)),
      end_y: Number(state.draftEnd.y.toFixed(2)),
      end_zone: endZone,
      timestamp: new Date().toISOString()
    };

    state.serves.push(newServe);
    saveToLocalStorage();

    // Clear draft
    court.clearDraft();
    
    // Update displays
    updateCourtDisplay();
    updatePredictions();
    renderPlayerRoster();
    updateUndoState();
  }

  function updateCourtDisplay() {
    let filteredServes = state.serves;
    if (state.filterMode === 'player') {
      filteredServes = state.serves.filter(s => String(s.player_number) === String(state.selectedPlayer));
    }
    court.setTrajectories(filteredServes);
  }

  function updatePredictions() {
    // 1. Outcome probabilities
    const probData = ServePredictor.predictOutcome(state.serves, state.selectedPlayer, state.selectedServeType);
    
    predConfidenceBadge.textContent = probData.confidence;
    predConfidenceBadge.className = probData.sampleSize >= 3 ? 'badge active' : 'badge';

    predAceVal.textContent = `${probData.probAce}%`;
    predAceFill.style.width = `${probData.probAce}%`;

    predInVal.textContent = `${probData.probIn}%`;
    predInFill.style.width = `${probData.probIn}%`;

    predFaultVal.textContent = `${probData.probFault}%`;
    predFaultFill.style.width = `${probData.probFault}%`;

    // 2. Trajectory vector & landing cluster
    const trajPred = ServePredictor.predictTrajectory(state.serves, state.selectedPlayer, state.selectedServeType);
    
    if (trajPred) {
      court.setPredictedTrajectory(trajPred);
      predTendencyText.textContent = `${probData.notes} Predicted target: ${trajPred.zone}.`;
    } else {
      court.setPredictedTrajectory(null);
      predTendencyText.textContent = probData.notes || 'No trajectory data yet for this player.';
    }

    // Update serve count badge
    const countForPlayer = state.serves.filter(s => String(s.player_number) === String(state.selectedPlayer)).length;
    playerServeCountBadge.textContent = `${countForPlayer} serve${countForPlayer === 1 ? '' : 's'}`;
  }

  function renderMatchInfo() {
    displayTeamName.textContent = state.teamName;
    displayOpponentName.textContent = state.opponentName;
    teamNameInput.value = state.teamName;
    oppNameInput.value = state.opponentName;
  }

  function renderPlayerRoster() {
    playerRosterGrid.innerHTML = '';
    state.players.forEach(num => {
      const btn = document.createElement('button');
      btn.className = `player-chip ${num === state.selectedPlayer ? 'active' : ''}`;
      
      const count = state.serves.filter(s => String(s.player_number) === String(num)).length;
      btn.innerHTML = `
        <span>#${num}</span>
        <span style="font-size: 0.65rem; opacity: 0.7; font-weight: 500;">${count}</span>
      `;

      btn.addEventListener('click', () => {
        state.selectedPlayer = num;
        renderPlayerRoster();
        updateCourtDisplay();
        updatePredictions();
      });

      playerRosterGrid.appendChild(btn);
    });
  }

  function renderServeTypeButtons() {
    const buttons = serveTypeGrid.querySelectorAll('.serve-type-btn');
    buttons.forEach(btn => {
      const type = btn.getAttribute('data-type');
      btn.classList.toggle('active', type === state.selectedServeType);

      btn.addEventListener('click', () => {
        state.selectedServeType = type;
        renderServeTypeButtons();
        updatePredictions();
      });
    });
  }

  function updateUndoState() {
    undoBtn.disabled = state.serves.length === 0;
  }

  function undoLastServe() {
    if (state.serves.length === 0) return;
    const removed = state.serves.pop();
    saveToLocalStorage();
    updateCourtDisplay();
    updatePredictions();
    renderPlayerRoster();
    updateUndoState();
  }

  // CSV Export
  function exportToCsv() {
    if (state.serves.length === 0) {
      alert('No serves recorded yet to export.');
      return;
    }

    const headers = [
      'id', 'game_team', 'opponent', 'player_number', 'serve_type',
      'outcome', 'start_x_m', 'start_y_m', 'end_x_m', 'end_y_m',
      'end_zone', 'timestamp'
    ];

    const rows = state.serves.map(s => [
      s.id,
      `"${s.team}"`,
      `"${s.opponent}"`,
      s.player_number,
      `"${s.serve_type}"`,
      `"${s.outcome}"`,
      s.start_x,
      s.start_y,
      s.end_x,
      s.end_y,
      `"${s.end_zone || ''}"`,
      `"${s.timestamp}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeTeam = state.teamName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `volleyball_scout_${safeTeam}_${dateStr}.csv`;

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.setAttribute('download', filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  }

  // CSV Import
  function importFromCsv(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return;

        const importedServes = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 10) {
            importedServes.push({
              id: cols[0] || 's_' + Date.now() + '_' + i,
              team: cols[1] || state.teamName,
              opponent: cols[2] || state.opponentName,
              player_number: cols[3],
              serve_type: cols[4],
              outcome: cols[5],
              start_x: parseFloat(cols[6]),
              start_y: parseFloat(cols[7]),
              end_x: parseFloat(cols[8]),
              end_y: parseFloat(cols[9]),
              end_zone: cols[10] || '',
              timestamp: cols[11] || new Date().toISOString()
            });
          }
        }

        if (importedServes.length > 0) {
          state.serves = importedServes;
          saveToLocalStorage();
          renderPlayerRoster();
          updateCourtDisplay();
          updatePredictions();
          updateUndoState();
          alert(`Successfully imported ${importedServes.length} serves!`);
        }
      } catch (err) {
        alert('Could not parse CSV file. Please verify format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function toggleFilter() {
    if (state.filterMode === 'player') {
      state.filterMode = 'all';
      filterLabel.textContent = 'All Players';
    } else {
      state.filterMode = 'player';
      filterLabel.textContent = 'Current Player';
    }
    updateCourtDisplay();
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        teamName: state.teamName,
        opponentName: state.opponentName,
        players: state.players,
        serves: state.serves
      }));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.teamName) state.teamName = parsed.teamName;
        if (parsed.opponentName) state.opponentName = parsed.opponentName;
        if (Array.isArray(parsed.players) && parsed.players.length > 0) state.players = parsed.players;
        if (Array.isArray(parsed.serves)) state.serves = parsed.serves;
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function attachEventListeners() {
    outcomeAceBtn.addEventListener('click', () => recordServe('Ace'));
    outcomeInBtn.addEventListener('click', () => recordServe('In'));
    outcomeFaultBtn.addEventListener('click', () => recordServe('Fault'));

    clearCurrentDraftBtn.addEventListener('click', () => court.clearDraft());
    undoBtn.addEventListener('click', () => undoLastServe());
    newGameBtn.addEventListener('click', () => startNewGame());
    filterBtn.addEventListener('click', () => toggleFilter());

    exportCsvBtn.addEventListener('click', () => exportToCsv());
    importCsvBtn.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', importFromCsv);

    togglePredictionOverlay.addEventListener('change', (e) => {
      court.setShowPrediction(e.target.checked);
    });

    toggleZonesOverlay.addEventListener('change', (e) => {
      court.setShowZones(e.target.checked);
    });

    // Modal Events
    if (openSetupBtn) {
      openSetupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
      });
    }

    const matchPillEl = document.getElementById('matchDisplayPill');
    if (matchPillEl) {
      matchPillEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
      });
    }

    if (closeSetupModalBtn) {
      closeSetupModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    }

    if (cancelSetupBtn) {
      cancelSetupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    }

    if (setupModal) {
      setupModal.addEventListener('click', (e) => {
        if (e.target === setupModal) {
          closeModal();
        }
      });
    }

    if (presetRoster12Btn) {
      presetRoster12Btn.addEventListener('click', () => {
        modalSelectedPlayers = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
        renderSetupRosterUI();
      });
    }

    if (presetRoster18Btn) {
      presetRoster18Btn.addEventListener('click', () => {
        modalSelectedPlayers = Array.from({ length: 18 }, (_, i) => (i + 1).toString());
        renderSetupRosterUI();
      });
    }

    if (presetClearBtn) {
      presetClearBtn.addEventListener('click', () => {
        modalSelectedPlayers = [];
        renderSetupRosterUI();
      });
    }

    if (numpadGrid) {
      numpadGrid.querySelectorAll('.numpad-btn[data-val]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          if (numpadBuffer.length < 2) {
            numpadBuffer += val;
            renderSetupRosterUI();
          }
        });
      });
    }

    if (numpadClearBtn) {
      numpadClearBtn.addEventListener('click', () => {
        numpadBuffer = numpadBuffer.slice(0, -1);
        renderSetupRosterUI();
      });
    }

    if (numpadAddBtn) {
      numpadAddBtn.addEventListener('click', () => {
        const numVal = parseInt(numpadBuffer, 10);
        if (!isNaN(numVal) && numVal > 0 && numVal <= 99) {
          const numStr = numVal.toString();
          if (!modalSelectedPlayers.includes(numStr)) {
            modalSelectedPlayers.push(numStr);
          }
          numpadBuffer = '';
          renderSetupRosterUI();
        }
      });
    }

    saveSetupBtn.addEventListener('click', () => {
      const newTeam = teamNameInput.value.trim();
      const newOpp = oppNameInput.value.trim();

      if (newTeam) state.teamName = newTeam;
      if (newOpp) state.opponentName = newOpp;

      if (modalSelectedPlayers.length > 0) {
        state.players = [...modalSelectedPlayers];
        if (!state.players.includes(state.selectedPlayer)) {
          state.selectedPlayer = state.players[0];
        }
      }

      saveToLocalStorage();
      renderMatchInfo();
      renderPlayerRoster();
      updateCourtDisplay();
      updatePredictions();
      closeModal();
    });

    // Fullscreen Toggle
    if (toggleFullscreenBtn) {
      toggleFullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.warn('Fullscreen request failed:', err);
          });
          toggleFullscreenBtn.innerHTML = '<span class="btn-icon">🗗</span> Exit Full';
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
          toggleFullscreenBtn.innerHTML = '<span class="btn-icon">⛶</span> Fullscreen';
        }
      });

      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
          toggleFullscreenBtn.innerHTML = '<span class="btn-icon">⛶</span> Fullscreen';
        } else {
          toggleFullscreenBtn.innerHTML = '<span class="btn-icon">🗗</span> Exit Full';
        }
      });
    }

    // PWA Install Prompt Handler
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installAppBtn) {
        installAppBtn.style.display = 'inline-flex';
      }
    });

    if (installAppBtn) {
      installAppBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installAppBtn.style.display = 'none';
        }
        deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      if (installAppBtn) installAppBtn.style.display = 'none';
    });

    // Register Service Worker for offline PWA installation
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('ServiceWorker registration error:', err);
      });
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
