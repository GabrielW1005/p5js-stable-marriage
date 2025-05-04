let men = [];
let women = [];
const numPairs = 5;
const manColor = '#4A90E2';
const womanColor = '#E94A86';
let matches = []; // Array of {man: i, woman: j}
let manPrefs = [];
let womanPrefs = [];

// Character names
const menNames = ['Eric', 'Li Shang', 'Hercules', 'Aladdin', 'Beast'];
const womenNames = ['Belle', 'Pocahontas', 'Mulan', 'Jasmine', 'Ariel'];

// Track marked preferences
let markedPrefs = {
  men: Array(numPairs).fill().map(() => new Set()),
  women: Array(numPairs).fill().map(() => new Set())
};

// Drag state
let dragging = null; // {type: 'man'|'woman', index: number, offsetX, offsetY}
let originalPos = null;

// Animation state
let affairAnimating = false;
let affairMan = null;
let affairWoman = null;
let affairManTarget = null;
let affairWomanTarget = null;
let affairPrevManPartner = null;
let affairPrevWomanPartner = null;
let affairStep = 0;

// Chain-reaction affair state
let chainActive = false;
let chainStepData = null;
let chainPhase = 0; // 0: affair animation, 1: match affair, 2: cheated animation, 3: match cheated
let chainDelay = 0;
let matchSlots = [];
let matchSlotIndex = 0;

// Dynamic slot grid
const SLOT_COLS = 3;
const SLOT_ROWS = 5;
const SLOT_GAP_X = 90;
const SLOT_GAP_Y = 90;
const SLOT_LEFT_BASE_X = 160;
const SLOT_RIGHT_BASE_X = 600;
const SLOT_BASE_Y = 80;
let slotGrid = [];

let affairMode = 'chain';

let oneAffairActive = false;
let oneAffairData = null;

let roommateMode = false;
let roommates = [];
let roommatePrefs = [];
let roommatePairs = [];
let selectedRoommate = null;

// Add roommate drag state
let roommateDragging = null; // {index, offsetX, offsetY}
let roommateOriginalPos = null;
let roommatePairSlots = [];
let roommatePairSlotIndex = 0;

// --- Stable Roommate Problem Animation State ---
let roommateAffairActive = false;
let roommateAffairData = null;

let menImages = [];
let womenImages = [];

