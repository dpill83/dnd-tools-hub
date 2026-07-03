function escHtml(str) {
  if (str == null || str === '') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escJsQ(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function imageSrc(filename) {
  var p = String(filename || '').replace(/^images\//, '');
  return encodeURI('images/' + p);
}

function fcClick(id) {
  // Update SVG active state
  document.querySelectorAll('#flowchart .fc-node').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`#flowchart [data-scene="${id}"]`).forEach(n => n.classList.add('active'));
  showScene(id);
}

function showScene(id) {
  // Update active node
  document.querySelectorAll('.flow-node, .flow-branch-node').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-scene="${id}"]`).forEach(n => n.classList.add('active'));
  // SVG active
  document.querySelectorAll('#flowchart .fc-node').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`#flowchart [data-scene="${id}"]`).forEach(n => n.classList.add('active'));
  var hdrNpcs = document.getElementById('hdr-btn-npcs');
  var hdrLocs = document.getElementById('hdr-btn-locations');
  if (hdrNpcs) hdrNpcs.classList.toggle('active', id === 'npcs');
  if (hdrLocs) hdrLocs.classList.toggle('active', id === 'locations');

  const scene = SCENES[id];
  if (!scene) return;

  let html = `<div class="detail-content">`;
  html += `<div class="detail-header">`;
  html += `<div class="detail-eyebrow">${escHtml(scene.eyebrow)}</div>`;
  html += `<div class="detail-title">${escHtml(scene.title)}</div>`;
  html += `<div class="detail-subtitle">${escHtml(scene.subtitle)}</div>`;
  html += `</div>`;

  for (const s of scene.sections) {
    if (s.type === 'section-title') {
      html += `<div class="section"><div class="section-title">${escHtml(s.text)}</div></div>`;
    } else if (s.type === 'body') {
      html += `<p class="body-text">${escHtml(s.content)}</p>`;
    } else if (s.type === 'dm-note') {
      html += `<div class="section"><div class="dm-note"><div class="dm-note-label">DM EYES ONLY</div><p class="dm-note-text">${escHtml(s.content)}</p></div></div>`;
    } else if (s.type === 'read-aloud') {
      html += `<div class="section"><div class="read-aloud"><p>${escHtml(s.text)}</p>`;
      if (s.wtyd) html += `<div class="wtyd"><span class="wtyd-label">What do you do?</span><span class="wtyd-text">${escHtml(s.wtyd)}</span></div>`;
      html += `</div></div>`;
    } else if (s.type === 'ifthen') {
      html += `<div class="section"><div class="ifthen-list">`;
      for (const item of s.items) {
        html += `<div class="ifthen"><span class="ifthen-if">IF</span><div><div class="ifthen-condition">${escHtml(item.condition)}</div><div class="ifthen-result">→ ${escHtml(item.result)}</div></div></div>`;
      }
      html += `</div></div>`;
    } else if (s.type === 'npc') {
      const portrait = PORTRAITS[s.name];
      const picUrl = portrait ? imageSrc(portrait) : '';
      const portraitHtml = portrait
        ? `<div class="npc-portrait-wrap">
            ${portrait.endsWith('.webm')
              ? `<video class="npc-portrait" autoplay loop muted playsinline><source src="${escHtml(picUrl)}" type="video/webm"></video>`
              : `<img class="npc-portrait" src="${escHtml(picUrl)}" alt="${escHtml(s.name)}">`
            }
            <button type="button" class="npc-copy-btn" onclick="displayOnTV('${escJsQ(picUrl)}')" title="Display on TV">▶ Display</button>
          </div>`
        : '';
      html += `<div class="section"><div class="npc-card npc-card-portrait" style="cursor:default">
        ${portraitHtml}
        <div class="npc-card-info">
          <div class="npc-name">${escHtml(s.name)}</div>
          <div class="npc-role">${escHtml(s.role)}</div>
          <div class="npc-want"><strong>Wants:</strong> ${escHtml(s.want)}</div>
          <div class="npc-voice"><strong>Voice:</strong> ${escHtml(s.voice)}</div>
          <div class="npc-keyline">"${escHtml(s.keyline)}"</div>
        </div>
      </div></div>`;
    } else if (s.type === 'checks') {
      html += `<div class="section"><div class="checks">`;
      for (const c of s.items) {
        html += `<div class="check"><span class="check-dc">${escHtml(c.dc)}</span><span class="check-desc">${escHtml(c.desc)}</span></div>`;
      }
      html += `</div></div>`;
    } else if (s.type === 'clues') {
      html += `<div class="section"><div class="clues">`;
      s.items.forEach((item, i) => {
        html += `<div class="clue"><span class="clue-num">${i+1}.</span><span class="clue-text">${escHtml(item)}</span></div>`;
      });
      html += `</div></div>`;
    } else if (s.type === 'location') {
      html += `<div class="section"><div class="clues">`;
      s.aspects.forEach((a, i) => {
        const icons = ['👁', '👂', '⚠'];
        html += `<div class="clue"><span class="clue-num">${icons[i]||'•'}</span><span class="clue-text">${escHtml(a)}</span></div>`;
      });
      html += `</div></div>`;
    } else if (s.type === 'stat') {
      html += `<div class="section"><div class="stat-block">
        <div class="stat-block-header">
          <span class="stat-block-name">${escHtml(s.name)}</span>
          <span class="stat-block-cr">${escHtml(s.cr)}</span>
        </div>
        <div class="stat-block-body">
          <div class="stat"><div class="stat-label">HP</div><div class="stat-value">${escHtml(s.hp)}</div></div>
          <div class="stat"><div class="stat-label">AC</div><div class="stat-value">${escHtml(s.ac)}</div></div>
          <div class="stat"><div class="stat-label">Attack</div><div class="stat-value">${escHtml(s.atk)}</div></div>
          <div class="stat"><div class="stat-label">Damage</div><div class="stat-value">${escHtml(s.dmg)}</div></div>
        </div>
        <div class="stat-block-behavior">${escHtml(s.behavior)}</div>
      </div></div>`;
    } else if (s.type === 'skilltable') {
      html += `<div class="section"><table class="check-table">
        <thead><tr>
          <th>Skill / Check</th>
          <th>DC</th>
          <th>Result</th>
        </tr></thead>
        <tbody>
          ${s.rows.map(r => `<tr>
            <td class="td-skill">${escHtml(r.skill)}</td>
            <td class="td-dc">${escHtml(r.dc)}</td>
            <td>${escHtml(r.result)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
    } else if (s.type === 'scene-image') {
      const sceneImgUrl = imageSrc(s.src);
      html += `<div class="section">
        <div style="position:relative;display:inline-block;width:50%;margin:0 auto;display:block;">
          <img src="${escHtml(sceneImgUrl)}" alt="${escHtml(s.src)}" style="width:100%;border-radius:6px;border:1px solid rgba(196,154,42,0.2);box-shadow:0 4px 20px rgba(0,0,0,0.5);">
          <button type="button" onclick="displayOnTV('${escJsQ(sceneImgUrl)}')" style="margin-top:6px;width:100%;font-family:'Cinzel',serif;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;background:rgba(139,26,26,0.25);border:1px solid rgba(139,26,26,0.4);border-radius:3px;color:var(--gold-dim);padding:5px;cursor:pointer;">▶ Display on TV</button>
        </div>
      </div>`;
    } else if (s.type === 'strong-start-image') {
      html += `<div class="section">
        <div style="width:50%;margin:0 auto;">
          <img src="images/StrongStart.png" alt="Strong Start" style="width:100%;border-radius:6px;border:1px solid rgba(196,154,42,0.2);box-shadow:0 4px 20px rgba(0,0,0,0.5);">
          <button type="button" onclick="displayOnTV('${escJsQ(imageSrc('StrongStart.png'))}')" style="margin-top:6px;width:100%;font-family:'Cinzel',serif;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;background:rgba(139,26,26,0.25);border:1px solid rgba(139,26,26,0.4);border-radius:3px;color:var(--gold-dim);padding:5px;cursor:pointer;">▶ Display on TV</button>
        </div>
      </div>`;
    } else if (s.type === 'note-image') {
      const noteFile = s.src || 'note.png';
      const noteImgUrl = imageSrc(noteFile);
      html += `<div class="section">
        <div class="note-image-wrap">
          <img src="${escHtml(noteImgUrl)}" alt="${escHtml(s.alt || noteFile)}" class="note-image">
          <button type="button" class="note-copy-btn" onclick="displayOnTV('${escJsQ(noteImgUrl)}')">▶ Display on TV</button>
        </div>
      </div>`;
    } else if (s.type === 'clockcontrol') {
      html += `<div class="section">
        <div class="clock-control-panel">
          <div class="ccp-header">
            <span class="ccp-title">⏱ The Night Clock</span>
            <button type="button" class="ccp-popout" onclick="openDisplay('stakeout')">Open on TV ↗</button>
          </div>
          <div class="ccp-row">
            <button type="button" class="ccp-btn ccp-start" onclick="clockCmd('start')">▶ Start</button>
            <button type="button" class="ccp-btn ccp-pause" onclick="clockCmd('pause')">⏸ Pause</button>
            <button type="button" class="ccp-btn ccp-resume" onclick="clockCmd('resume')">▶ Resume</button>
            <button type="button" class="ccp-btn ccp-reset" onclick="clockCmd('reset')">↺ Reset</button>
          </div>
          <div class="ccp-row">
            <span class="ccp-label">Speed (game min/sec):</span>
            <select class="ccp-select" id="clock-speed" onchange="updateSpeed()">
              <option value="0.5">0.5 — very slow</option>
              <option value="1" selected>1 — slow</option>
              <option value="2">2 — medium</option>
              <option value="4">4 — fast</option>
              <option value="8">8 — very fast</option>
              <option value="60">60 — skip ahead</option>
            </select>
          </div>
          <div class="ccp-row">
            <button type="button" class="ccp-btn" onclick="dismissTV()" style="background:rgba(10,10,30,0.3);border-color:rgba(80,80,160,0.4);color:#8080C0;">✕ Dismiss Image</button>
            <span class="ccp-label" style="font-size:10px;">clear TV display</span>
          </div>
          <div class="ccp-row">
            <button type="button" class="ccp-btn" onclick="triggerWatchman()" style="background:rgba(60,40,10,0.3);border-color:rgba(180,120,20,0.4);color:#C0A060;">🕯 Watchman Patrol</button>
            <span class="ccp-label" style="font-size:10px;">manually trigger his circuit</span>
          </div>
          <div class="ccp-row">
            <span class="ccp-label">Jump to bell:</span>
            <select class="ccp-select" id="clock-jump">
              <option value="0">10th Bell (start)</option>
              <option value="60">11th Bell</option>
              <option value="120">Midnight</option>
              <option value="180">1st Bell</option>
              <option value="240">2nd Bell</option>
              <option value="300">3rd Bell</option>
              <option value="360">4th Bell</option>
              <option value="420">5th Bell</option>
              <option value="479">6th Bell (dawn)</option>
            </select>
            <button type="button" class="ccp-btn" onclick="clockJump()" style="margin-left:8px;">Jump</button>
          </div>
          <div class="ccp-note">Kids arrive: roll 1d4+1 secretly before the scene starts — that's the bell they show up on. Keep it hidden. Run the event table until you hit that bell, then the kids appear regardless of what else is happening.</div>
        </div>
      </div>`;
    } else if (s.type === 'device-tracker') {
      const states = [
        { name: 'Stable',      color: '#1a5a1a', desc: 'The device hums steadily. Low blue-green light.' },
        { name: 'Agitated',    color: '#8b6914', desc: 'The hum rises in pitch. Light pulses irregularly. Loose objects vibrate on nearby shelves.' },
        { name: 'Critical',    color: '#8b1a1a', desc: 'A high whine underneath the hum. The light shifts toward white. Reagent bottles on adjacent shelves begin to crack.' },
        { name: 'Detonation',  color: '#4a0a0a', desc: 'The shriek fills the building. Three seconds. Everyone with a reaction — move.' },
      ];
      const trackerId = 'device-state-' + Date.now();
      html += `<div class="section">
    <div class="device-tracker" id="${trackerId}">
      <div class="dt-states">
        ${states.map((st, i) => `<div class="dt-state ${i === 0 ? 'dt-active' : ''}" id="${trackerId}-${i}" style="--state-color:${st.color}" onclick="advanceDevice('${escJsQ(trackerId)}',${i},${states.length})">
          <div class="dt-name">${escHtml(st.name)}</div>
          <div class="dt-desc">${escHtml(st.desc)}</div>
        </div>`).join('')}
      </div>
      <div class="dt-controls">
        <button type="button" class="dt-btn dt-advance" onclick="advanceDeviceNext('${escJsQ(trackerId)}',${states.length})">⚡ Advance</button>
        <button type="button" class="dt-btn dt-reset" onclick="resetDevice('${escJsQ(trackerId)}',${states.length})">↺ Reset</button>
      </div>
    </div>
  </div>`;

    } else if (s.type === 'env-table') {
      const ENV = [
        { roll: '1', what: 'Reagent shelf collapses',          effect: 'All within 5 ft. — DC 13 Dex save or 2d6 bludgeoning + prone. Advance device if within 10 ft.' },
        { roll: '2', what: 'Vial shatters — flammable compound', effect: '5 ft. square becomes difficult terrain. Fire damage there triggers +1d6 fire to all adjacent.' },
        { roll: '3', what: 'Device pulses',                    effect: 'Advance condition one step. DC 12 Con save within 15 ft. or disadvantage on next attack.' },
        { roll: '4', what: 'Floor slick from spilled compound', effect: 'Random 10 ft. square: DC 12 Acrobatics to cross or fall prone.' },
        { roll: '5', what: 'Crate falls — blocks exit',        effect: 'One exit becomes difficult terrain. DC 14 Athletics as an action to clear.' },
        { roll: '6', what: 'Smoke from cracked vial',          effect: '10 ft. area lightly obscured for 1d4 rounds. Attacks through it at disadvantage.' },
        { roll: '7', what: 'Nothing this round',               effect: 'The room holds its breath. The hum is the only sound.' },
        { roll: '8', what: 'Viktor clips a shelf (if he moved)', effect: 'If Viktor moved 15+ ft. this round — roll again immediately. Otherwise nothing.' },
      ];
      html += `<div class="section">
    <div class="stakeout-table-wrap">
      <div class="st-desc">Roll at the <em>end of each round</em> or whenever a significant impact occurs near the device. Ask the table what they do about it.</div>
      <table class="check-table">
        <thead><tr><th>d8</th><th>What Happens</th><th>Effect</th></tr></thead>
        <tbody>
          ${ENV.map(h => `<tr>
            <td class="td-dc" style="width:32px;">${escHtml(h.roll)}</td>
            <td style="font-weight:600;color:var(--gold-dim);width:35%;">${escHtml(h.what)}</td>
            <td>${escHtml(h.effect)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
        <button type="button" class="st-roll-btn" style="width:auto;padding:6px 16px;" onclick="rollEnvHazard()">⚄ Roll d8 Hazard</button>
        <div class="st-result" id="env-hazard-result" style="flex:1;min-height:auto;padding:6px 10px;">—</div>
      </div>
    </div>
  </div>`;
    } else if (s.type === 'stakeout-table') {
      const WHAT = STAKEOUT_WHAT;
      const WHO = STAKEOUT_WHO;
      const WHERE = STAKEOUT_WHERE;

      html += `<div class="section">
        <div class="stakeout-table-wrap">
          <div class="st-desc">Each bell, roll one die for each column. Combine the results into a moment and ask the table: <em>what do you do?</em></div>
          <div class="st-grid">
            <div class="st-col">
              <div class="st-col-head">What (d6)</div>
              ${WHAT.map((w,i) => `<div class="st-roll"><span class="st-num">${i+1}</span>${escHtml(w)}</div>`).join('')}
              <button type="button" class="st-roll-btn" onclick="rollStakeout('what')">Roll What</button>
              <div class="st-result" id="result-what">—</div>
            </div>
            <div class="st-col">
              <div class="st-col-head">Who (d6)</div>
              ${WHO.map((w,i) => `<div class="st-roll"><span class="st-num">${i+1}</span>${escHtml(w)}</div>`).join('')}
              <button type="button" class="st-roll-btn" onclick="rollStakeout('who')">Roll Who</button>
              <div class="st-result" id="result-who">—</div>
            </div>
            <div class="st-col">
              <div class="st-col-head">Where (d6)</div>
              ${WHERE.map((w,i) => `<div class="st-roll"><span class="st-num">${i+1}</span>${escHtml(w)}</div>`).join('')}
              <button type="button" class="st-roll-btn" onclick="rollStakeout('where')">Roll Where</button>
              <div class="st-result" id="result-where">—</div>
            </div>
          </div>
          <button type="button" class="st-roll-all-btn" onclick="rollAll()">⚄ Roll All Three</button>
        </div>
      </div>`;
    } else if (s.type === 'fullstat') {
      const traitsHtml = (s.traits||[]).map(t => `<p class="fs-entry"><span class="fs-bold">${escHtml(t.name)}.</span> ${escHtml(t.text)}</p>`).join('');
      const actionsHtml = (s.actions||[]).map(a => `<p class="fs-entry"><span class="fs-bold">${escHtml(a.name)}.</span> ${escHtml(a.text)}</p>`).join('');
      const bonusHtml = (s.bonus||[]).length ? `<div class="fs-section-head">Bonus Actions</div>${(s.bonus||[]).map(a => `<p class="fs-entry"><span class="fs-bold">${escHtml(a.name)}.</span> ${escHtml(a.text)}</p>`).join('')}` : '';
      const reactionsHtml = (s.reactions||[]).length ? `<div class="fs-section-head">Reactions</div>${(s.reactions||[]).map(r => `<p class="fs-entry"><span class="fs-bold">${escHtml(r.name)}.</span> ${escHtml(r.text)}</p>`).join('')}` : '';
      html += `<div class="section"><div class="fs-block">
        <div class="fs-header">
          <div class="fs-name">${escHtml(s.name)}</div>
          <div class="fs-meta">${escHtml(s.meta)}</div>
        </div>
        <div class="fs-rule"></div>
        <div class="fs-basics">
          <p><strong>Armor Class</strong> ${escHtml(s.ac)}</p>
          <p><strong>Hit Points</strong> ${escHtml(s.hp)}</p>
          <p><strong>Speed</strong> ${escHtml(s.speed)}</p>
        </div>
        <div class="fs-rule"></div>
        <div class="fs-stats">
          <div class="fs-stat"><div class="fs-stat-label">STR</div><div class="fs-stat-val">${escHtml(s.stats.str)}</div></div>
          <div class="fs-stat"><div class="fs-stat-label">DEX</div><div class="fs-stat-val">${escHtml(s.stats.dex)}</div></div>
          <div class="fs-stat"><div class="fs-stat-label">CON</div><div class="fs-stat-val">${escHtml(s.stats.con)}</div></div>
          <div class="fs-stat"><div class="fs-stat-label">INT</div><div class="fs-stat-val">${escHtml(s.stats.int)}</div></div>
          <div class="fs-stat"><div class="fs-stat-label">WIS</div><div class="fs-stat-val">${escHtml(s.stats.wis)}</div></div>
          <div class="fs-stat"><div class="fs-stat-label">CHA</div><div class="fs-stat-val">${escHtml(s.stats.cha)}</div></div>
        </div>
        <div class="fs-rule"></div>
        <div class="fs-details">
          ${s.saves ? `<p><strong>Saving Throws</strong> ${escHtml(s.saves)}</p>` : ''}
          <p><strong>Skills</strong> ${escHtml(s.skills)}</p>
          <p><strong>Senses</strong> ${escHtml(s.senses)}</p>
          <p><strong>Languages</strong> ${escHtml(s.languages)}</p>
          <p><strong>Challenge</strong> ${escHtml(s.cr)}</p>
        </div>
        <div class="fs-rule"></div>
        ${traitsHtml}
        ${actionsHtml.length ? `<div class="fs-section-head">Actions</div>${actionsHtml}` : ''}
        ${bonusHtml}
        ${reactionsHtml}
        <div class="fs-rule"></div>
        <div class="fs-behavior"><span class="fs-bold">DM Note:</span> ${escHtml(s.behavior)}</div>
      </div></div>`;
    }
  }

  html += `</div>`;
  document.getElementById('detail').innerHTML = html;
}

function advanceDevice(trackerId, clickedIndex, total) {
  for (let i = 0; i < total; i++) {
    const el = document.getElementById(`${trackerId}-${i}`);
    if (el) el.classList.toggle('dt-active', i === clickedIndex);
  }
}

function advanceDeviceNext(trackerId, total) {
  let current = 0;
  for (let i = 0; i < total; i++) {
    if (document.getElementById(`${trackerId}-${i}`)?.classList.contains('dt-active')) {
      current = i;
    }
  }
  const next = Math.min(current + 1, total - 1);
  advanceDevice(trackerId, next, total);
  if (next === total - 1) {
    const tracker = document.getElementById(trackerId);
    if (tracker) tracker.style.boxShadow = '0 0 30px rgba(139,26,26,0.8)';
  }
}

function resetDevice(trackerId, total) {
  advanceDevice(trackerId, 0, total);
  const tracker = document.getElementById(trackerId);
  if (tracker) tracker.style.boxShadow = '';
}

function rollEnvHazard() {
  const ENV = [
    { what: 'Reagent shelf collapses',           effect: 'DC 13 Dex save for all within 5 ft. — 2d6 bludgeoning + prone on fail. Advance device if within 10 ft.' },
    { what: 'Vial shatters — flammable compound', effect: '5 ft. square becomes difficult terrain. Fire damage there triggers +1d6 fire to all adjacent.' },
    { what: 'Device pulses — advance condition',  effect: 'Advance device one step. DC 12 Con save within 15 ft. or disadvantage on next attack.' },
    { what: 'Floor slick from spilled compound',  effect: 'Random 10 ft. square: DC 12 Acrobatics to cross or fall prone.' },
    { what: 'Crate falls — blocks exit',          effect: 'One exit becomes difficult terrain. DC 14 Athletics as an action to clear.' },
    { what: 'Smoke from cracked vial',            effect: '10 ft. area lightly obscured for 1d4 rounds. Attacks through it at disadvantage.' },
    { what: 'Nothing this round',                 effect: 'The room holds its breath. The hum is the only sound.' },
    { what: 'Viktor clips a shelf (if he moved)', effect: 'If Viktor moved 15+ ft. this round — roll again immediately. Otherwise nothing.' },
  ];
  const roll = Math.floor(Math.random() * 8);
  const h = ENV[roll];
  const el = document.getElementById('env-hazard-result');
  if (el) {
    el.innerHTML = `<strong style="color:var(--gold-dim)">[${roll + 1}] ${escHtml(h.what)}</strong><br><span style="color:#A09070;font-style:italic">${escHtml(h.effect)}</span>`;
    el.style.borderColor = 'var(--gold)';
    setTimeout(() => { el.style.borderColor = 'var(--red)'; }, 600);
  }
}
