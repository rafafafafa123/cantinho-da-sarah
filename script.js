(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const integer = (min, max) => Math.floor(random(min, max + 1));
  const haptic = (pattern = 10) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
  };
  const STORAGE_KEY = 'cantinhoSarahArcadeV6';
  const BEST_DEFAULTS = { run: 0, battleWins: 0, snack: 0 };

  function loadBest() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...BEST_DEFAULTS, ...data };
    } catch {
      return { ...BEST_DEFAULTS };
    }
  }

  const state = {
    page: 'home',
    sound: true,
    best: loadBest(),
    toastTimer: 0
  };

  const audio = {
    context: null,
    muted: false,
    unlock() {
      if (this.muted) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.context) this.context = new AudioContextClass();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    },
    tone(frequency = 440, duration = .08, type = 'sine', volume = .025, endFrequency = null) {
      if (this.muted) return;
      this.unlock();
      if (!this.context) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    },
    sequence(notes) {
      notes.forEach((note, index) => window.setTimeout(() => this.tone(...note), index * 85));
    },
    click() { this.tone(520, .045, 'triangle', .018); },
    collect() { this.sequence([[740,.06,'sine',.025],[990,.09,'triangle',.027]]); },
    impact() { this.sequence([[180,.09,'sawtooth',.03,110],[95,.13,'square',.017]]); },
    victory() { this.sequence([[523,.11,'triangle',.028],[659,.11,'triangle',.028],[784,.11,'triangle',.03],[1047,.2,'triangle',.03]]); },
    defeat() { this.sequence([[290,.13,'triangle',.023],[220,.16,'triangle',.02],[165,.23,'sine',.018]]); },
    thunder() { this.sequence([[190,.16,'sawtooth',.025,70],[820,.08,'square',.02],[380,.18,'sawtooth',.02,90]]); }
  };

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => element.classList.remove('show'), 1900);
  }

  function persistBest() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.best)); } catch { /* private browsing */ }
    renderRecords();
  }

  function updateRecord(key, value) {
    if (value > (state.best[key] || 0)) {
      state.best[key] = value;
      persistBest();
      toast('Novo recorde neste aparelho.');
      return true;
    }
    return false;
  }

  function renderRecords() {
    $('#bestRun').textContent = state.best.run > 0 ? `RECORDE ${state.best.run.toFixed(1)}s` : 'RECORDE —';
    $('#bestBattle').textContent = `VITÓRIAS ${state.best.battleWins || 0}`;
    $('#bestSnack').textContent = state.best.snack > 0 ? `RECORDE ${state.best.snack}` : 'RECORDE —';
  }

  function soundButton() {
    const button = $('#musicBtn');
    $('#soundIcon').textContent = state.sound ? '🔊' : '🔇';
    button.setAttribute('aria-pressed', String(state.sound));
    button.setAttribute('aria-label', state.sound ? 'Desligar efeitos sonoros' : 'Ligar efeitos sonoros');
    audio.muted = !state.sound;
  }

  function showPage(id) {
    stopRun();
    stopBattle();
    stopSnack();
    state.page = id;
    $$('.page').forEach(page => page.classList.toggle('active', page.id === id));
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (id === 'run') initRun();
    if (id === 'battle') initBattle();
    if (id === 'snack') initSnack();
    if (id === 'home') renderRecords();
  }

  function goHome() { showPage('home'); }
  $$('[data-home]').forEach(button => button.addEventListener('click', goHome));
  $$('[data-game]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.game)));
  $('#randomGame').addEventListener('click', () => {
    const options = ['run', 'battle', 'snack'].filter(id => id !== state.page);
    showPage(options[integer(0, options.length - 1)]);
  });
  $('#musicBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    soundButton();
    if (state.sound) { audio.unlock(); audio.tone(690, .07, 'triangle', .025); }
  });

  // Keep image failures local and show a deliberate character fallback.
  $$('img').forEach(image => {
    image.addEventListener('error', () => image.closest('.chaser-character,.fighter-pic')?.classList.add('no-image'));
    if (image.complete && image.naturalWidth === 0) image.closest('.chaser-character,.fighter-pic')?.classList.add('no-image');
  });

  /* =========================================================
     GAME 01 — FOGE, NEZUKO!
     Pointer/touch movement, fair chase AI, telegraphed Thunder Breathing.
     ========================================================= */
  const R = {
    active: false, paused: false, raf: 0, last: 0, time: 0, distance: 0,
    x: 0, y: 0, targetX: 0, targetY: 0, zX: 0, zY: 0,
    stamina: 100, dashTime: 0, dashCooldown: 0, playerInvulnerable: 0,
    dragging: false, pointerId: null, pointerType: 'mouse',
    thunder: 'idle', thunderTimer: 0, thunderCooldown: 0,
    thunderAimX: 0, thunderAimY: 0, thunderBurst: 0,
    pickup: null, pickupTimer: 7, pickupLife: 0,
    lastDistance: 0, messageTimer: 0, rafWasHidden: false
  };

  const runStage = $('#runStage');
  const nezuko = $('#nezuko');
  const zenitsu = $('#zenitsu');
  const pickupElement = $('#runPickup');
  const warningElement = $('#thunderWarning');

  function resetRunState() {
    const width = runStage.clientWidth || 360;
    const height = runStage.clientHeight || 520;
    R.active = false; R.paused = false; R.time = 0; R.distance = 0;
    R.x = width * .22; R.y = height * .58;
    R.targetX = R.x; R.targetY = R.y;
    R.zX = width * .77; R.zY = height * .36;
    R.stamina = 100; R.dashTime = 0; R.dashCooldown = 0; R.playerInvulnerable = 0;
    R.dragging = false; R.pointerId = null; R.pointerType = 'mouse';
    R.thunder = 'idle'; R.thunderTimer = 0; R.thunderCooldown = random(14, 18); R.thunderBurst = 0;
    R.pickup = null; R.pickupTimer = 6; R.pickupLife = 0;
    R.lastDistance = 0;
    positionRun();
    updateRunHud();
    pickupElement.classList.add('hidden');
    warningElement.classList.add('hidden');
    $('#runFx').innerHTML = '';
    $('#runMessage').classList.remove('show');
    $('#runStart').classList.remove('hidden');
    $('#runPause').classList.add('hidden');
    $('#runEnd').classList.add('hidden');
    $('#dashBtn').disabled = true;
    $('#runPauseBtn').disabled = true;
    $('#dashHint').textContent = '35 FÔLEGO';
  }

  function initRun() {
    stopRun();
    resetRunState();
  }

  function positionRun() {
    if (!runStage) return;
    const width = runStage.clientWidth || 360;
    const height = runStage.clientHeight || 520;
    const pad = 40;
    R.x = clamp(R.x, pad, width - pad);
    R.y = clamp(R.y, 88, height - 52);
    R.zX = clamp(R.zX, pad, width - pad);
    R.zY = clamp(R.zY, 88, height - 52);
    nezuko.style.left = `${R.x}px`;
    nezuko.style.top = `${R.y}px`;
    zenitsu.style.left = `${R.zX}px`;
    zenitsu.style.top = `${R.zY}px`;
  }

  function setRunTarget(clientX, clientY) {
    const rect = runStage.getBoundingClientRect();
    const pad = 38;
    R.targetX = clamp(clientX - rect.left, pad, rect.width - pad);
    R.targetY = clamp(clientY - rect.top, 86, rect.height - 50);
  }

  runStage.addEventListener('pointerdown', event => {
    if (!R.active || R.paused || event.target.closest('#dashBtn')) return;
    if (event.pointerType !== 'mouse') {
      R.dragging = true;
      R.pointerId = event.pointerId;
      R.pointerType = event.pointerType;
      try { runStage.setPointerCapture(event.pointerId); } catch { /* browser may not support */ }
    } else {
      R.pointerType = 'mouse';
    }
    setRunTarget(event.clientX, event.clientY);
  });

  runStage.addEventListener('pointermove', event => {
    if (!R.active || R.paused) return;
    if (event.pointerType === 'mouse' || (R.dragging && event.pointerId === R.pointerId)) {
      setRunTarget(event.clientX, event.clientY);
    }
  });

  function endRunPointer(event) {
    if (event.pointerId === R.pointerId) {
      R.dragging = false;
      R.pointerId = null;
    }
  }
  runStage.addEventListener('pointerup', endRunPointer);
  runStage.addEventListener('pointercancel', endRunPointer);

  function flashRun(text, kind = 'normal') {
    if (!R.active) return;
    const message = $('#runMessage');
    message.textContent = text;
    message.dataset.kind = kind;
    message.classList.add('show');
    window.clearTimeout(R.messageTimer);
    R.messageTimer = window.setTimeout(() => message.classList.remove('show'), 1050);
  }

  function createThunderBolt() {
    const bolt = document.createElement('div');
    bolt.className = 'thunder-bolt';
    bolt.textContent = 'ϟ';
    bolt.style.left = `${R.zX / runStage.clientWidth * 100}%`;
    runStage.appendChild(bolt);
    window.setTimeout(() => bolt.remove(), 520);
  }

  function showRunFx(text) {
    const fx = $('#runFx');
    const element = document.createElement('div');
    element.className = 'run-particle';
    element.textContent = text;
    fx.appendChild(element);
    window.setTimeout(() => element.remove(), 650);
  }

  function startRun() {
    audio.unlock();
    R.active = true; R.paused = false;
    R.last = performance.now();
    $('#runStart').classList.add('hidden');
    $('#runEnd').classList.add('hidden');
    $('#dashBtn').disabled = false;
    $('#runPauseBtn').disabled = false;
    $('#runPauseBtn').textContent = 'Ⅱ PAUSAR';
    $('#runStage').focus?.();
    R.raf = requestAnimationFrame(runLoop);
    flashRun('NEZUKO, PELA ESQUERDA!', 'pink');
  }

  function dashRun() {
    if (!R.active || R.paused || R.stamina < 35 || R.dashCooldown > 0) return;
    const dx = R.targetX - R.x;
    const dy = R.targetY - R.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dx / length, ny = dy / length;
    R.dashTime = .34;
    R.dashCooldown = 1.5;
    R.stamina -= 35;
    R.playerInvulnerable = .22;
    R.x = clamp(R.x + nx * 25, 40, runStage.clientWidth - 40);
    R.y = clamp(R.y + ny * 25, 90, runStage.clientHeight - 54);
    audio.sequence([[800,.055,'square',.018],[1160,.075,'triangle',.024]]);
    haptic([12, 24, 12]);
    showRunFx('✦');
    flashRun('ARRANCADA!', 'cyan');
    updateRunHud();
  }

  $('#dashBtn').addEventListener('click', dashRun);
  $('#runStartBtn').addEventListener('click', startRun);
  $('#runAgain').addEventListener('click', initRun);

  function pauseRun() {
    if (!R.active || R.paused) return;
    R.paused = true;
    cancelAnimationFrame(R.raf);
    $('#runPause').classList.remove('hidden');
    $('#runPauseBtn').textContent = '▶ CONTINUAR';
  }
  function resumeRun() {
    if (!R.active || !R.paused) return;
    R.paused = false;
    R.last = performance.now();
    $('#runPause').classList.add('hidden');
    $('#runPauseBtn').textContent = 'Ⅱ PAUSAR';
    R.raf = requestAnimationFrame(runLoop);
  }
  $('#runPauseBtn').addEventListener('click', () => R.paused ? resumeRun() : pauseRun());
  $('#runResumeBtn').addEventListener('click', resumeRun);
  document.addEventListener('keydown', event => {
    if (state.page === 'run' && event.code === 'Space' && R.active && !R.paused) {
      event.preventDefault();
      dashRun();
    }
  });

  function spawnPickup() {
    if (R.pickup) return;
    const width = runStage.clientWidth, height = runStage.clientHeight;
    R.pickup = { x: random(width * .18, width * .82), y: random(height * .22, height * .76) };
    R.pickupLife = 5.4;
    pickupElement.style.left = `${R.pickup.x}px`;
    pickupElement.style.top = `${R.pickup.y}px`;
    pickupElement.classList.remove('hidden');
    flashRun('UMA PÉTALA APARECEU', 'pink');
  }

  function updateRunHud() {
    $('#runScore').textContent = `${R.time.toFixed(1)}s`;
    $('#runDistance').textContent = `${Math.floor(R.distance)} m`;
    $('#runStamina').style.width = `${R.stamina}%`;
    $('#staminaText').textContent = `${Math.floor(R.stamina)}%`;
    const distance = Math.hypot(R.x - R.zX, R.y - R.zY);
    const danger = $('#runDanger');
    if (distance < 92) {
      danger.textContent = 'PERTO'; danger.className = 'danger-high';
    } else if (distance < 175) {
      danger.textContent = 'ATENÇÃO'; danger.className = 'danger-mid';
    } else {
      danger.textContent = 'DISTANTE'; danger.className = 'danger-low';
    }
    const dashButton = $('#dashBtn');
    dashButton.disabled = !R.active || R.paused || R.stamina < 35 || R.dashCooldown > 0;
    $('#dashHint').textContent = R.dashCooldown > 0 ? `${R.dashCooldown.toFixed(1)}s` : `${Math.floor(R.stamina)} FÔLEGO`;
  }

  function thunderPhase() {
    if (R.thunder === 'idle' && R.thunderCooldown <= 0) {
      R.thunder = 'warning';
      R.thunderTimer = 1.25;
      const warning = $('#thunderWarning');
      warning.classList.remove('hidden');
      audio.tone(390, .12, 'sawtooth', .018, 540);
      flashRun('ZENITSU PREPAROU A TÉCNICA!', 'gold');
      return;
    }
    if (R.thunder === 'warning' && R.thunderTimer <= 0) {
      R.thunder = 'burst';
      R.thunderBurst = .82;
      R.thunderCooldown = random(11, 14);
      R.thunderAimX = R.x + (R.x - R.zX) * .35;
      R.thunderAimY = R.y + (R.y - R.zY) * .35;
      $('#thunderWarning').classList.add('hidden');
      createThunderBolt();
      audio.thunder();
      haptic([35, 45, 55]);
      flashRun('RESPIRAÇÃO DO TROVÃO!', 'gold');
      $('#zenitsu').classList.add('thunder-dash');
      return;
    }
    if (R.thunder === 'burst' && R.thunderBurst <= 0) {
      R.thunder = 'idle';
      $('#zenitsu').classList.remove('thunder-dash');
    }
  }

  function runLoop(now) {
    if (!R.active || R.paused) return;
    const dt = Math.min(.034, Math.max(0, (now - R.last) / 1000));
    R.last = now;
    if (document.hidden) {
      R.raf = requestAnimationFrame(runLoop);
      return;
    }

    R.time += dt;
    R.distance += dt * (4.2 + Math.min(2.8, R.time / 14));
    R.dashTime = Math.max(0, R.dashTime - dt);
    R.dashCooldown = Math.max(0, R.dashCooldown - dt);
    R.playerInvulnerable = Math.max(0, R.playerInvulnerable - dt);
    R.thunderCooldown -= dt;
    R.thunderTimer -= R.thunder === 'warning' ? dt : 0;
    R.thunderBurst -= R.thunder === 'burst' ? dt : 0;
    R.pickupTimer -= dt;
    R.pickupLife -= R.pickup ? dt : 0;

    const width = runStage.clientWidth, height = runStage.clientHeight;
    if (R.dashTime > 0) {
      const dx = R.targetX - R.x, dy = R.targetY - R.y;
      const length = Math.hypot(dx, dy) || 1;
      R.x += dx / length * 470 * dt;
      R.y += dy / length * 470 * dt;
    } else {
      const dx = R.targetX - R.x, dy = R.targetY - R.y;
      const length = Math.hypot(dx, dy);
      if (length > 1) {
        const move = Math.min(length, 305 * dt);
        R.x += dx / length * move;
        R.y += dy / length * move;
      }
    }

    // Zenitsu closes distance slowly; the Thunder Breathing attack is the burst threat.
    const diffX = R.x - R.zX, diffY = R.y - R.zY;
    const separation = Math.hypot(diffX, diffY) || 1;
    let zenitsuSpeed = 68 + Math.min(22, R.time * .52);
    if (R.thunder === 'burst') {
      const aimX = R.thunderAimX - R.zX, aimY = R.thunderAimY - R.zY;
      const aimLength = Math.hypot(aimX, aimY) || 1;
      R.zX += aimX / aimLength * 285 * dt;
      R.zY += aimY / aimLength * 285 * dt;
    } else {
      R.zX += diffX / separation * zenitsuSpeed * dt;
      R.zY += diffY / separation * zenitsuSpeed * dt;
    }

    R.x = clamp(R.x, 38, width - 38);
    R.y = clamp(R.y, 86, height - 50);
    R.zX = clamp(R.zX, 38, width - 38);
    R.zY = clamp(R.zY, 86, height - 50);

    if (R.pickup && R.pickupLife <= 0) {
      R.pickup = null; pickupElement.classList.add('hidden'); R.pickupTimer = random(7, 10);
    } else if (!R.pickup && R.pickupTimer <= 0) {
      spawnPickup(); R.pickupTimer = random(10, 14);
    }
    if (R.pickup && Math.hypot(R.x - R.pickup.x, R.y - R.pickup.y) < 42) {
      R.stamina = clamp(R.stamina + 32, 0, 100);
      R.pickup = null; pickupElement.classList.add('hidden');
      audio.collect(); haptic(18); flashRun('FÔLEGO RECUPERADO', 'cyan');
    }

    R.stamina = Math.min(100, R.stamina + dt * 9);
    thunderPhase();
    positionRun();
    updateRunHud();

    const touchDistance = Math.hypot(R.x - R.zX, R.y - R.zY);
    const catchDistance = R.playerInvulnerable > 0 ? 21 : 32;
    if (touchDistance < catchDistance) {
      finishRun(false);
      return;
    }
    if (R.time >= 40) {
      finishRun(true);
      return;
    }
    R.raf = requestAnimationFrame(runLoop);
  }

  function finishRun(escaped) {
    if (!R.active) return;
    R.active = false;
    cancelAnimationFrame(R.raf);
    $('#dashBtn').disabled = true;
    $('#runPauseBtn').disabled = true;
    $('#runEndEmoji').textContent = escaped ? '🌸' : '💍';
    $('#runEndEyebrow').textContent = escaped ? 'FUGA CONCLUÍDA' : 'PERSEGUIDOR ALCANÇOU';
    $('#runEndTitle').textContent = escaped ? 'NEZUKO ESCAPOU!' : 'CASA COMIGO, NEZUKOOOO!';
    $('#runEndText').textContent = escaped
      ? 'Zenitsu tropeçou na própria pressa. “Ela… ela realmente me deixou para trás…” 😭'
      : 'Zenitsu alcançou a Nezuko e já começou: “CASA COMIGO, NEZUKOOOO! EU ATRAVESSO O JAPÃO POR VOCÊ!” 😭💍';
    $('#runFinal').textContent = `${R.time.toFixed(1)}s`;
    $('#runEnd').classList.remove('hidden');
    if (escaped) updateRecord('run', R.time);
    escaped ? audio.victory() : audio.defeat();
  }

  function stopRun() {
    R.active = false; R.paused = false;
    cancelAnimationFrame(R.raf);
    window.clearTimeout(R.messageTimer);
    $('#runPause')?.classList.add('hidden');
    $('#thunderWarning')?.classList.add('hidden');
    $('#zenitsu')?.classList.remove('thunder-dash');
  }

  window.addEventListener('resize', () => {
    if (state.page !== 'run') return;
    const width = runStage.clientWidth, height = runStage.clientHeight;
    R.x = clamp(R.x, 38, width - 38); R.targetX = clamp(R.targetX, 38, width - 38);
    R.zX = clamp(R.zX, 38, width - 38);
    R.y = clamp(R.y, 86, height - 50); R.targetY = clamp(R.targetY, 86, height - 50);
    R.zY = clamp(R.zY, 86, height - 50);
    positionRun();
  });

  /* =========================================================
     GAME 02 — SKY VS SHADOW
     Turn-based tactics, readable choices, Shadow-only awakening.
     ========================================================= */
  const B = {
    active: false, busy: false, player: null, sky: 100, shadow: 100,
    shadowEnergy: 0, round: 1, combo: 0, guard: { sky: 0, shadow: 0 },
    weakened: { sky: 0, shadow: 0 }, awakenedTurns: 0,
    snacks: { sky: 2, shadow: 2 }, pounceCooldown: { sky: 0, shadow: 0 },
    timer: 0, turnOwner: 'player', lastAction: ''
  };

  function initBattle() {
    stopBattle();
    Object.assign(B, {
      active: false, busy: false, player: null, sky: 100, shadow: 100,
      shadowEnergy: 0, round: 1, combo: 0, guard: { sky: 0, shadow: 0 },
      weakened: { sky: 0, shadow: 0 }, awakenedTurns: 0,
      snacks: { sky: 2, shadow: 2 }, pounceCooldown: { sky: 0, shadow: 0 },
      turnOwner: 'player', lastAction: ''
    });
    $('#battleStart').classList.remove('hidden');
    $('#battleEnd').classList.add('hidden');
    $('#battleLog').textContent = 'Escolha Sky ou Shadow para iniciar a luta.';
    $('#battleTurnLabel').textContent = 'AGUARDANDO ESCOLHA';
    $('#turnPill').textContent = 'ESCOLHA';
    $('#playerName').textContent = '—';
    $('#chaosAction').hidden = true;
    $('#chaosAction').disabled = true;
    updateBattleUI();
    enableBattleActions(false);
  }

  function pickFighter(fighter) {
    if (!['sky', 'shadow'].includes(fighter)) return;
    audio.unlock();
    B.player = fighter; B.active = true; B.busy = false; B.turnOwner = 'player';
    haptic(12);
    $('#battleStart').classList.add('hidden');
    $('#playerName').textContent = fighter === 'sky' ? 'SKY' : 'SHADOW';
    $('#battleTurnLabel').textContent = 'SUA VEZ';
    $('#turnPill').textContent = 'SUA VEZ';
    $('#chaosAction').hidden = fighter !== 'shadow';
    $('#battleLog').textContent = fighter === 'sky'
      ? 'Sky entrou ligeira. Shadow acompanha cada movimento.'
      : 'Shadow entrou sem pressa. A energia do caos ainda está em zero.';
    updateBattleUI();
    B.busy = false;
    enableBattleActions(true);
  }

  $$('[data-pick]').forEach(button => button.addEventListener('click', () => pickFighter(button.dataset.pick)));
  $$('[data-action]').forEach(button => {
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.action;
      if (button.disabled) return;
      if (action === 'awakening') playerAwakening();
      else playerBattleAction(action);
    });
  });

  function enableBattleActions(enabled) {
    const usable = enabled && !B.busy && B.active;
    $$('[data-action]').forEach(button => {
      if (button.dataset.action === 'awakening') return;
      button.disabled = !usable;
    });
    const pounce = $('[data-action="pounce"]');
    const snack = $('[data-action="snack"]');
    const me = B.player || 'sky';
    if (pounce) {
      const cd = B.pounceCooldown[me];
      pounce.disabled = !usable || cd > 0;
      pounce.querySelector('small').textContent = cd > 0 ? `Recarga: ${cd} turno(s)` : 'Mais dano; pode errar';
    }
    if (snack) {
      snack.disabled = !usable || B.snacks[me] <= 0;
      $('#snackCount').textContent = `${B.snacks[me]} restantes`;
    }
    const canAwaken = B.active && !B.busy && B.player === 'shadow' && B.shadowEnergy >= 100 && B.awakenedTurns <= 0;
    $('#chaosAction').disabled = !canAwaken;
  }

  function updateBattleUI() {
    $('#skyHp').style.width = `${clamp(B.sky, 0, 100)}%`;
    $('#shadowHp').style.width = `${clamp(B.shadow, 0, 100)}%`;
    $('#energyBar').style.width = `${clamp(B.shadowEnergy, 0, 100)}%`;
    $('#energyText').textContent = `${Math.floor(B.shadowEnergy)} / 100`;
    $('#round').textContent = B.round;
    $('#comboText').textContent = B.combo;
    $('#comboBar').style.width = `${Math.min(100, B.combo * 20)}%`;
    $('#skyState').textContent = B.player === 'sky' ? 'VOCÊ' : (B.guard.sky ? 'DEFENDENDO' : 'OPONENTE');
    $('#shadowState').textContent = B.awakenedTurns > 0 ? 'DESPERTADO' : (B.player === 'shadow' ? 'VOCÊ' : (B.guard.shadow ? 'DEFENDENDO' : 'OPONENTE'));
    $('#skyStatus').innerHTML = [
      B.guard.sky ? '<span class="status-chip">🛡️ GUARDA</span>' : '',
      B.weakened.sky ? `<span class="status-chip">↘ PRÓXIMO ATAQUE -40%</span>` : ''
    ].join('');
    $('#shadowStatus').innerHTML = [
      B.guard.shadow ? '<span class="status-chip">🛡️ GUARDA</span>' : '',
      B.awakenedTurns ? `<span class="status-chip">🌀 CAOS ${B.awakenedTurns}</span>` : '',
      B.weakened.shadow ? `<span class="status-chip">↘ PRÓXIMO ATAQUE -40%</span>` : ''
    ].join('');
    $('#awakeningStatus').textContent = B.awakenedTurns > 0
      ? `Despertado por mais ${B.awakenedTurns} turno(s).`
      : B.shadowEnergy >= 100 ? 'Energia completa. O Despertar pode ser ativado.'
      : `Faltam ${Math.max(0, 100 - Math.floor(B.shadowEnergy))} pontos para o Despertar.`;
    enableBattleActions(B.active && !B.busy);
  }

  function battleLog(message) {
    $('#battleLog').textContent = message;
  }

  function battleEffect(message, color = '#fff') {
    const layer = $('#battleFx');
    const arena = $('#arena');
    layer.innerHTML = '';
    const pop = document.createElement('div');
    const effectClass = /ERROU/i.test(message) ? 'fx-miss'
      : /ESQUIVA|DEFESA/i.test(message) ? 'fx-guard'
      : /NHAC|PETISCO/i.test(message) ? 'fx-heal'
      : /CHAOS|DESPERT/i.test(message) ? 'fx-chaos'
      : /ENCARADA/i.test(message) ? 'fx-taunt'
      : 'fx-hit';
    pop.className = `battle-pop ${effectClass}`;
    pop.style.color = color;
    pop.textContent = message;
    layer.appendChild(pop);
    arena.classList.remove('battle-impact','battle-miss','battle-heal','battle-chaos');
    void arena.offsetWidth;
    arena.classList.add(effectClass === 'fx-miss' ? 'battle-miss' : effectClass === 'fx-heal' ? 'battle-heal' : effectClass === 'fx-chaos' ? 'battle-chaos' : 'battle-impact');
    window.setTimeout(() => {
      pop.remove();
      arena.classList.remove('battle-impact','battle-miss','battle-heal','battle-chaos');
    }, 650);
  }

  function fighterHit(name) {
    const pic = name === 'sky' ? $('#skyPic') : $('#shadowPic');
    const fighter = name === 'sky' ? $('#skyFighter') : $('#shadowFighter');
    pic.classList.remove('fighter-hit');
    fighter.classList.remove('targeted');
    void pic.offsetWidth;
    pic.classList.add('fighter-hit');
    fighter.classList.add('targeted');
    window.setTimeout(() => fighter.classList.remove('targeted'), 360);
  }

  function addShadowEnergy(amount) {
    B.shadowEnergy = clamp(B.shadowEnergy + amount, 0, 100);
  }

  function dealDamage(target, amount) {
    let rawDamage = Math.max(1, Math.round(amount));
    let weakenedHit = false;
    if (B.weakened[target] > 0) {
      weakenedHit = true;
      rawDamage = Math.max(1, Math.round(rawDamage * .60));
      B.weakened[target] = 0;
    }
    let damage = rawDamage;
    let blocked = 0;
    if (B.guard[target] > 0) {
      blocked = Math.min(B.guard[target], damage);
      B.guard[target] = 0;
      damage -= blocked;
    }
    damage = Math.max(0, damage);
    B[target] = Math.max(0, B[target] - damage);
    if (target === 'shadow' && damage > 0) addShadowEnergy(12);
    fighterHit(target);
    updateBattleUI();
    return { damage, blocked, weakenedHit };
  }

  function startPlayerTurn() {
    if (!B.active) return;
    B.busy = false;
    B.turnOwner = 'player';
    $('#battleTurnLabel').textContent = 'SUA VEZ';
    $('#turnPill').textContent = 'SUA VEZ';
    updateBattleUI();
    enableBattleActions(true);
  }

  function startEnemyTurn() {
    if (!B.active) return;
    B.busy = true;
    B.turnOwner = 'enemy';
    $('#battleTurnLabel').textContent = 'VEZ DO ADVERSÁRIO';
    $('#turnPill').textContent = 'OPONENTE';
    enableBattleActions(false);
    B.timer = window.setTimeout(enemyTurn, 720);
  }

  function actionName(fighter) { return fighter === 'sky' ? 'Sky' : 'Shadow'; }

  function playerBattleAction(action) {
    if (!B.active || B.busy) return;
    const me = B.player;
    const foe = me === 'sky' ? 'shadow' : 'sky';
    B.busy = true;
    B.lastAction = action;
    enableBattleActions(false);
    let line = '';
    let effect = '';
    let effectColor = '#fff';

    if (action === 'claw') {
      const base = integer(12, 17)
        + (me === 'sky' && B.combo >= 2 ? 4 : 0)
        + (me === 'sky' && B.combo >= 4 ? 3 : 0);
      const result = dealDamage(foe, base);
      B.combo += 1;
      if (me === 'shadow') addShadowEnergy(18);
      line = `${actionName(me)} acertou ${result.damage} de dano${result.blocked ? `; ${result.blocked} foram bloqueados` : ''}${result.weakenedHit ? ' — a encarada reduziu o golpe.' : ''}.`;
      effect = result.damage >= 17 ? 'ARRANHÃO!' : 'PATADA!';
      effectColor = me === 'sky' ? '#8deaff' : '#d7b5ff';
    } else if (action === 'pounce') {
      if (B.pounceCooldown[me] > 0) { B.busy = false; updateBattleUI(); return; }
      B.pounceCooldown[me] = me === 'sky' ? 1.5 : 2;
      const hitChance = me === 'sky' ? .82 : .78;
      if (Math.random() > hitChance) {
        B.combo = 0;
        line = `${actionName(me)} calculou mal a distância. O bote passou raspando.`;
        effect = 'ERROU!';
        effectColor = '#ffd17f';
      } else {
        const result = dealDamage(foe, integer(20, 27) + (me === 'shadow' && B.awakenedTurns > 0 ? 7 : 0));
        B.combo += 2;
        if (me === 'shadow') addShadowEnergy(24);
        line = `${actionName(me)} acertou um bote de ${result.damage} de dano${result.weakenedHit ? ' — a encarada reduziu o golpe.' : ''}.`;
        effect = 'BOTE!';
        effectColor = '#ffd17f';
      }
    } else if (action === 'guard') {
      B.guard[me] = me === 'sky' ? 25 : 22;
      B.combo = 0;
      if (me === 'shadow') addShadowEnergy(10);
      line = `${actionName(me)} recuou e preparou a esquiva. O próximo ataque perde até ${B.guard[me]} de dano.`;
      effect = 'ESQUIVA!';
      effectColor = '#8de7b2';
    } else if (action === 'snack') {
      if (B.snacks[me] <= 0) { B.busy = false; updateBattleUI(); return; }
      B.snacks[me] -= 1;
      const heal = Math.min(22, 100 - B[me]);
      B[me] = Math.min(100, B[me] + 22);
      B.combo = 0;
      if (me === 'shadow') addShadowEnergy(8);
      line = `${actionName(me)} parou para comer. Recuperou ${heal} de vida; restam ${B.snacks[me]} petisco(s).`;
      effect = 'NHAC!';
      effectColor = '#ffd17f';
    } else if (action === 'taunt') {
      B.weakened[foe] = 1;
      B.combo = 0;
      if (me === 'shadow') addShadowEnergy(14);
      line = `${actionName(me)} encarou sem piscar. O próximo ataque do adversário será mais fraco.`;
      effect = 'ENCARADA!';
      effectColor = '#e6d1ff';
    }

    updateBattleUI();
    battleLog(line);
    battleEffect(effect, effectColor);
    audio.tone(440 + (effect === 'BOTE!' ? 180 : 0), .09, 'triangle', .022);
    haptic(action === 'pounce' ? [18, 28] : 10);
    if (checkBattleEnd()) return;
    B.timer = window.setTimeout(startEnemyTurn, 610);
  }

  function playerAwakening() {
    if (!B.active || B.busy || B.player !== 'shadow' || B.shadowEnergy < 100 || B.awakenedTurns > 0) return;
    B.busy = true;
    B.shadowEnergy = 0;
    B.awakenedTurns = 3;
    B.shadow = Math.min(100, B.shadow + 8);
    $('#arena').classList.remove('awakening');
    void $('#arena').offsetWidth;
    $('#arena').classList.add('awakening');
    battleEffect('CHAOS CONTROL', '#c4a0ff');
    battleLog('Shadow despertou. O próximo movimento dele será mais forte por três turnos.');
    audio.sequence([[160,.12,'sawtooth',.024,620],[880,.12,'square',.022],[1240,.18,'triangle',.025]]);
    haptic([35, 30, 60]);
    updateBattleUI();
    B.timer = window.setTimeout(startEnemyTurn, 780);
  }

  function enemyTurn() {
    if (!B.active) return;
    const enemy = B.player === 'sky' ? 'shadow' : 'sky';
    const player = B.player;
    const enemyHP = B[enemy];
    const isShadowAwake = enemy === 'shadow' && B.awakenedTurns > 0;

    // Shadow's special meter charges when it is hit and when it acts.
    if (enemy === 'shadow' && B.shadowEnergy >= 100 && B.awakenedTurns <= 0) {
      B.shadowEnergy = 0;
      B.awakenedTurns = 3;
      B.shadow = Math.min(100, B.shadow + 6);
      $('#arena').classList.add('awakening');
      battleEffect('SHADOW DESPERTOU!', '#c4a0ff');
      battleLog('Shadow ativou o Chaos Control. Ele ficará mais forte por três turnos.');
      audio.sequence([[160,.12,'sawtooth',.024,620],[900,.1,'square',.02],[1250,.2,'triangle',.024]]);
      updateBattleUI();
      B.timer = window.setTimeout(() => {
        if (B.active) resolveEnemyMove(enemy, player);
      }, 820);
      return;
    }
    resolveEnemyMove(enemy, player);
  }

  function resolveEnemyMove(enemy, player) {
    if (!B.active) return;
    const hp = B[enemy];
    let line = '';
    let effect = '';
    let color = '#ff9bc6';
    const playerLow = B[player] < 36;
    const canSnack = B.snacks[enemy] > 0 && hp < 48;
    const isShadowAwake = enemy === 'shadow' && B.awakenedTurns > 0;
    const aggression = isShadowAwake ? .12 : 0;

    if (canSnack && (playerLow || hp < 27) && Math.random() < .48) {
      B.snacks[enemy]--;
      const heal = Math.min(19, 100 - B[enemy]);
      B[enemy] = Math.min(100, B[enemy] + 19);
      line = `${actionName(enemy)} aproveitou a distância para recuperar ${heal} de vida.`;
      effect = 'PETISCO!';
      color = '#ffd17f';
    } else if (B.pounceCooldown[enemy] <= 0
      && (Math.random() < (B[enemy] < 55 ? .62 : .39) + aggression)) {
      B.pounceCooldown[enemy] = 2;
      const chance = enemy === 'sky' ? .84 : .79;
      if (Math.random() > chance) {
        line = `${actionName(enemy)} tentou um bote, mas passou longe.`;
        effect = 'ERROU!';
        color = '#ffd17f';
      } else {
        const power = integer(17, 24) + (enemy === 'shadow' && B.awakenedTurns > 0 ? 8 : 0);
        const outcome = dealDamage(player, power);
        line = `${actionName(enemy)} avançou e causou ${outcome.damage} de dano${outcome.blocked ? `; ${outcome.blocked} foram bloqueados` : ''}${outcome.weakenedHit ? ' — a encarada enfraqueceu o bote.' : ''}.`;
        effect = enemy === 'shadow' && B.awakenedTurns > 0 ? 'CHAOS STRIKE!' : 'BOTE!';
      }
    } else if (Math.random() < .18 && B.guard[enemy] <= 0) {
      B.guard[enemy] = 18;
      line = `${actionName(enemy)} se protegeu. O próximo ataque será amortecido.`;
      effect = 'DEFESA!';
      color = '#8de7b2';
    } else {
      const amount = integer(11, 17) + (enemy === 'shadow' && B.awakenedTurns > 0 ? 7 : 0);
      const outcome = dealDamage(player, amount);
      line = `${actionName(enemy)} acertou um golpe de ${outcome.damage} de dano${outcome.blocked ? `; ${outcome.blocked} foram bloqueados` : ''}${outcome.weakenedHit ? ' — a encarada enfraqueceu o golpe.' : ''}.`;
      effect = enemy === 'shadow' && B.awakenedTurns > 0 ? 'CAOS!' : 'ARRANHÃO!';
    }

    if (enemy === 'shadow') addShadowEnergy(14);
    if (B.awakenedTurns > 0) B.awakenedTurns--;
    B.pounceCooldown.sky = Math.max(0, B.pounceCooldown.sky - 1);
    B.pounceCooldown.shadow = Math.max(0, B.pounceCooldown.shadow - 1);
    B.round++;
    B.combo = 0;
    updateBattleUI();
    battleLog(line);
    battleEffect(effect, color);
    if (enemy === 'sky') fighterHit('shadow');
    else fighterHit('sky');
    audio.tone(310, .1, 'triangle', .02);
    haptic(effect.includes('BOTE') || effect.includes('CAOS') ? [20, 24] : 8);
    if (checkBattleEnd()) return;
    B.timer = window.setTimeout(startPlayerTurn, 680);
  }

  function checkBattleEnd() {
    if (B.sky > 0 && B.shadow > 0) return false;
    B.active = false; B.busy = false;
    const won = B[B.player] > 0;
    $('#battleEndEmoji').textContent = won ? (B.player === 'sky' ? '☁️' : '🌀') : '🐾';
    $('#battleEndTitle').textContent = won ? `${actionName(B.player).toUpperCase()} VENCEU!` : 'A REVANCHE FICA PRA PRÓXIMA.';
    $('#battleEndText').textContent = won
      ? (B.player === 'shadow'
        ? 'O Chaos Control virou a luta no momento certo. Shadow ficou impossível de acompanhar.'
        : 'Sky venceu na velocidade. Shadow ficou olhando para o próprio rabo, tentando entender.')
      : `${actionName(B.player)} ficou sem energia antes do adversário.`;
    $('#battleFinal').textContent = B.round;
    $('#battleEnd').classList.remove('hidden');
    if (won) {
      state.best.battleWins += 1;
      persistBest();
      $('#battleEndText').textContent += ` Vitória nº ${state.best.battleWins} neste aparelho.`;
      audio.victory();
    }
    else audio.defeat();
    enableBattleActions(false);
    return true;
  }

  $('#battleAgain').addEventListener('click', initBattle);

  function stopBattle() {
    B.active = false; B.busy = false;
    window.clearTimeout(B.timer);
  }

  /* =========================================================
     GAME 03 — OPERAÇÃO PETISCO
     Mobile-first catch game: drag a cat horizontally, collect snacks,
     avoid vegetables, build combos and survive the chaos.
     ========================================================= */
  const S = {
    active:false, raf:0, last:0, selected:null, score:0, combo:0,
    lives:3, time:45, items:[], spawn:0, spawnGap:0.72,
    width:0, height:0, x:0, targetX:0, playerSpeed:0, fever:0,
    pointerId:null, dragging:false, invuln:0, messageTimer:0, bestStreak:0
  };

  const snackItems = [
    {emoji:'🍗', kind:'good', points:10, weight:5},
    {emoji:'🍖', kind:'good', points:14, weight:3},
    {emoji:'🐟', kind:'good', points:18, weight:2},
    {emoji:'🥒', kind:'bad', points:0, weight:2},
    {emoji:'🥕', kind:'bad', points:0, weight:2},
    {emoji:'🧅', kind:'bad', points:0, weight:1},
    {emoji:'⭐', kind:'gold', points:35, weight:1}
  ];

  function initSnack(){
    stopSnack();
    Object.assign(S,{active:false,score:0,combo:0,lives:3,time:45,items:[],spawn:0,spawnGap:.72,
      selected:null,width:0,height:0,x:0,targetX:0,playerSpeed:0,fever:0,pointerId:null,dragging:false,invuln:0,bestStreak:0});
    $('#snackStart').classList.remove('hidden');
    $('#snackEnd').classList.add('hidden');
    $('#snackStartBtn').disabled=true;
    $('#snackScore').textContent='0'; $('#snackCombo').textContent='x0';
    $('#snackLives').textContent='♥ ♥ ♥'; $('#snackTime').textContent='45s';
    $('#snackItems').innerHTML=''; $('#snackMessage').classList.remove('show');
    $('#snackPlayer').style.left='50%';
  }

  $('#snackPickSky').addEventListener('click',()=>selectSnackCat('sky'));
  $('#snackPickShadow').addEventListener('click',()=>selectSnackCat('shadow'));
  $('#snackStartBtn').addEventListener('click',startSnack);
  $('#snackAgain').addEventListener('click',initSnack);

  function selectSnackCat(cat){
    S.selected=cat;
    $('#snackPickSky').classList.toggle('selected-choice',cat==='sky');
    $('#snackPickShadow').classList.toggle('selected-choice',cat==='shadow');
    $('#snackStartBtn').disabled=false;
    const img=$('#snackPlayerImg');
    img.src=cat==='sky'?'assets/imagem3.png':'assets/imagem4.png';
    img.alt=cat==='sky'?'Sky':'Shadow';
    $('#snackPlayerName').textContent=cat==='sky'?'SKY':'SHADOW';
    $('#snackStartBtn').textContent='COMEÇAR A OPERAÇÃO →';
    audio.click();
  }

  function snackResize(){
    const board=$('#snackBoard');
    S.width=board.clientWidth||360; S.height=board.clientHeight||560;
    S.x=clamp(S.x||S.width*.5,45,S.width-45);
    S.targetX=clamp(S.targetX||S.x,45,S.width-45);
    $('#snackPlayer').style.left=`${S.x}px`;
  }

  function setSnackTarget(clientX){
    const rect=$('#snackBoard').getBoundingClientRect();
    S.targetX=clamp(clientX-rect.left,42,rect.width-42);
  }

  const snackBoard=$('#snackBoard');
  snackBoard.addEventListener('pointerdown',e=>{
    if(!S.active || e.target.closest('.game-overlay') || e.target.closest('.snack-item')) return;
    S.dragging=true; S.pointerId=e.pointerId;
    try{snackBoard.setPointerCapture(e.pointerId);}catch{}
    setSnackTarget(e.clientX);
  });
  snackBoard.addEventListener('pointermove',e=>{
    if(S.active && S.dragging && e.pointerId===S.pointerId) setSnackTarget(e.clientX);
  });
  ['pointerup','pointercancel'].forEach(type=>snackBoard.addEventListener(type,e=>{if(e.pointerId===S.pointerId){S.dragging=false;S.pointerId=null;}}));

  function snackMessage(text,kind='normal'){
    const el=$('#snackMessage'); el.textContent=text; el.dataset.kind=kind; el.classList.add('show');
    clearTimeout(S.messageTimer); S.messageTimer=setTimeout(()=>el.classList.remove('show'),720);
  }

  function weightedSnack(){
    const total=snackItems.reduce((a,b)=>a+b.weight,0); let n=Math.random()*total;
    for(const item of snackItems){n-=item.weight;if(n<=0)return item;}
    return snackItems[0];
  }

  function spawnSnack(){
    const data=weightedSnack();
    const el=document.createElement('button'); el.type='button'; el.className=`snack-item ${data.kind}`;
    el.textContent=data.emoji; el.setAttribute('aria-label',data.kind==='bad'?'Armadilha':'Petisco');
    const item={el,data,x:random(28,S.width-28),y:-35,vy:random(105,155)+(45-S.time)*1.8,rot:random(-12,12),hit:false};
    el.style.left=`${item.x}px`; el.style.top='-35px'; el.style.transform=`translate(-50%,-50%) rotate(${item.rot}deg)`;
    el.addEventListener('pointerdown',e=>e.stopPropagation());
    $('#snackItems').appendChild(el); S.items.push(item);
  }

  function collectSnack(item){
    if(item.hit)return; item.hit=true; item.el.remove();
    if(item.data.kind==='bad'){
      if(S.invuln>0)return; S.lives--; S.combo=0; S.invuln=.8;
      snackMessage(S.selected==='shadow'?'SHADOW: "ECA!"':'SKY: "ISSO NÃO ERA PETISCO!"','bad');
      audio.impact(); haptic([35,25]);
      if(S.lives<=0){finishSnack(false);return;}
    }else{
      S.combo=Math.min(12,S.combo+1); S.bestStreak=Math.max(S.bestStreak,S.combo);
      const multiplier=1+Math.min(3,S.combo*.12)+(S.fever>0?.5:0);
      const points=Math.round(item.data.points*multiplier); S.score+=points;
      if(S.combo===3) snackMessage('COMBO! 🐾','good');
      else if(S.combo===6) snackMessage('O GATO ENTROU NO MODO FOME! 🔥','gold');
      else if(item.data.kind==='gold') snackMessage('PETISCO DOURADO! +'+points,'gold');
      audio.collect(); haptic(12);
      if(S.combo>=6)S.fever=2.5;
    }
    updateSnackHud();
  }

  function startSnack(){
    if(!S.selected)return; audio.unlock();
    $('#snackStart').classList.add('hidden'); $('#snackEnd').classList.add('hidden');
    S.active=true; S.last=performance.now(); S.spawn=.15; S.spawnGap=.72; S.time=45;
    S.items=[]; S.score=0; S.combo=0; S.lives=3; S.fever=0; S.invuln=0; S.bestStreak=0;
    $('#snackItems').innerHTML=''; snackResize(); S.x=S.width*.5; S.targetX=S.x;
    $('#snackPlayer').style.left=`${S.x}px`;
    updateSnackHud(); cancelAnimationFrame(S.raf); S.raf=requestAnimationFrame(snackLoop);
  }

  function updateSnackHud(){
    $('#snackScore').textContent=S.score.toLocaleString('pt-BR');
    $('#snackCombo').textContent=`x${S.combo}`;
    $('#snackTime').textContent=`${Math.max(0,S.time).toFixed(1)}s`;
    $('#snackLives').textContent='♥ '.repeat(S.lives).trim()+'♡ '.repeat(3-S.lives);
  }

  function snackLoop(now){
    if(!S.active)return;
    const dt=Math.min(.035,Math.max(0,(now-S.last)/1000)); S.last=now;
    if(!document.hidden)S.time-=dt;
    S.invuln=Math.max(0,S.invuln-dt); S.fever=Math.max(0,S.fever-dt);
    const speed=(S.selected==='sky'?310:270)*(S.fever>0?1.08:1);
    S.x += clamp(S.targetX-S.x,-speed*dt,speed*dt);
    $('#snackPlayer').style.left=`${S.x}px`;
    if(S.invuln>0)$('#snackPlayer').classList.add('hurt');else $('#snackPlayer').classList.remove('hurt');
    S.spawn-=dt;
    if(S.spawn<=0){spawnSnack();S.spawn=Math.max(.34,S.spawnGap-(45-S.time)*.006);}
    const bottom=S.height-64;
    for(let i=S.items.length-1;i>=0;i--){
      const item=S.items[i]; if(item.hit)continue;
      item.y+=item.vy*dt; item.el.style.top=`${item.y}px`;
      item.el.style.transform=`translate(-50%,-50%) rotate(${item.rot+item.y*.12}deg)`;
      const dx=Math.abs(item.x-S.x), dy=Math.abs(item.y-(S.height-62));
      if(dx<48 && dy<48){collectSnack(item);S.items.splice(i,1);continue;}
      if(item.y>bottom+55){item.el.remove();S.items.splice(i,1);}
    }
    if(S.time<=0){finishSnack(true);return;}
    updateSnackHud(); S.raf=requestAnimationFrame(snackLoop);
  }

  function finishSnack(won){
    if(!S.active)return; S.active=false; cancelAnimationFrame(S.raf);
    $('#snackEndEmoji').textContent=won?'🏆':'🥒';
    $('#snackEndTitle').textContent=won?'A OPERAÇÃO FOI UM SUCESSO!':'O GATO DECLAROU GREVE.';
    $('#snackEndText').textContent=won
      ? `Você sobreviveu aos 45 segundos com ${S.bestStreak} de combo máximo. O estoque de petiscos oficialmente não está seguro.`
      : `${S.selected==='shadow'?'Shadow':'Sky'} encontrou um limite para a gula. Combo máximo: ${S.bestStreak}.`;
    $('#snackFinal').textContent=S.score.toLocaleString('pt-BR');
    $('#snackEnd').classList.remove('hidden');
    const isNew=updateRecord('snack',S.score);
    if(isNew)$('#snackEndText').textContent+=' Novo recorde neste aparelho!';
    won?audio.victory():audio.defeat();
  }

  function stopSnack(){
    S.active=false; cancelAnimationFrame(S.raf); clearTimeout(S.messageTimer);
    S.items.forEach(i=>i.el?.remove()); S.items=[]; S.dragging=false;
  }

  // Pause the chase when the user switches tabs/apps; never let a timer run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.page === 'run' && R.active && !R.paused) pauseRun();
      if (state.page === 'snack' && S.active) S.last = performance.now();
    }
  });

  renderRecords();
  soundButton();
})();