function shuffle(arr) {
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePreferences() {
  manPrefs = [];
  womanPrefs = [];
  for (let i = 0; i < numPairs; i++) {
    let menList = Array.from({length: numPairs}, (_, j) => j);
    let womenList = Array.from({length: numPairs}, (_, j) => j);
    manPrefs.push(shuffle([...womenList]));
    womanPrefs.push(shuffle([...menList]));
  }
}

function preload() {
  for (let i = 0; i < numPairs; i++) {
    menImages[i] = loadImage('disneyfacesmarriage/men/' + i + '.png');
    womenImages[i] = loadImage('disneyfacesmarriage/women/' + i + '.png');
  }
}

function setup() {
  let canvas = createCanvas(800, 400);
  canvas.parent('game-container');
  men = [];
  women = [];
  for (let i = 0; i < numPairs; i++) {
    men.push({
      x: 150,
      y: 30 + i * 70,
      color: manColor,
      homeX: 150,
      homeY: 30 + i * 70,
      paired: false,
      pairIndex: null
    });
    women.push({
      x: 650,
      y: 30 + i * 70,
      color: womanColor,
      homeX: 650,
      homeY: 30 + i * 70,
      paired: false,
      pairIndex: null
    });
  }
  matches = [];
  resetMatchSlots();
  generatePreferences();
  updateMatchesDisplay();
  updatePreferencesDisplay();
  setupButtons();
}

function draw() {
  if (affairMode === 'roommate') {
    roommateMode = true;
    drawRoommateMode();
    return;
  } else {
    roommateMode = false;
  }

  // --- Stable Marriage/affair modes below ---
  background(245);
  textAlign(CENTER, CENTER);
  textSize(18);
  fill(0);

  if (affairMode === 'chain' && chainActive && chainStepData) {
    // Chain-reaction affair animation (sequential)
    let speed = 200;
    let dt = Math.min(deltaTime, 50) / 1000;
    if (chainPhase === 0) {
      // Animate affair couple
      chainStepData.step++;
      let m = men[chainStepData.affairMan];
      let w = women[chainStepData.affairWoman];
      moveTowards(m, chainStepData.affairManTarget, speed, dt);
      moveTowards(w, chainStepData.affairWomanTarget, speed, dt);
      if (chainStepData.step > 120) {
        chainPhase = 1;
        chainStepData.step = 0;
        setTimeout(() => {
          performChainUpdate(1); // Match affair couple
        }, 200);
      }
    } else if (chainPhase === 1) {
      // Wait a moment, then animate cheated partners
      chainPhase = 2;
      chainStepData.step = 0;
    } else if (chainPhase === 2) {
      // Animate cheated partners
      chainStepData.step++;
      if (chainStepData.prevManPartner !== null) {
        let cheatedW = women[chainStepData.prevManPartner];
        moveTowards(cheatedW, chainStepData.cheatedWomanTarget, speed, dt);
      }
      if (chainStepData.prevWomanPartner !== null) {
        let cheatedM = men[chainStepData.prevWomanPartner];
        moveTowards(cheatedM, chainStepData.cheatedManTarget, speed, dt);
      }
      if (chainStepData.step > 120) {
        chainPhase = 3;
        chainStepData.step = 0;
        setTimeout(() => {
          performChainUpdate(3); // Match cheated partners
        }, 200);
      }
    } else if (chainPhase === 3) {
      // Wait a moment, then proceed to next step
      chainPhase = 4;
      chainStepData.step = 0;
      setTimeout(() => {
        if (!chainReactionStep()) {
          showResultMessage({stable: true, message: 'Stable!'});
        }
      }, 400);
      chainActive = false;
    }
  } else if (affairMode === 'one' && oneAffairActive && oneAffairData) {
    // One Affair mode: only animate the affair couple
    let speed = 200;
    let dt = Math.min(deltaTime, 50) / 1000;
    oneAffairData.step++;
    let m = men[oneAffairData.affairMan];
    let w = women[oneAffairData.affairWoman];
    moveTowards(m, oneAffairData.affairManTarget, speed, dt);
    moveTowards(w, oneAffairData.affairWomanTarget, speed, dt);
    if (oneAffairData.step > 120) {
      // Remove old match for m and free its slot
      let old = matches.find(pair => pair.man === oneAffairData.affairMan);
      if (old && old.slotIndex != null) freeMatchSlot(old.slotIndex);
      matches = matches.filter(pair => !(pair.man === oneAffairData.affairMan));
      // Add new match for m
      matches.push({man: oneAffairData.affairMan, woman: oneAffairData.affairWoman, slotIndex: oneAffairData.affairSlotIndex});
      men[oneAffairData.affairMan].x = oneAffairData.affairManTarget.x;
      men[oneAffairData.affairMan].y = oneAffairData.affairManTarget.y;
      women[oneAffairData.affairWoman].x = oneAffairData.affairWomanTarget.x;
      women[oneAffairData.affairWoman].y = oneAffairData.affairWomanTarget.y;
      clearPairingFlags();
      updateMatchesDisplay();
      // Don't clear the result message here
      oneAffairActive = false;
      oneAffairData = null;
    }
  }

  // Draw men
  imageMode(CENTER);
  for (let i = 0; i < men.length; i++) {
    if (menImages[i]) {
      image(menImages[i], men[i].x, men[i].y, 50, 50);
    } else {
      fill(men[i].color);
      ellipse(men[i].x, men[i].y, 50, 50);
    }
  }
  // Draw women
  imageMode(CENTER);
  for (let i = 0; i < women.length; i++) {
    if (womenImages[i]) {
      image(womenImages[i], women[i].x, women[i].y, 50, 50);
    } else {
      fill(women[i].color);
      ellipse(women[i].x, women[i].y, 50, 50);
    }
  }

  // Highlight dragged
  if (dragging) {
    stroke(255, 180, 0);
    strokeWeight(4);
    if (dragging.type === 'man') {
      ellipse(men[dragging.index].x, men[dragging.index].y, 54, 54);
    } else {
      ellipse(women[dragging.index].x, women[dragging.index].y, 54, 54);
    }
    noStroke();
  }
}

function mousePressed() {
  if (roommateMode) {
    mousePressedRoommateMode();
    return;
  }
  // Check if a man is clicked
  for (let i = 0; i < men.length; i++) {
    if (dist(mouseX, mouseY, men[i].x, men[i].y) < 25) {
      dragging = {type: 'man', index: i, offsetX: men[i].x - mouseX, offsetY: men[i].y - mouseY};
      originalPos = {x: men[i].x, y: men[i].y};
      return;
    }
  }
  // Check if a woman is clicked
  for (let i = 0; i < women.length; i++) {
    if (dist(mouseX, mouseY, women[i].x, women[i].y) < 25) {
      dragging = {type: 'woman', index: i, offsetX: women[i].x - mouseX, offsetY: women[i].y - mouseY};
      originalPos = {x: women[i].x, y: women[i].y};
      return;
    }
  }
}

function mouseDragged() {
  if (dragging) {
    if (dragging.type === 'man') {
      men[dragging.index].x = mouseX + dragging.offsetX;
      men[dragging.index].y = mouseY + dragging.offsetY;
    } else {
      women[dragging.index].x = mouseX + dragging.offsetX;
      women[dragging.index].y = mouseY + dragging.offsetY;
    }
  }
}

function updatePairPositions() {
  // For each match, set paired positions for man and woman
  const centerX = 400;
  const startY = 30;
  const pairGap = 70;
  for (let k = 0; k < matches.length; k++) {
    const mIdx = matches[k].man;
    const wIdx = matches[k].woman;
    const px = centerX;
    const py = startY + k * pairGap;
    men[mIdx].x = px - 25;
    men[mIdx].y = py;
    men[mIdx].paired = true;
    men[mIdx].pairIndex = k;
    women[wIdx].x = px + 25;
    women[wIdx].y = py;
    women[wIdx].paired = true;
    women[wIdx].pairIndex = k;
  }
  // Unmatched men/women return to home
  for (let i = 0; i < men.length; i++) {
    if (!men[i].paired) {
      men[i].x = men[i].homeX;
      men[i].y = men[i].homeY;
      men[i].pairIndex = null;
    }
  }
  for (let i = 0; i < women.length; i++) {
    if (!women[i].paired) {
      women[i].x = women[i].homeX;
      women[i].y = women[i].homeY;
      women[i].pairIndex = null;
    }
  }
}

function clearPairingFlags() {
  for (let i = 0; i < men.length; i++) {
    men[i].paired = false;
    men[i].pairIndex = null;
  }
  for (let i = 0; i < women.length; i++) {
    women[i].paired = false;
    women[i].pairIndex = null;
  }
}

function mouseReleased() {
  if (!dragging) return;
  let matched = false;
  if (dragging.type === 'man') {
    for (let j = 0; j < women.length; j++) {
      if (dist(mouseX, mouseY, women[j].x, women[j].y) < 25) {
        // Remove any previous match for this man or woman
        matches = matches.filter(m => m.man !== dragging.index && m.woman !== j);
        matches.push({man: dragging.index, woman: j});
        matched = true;
        break;
      }
    }
  } else if (dragging.type === 'woman') {
    for (let i = 0; i < men.length; i++) {
      if (dist(mouseX, mouseY, men[i].x, men[i].y) < 25) {
        matches = matches.filter(m => m.man !== i && m.woman !== dragging.index);
        matches.push({man: i, woman: dragging.index});
        matched = true;
        break;
      }
    }
  }
  clearPairingFlags();
  updatePairPositions();
  updateMatchesDisplay();
  clearResultMessage();
  // Snap back if not matched
  if (!matched) {
    if (dragging.type === 'man') {
      men[dragging.index].x = men[dragging.index].homeX;
      men[dragging.index].y = men[dragging.index].homeY;
    } else {
      women[dragging.index].x = women[dragging.index].homeX;
      women[dragging.index].y = women[dragging.index].homeY;
    }
  }
  dragging = null;
  originalPos = null;
}

function updateMatchesDisplay() {
  // Only update preferences, do not show matches
  updatePreferencesDisplay();
}

function updatePreferencesDisplay() {
  let matchesDiv = document.getElementById('matches');
  if (!matchesDiv) return;
  if (!manPrefs || !womanPrefs || manPrefs.length !== numPairs || womanPrefs.length !== numPairs) return;
  let html = '';
  html += '<table style="margin:0 auto;text-align:left;font-size:15px; border-spacing: 30px 10px;">';
  for (let i = 0; i < numPairs; i++) {
    html += '<tr>';
    // Men's preferences
    html += '<td style="vertical-align:middle;">';
    if (menImages[i]) {
      html += `<img src="disneyfacesmarriage/men/${i}.png" style="width:40px;height:40px;vertical-align:middle;margin-right:5px;">`;
    } else {
      html += `<div style="display:inline-block;width:40px;height:40px;background-color:${manColor};border-radius:50%;vertical-align:middle;margin-right:5px;"></div>`;
    }
    html += '<span style="display:inline-block;vertical-align:middle;border-left:3px solid #4CAF50;padding-left:5px;height:40px;">';
    for (let j of manPrefs[i]) {
      if (womenImages[j]) {
        html += `<div style="display:inline-block;position:relative;margin:0 2px;vertical-align:middle;">
          <img src="disneyfacesmarriage/women/${j}.png" style="width:40px;height:40px;vertical-align:middle;cursor:pointer;" 
               onclick="window.toggleMark('men', ${i}, ${j})">
          ${markedPrefs.men[i].has(j) ? '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="color:red;font-size:30px;font-weight:bold;">✕</span></div>' : ''}
        </div>`;
      } else {
        html += `<div style="display:inline-block;position:relative;margin:0 2px;vertical-align:middle;">
          <div style="display:inline-block;width:40px;height:40px;background-color:${womanColor};border-radius:50%;margin:0 2px;vertical-align:middle;cursor:pointer;" 
               onclick="window.toggleMark('men', ${i}, ${j})">
          ${markedPrefs.men[i].has(j) ? '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="color:red;font-size:30px;font-weight:bold;">✕</span></div>' : ''}
          </div>
        </div>`;
      }
    }
    html += '</span></td>';
    
    // Women's preferences
    html += '<td style="vertical-align:middle;">';
    if (womenImages[i]) {
      html += `<img src="disneyfacesmarriage/women/${i}.png" style="width:40px;height:40px;vertical-align:middle;margin-right:5px;">`;
    } else {
      html += `<div style="display:inline-block;width:40px;height:40px;background-color:${womanColor};border-radius:50%;vertical-align:middle;margin-right:5px;"></div>`;
    }
    html += '<span style="display:inline-block;vertical-align:middle;border-left:3px solid #4CAF50;padding-left:5px;height:40px;">';
    for (let j of womanPrefs[i]) {
      if (menImages[j]) {
        html += `<div style="display:inline-block;position:relative;margin:0 2px;vertical-align:middle;">
          <img src="disneyfacesmarriage/men/${j}.png" style="width:40px;height:40px;margin:0 2px;vertical-align:middle;cursor:pointer;" 
               onclick="window.toggleMark('women', ${i}, ${j})">
          ${markedPrefs.women[i].has(j) ? '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="color:red;font-size:30px;font-weight:bold;">✕</span></div>' : ''}
        </div>`;
      } else {
        html += `<div style="display:inline-block;position:relative;margin:0 2px;vertical-align:middle;">
          <div style="display:inline-block;width:40px;height:40px;background-color:${manColor};border-radius:50%;margin:0 2px;vertical-align:middle;cursor:pointer;" 
               onclick="window.toggleMark('women', ${i}, ${j})">
          ${markedPrefs.women[i].has(j) ? '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;"><span style="color:red;font-size:30px;font-weight:bold;">✕</span></div>' : ''}
          </div>
        </div>`;
      }
    }
    html += '</span></td>';
    html += '</tr>';
  }
  html += '</table>';
  matchesDiv.innerHTML = html;
}

function setupButtons() {
  const checkBtn = document.getElementById('check-stability');
  const resetBtn = document.getElementById('reset-btn');
  const autoMatchBtn = document.getElementById('auto-match-btn');
  const irvingBtn = document.getElementById('irving-btn');
  const toggleInstructionsBtn = document.getElementById('toggle-instructions');
  const instructionsDiv = document.getElementById('instructions');
  
  if (checkBtn) {
    checkBtn.onclick = () => {
      if (affairMode === 'roommate') {
        checkRoommateStability();
      } else {
        const result = checkStability();
        showResultMessage(result);
      }
    };
  }
  
  if (resetBtn) {
    resetBtn.onclick = () => {
      matches = [];
      resetMatchSlots();
      generatePreferences();
      // Clear all marked preferences
      markedPrefs.men = Array(numPairs).fill().map(() => new Set());
      markedPrefs.women = Array(numPairs).fill().map(() => new Set());
      updateMatchesDisplay();
      updatePreferencesDisplay();
      clearResultMessage();
      clearPairingFlags();
      updatePairPositions();
      if (affairMode === 'roommate') {
        setupRoommateMode();
        // Do not clear result message here so Irving check can show
      }
    };
  }

  if (autoMatchBtn) {
    autoMatchBtn.onclick = () => {
      if (affairMode === 'one') {
        // Clear existing matches
        matches = [];
        clearPairingFlags();
        
        // Create random matches
        let availableWomen = Array.from({length: numPairs}, (_, i) => i);
        for (let i = 0; i < numPairs; i++) {
          let randomIndex = Math.floor(Math.random() * availableWomen.length);
          let womanIndex = availableWomen[randomIndex];
          matches.push({man: i, woman: womanIndex});
          availableWomen.splice(randomIndex, 1);
        }
        
        // Update display and check stability
        updatePairPositions();
        updateMatchesDisplay();
        const result = checkStability();
        showResultMessage(result);
      }
    };
  }

  if (toggleInstructionsBtn && instructionsDiv) {
    toggleInstructionsBtn.onclick = () => {
      if (instructionsDiv.style.display === 'none') {
        instructionsDiv.style.display = 'block';
        toggleInstructionsBtn.textContent = 'Hide Gale-Shapley';
      } else {
        instructionsDiv.style.display = 'none';
        toggleInstructionsBtn.textContent = 'Show Gale-Shapley';
      }
    };
  }
  
  if (irvingBtn) {
    irvingBtn.onclick = () => {
      if (affairMode === 'roommate') {
        findStableRoommateMatching();
      }
    };
  }
}

function showResultMessage(result) {
  const msg = document.getElementById('result-message');
  if (!msg) return;
  msg.textContent = result.message;
  msg.style.color = result.stable ? 'green' : 'red';
}

function clearResultMessage() {
  const msg = document.getElementById('result-message');
  if (!msg) return;
  msg.textContent = '';
}

function resetMatchSlots() {
  matchSlots = [];
  matchSlotIndex = 0;
  // Build grid of slots (left and right sides)
  slotGrid = [];
  for (let side = 0; side < 2; side++) { // 0: right, 1: left
    let baseX = side === 0 ? SLOT_RIGHT_BASE_X : SLOT_LEFT_BASE_X;
    for (let col = 0; col < SLOT_COLS; col++) {
      for (let row = 0; row < SLOT_ROWS; row++) {
        slotGrid.push({
          x1: baseX - (side === 0 ? col : -col) * SLOT_GAP_X,
          y1: SLOT_BASE_Y + row * SLOT_GAP_Y,
          x2: baseX - (side === 0 ? col : -col) * SLOT_GAP_X + 38,
          y2: SLOT_BASE_Y + row * SLOT_GAP_Y,
          occupied: false
        });
      }
    }
  }
}

function getNextMatchSlot() {
  // Find the first unoccupied slot
  for (let slot of slotGrid) {
    if (!slot.occupied) {
      slot.occupied = true;
      matchSlots.push(slot);
      return slot;
    }
  }
  // If all slots are occupied, use the last one (fallback)
  let fallback = slotGrid[slotGrid.length - 1];
  fallback.occupied = true;
  matchSlots.push(fallback);
  return fallback;
}

function freeMatchSlot(slotIndex) {
  if (slotIndex != null && slotGrid[slotIndex]) {
    slotGrid[slotIndex].occupied = false;
  }
}

function chainReactionStep() {
  // Build partner lookup
  let manPartner = Array(numPairs).fill(null);
  let womanPartner = Array(numPairs).fill(null);
  for (let m of matches) {
    manPartner[m.man] = m.woman;
    womanPartner[m.woman] = m.man;
  }
  // Find first instability
  for (let m = 0; m < numPairs; m++) {
    let w = manPartner[m];
    for (let w2 of manPrefs[m]) {
      if (w2 === w) break;
      let m2 = womanPartner[w2];
      if (womanPrefs[w2].indexOf(m) < womanPrefs[w2].indexOf(m2)) {
        // Assign slots for the new matches
        let affairSlot = getNextMatchSlot();
        let cheatedSlot = getNextMatchSlot();
        chainStepData = {
          affairMan: m,
          affairWoman: w2,
          prevManPartner: w,
          prevWomanPartner: m2,
          affairManTarget: {x: affairSlot.x1, y: affairSlot.y1},
          affairWomanTarget: {x: affairSlot.x2, y: affairSlot.y2},
          cheatedManTarget: {x: cheatedSlot.x1, y: cheatedSlot.y1},
          cheatedWomanTarget: {x: cheatedSlot.x2, y: cheatedSlot.y2},
          step: 0,
          affairSlotIndex: slotGrid.indexOf(affairSlot),
          cheatedSlotIndex: slotGrid.indexOf(cheatedSlot)
        };
        chainActive = true;
        chainPhase = 0;
        chainDelay = 0;
        return true; // Found an affair
      }
    }
  }
  chainActive = false;
  chainStepData = null;
  return false; // No more affairs
}

function performChainUpdate(phase) {
  let m = chainStepData.affairMan;
  let w2 = chainStepData.affairWoman;
  let w = chainStepData.prevManPartner;
  let m2 = chainStepData.prevWomanPartner;
  if (phase === 1) {
    // Remove old match for m and free its slot
    let old = matches.find(pair => pair.man === m);
    if (old && old.slotIndex != null) freeMatchSlot(old.slotIndex);
    matches = matches.filter(pair => !(pair.man === m));
    // Add new match for m
    matches.push({man: m, woman: w2, slotIndex: chainStepData.affairSlotIndex});
    let centerX = (chainStepData.affairManTarget.x + chainStepData.affairWomanTarget.x) / 2;
    men[m].x = centerX - 25;
    men[m].y = chainStepData.affairManTarget.y;
    women[w2].x = centerX + 25;
    women[w2].y = chainStepData.affairWomanTarget.y;
  } else if (phase === 3) {
    // Remove old match for m2 and free its slot
    let old = matches.find(pair => pair.man === m2);
    if (old && old.slotIndex != null) freeMatchSlot(old.slotIndex);
    matches = matches.filter(pair => !(pair.man === m2));
    // Add new match for m2
    if (m2 !== null && w !== null) {
      matches.push({man: m2, woman: w, slotIndex: chainStepData.cheatedSlotIndex});
      let centerX = (chainStepData.cheatedManTarget.x + chainStepData.cheatedWomanTarget.x) / 2;
      men[m2].x = centerX - 25;
      men[m2].y = chainStepData.cheatedManTarget.y;
      women[w].x = centerX + 25;
      women[w].y = chainStepData.cheatedWomanTarget.y;
    }
  }
  clearPairingFlags();
  updateMatchesDisplay();
  clearResultMessage();
}

function checkStability() {
  if (affairMode === 'chain') {
    if (chainActive) return {stable: false, message: 'Chain reaction in progress...'};
    // Start the chain
    if (chainReactionStep()) {
      // Show message first
      showResultMessage({stable: false, message: 'Chain reaction started!'});
      // Then start animation after a short delay
      setTimeout(() => {
        chainActive = true;
        chainPhase = 0;
      }, 2000);
      return {stable: false, message: 'Chain reaction started!'};
    } else {
      return {stable: true, message: 'Stable!'};
    }
  } else if (affairMode === 'one') {
    // Only animate the first unstable pair, then stop
    if (oneAffairActive) return {stable: false, message: 'Affair animation in progress...'};
    // Build partner lookup
    let manPartner = Array(numPairs).fill(null);
    let womanPartner = Array(numPairs).fill(null);
    for (let m of matches) {
      manPartner[m.man] = m.woman;
      womanPartner[m.woman] = m.man;
    }
    for (let m = 0; m < numPairs; m++) {
      let w = manPartner[m];
      for (let w2 of manPrefs[m]) {
        if (w2 === w) break;
        let m2 = womanPartner[w2];
        if (womanPrefs[w2].indexOf(m) < womanPrefs[w2].indexOf(m2)) {
          // Show message first
          let message = `Instability: ${menNames[m]} prefers ${womenNames[w2]} over ${womenNames[w]}, and ${womenNames[w2]} prefers ${menNames[m]} over ${menNames[m2]}. ${menNames[m]} has an affair with ${womenNames[w2]}!`;
          showResultMessage({stable: false, message: message});
          // Then start animation after a short delay
          setTimeout(() => {
            // Assign a slot for the affair
            let affairSlot = getNextMatchSlot();
            let centerX = (affairSlot.x1 + affairSlot.x2) / 2;
            oneAffairData = {
              affairMan: m,
              affairWoman: w2,
              affairManTarget: {x: centerX - 25, y: affairSlot.y1},
              affairWomanTarget: {x: centerX + 25, y: affairSlot.y2},
              step: 0,
              affairSlotIndex: slotGrid.indexOf(affairSlot)
            };
            oneAffairActive = true;
          }, 2000);
          return {stable: false, message: message};
        }
      }
    }
    return {stable: true, message: 'Stable!'};
  }
}

function moveTowards(obj, target, speed, dt) {
  let dx = target.x - obj.x;
  let dy = target.y - obj.y;
  let distToTarget = Math.sqrt(dx*dx + dy*dy);
  if (distToTarget < 1) return;
  let moveDist = Math.min(speed * dt, distToTarget);
  obj.x += (dx / distToTarget) * moveDist;
  obj.y += (dy / distToTarget) * moveDist;
}

function setupRoommateMode() {
  roommateMode = true;
  roommates = [];
  roommatePrefs = [];
  roommatePairs = [];
  selectedRoommate = null;
  resetRoommatePairSlots(); // Ensure slots are reset
  const n = 10;
  const centerX = 400;
  const centerY = 200;
  const radius = 150;
  for (let i = 0; i < n; i++) {
    let angle = (2 * Math.PI * i) / n;
    roommates.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      color: i % 2 === 0 ? manColor : womanColor,
      label: 'P' + (i + 1)
    });
  }
  // Generate random preferences for each roommate
  for (let i = 0; i < n; i++) {
    let others = Array.from({ length: n }, (_, j) => j).filter(j => j !== i);
    roommatePrefs.push(shuffle([...others]));
  }
  updateRoommateDisplay();
  checkRoommateHasStableMatching();
}

