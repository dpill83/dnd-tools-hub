import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DISTRICTS = {
  castle: {
    id: "castle", name: "Castle Ward", emoji: "🏰",
    desc: "Seat of power. Lords, nobles, and their coin.",
    x: 42, y: 20,
    baseModifiers: { silks: 1.4, books: 1.5, spices: 1.3, contraband: 0.6, grain: 1.1, weapons: 0.9, timber: 0.8, alchemical: 1.2, magical: 1.3 },
  },
  sea: {
    id: "sea", name: "Sea Ward", emoji: "🌊",
    desc: "Old money and magic. Temples, villas, wizard towers.",
    x: 20, y: 30,
    baseModifiers: { magical: 1.6, alchemical: 1.4, silks: 1.2, books: 1.3, contraband: 0.7, grain: 1.0, weapons: 0.9, timber: 0.85, spices: 1.1 },
  },
  trade: {
    id: "trade", name: "Trade Ward", emoji: "⚖️",
    desc: "The beating heart of commerce. Fair prices, fierce competition.",
    x: 55, y: 42,
    baseModifiers: { silks: 1.0, books: 1.0, spices: 1.0, contraband: 0.85, grain: 1.0, weapons: 1.0, timber: 1.0, alchemical: 1.0, magical: 1.0 },
  },
  north: {
    id: "north", name: "North Ward", emoji: "🏘️",
    desc: "Prosperous merchants and guild halls. Steady trade.",
    x: 45, y: 28,
    baseModifiers: { grain: 1.15, silks: 1.1, books: 1.1, contraband: 0.8, spices: 1.0, weapons: 1.0, timber: 1.05, alchemical: 0.95, magical: 0.9 },
  },
  south: {
    id: "south", name: "South Ward", emoji: "⚒️",
    desc: "Craftsmen and laborers. Raw materials flow through here.",
    x: 50, y: 60,
    baseModifiers: { timber: 1.4, weapons: 1.3, grain: 1.2, silks: 0.85, books: 0.8, contraband: 0.9, spices: 0.9, alchemical: 0.9, magical: 0.75 },
  },
  dock: {
    id: "dock", name: "Dock Ward", emoji: "⚓",
    desc: "Rough and ready. Smugglers, sailors, the desperate and the bold.",
    x: 30, y: 55,
    baseModifiers: { contraband: 1.7, timber: 1.2, weapons: 1.2, grain: 0.85, spices: 0.9, silks: 0.8, books: 0.7, alchemical: 0.8, magical: 0.7 },
  },
  field: {
    id: "field", name: "Field Ward", emoji: "🌾",
    desc: "Outside the city walls. Desperate folk. Dirt-cheap, dirt-rough.",
    x: 70, y: 68,
    baseModifiers: { grain: 1.5, timber: 1.3, contraband: 1.4, weapons: 1.1, silks: 0.7, books: 0.65, spices: 0.8, alchemical: 0.75, magical: 0.6 },
  },
};

const GOODS = {
  spices:     { name: "Spices",            emoji: "🌶️", basePrice: 80,  legal: true,  cargoSize: 1 },
  silks:      { name: "Fine Silks",        emoji: "🧵", basePrice: 140, legal: true,  cargoSize: 1 },
  alchemical: { name: "Alchemical Supplies",emoji: "⚗️",basePrice: 110, legal: true,  cargoSize: 1 },
  weapons:    { name: "Steel & Weapons",   emoji: "⚔️", basePrice: 95,  legal: true,  cargoSize: 2 },
  grain:      { name: "Grain & Livestock", emoji: "🌾", basePrice: 40,  legal: true,  cargoSize: 2 },
  contraband: { name: "Contraband",        emoji: "💀", basePrice: 200, legal: false, cargoSize: 1 },
  magical:    { name: "Magical Components",emoji: "✨", basePrice: 180, legal: true,  cargoSize: 1 },
  timber:     { name: "Timber & Stone",    emoji: "🪵", basePrice: 55,  legal: true,  cargoSize: 3 },
  books:      { name: "Books & Scrolls",   emoji: "📜", basePrice: 65,  legal: true,  cargoSize: 1 },
};

const FACTIONS = {
  watch:    { name: "City Watch",      emoji: "🛡️", color: "#4a90d9" },
  thieves:  { name: "Shadow Thieves",  emoji: "🗡️", color: "#9b59b6" },
  guild:    { name: "Merchant's Guild",emoji: "⚖️", color: "#e6a817" },
};

const CONNECTIONS = [
  ["castle","sea"],["castle","north"],["castle","trade"],
  ["sea","north"],["sea","dock"],
  ["north","trade"],["north","south"],
  ["trade","south"],["trade","dock"],
  ["south","dock"],["south","field"],
  ["dock","field"],
];

const CARGO_CAPACITY = 20;
const WIN_GOLD = 10000;
const MAX_DAYS = 120;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getConnected(districtId) {
  return CONNECTIONS
    .filter(([a, b]) => a === districtId || b === districtId)
    .map(([a, b]) => (a === districtId ? b : a));
}

function generateMarket(districtId, day, volatilitySeeds) {
  const district = DISTRICTS[districtId];
  const market = {};
  Object.entries(GOODS).forEach(([key, good]) => {
    const mod = district.baseModifiers[key] || 1.0;
    const seed = volatilitySeeds[`${districtId}-${key}`] || 1.0;
    const dayNoise = Math.sin(day * 0.3 + key.charCodeAt(0) * 0.7) * 0.12;
    const price = Math.round(good.basePrice * mod * seed * (1 + dayNoise));
    market[key] = Math.max(10, price);
  });
  return market;
}