function updateRoommateDisplay() {
  let matchesDiv = document.getElementById('matches');
  if (!matchesDiv) return;
  let html = '';
  html += '<table style="margin:0 auto;text-align:left;font-size:15px; border-spacing: 40px 0;">';
  html += '<tr><td><b>Person</b></td><td><b>Preferences</b></td></tr>';
  for (let i = 0; i < roommates.length; i++) {
    html += '<tr>';
    // Person column with image
    html += '<td style="vertical-align:middle;">';
    let img = (i % 2 === 0) ? menImages[Math.floor(i/2)] : womenImages[Math.floor(i/2)];
    if (img) {
      html += `<img src="disneyfacesmarriage/${i % 2 === 0 ? 'men' : 'women'}/${Math.floor(i/2)}.png" style="width:40px;height:40px;vertical-align:middle;margin-right:5px;">`;
    } else {
      html += `<div style="display:inline-block;width:40px;height:40px;background-color:${roommates[i].color};border-radius:50%;vertical-align:middle;margin-right:5px;"></div>`;
    }
    html += '</td>';
    
    // Preferences column with images
    html += '<td style="vertical-align:middle;">';
    for (let j of roommatePrefs[i]) {
      let prefImg = (j % 2 === 0) ? menImages[Math.floor(j/2)] : womenImages[Math.floor(j/2)];
      if (prefImg) {
        html += `<img src="disneyfacesmarriage/${j % 2 === 0 ? 'men' : 'women'}/${Math.floor(j/2)}.png" style="width:40px;height:40px;margin:0 2px;vertical-align:middle;">`;
      } else {
        html += `<div style="display:inline-block;width:40px;height:40px;background-color:${roommates[j].color};border-radius:50%;margin:0 2px;vertical-align:middle;"></div>`;
      }
    }
    html += '</td>';
    html += '</tr>';
  }
  html += '</table>';
  matchesDiv.innerHTML = html;
}

function drawRoommateMode() {
  background(245);
  textAlign(CENTER, CENTER);
  textSize(18);
  fill(0);

  // Affair animation
  if (roommateAffairActive && roommateAffairData) {
    let speed = 200;
    let dt = Math.min(deltaTime, 50) / 1000;
    roommateAffairData.step++;
    let i = roommateAffairData.i;
    let j = roommateAffairData.j;
    moveTowards(roommates[i], roommateAffairData.targetI, speed, dt);
    moveTowards(roommates[j], roommateAffairData.targetJ, speed, dt);
    // Move previous partners back to circle
    if (roommateAffairData.prevPartnerI !== null) {
      moveTowards(roommates[roommateAffairData.prevPartnerI], roommateAffairData.prevPartnerITarget, speed, dt);
    }
    if (roommateAffairData.prevPartnerJ !== null) {
      moveTowards(roommates[roommateAffairData.prevPartnerJ], roommateAffairData.prevPartnerJTarget, speed, dt);
    }
    if (roommateAffairData.step > 120) {
      // Remove old pairs
      if (roommateAffairData.oldPairIIdx !== -1) roommatePairs.splice(roommateAffairData.oldPairIIdx, 1);
      if (roommateAffairData.oldPairJIdx !== -1 && roommateAffairData.oldPairJIdx !== roommateAffairData.oldPairIIdx) roommatePairs.splice(roommateAffairData.oldPairJIdx > roommateAffairData.oldPairIIdx ? roommateAffairData.oldPairJIdx - 1 : roommateAffairData.oldPairJIdx, 1);
      // Add new pair
      roommatePairs.push([i, j]);
      updateRoommateDisplay();
      roommateAffairActive = false;
      roommateAffairData = null;
    }
  }

  // Draw all people with images
  imageMode(CENTER);
  for (let i = 0; i < roommates.length; i++) {
    // Alternate menImages/womenImages for variety, fallback to color if missing
    let img = (i % 2 === 0) ? menImages[Math.floor(i/2)] : womenImages[Math.floor(i/2)];
    if (img) {
      image(img, roommates[i].x, roommates[i].y, 50, 50);
    } else {
      fill(roommates[i].color);
      ellipse(roommates[i].x, roommates[i].y, 50, 50);
    }
    if (roommateDragging && roommateDragging.index === i) {
      stroke(255, 180, 0);
      strokeWeight(4);
      ellipse(roommates[i].x, roommates[i].y, 54, 54);
      noStroke();
    }
  }
  // No green lines; overlap shows pairing
}