function generateVolatilitySeeds() {
  const seeds = {};
  Object.keys(DISTRICTS).forEach(d => {
    Object.keys(GOODS).forEach(g => {
      seeds[`${d}-${g}`] = 0.75 + Math.random() * 0.5;
    });
  });
  return seeds;
}

const EVENTS = [
  {
    id: "watch_patrol",
    title: "City Watch Patrol",
    desc: "A Watch patrol stops your cart for inspection. They're looking for contraband.",
    condition: (state) => state.cargo.some(c => c.good === "contraband"),
    options: [
      { label: "Pay the bribe (50gp)", effect: (state) => ({ gold: state.gold - 50, log: "You slipped them 50gp. They looked the other way.", factionChange: { watch: -2 } }) },
      { label: "Talk your way out (Persuasion check)", effect: (state) => Math.random() > 0.5
          ? { log: "Your smooth words convinced them. They move on.", factionChange: { watch: 1 } }
          : { gold: state.gold - 150, cargo: state.cargo.filter(c => c.good !== "contraband"), log: "They didn't buy it. Contraband confiscated, 150gp fine.", factionChange: { watch: -5 } }
      },
    ],
  },
  {
    id: "thieves_toll",
    title: "Shadow Thief Toll",
    desc: "A cloaked figure steps into your path. 'The Guild extends its... hospitality.'",
    condition: () => true,
    options: [
      { label: "Pay the toll (30gp)", effect: (state) => ({ gold: state.gold - 30, log: "A small price for safe passage.", factionChange: { thieves: 1 } }) },
      { label: "Refuse and run", effect: (state) => Math.random() > 0.4
          ? { log: "You bolt down an alley. They don't follow — this time.", factionChange: { thieves: -3 } }
          : { gold: state.gold - 100, log: "You run, but they were faster. 100gp richer, they melt into shadow.", factionChange: { thieves: -2 } }
      },
    ],
  },
  {
    id: "market_tip",
    title: "Merchant's Tip",
    desc: "A red-faced merchant leans close. 'Between you and me — silks are fetching double in Sea Ward today. Storm delayed the shipment.'",
    condition: () => true,
    options: [
      { label: "Thank them and take note", effect: () => ({ log: "You file the tip away. Knowledge is coin.", factionChange: { guild: 1 }, marketBoost: { district: "sea", good: "silks", multiplier: 1.8 } }) },
    ],
  },
  {
    id: "dockworkers_strike",
    title: "Dockworkers' Strike",
    desc: "The Dock Ward is in uproar. Longshoremen have walked off the job. Timber and grain prices are spiking.",
    condition: () => true,
    options: [
      { label: "Noted", effect: () => ({ log: "The strike makes timber and grain scarce at the docks.", marketBoost: { district: "dock", good: "timber", multiplier: 2.0 } }) },
    ],
  },
  {
    id: "noble_feast",
    title: "A Noble's Grand Feast",
    desc: "Lord Haereth is throwing a feast for three hundred guests. Luxury goods are flying off the shelves in Castle Ward.",
    condition: () => true,
    options: [
      { label: "Make haste to Castle Ward", effect: () => ({ log: "Spices and silks are in short supply at the castle.", marketBoost: { district: "castle", good: "spices", multiplier: 1.9 } }) },
    ],
  },
  {
    id: "fog_delay",
    title: "Sea Fog Rolls In",
    desc: "A thick fog off the harbor slows all movement through the city. Travel costs +1 extra day.",
    condition: () => true,
    options: [
      { label: "Wait it out", effect: (state) => ({ day: state.day + 1, log: "You lose a day to the fog. The city breathes, unhurried." }) },
    ],
  },
  {
    id: "cargo_quest",
    title: "Urgent Delivery",
    desc: "A nervous clerk rushes up. 'Please — I'll pay 300gp to have these alchemical supplies delivered to Field Ward within 5 days. Discreetly.'",
    condition: (state) => !state.quests.some(q => q.id === "cargo_quest_active") && state.cargo.reduce((s,c)=>s+GOODS[c.good].cargoSize*c.qty,0) + 3 <= CARGO_CAPACITY,
    options: [
      { label: "Accept the job", effect: (state) => ({ log: "You take the crate. Field Ward within 5 days.", quests: [...state.quests, { id:"cargo_quest_active", label:"Deliver alchemical to Field Ward", deadline: state.day+5, reward:300, destDistrict:"field", goodRequired:"alchemical", cargoAdded:true }], cargo: [...state.cargo, { good:"alchemical", qty:3, paid:0, questLocked:true }] }) },
      { label: "Decline", effect: () => ({ log: "You shake your head. The clerk slinks away." }) },
    ],
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function WaterdeepTrader() {
  const [phase, setPhase] = useState("menu"); // menu | game | win | lose
  const [day, setDay] = useState(1);
  const [gold, setGold] = useState(500);
  const [location, setLocation] = useState("trade");
  const [cargo, setCargo] = useState([]); // [{good, qty, paid, questLocked}]
  const [factions, setFactions] = useState({ watch: 50, thieves: 50, guild: 50 });
  const [quests, setQuests] = useState([]);
  const [log, setLog] = useState(["You arrive at Trade Ward with 500gp and an empty cart. Make your fortune."]);
  const [seeds, setSeeds] = useState(() => generateVolatilitySeeds());
  const [marketBoosts, setMarketBoosts] = useState({});
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("market");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const logRef = useRef(null);

  function showToast(msg, reward) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, reward });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Derived
  const cargoUsed = cargo.reduce((s, c) => s + GOODS[c.good].cargoSize * c.qty, 0);
  const market = useCallback((districtId) => {
    const base = generateMarket(districtId, day, seeds);
    const boost = marketBoosts[districtId];
    if (boost) base[boost.good] = Math.round(base[boost.good] * boost.multiplier);
    return base;
  }, [day, seeds, marketBoosts]);

  const currentMarket = market(location);
  const connected = getConnected(location);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (gold >= WIN_GOLD) setPhase("win");
    if (day > MAX_DAYS) setPhase("lose");
  }, [gold, day]);

  function addLog(msg) {
    setLog(prev => [...prev.slice(-49), msg]);
  }

  function applyEffect(eff) {
    if (!eff) return;
    if (eff.gold !== undefined) setGold(eff.gold);
    if (eff.cargo !== undefined) setCargo(eff.cargo);
    if (eff.day !== undefined) setDay(eff.day);
    if (eff.quests !== undefined) setQuests(eff.quests);
    if (eff.factionChange) {
      setFactions(prev => {
        const next = { ...prev };
        Object.entries(eff.factionChange).forEach(([k, v]) => {
          next[k] = Math.max(0, Math.min(100, (next[k] || 50) + v));
        });
        return next;
      });
    }
    if (eff.marketBoost) {
      setMarketBoosts(prev => ({ ...prev, [eff.marketBoost.district]: { good: eff.marketBoost.good, multiplier: eff.marketBoost.multiplier } }));
    }
    if (eff.log) addLog(`📜 ${eff.log}`);
  }

  function buy(goodKey, qty) {
    const price = currentMarket[goodKey];
    const good = GOODS[goodKey];
    const totalCost = price * qty;
    const spaceNeeded = good.cargoSize * qty;
    if (gold < totalCost) return addLog("❌ Not enough gold.");
    if (cargoUsed + spaceNeeded > CARGO_CAPACITY) return addLog("❌ Not enough cargo space.");
    setGold(g => g - totalCost);
    setCargo(prev => {
      const existing = prev.find(c => c.good === goodKey && !c.questLocked);
      if (existing) return prev.map(c => c.good === goodKey && !c.questLocked ? { ...c, qty: c.qty + qty, paid: Math.round((c.paid * c.qty + price * qty) / (c.qty + qty)) } : c);
      return [...prev, { good: goodKey, qty, paid: price, questLocked: false }];
    });
    addLog(`🛒 Bought ${qty}x ${good.name} for ${totalCost}gp (${price}gp each).`);
  }

  function sell(goodKey, qty) {
    const item = cargo.find(c => c.good === goodKey && !c.questLocked);
    if (!item || item.qty < qty) return addLog("❌ You don't have that many.");
    const price = currentMarket[goodKey];
    const totalGain = price * qty;
    const profit = totalGain - item.paid * qty;
    setGold(g => g + totalGain);
    setCargo(prev =>
      prev.map(c => c.good === goodKey && !c.questLocked ? { ...c, qty: c.qty - qty } : c).filter(c => c.qty > 0)
    );
    addLog(`💰 Sold ${qty}x ${GOODS[goodKey].name} for ${totalGain}gp. Profit: ${profit >= 0 ? "+" : ""}${profit}gp.`);
  }

  // Called on arrival at a district — resolves any quests whose destination matches
  function resolveQuestsAtDistrict(destId, currentCargo, currentQuests) {
    let updatedCargo = [...currentCargo];
    let updatedQuests = [...currentQuests];
    let goldBonus = 0;
    let factionBonus = 0;
    let resolved = false;

    currentQuests.forEach(q => {
      if (!q.complete && q.destDistrict === destId) {
        const questCargo = currentCargo.find(c => c.good === q.goodRequired && c.questLocked);
        if (questCargo) {
          goldBonus += q.reward;
          factionBonus += 5;
          updatedCargo = updatedCargo.filter(c => !(c.good === q.goodRequired && c.questLocked));
          updatedQuests = updatedQuests.map(qq => qq.id === q.id ? { ...qq, complete: true } : qq);
          addLog(`✅ Quest complete! Delivered ${GOODS[q.goodRequired].name} to ${DISTRICTS[destId].name}. Reward: ${q.reward}gp.`);
          showToast(`Delivered ${GOODS[q.goodRequired].name} to ${DISTRICTS[destId].name}`, q.reward);
          resolved = true;
        }
      }
    });

    if (resolved) {
      setGold(g => g + goldBonus);
      setCargo(updatedCargo);
      setQuests(updatedQuests);
      setFactions(prev => ({ ...prev, guild: Math.min(100, prev.guild + factionBonus) }));
    }

    return { updatedCargo, updatedQuests };
  }

  function travel(destId) {
    const newDay = day + 1;
    setDay(newDay);
    setLocation(destId);
    setSeeds(generateVolatilitySeeds());
    addLog(`🗺️ Day ${newDay}: Traveled to ${DISTRICTS[destId].name}.`);

    // Check expired quests BEFORE resolving (use current state snapshots)
    let liveCargo = cargo;
    let liveQuests = quests;
    const expired = liveQuests.filter(q => !q.complete && q.deadline && newDay > q.deadline);
    if (expired.length > 0) {
      expired.forEach(q => addLog(`⚠️ Quest failed: "${q.label}" — deadline passed.`));
      liveQuests = liveQuests.filter(q => !expired.find(e => e.id === q.id));
      liveCargo = liveCargo.filter(c => !c.questLocked);
      setQuests(liveQuests);
      setCargo(liveCargo);
    }

    // Resolve any quests whose destination is here
    const { updatedCargo, updatedQuests } = resolveQuestsAtDistrict(destId, liveCargo, liveQuests);

    // Maybe trigger event (use updated cargo so expired/delivered items don't affect conditions)
    const eligibleEvents = EVENTS.filter(e => e.condition({ cargo: updatedCargo, quests: updatedQuests, day: newDay }));
    if (eligibleEvents.length > 0 && Math.random() < 0.45) {
      const chosen = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
      setEvent(chosen);
    }
  }

  function handleEventOption(option) {
    const state = { gold, cargo, day, quests, factions };
    const effect = option.effect(state);
    applyEffect(effect);
    setEvent(null);
  }

  function startGame() {
    setPhase("game");
    setDay(1);
    setGold(500);
    setLocation("trade");
    setCargo([]);
    setFactions({ watch: 50, thieves: 50, guild: 50 });
    setQuests([]);
    setLog(["You arrive at Trade Ward with 500gp and an empty cart. Make your fortune."]);
    setSeeds(generateVolatilitySeeds());
    setMarketBoosts({});
    setEvent(null);
    setTab("market");
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const gold_pct = Math.min(100, (gold / WIN_GOLD) * 100);
  const cargo_pct = (cargoUsed / CARGO_CAPACITY) * 100;

  if (phase === "menu") return <MenuScreen onStart={startGame} />;
  if (phase === "win") return <EndScreen win={true} day={day} gold={gold} onRestart={startGame} />;
  if (phase === "lose") return <EndScreen win={false} day={day} gold={gold} onRestart={startGame} />;

  const dist = DISTRICTS[location];

  // Tabs include map on mobile; log is its own tab too
  const TABS = [
    { id: "market", label: "🏪", full: "Market" },
    { id: "travel", label: "🗺️", full: "Travel" },
    { id: "map",    label: "📍", full: "Map" },
    { id: "quests", label: "📋", full: "Quests" },
    { id: "cargo",  label: "📦", full: "Cargo" },
    { id: "log",    label: "📜", full: "Log" },
  ];

  return (
    <div style={styles.root}>
      <div style={styles.texture} />

      {/* EVENT MODAL */}
      {event && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={styles.modalIcon}>⚔️</span>
              <span style={styles.modalTitle}>{event.title}</span>
            </div>
            <p style={styles.modalDesc}>{event.desc}</p>
            <div style={styles.modalOptions}>
              {event.options.map((opt, i) => (
                <button key={i} style={styles.modalBtn} onClick={() => handleEventOption(opt)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR — compact on mobile */}
      <div style={styles.topBar}>
        <div style={styles.topTitle}>⚓ WATERDEEP TRADER</div>
        <div style={styles.topStats}>
          <StatChip label="Gold" value={`${gold.toLocaleString()}gp`} icon="🪙" color="#e6a817" />
          <StatChip label="Day" value={`${day}/${MAX_DAYS}`} icon="📅" color="#a0c4a0" />
          <div style={styles.statChip}>
            <span style={{ color: "#aaa", fontSize: 10 }}>CARGO</span>
            <div style={styles.miniBar}>
              <div style={{ ...styles.miniBarFill, width: `${cargo_pct}%`, background: cargo_pct > 80 ? "#e05c5c" : "#e6a817" }} />
            </div>
            <span style={{ color: "#e6a817", fontSize: 11, fontFamily: "monospace" }}>{cargoUsed}/{CARGO_CAPACITY}</span>
          </div>
          <div style={styles.statChip}>
            <span style={{ color: "#aaa", fontSize: 10 }}>GOAL</span>
            <div style={styles.miniBar}>
              <div style={{ ...styles.miniBarFill, width: `${gold_pct}%`, background: "#e6a817" }} />
            </div>
            <span style={{ color: "#e6a817", fontSize: 11, fontFamily: "monospace" }}>{Math.round(gold_pct)}%</span>
          </div>
        </div>
      </div>

      {/* FACTION BARS — tighter on mobile */}
      <div style={styles.factionBar}>
        {Object.entries(FACTIONS).map(([key, f]) => (
          <div key={key} style={styles.factionItem}>
            <span style={{ fontSize: 12 }}>{f.emoji}</span>
            <div style={styles.factionTrack}>
              <div style={{ ...styles.factionFill, width: `${factions[key]}%`, background: f.color }} />
            </div>
            <span style={{ fontSize: 10, color: "#666", fontFamily: "monospace", minWidth: 22 }}>{factions[key]}</span>
          </div>
        ))}
      </div>

      {/* LOCATION HEADER — full width, compact */}
      <div style={styles.locationCard}>
        <div style={styles.locationEmoji}>{dist.emoji}</div>
        <div style={{minWidth:0}}>
          <div style={styles.locationName}>{dist.name}</div>
          <div style={styles.locationDesc}>{dist.desc}</div>
        </div>
      </div>

      {/* TABS — full width, 6 tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            <span style={{fontSize:15}}>{t.label}</span>
            <span style={{fontSize:10, display:"block", marginTop:1}}>{t.full}</span>
          </button>
        ))}
      </div>

      {/* SINGLE SCROLLABLE CONTENT AREA */}
      <div style={styles.tabContent}>
        {tab === "market" && <MarketTab market={currentMarket} cargo={cargo} gold={gold} cargoUsed={cargoUsed} onBuy={buy} onSell={sell} quests={quests} location={location} />}
        {tab === "travel" && <TravelTab connected={connected} location={location} onTravel={(id) => { travel(id); setTab("market"); }} day={day} maxDays={MAX_DAYS} />}
        {tab === "map"    && <MapView location={location} connected={connected} onTravel={(id) => { travel(id); setTab("market"); }} fullscreen />}
        {tab === "quests" && <QuestsTab quests={quests} day={day} />}
        {tab === "cargo"  && <CargoTab cargo={cargo} market={currentMarket} />}
        {tab === "log"    && (
          <div style={{display:"flex", flexDirection:"column", gap:6}}>
            <div style={styles.logTitle}>📜 Captain's Log</div>
            {log.slice().reverse().map((entry, i) => (
              <div key={i} style={{ ...styles.logEntry, opacity: 1 - i * 0.04, fontSize: i === 0 ? 14 : 13 }}>{entry}</div>
            ))}
          </div>
        )}
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#1a2a12", border: "1px solid #4a8a2a",
          borderRadius: 10, padding: "12px 20px", zIndex: 200,
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
          animation: "slideUp 0.3s ease",
          maxWidth: "90vw",
        }}>
          <span style={{fontSize: 24}}>✅</span>
          <div>
            <div style={{color:"#6abf6a", fontWeight:"bold", fontSize:14}}>Quest Complete!</div>
            <div style={{color:"#c8b87a", fontSize:13, marginTop:2}}>{toast.msg}</div>
          </div>
          <div style={{
            marginLeft: 8, background: "#2a4a1a", border: "1px solid #4a8a2a",
            borderRadius: 6, padding: "4px 10px", color:"#a0c4a0",
            fontFamily:"monospace", fontWeight:"bold", fontSize:15, flexShrink:0,
          }}>+{toast.reward}gp</div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatChip({ label, value, icon, color }) {
  return (
    <div style={styles.statChip}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ color: "#aaa", fontSize: 11 }}>{label}</span>
      <span style={{ color, fontFamily: "monospace", fontWeight: "bold", fontSize: 14 }}>{value}</span>
    </div>
  );
}

function MarketTab({ market, cargo, gold, cargoUsed, onBuy, onSell, quests, location }) {
  const [qty, setQty] = useState(1);

  const deliverableHere = quests.filter(
    q => !q.complete && q.destDistrict === location && cargo.some(c => c.good === q.goodRequired && c.questLocked)
  );

  return (
    <div>
      {deliverableHere.map(q => (
        <div key={q.id} style={styles.deliveryBanner}>
          <span style={{fontSize:18}}>📦</span>
          <div>
            <div style={{color:"#e6a817",fontWeight:"bold",fontSize:13}}>Quest Delivery Ready!</div>
            <div style={{color:"#a0c4a0",fontSize:12,marginTop:2}}>Reward: {q.reward}gp — resolves on next travel ✓</div>
          </div>
        </div>
      ))}

      {/* Qty selector */}
      <div style={styles.qtyRow}>
        <span style={styles.sectionLabel}>Qty:</span>
        {[1,5,10].map(q => (
          <button key={q} style={{ ...styles.qtyBtn, ...(qty===q ? styles.qtyBtnActive : {}) }} onClick={() => setQty(q)}>{q}</button>
        ))}
      </div>

      {/* Card-per-good layout */}
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        {Object.entries(GOODS).map(([key, good]) => {
          const price = market[key];
          const heldItem = cargo.find(c => c.good === key && !c.questLocked);
          const held = heldItem?.qty || 0;
          const paid = heldItem?.paid || 0;
          const pnlTotal = held > 0 ? (price - paid) * held : null;
          const canBuy = gold >= price * qty && cargoUsed + good.cargoSize * qty <= 20;
          const canSell = held >= qty;
          const isQuestLocked = cargo.some(c => c.good === key && c.questLocked);
          const isIllicit = !good.legal;

          return (
            <div key={key} style={{
              background: isIllicit ? "rgba(155,89,182,0.07)" : held > 0 ? "rgba(40,60,30,0.25)" : "#0f0d08",
              border: `1px solid ${held > 0 ? "#2a4020" : isIllicit ? "#2a1a3a" : "#1e1a10"}`,
              borderRadius: 6,
              padding: "8px 10px",
            }}>
              {/* Row 1: name + price + pnl badge */}
              <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:5}}>
                <span style={{fontSize:16, flexShrink:0}}>{good.emoji}</span>
                <span style={{color:"#e6d5a8", fontSize:13, fontWeight:"bold", flex:1, minWidth:0}}>
                  {good.name}
                  {isIllicit && <span style={{color:"#9b59b6",fontSize:10,marginLeft:5}}>[illicit]</span>}
                  {isQuestLocked && <span style={{color:"#e6a817",fontSize:10,marginLeft:5}}>[quest]</span>}
                </span>
                {/* Price */}
                <span style={{fontFamily:"monospace", color:"#e6a817", fontWeight:"bold", fontSize:14, flexShrink:0}}>
                  {price}gp
                </span>
              </div>

              {/* Row 2: held info + buy/sell buttons */}
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                {/* Held / paid / pnl — left side */}
                <div style={{flex:1, fontSize:11, fontFamily:"monospace", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
                  {held > 0 ? (
                    <>
                      <span style={{color:"#888"}}>held: <span style={{color:"#c8b87a"}}>{held}</span></span>
                      <span style={{color:"#666"}}>paid: <span style={{color:"#888"}}>{paid}gp</span></span>
                      <span style={{
                        color: pnlTotal >= 0 ? "#6abf6a" : "#e05c5c",
                        fontWeight:"bold",
                      }}>
                        {pnlTotal >= 0 ? "▲" : "▼"}{Math.abs(pnlTotal)}gp
                      </span>
                    </>
                  ) : (
                    <span style={{color:"#444"}}>not held · {good.cargoSize}u/ea</span>
                  )}
                </div>

                {/* Buttons — right side, always visible */}
                <button
                  style={{
                    ...styles.tradeBtn, ...styles.buyBtn,
                    opacity: canBuy ? 1 : 0.28,
                    cursor: canBuy ? "pointer" : "default",
                    padding: "5px 14px", fontSize: 13,
                  }}
                  onClick={() => canBuy && onBuy(key, qty)}
                >Buy</button>
                <button
                  style={{
                    ...styles.tradeBtn, ...styles.sellBtn,
                    opacity: canSell ? 1 : 0.28,
                    cursor: canSell ? "pointer" : "default",
                    padding: "5px 14px", fontSize: 13,
                  }}
                  onClick={() => canSell && onSell(key, qty)}
                >Sell</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TravelTab({ connected, location, onTravel, day, maxDays }) {
  return (
    <div>
      <div style={styles.sectionLabel}>Reachable Districts (1 day travel)</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8 }}>
        {connected.map(id => {
          const d = DISTRICTS[id];
          return (
            <button key={id} style={styles.travelCard} onClick={() => onTravel(id)}>
              <span style={{fontSize:22}}>{d.emoji}</span>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{color:"#e6d5a8",fontWeight:"bold",fontSize:14}}>{d.name}</div>
                <div style={{color:"#888",fontSize:12}}>{d.desc}</div>
              </div>
              <span style={{color:"#888",fontSize:12}}>1 day →</span>
            </button>
          );
        })}
      </div>
      {day >= maxDays - 10 && <div style={styles.warning}>⚠️ Only {maxDays - day} days remain!</div>}
    </div>
  );
}

function QuestsTab({ quests, day }) {
  const active = quests.filter(q => !q.complete);
  if (active.length === 0) return <div style={{color:"#666",padding:16,textAlign:"center"}}>No active quests. Events may offer contracts.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {active.map((q,i) => {
        const urgent = q.deadline && (q.deadline - day) <= 2;
        return (
          <div key={i} style={{...styles.questCard, borderColor: urgent?"#e05c5c":"#3a3020"}}>
            <div style={{color:urgent?"#e05c5c":"#e6d5a8",fontWeight:"bold",fontSize:13}}>{q.label}</div>
            {q.deadline && <div style={{color:urgent?"#e05c5c":"#888",fontSize:12}}>Due: Day {q.deadline} ({q.deadline-day} days left)</div>}
            <div style={{color:"#a0c4a0",fontSize:12}}>Reward: {q.reward}gp</div>
          </div>
        );
      })}
    </div>
  );
}

function CargoTab({ cargo, market }) {
  if (cargo.length === 0) return <div style={{color:"#666",padding:16,textAlign:"center"}}>Your cart is empty.</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {cargo.map((item, i) => {
        const good = GOODS[item.good];
        const currentPrice = market[item.good];
        const pnl = (currentPrice - item.paid) * item.qty;
        return (
          <div key={i} style={styles.cargoItem}>
            <span style={{fontSize:18}}>{good.emoji}</span>
            <div style={{flex:1}}>
              <div style={{color:"#e6d5a8",fontSize:13}}>{good.name} {item.questLocked && <span style={{color:"#9b59b6",fontSize:10}}>[quest]</span>}</div>
              <div style={{color:"#888",fontSize:12}}>Qty: {item.qty} · Paid: {item.paid}gp · Size: {good.cargoSize * item.qty}u</div>
            </div>
            <span style={{fontFamily:"monospace",color:pnl>=0?"#a0c4a0":"#e05c5c",fontSize:13}}>{pnl>=0?"+":""}{pnl}gp</span>
          </div>
        );
      })}
    </div>
  );
}

function MapView({ location, connected, onTravel, fullscreen }) {
  return (
    <div style={fullscreen ? {padding:"12px 16px"} : styles.mapContainer}>
      {!fullscreen && <div style={styles.mapTitle}>🗺️ Waterdeep</div>}
      {fullscreen && <div style={{color:"#888", fontSize:12, letterSpacing:2, marginBottom:10}}>🗺️ WATERDEEP — tap a reachable district to travel</div>}
      <svg viewBox="0 0 100 90" style={{width:"100%", display:"block", maxHeight: fullscreen ? 340 : undefined}}>
        {CONNECTIONS.map(([a, b], i) => {
          const da = DISTRICTS[a]; const db = DISTRICTS[b];
          const isActive = (a === location && connected.includes(b)) || (b === location && connected.includes(a));
          return (
            <line key={i} x1={da.x} y1={da.y} x2={db.x} y2={db.y}
              stroke={isActive ? "#6b5a3a" : "#2a2010"} strokeWidth={isActive ? 1.2 : 0.7} />
          );
        })}
        {Object.entries(DISTRICTS).map(([id, d]) => {
          const isCurrent = id === location;
          const isReachable = connected.includes(id);
          const r = fullscreen ? (isCurrent ? 7 : isReachable ? 6 : 4.5) : (isCurrent ? 5.5 : isReachable ? 4.5 : 3.5);
          return (
            <g key={id} onClick={() => isReachable && onTravel(id)} style={{ cursor: isReachable ? "pointer" : "default" }}>
              <circle cx={d.x} cy={d.y} r={r}
                fill={isCurrent ? "#e6a817" : isReachable ? "#6b5a3a" : "#2a2010"}
                stroke={isCurrent ? "#fff" : isReachable ? "#a08030" : "#3a3020"}
                strokeWidth={isCurrent ? 1.5 : 1} />
              <text x={d.x} y={d.y - (fullscreen ? 9 : 7)} textAnchor="middle"
                fill={isCurrent ? "#e6d5a8" : isReachable ? "#a09070" : "#55493a"}
                fontSize={fullscreen ? (isCurrent ? 5.5 : 4.5) : (isCurrent ? 4.5 : 3.8)}
                fontFamily="serif">
                {d.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={styles.mapLegend}>
        <span style={{color:"#e6a817"}}>● You</span>
        <span style={{color:"#a08030"}}>● Reachable (tap)</span>
        <span style={{color:"#3a3020"}}>● Far</span>
      </div>
    </div>
  );
}

function MenuScreen({ onStart }) {
  return (
    <div style={{...styles.root, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24}}>
      <div style={styles.texture} />
      <div style={{textAlign:"center", zIndex:1}}>
        <div style={{fontSize:64, marginBottom:8}}>⚓</div>
        <div style={{fontFamily:"'Palatino Linotype', Palatino, serif", fontSize:42, color:"#e6a817", letterSpacing:4, textShadow:"0 2px 20px rgba(230,168,23,0.4)"}}>
          WATERDEEP TRADER
        </div>
        <div style={{color:"#888", marginTop:8, fontSize:15, fontStyle:"italic", letterSpacing:2}}>
          A merchant's tale in the City of Splendors
        </div>
      </div>
      <div style={{...styles.menuCard, zIndex:1}}>
        <p style={{color:"#c8b87a", lineHeight:1.7, fontSize:14, margin:0}}>
          You arrive in Waterdeep with <strong style={{color:"#e6a817"}}>500 gold pieces</strong> and an empty cart.
          Trade between the city's seven wards, run cargo for coin, navigate faction politics,
          and weather random fortune — all before <strong style={{color:"#e6a817"}}>Day 120</strong>.
        </p>
        <p style={{color:"#888", fontSize:13, marginTop:12, marginBottom:0}}>
          Goal: Accumulate <strong style={{color:"#e6a817"}}>10,000gp</strong> to establish yourself as a power in the city.
        </p>
      </div>
      <button style={{...styles.startBtn, zIndex:1}} onClick={onStart}>
        Begin Trading
      </button>
    </div>
  );
}

function EndScreen({ win, day, gold, onRestart }) {
  return (
    <div style={{...styles.root, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24}}>
      <div style={styles.texture} />
      <div style={{textAlign:"center", zIndex:1}}>
        <div style={{fontSize:64}}>{win ? "👑" : "💀"}</div>
        <div style={{fontFamily:"'Palatino Linotype', serif", fontSize:36, color: win?"#e6a817":"#e05c5c", marginTop:8}}>
          {win ? "Fortune Secured!" : "Ruined."}
        </div>
        <div style={{color:"#888", marginTop:12, fontSize:14}}>
          {win
            ? `You amassed ${gold.toLocaleString()}gp in ${day} days. Waterdeep will remember your name.`
            : `You finished Day ${day} with only ${gold.toLocaleString()}gp. The city is unforgiving.`
          }
        </div>
      </div>
      <button style={{...styles.startBtn, zIndex:1}} onClick={onRestart}>Play Again</button>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    height: "100vh", background: "#0d0b07", color: "#c8b87a",
    fontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
    position: "relative", display: "flex", flexDirection: "column", overflow: "hidden",
  },
  texture: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
    backgroundImage: `
      radial-gradient(ellipse at 20% 80%, rgba(60,40,10,0.3) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(40,30,5,0.2) 0%, transparent 50%)
    `,
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", background: "#0a0805",
    borderBottom: "1px solid #2a2010", zIndex: 10, flexWrap: "wrap", gap: 8,
  },
  topTitle: {
    fontFamily: "'Palatino Linotype', serif", fontSize: 18, color: "#e6a817",
    letterSpacing: 2, textShadow: "0 1px 8px rgba(230,168,23,0.3)",
  },
  topStats: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" },
  statChip: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 2, padding: "4px 10px", background: "#13100a",
    border: "1px solid #2a2010", borderRadius: 4, minWidth: 70,
  },
  miniBar: { width: 70, height: 4, background: "#2a2010", borderRadius: 2, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 2, transition: "width 0.5s ease" },
  factionBar: {
    display: "flex", gap: 8, padding: "5px 12px", background: "#090705",
    borderBottom: "1px solid #1a1508", zIndex: 10,
  },
  factionItem: { display: "flex", alignItems: "center", gap: 5, flex: 1 },
  factionName: { color: "#888", fontSize: 11, whiteSpace: "nowrap" },
  factionTrack: { flex: 1, height: 3, background: "#2a2010", borderRadius: 2, overflow: "hidden" },
  factionFill: { height: "100%", borderRadius: 2, transition: "width 0.5s" },
  locationCard: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    background: "#0f0d08", borderBottom: "1px solid #2a2010", flexShrink: 0,
  },
  locationEmoji: { fontSize: 28, flexShrink: 0 },
  locationName: { color: "#e6d5a8", fontWeight: "bold", fontSize: 16, letterSpacing: 1 },
  locationDesc: { color: "#888", fontSize: 12, marginTop: 1 },
  tabs: {
    display: "flex", borderBottom: "1px solid #2a2010", background: "#0a0805", flexShrink: 0,
  },
  tab: {
    flex: 1, padding: "6px 2px", background: "transparent", border: "none",
    color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
    borderBottom: "2px solid transparent", transition: "all 0.2s", lineHeight: 1.2,
  },
  tabActive: { color: "#e6a817", borderBottomColor: "#e6a817", background: "#0f0d08" },
  tabContent: { flex: 1, overflow: "auto", padding: 12, zIndex: 1 },
  qtyRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionLabel: { color: "#888", fontSize: 12 },
  qtyBtn: {
    padding: "3px 12px", background: "#1a1508", border: "1px solid #3a3020",
    color: "#888", cursor: "pointer", borderRadius: 3, fontSize: 13, fontFamily: "inherit",
  },
  qtyBtnActive: { background: "#3a2a08", color: "#e6a817", borderColor: "#6b5a3a" },
  marketTable: { display: "flex", flexDirection: "column", gap: 2 },
  tableHeader: {
    display: "flex", padding: "4px 8px", color: "#555", fontSize: 11,
    borderBottom: "1px solid #2a2010", marginBottom: 4, letterSpacing: 1,
  },
  tableRow: {
    display: "flex", alignItems: "center", padding: "6px 8px",
    borderRadius: 4, border: "1px solid #1a1508", gap: 4,
  },
  tradeBtn: {
    padding: "3px 10px", border: "none", borderRadius: 3, cursor: "pointer",
    fontSize: 12, fontFamily: "inherit", fontWeight: "bold", transition: "opacity 0.2s",
  },
  buyBtn: { background: "#1a3a1a", color: "#a0c4a0" },
  sellBtn: { background: "#3a1a1a", color: "#c4a0a0" },
  travelCard: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    background: "#0f0d08", border: "1px solid #2a2010", borderRadius: 6,
    cursor: "pointer", color: "inherit", fontFamily: "inherit", transition: "border-color 0.2s",
  },
  warning: { color: "#e05c5c", fontSize: 13, marginTop: 16, padding: "8px 12px", background: "#200a0a", borderRadius: 4 },
  questCard: { padding: "10px 14px", background: "#0f0d08", border: "1px solid #3a3020", borderRadius: 6 },
  cargoItem: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
    background: "#0f0d08", border: "1px solid #2a2010", borderRadius: 5,
  },
  deliveryBanner: {
    display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px",
    background: "#1a1800", border: "1px solid #6b5a1a", borderRadius: 6,
    marginBottom: 12,
  },
  mapLegend: { display: "flex", gap: 12, fontSize: 11, color: "#666", marginTop: 6, justifyContent: "center" },
  logTitle: { color: "#555", fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  logEntry: { color: "#a09070", lineHeight: 1.6, borderBottom: "1px solid #13100a", paddingBottom: 6, marginBottom: 2 },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  modal: {
    background: "#13100a", border: "2px solid #6b5a3a", borderRadius: 8,
    padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
  },
  modalHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  modalIcon: { fontSize: 28 },
  modalTitle: { fontFamily: "'Palatino Linotype', serif", fontSize: 20, color: "#e6a817", letterSpacing: 1 },
  modalDesc: { color: "#c8b87a", lineHeight: 1.7, fontSize: 14, margin: "0 0 18px" },
  modalOptions: { display: "flex", flexDirection: "column", gap: 8 },
  modalBtn: {
    padding: "10px 16px", background: "#1a1508", border: "1px solid #3a3020",
    color: "#e6d5a8", cursor: "pointer", borderRadius: 4, fontFamily: "inherit",
    fontSize: 13, textAlign: "left", transition: "background 0.2s",
  },
  menuCard: {
    background: "#0f0d08", border: "1px solid #3a3020", borderRadius: 8,
    padding: "20px 24px", maxWidth: 480, width: "100%",
  },
  startBtn: {
    padding: "14px 40px", background: "#3a2a08", border: "2px solid #e6a817",
    color: "#e6a817", fontSize: 16, fontFamily: "'Palatino Linotype', serif",
    letterSpacing: 2, cursor: "pointer", borderRadius: 4,
    boxShadow: "0 0 20px rgba(230,168,23,0.2)", transition: "all 0.2s",
  },
};