function mousePressedRoommateMode() {
  for (let i = 0; i < roommates.length; i++) {
    if (dist(mouseX, mouseY, roommates[i].x, roommates[i].y) < 25) {
      // Only allow dragging if not already paired or to re-pair
      roommateDragging = {index: i, offsetX: roommates[i].x - mouseX, offsetY: roommates[i].y - mouseY};
      roommateOriginalPos = {x: roommates[i].x, y: roommates[i].y};
      return;
    }
  }
}

function mouseDraggedRoommateMode() {
  if (roommateDragging) {
    let i = roommateDragging.index;
    roommates[i].x = mouseX + roommateDragging.offsetX;
    roommates[i].y = mouseY + roommateDragging.offsetY;
  }
}

function mouseReleasedRoommateMode() {
  if (!roommateDragging) return;
  let i = roommateDragging.index;
  for (let j = 0; j < roommates.length; j++) {
    if (i !== j && dist(mouseX, mouseY, roommates[j].x, roommates[j].y) < 25) {
      // Remove old pair for i if it exists
      let oldPairIIdx = roommatePairs.findIndex(pair => pair.includes(i));
      if (oldPairIIdx !== -1) {
        let oldPairI = roommatePairs[oldPairIIdx];
        let other = oldPairI[0] === i ? oldPairI[1] : oldPairI[0];
        let n = roommates.length;
        let angle = (2 * Math.PI * other) / n;
        roommates[other].x = 400 + 150 * Math.cos(angle);
        roommates[other].y = 200 + 150 * Math.sin(angle);
        roommatePairs.splice(oldPairIIdx, 1);
      }
      // Remove old pair for j if it exists (and not already removed)
      let oldPairJIdx = roommatePairs.findIndex(pair => pair.includes(j));
      if (oldPairJIdx !== -1) {
        let oldPairJ = roommatePairs[oldPairJIdx];
        let other = oldPairJ[0] === j ? oldPairJ[1] : oldPairJ[0];
        let n = roommates.length;
        let angle = (2 * Math.PI * other) / n;
        roommates[other].x = 400 + 150 * Math.cos(angle);
        roommates[other].y = 200 + 150 * Math.sin(angle);
        roommatePairs.splice(oldPairJIdx, 1);
      }
      // Place both at the drop location with a slight horizontal overlap
      let overlap = 24;
      roommates[i].x = mouseX - overlap;
      roommates[i].y = mouseY;
      roommates[j].x = mouseX + overlap;
      roommates[j].y = mouseY;
      roommatePairs.push([i, j]);
      updateRoommateDisplay();
      roommateDragging = null;
      roommateOriginalPos = null;
      return;
    }
  }
  // Snap back if not paired
  roommates[i].x = roommateOriginalPos.x;
  roommates[i].y = roommateOriginalPos.y;
  roommateDragging = null;
  roommateOriginalPos = null;
}

// In mouseDragged and mouseReleased, call roommate versions if roommateMode
const originalMouseDragged = mouseDragged;
mouseDragged = function() {
  if (roommateMode) {
    mouseDraggedRoommateMode();
  } else {
    originalMouseDragged();
  }
};
const originalMouseReleased = mouseReleased;
mouseReleased = function() {
  if (roommateMode) {
    mouseReleasedRoommateMode();
  } else {
    originalMouseReleased();
  }
};

function resetRoommatePairSlots() {
  roommatePairSlots = [];
  roommatePairSlotIndex = 0;
  // Precompute slots for up to 5 pairs (10 people)
  const baseX = 180;
  const baseY = 200;
  const gapX = 110;
  for (let idx = 0; idx < 5; idx++) {
    roommatePairSlots[idx] = {
      x1: baseX + idx * gapX,
      y1: baseY,
      x2: baseX + idx * gapX + 38,
      y2: baseY
    };
  }
}

function getNextRoommatePairSlot() {
  // Always assign the next slot at the end
  const baseX = 180;
  const baseY = 200;
  const gapX = 110;
  let idx = roommatePairSlotIndex;
  let slot = {
    x1: baseX + idx * gapX,
    y1: baseY,
    x2: baseX + idx * gapX + 38,
    y2: baseY
  };
  roommatePairSlots.push(slot);
  roommatePairSlotIndex++;
  return {slot, slotIndex: roommatePairSlotIndex - 1};
}

function checkRoommateStability() {
  // A blocking pair is two people not paired together who both prefer each other over their current partners
  if (roommatePairs.length * 2 !== roommates.length) {
    showResultMessage({stable: false, message: 'Not all people are paired.'});
    return;
  }
  // Build partner lookup
  let partner = Array(roommates.length).fill(null);
  for (let pair of roommatePairs) {
    partner[pair[0]] = pair[1];
    partner[pair[1]] = pair[0];
  }
  // Check for blocking pairs
  for (let i = 0; i < roommates.length; i++) {
    for (let j = 0; j < roommates.length; j++) {
      if (i === j || partner[i] === j) continue;
      let myPartner = partner[i];
      let theirPartner = partner[j];
      // Would i prefer j over their current partner?
      if (roommatePrefs[i].indexOf(j) < roommatePrefs[i].indexOf(myPartner)) {
        // Would j prefer i over their current partner?
        if (roommatePrefs[j].indexOf(i) < roommatePrefs[j].indexOf(theirPartner)) {
          // Start affair animation
          let targetX = 650;
          let targetY = 100 + Math.floor(Math.random() * 200);
          let overlap = 24;
          // Find old pair indices
          let oldPairIIdx = roommatePairs.findIndex(pair => pair.includes(i));
          let oldPairJIdx = roommatePairs.findIndex(pair => pair.includes(j));
          // Previous partners
          let prevPartnerI = myPartner;
          let prevPartnerJ = theirPartner;
          // Targets for previous partners (back to circle)
          let n = roommates.length;
          let prevPartnerITarget = null, prevPartnerJTarget = null;
          if (prevPartnerI !== null) {
            let angle = (2 * Math.PI * prevPartnerI) / n;
            prevPartnerITarget = {x: 400 + 150 * Math.cos(angle), y: 200 + 150 * Math.sin(angle)};
          }
          if (prevPartnerJ !== null) {
            let angle = (2 * Math.PI * prevPartnerJ) / n;
            prevPartnerJTarget = {x: 400 + 150 * Math.cos(angle), y: 200 + 150 * Math.sin(angle)};
          }
          roommateAffairActive = true;
          roommateAffairData = {
            i, j,
            targetI: {x: targetX - overlap, y: targetY},
            targetJ: {x: targetX + overlap, y: targetY},
            prevPartnerI,
            prevPartnerJ,
            prevPartnerITarget,
            prevPartnerJTarget,
            oldPairIIdx,
            oldPairJIdx,
            step: 0
          };
          // Get character names based on index
          let nameI = i % 2 === 0 ? menNames[Math.floor(i/2)] : womenNames[Math.floor(i/2)];
          let nameJ = j % 2 === 0 ? menNames[Math.floor(j/2)] : womenNames[Math.floor(j/2)];
          clearResultMessage();
          showResultMessage({stable: false, message: `Blocking pair: ${nameI} and ${nameJ} prefer each other over their current partners.`});
          return;
        }
      }
    }
  }
  showResultMessage({stable: true, message: 'Stable!'});
}

// Irving's algorithm for Stable Roommate Problem
function findStableRoommateMatching() {
  // Deep copy preferences
  let n = roommates.length;
  let prefs = roommatePrefs.map(arr => arr.slice());
  // Phase 1: Propose and reduce lists
  let proposals = Array(n).fill(null);
  let eliminated = Array.from({length: n}, () => new Set());
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (prefs[i].length === 0) continue;
      let first = prefs[i][0];
      // Find all who have i as their first choice
      let suitors = [];
      for (let j = 0; j < n; j++) {
        if (prefs[j][0] === i) suitors.push(j);
      }
      // If i is not anyone's first, skip
      if (suitors.length === 0) continue;
      // i rejects all but their favorite suitor
      let fav = suitors[0];
      for (let s of suitors) {
        if (prefs[i].indexOf(s) < prefs[i].indexOf(fav)) fav = s;
      }
      for (let s of suitors) {
        if (s !== fav) {
          // Remove i from s's list
          let idx = prefs[s].indexOf(i);
          if (idx !== -1) {
            prefs[s].splice(idx, 1);
            changed = true;
          }
        }
      }
    }
  }
  // Check for empty lists (no stable matching)
  for (let i = 0; i < n; i++) {
    if (prefs[i].length === 0) {
      showResultMessage({stable: false, message: 'No stable matching possible.'});
      return;
    }
  }
  // Phase 2: Eliminate rotations
  let done = false;
  while (!done) {
    // Find a rotation
    let rotation = [];
    let visited = Array(n).fill(false);
    let i = -1;
    for (let k = 0; k < n; k++) {
      if (prefs[k].length > 1) { i = k; break; }
    }
    if (i === -1) break; // All lists length 1
    let start = i;
    let validRotation = true;
    do {
      let j = prefs[i][1];
      if (j === undefined) { validRotation = false; break; }
      let idxInJ = prefs[j].indexOf(i);
      if (idxInJ === -1 || idxInJ + 1 >= prefs[j].length) { validRotation = false; break; }
      let k = prefs[j][idxInJ + 1];
      rotation.push({i, j});
      i = k;
    } while (i !== start && i !== undefined && rotation.length <= n+1);
    if (!validRotation || i !== start || rotation.length > n) { done = true; break; } // No rotation found or incomplete
    // Eliminate rotation
    for (let r of rotation) {
      let idx = prefs[r.i].indexOf(r.j);
      if (idx !== -1) prefs[r.i].splice(idx, 1);
      let idx2 = prefs[r.j].indexOf(r.i);
      if (idx2 !== -1) prefs[r.j].splice(idx2, 1);
    }
  }
  // Check for empty lists again
  for (let i = 0; i < n; i++) {
    if (prefs[i].length === 0) {
      showResultMessage({stable: false, message: 'No stable matching possible.'});
      return;
    }
  }
  // If all lists are length 1, we have a stable matching
  let pairs = [];
  let used = Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!used[i]) {
      let j = prefs[i][0];
      if (j === undefined || used[j]) continue;
      pairs.push([i, j]);
      used[i] = true;
      used[j] = true;
    }
  }
  // Check that all people are paired exactly once
  if (pairs.length !== n / 2 || used.some(u => !u)) {
    showResultMessage({stable: false, message: 'No stable matching possible.'});
    return;
  }
  // Update roommatePairs and display
  roommatePairs = [];
  for (let [a, b] of pairs) {
    if (!roommatePairs.some(pair => pair.includes(a) || pair.includes(b))) {
      roommatePairs.push([a, b]);
    }
  }
  // Move paired people together visually
  let baseX = 180;
  let baseY = 200;
  let gapX = 110;
  for (let idx = 0; idx < roommatePairs.length; idx++) {
    let [a, b] = roommatePairs[idx];
    roommates[a].x = baseX + idx * gapX - 24;
    roommates[a].y = baseY;
    roommates[b].x = baseX + idx * gapX + 24;
    roommates[b].y = baseY;
  }
  updateRoommateDisplay();
  showResultMessage({stable: true, message: 'Stable matching found!'});
}

// Check if a stable matching is possible using Irving's algorithm, but do not solve or update pairs
function checkRoommateHasStableMatching() {
  let n = roommates.length;
  let prefs = roommatePrefs.map(arr => arr.slice());
  // Phase 1: Propose and reduce lists
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (prefs[i].length === 0) continue;
      let suitors = [];
      for (let j = 0; j < n; j++) {
        if (prefs[j][0] === i) suitors.push(j);
      }
      if (suitors.length === 0) continue;
      let fav = suitors[0];
      for (let s of suitors) {
        if (prefs[i].indexOf(s) < prefs[i].indexOf(fav)) fav = s;
      }
      for (let s of suitors) {
        if (s !== fav) {
          let idx = prefs[s].indexOf(i);
          if (idx !== -1) {
            prefs[s].splice(idx, 1);
            changed = true;
          }
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (prefs[i].length === 0) {
      showResultMessage({stable: false, message: 'No stable matching possible for these preferences.'});
      return;
    }
  }
  // Phase 2: Eliminate rotations
  let done = false;
  while (!done) {
    let rotation = [];
    let i = -1;
    for (let k = 0; k < n; k++) {
      if (prefs[k].length > 1) { i = k; break; }
    }
    if (i === -1) break;
    let start = i;
    let validRotation = true;
    do {
      let j = prefs[i][1];
      if (j === undefined) { validRotation = false; break; }
      let idxInJ = prefs[j].indexOf(i);
      if (idxInJ === -1 || idxInJ + 1 >= prefs[j].length) { validRotation = false; break; }
      let k = prefs[j][idxInJ + 1];
      rotation.push({i, j});
      i = k;
    } while (i !== start && i !== undefined && rotation.length <= n+1);
    if (!validRotation || i !== start || rotation.length > n) { done = true; break; }
    for (let r of rotation) {
      let idx = prefs[r.i].indexOf(r.j);
      if (idx !== -1) prefs[r.i].splice(idx, 1);
      let idx2 = prefs[r.j].indexOf(r.i);
      if (idx2 !== -1) prefs[r.j].splice(idx2, 1);
    }
  }
  for (let i = 0; i < n; i++) {
    if (prefs[i].length === 0) {
      showResultMessage({stable: false, message: 'No stable matching possible for these preferences.'});
      return;
    }
  }
  // If all lists are length 1, we have a stable matching, but do not show a message
  clearResultMessage();
}

// Add this function to handle toggling marks
window.toggleMark = function(type, personIndex, prefIndex) {
  if (type === 'men') {
    if (markedPrefs.men[personIndex].has(prefIndex)) {
      markedPrefs.men[personIndex].delete(prefIndex);
    } else {
      markedPrefs.men[personIndex].add(prefIndex);
    }
  } else {
    if (markedPrefs.women[personIndex].has(prefIndex)) {
      markedPrefs.women[personIndex].delete(prefIndex);
    } else {
      markedPrefs.women[personIndex].add(prefIndex);
    }
  }
  updatePreferencesDisplay();
}

// Ensure preferences and matches are shown on page load
window.addEventListener('DOMContentLoaded', () => {
  updateMatchesDisplay();
  updatePreferencesDisplay();
  setupButtons();
  // Mode selector
  const modeSelect = document.getElementById('mode-select');
  const irvingBtn = document.getElementById('irving-btn');
  const autoMatchBtn = document.getElementById('auto-match-btn');
  const toggleInstructionsBtn = document.getElementById('toggle-instructions');
  const instructionsDiv = document.getElementById('instructions');
  
  if (modeSelect) {
    affairMode = modeSelect.value;
    modeSelect.addEventListener('change', () => {
      affairMode = modeSelect.value;
      // Reset all state for both modes when switching
      chainActive = false;
      chainStepData = null;
      chainPhase = 0;
      oneAffairActive = false;
      oneAffairData = null;
      if (affairMode === 'roommate') {
        // Reset marriage mode state
        chainActive = false;
        chainStepData = null;
        chainPhase = 0;
        oneAffairActive = false;
        oneAffairData = null;
        setupRoommateMode();
        if (irvingBtn) irvingBtn.style.display = '';
        if (autoMatchBtn) autoMatchBtn.style.display = 'none';
        if (toggleInstructionsBtn) toggleInstructionsBtn.style.display = 'none';
        if (instructionsDiv) instructionsDiv.style.display = 'none';
      } else {
        // Reset roommate mode state
        roommateMode = false;
        roommates = [];
        roommatePrefs = [];
        roommatePairs = [];
        selectedRoommate = null;
        updateMatchesDisplay();
        updatePreferencesDisplay();
        if (irvingBtn) irvingBtn.style.display = 'none';
        if (autoMatchBtn) autoMatchBtn.style.display = '';
        if (toggleInstructionsBtn) toggleInstructionsBtn.style.display = '';
        if (instructionsDiv) instructionsDiv.style.display = 'none';
        clearResultMessage();
      }
    });
    if (affairMode === 'roommate') {
      setupRoommateMode();
      if (irvingBtn) irvingBtn.style.display = '';
      if (autoMatchBtn) autoMatchBtn.style.display = 'none';
      if (toggleInstructionsBtn) toggleInstructionsBtn.style.display = 'none';
      if (instructionsDiv) instructionsDiv.style.display = 'none';
    } else {
      if (irvingBtn) irvingBtn.style.display = 'none';
      if (autoMatchBtn) autoMatchBtn.style.display = '';
      if (toggleInstructionsBtn) toggleInstructionsBtn.style.display = '';
      if (instructionsDiv) instructionsDiv.style.display = 'none';
    }
  }
}); 