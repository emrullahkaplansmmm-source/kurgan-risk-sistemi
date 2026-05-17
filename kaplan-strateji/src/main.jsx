import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const MAP_SIZE = 16;
const TICK_MS = 650;

const UNIT_BLUEPRINTS = {
  soldier: {
    label: 'Asker',
    icon: '🪖',
    hp: 62,
    attack: 11,
    range: 1,
    speed: 1,
    gold: 55,
    energy: 10,
    reward: 24,
  },
  tank: {
    label: 'Tank',
    icon: '🛡️',
    hp: 145,
    attack: 24,
    range: 2,
    speed: 1,
    gold: 145,
    energy: 32,
    reward: 58,
  },
};

const TOWER_BLUEPRINT = {
  label: 'Savunma Kulesi',
  icon: '🗼',
  hp: 175,
  attack: 18,
  range: 3,
  gold: 120,
  energy: 42,
};

const BASE_STATS = {
  player: { hp: 620, x: 1, y: 13, icon: '🐯', label: 'Kaplan Üssü' },
  enemy: { hp: 620, x: 14, y: 2, icon: '☠️', label: 'Düşman Üssü' },
};

const TOWER_SLOTS = [
  { x: 3, y: 10 },
  { x: 5, y: 13 },
  { x: 10, y: 2 },
  { x: 12, y: 5 },
];

const terrainFor = (x, y) => {
  const ridge = (x === 7 && y > 2 && y < 13) || (x === 8 && y > 3 && y < 12);
  const ore = (x === 2 && y === 11) || (x === 13 && y === 4) || (x === 5 && y === 6) || (x === 10 && y === 9);
  if (ridge) return 'ridge';
  if (ore) return 'ore';
  if ((x + y) % 7 === 0) return 'forest';
  return 'plain';
};

const makeUnit = (type, team, idSeed) => {
  const blueprint = UNIT_BLUEPRINTS[type];
  const spawn = team === 'player' ? { x: 2, y: 13 } : { x: 13, y: 2 };
  return {
    id: `${team}-${type}-${idSeed}-${Math.random().toString(16).slice(2)}`,
    type,
    team,
    x: spawn.x,
    y: spawn.y,
    hp: blueprint.hp,
    maxHp: blueprint.hp,
    attackCooldown: 0,
  };
};

const createInitialGame = () => ({
  running: false,
  tick: 0,
  message: 'Komutan, savaşı başlat ve Kaplan Üssü’nü koru.',
  resources: { gold: 320, energy: 130 },
  enemyResources: { gold: 260, energy: 110 },
  bases: {
    player: { ...BASE_STATS.player, maxHp: BASE_STATS.player.hp },
    enemy: { ...BASE_STATS.enemy, maxHp: BASE_STATS.enemy.hp },
  },
  units: [makeUnit('soldier', 'player', 'initial'), makeUnit('soldier', 'enemy', 'initial')],
  towers: [
    { id: 'player-tower-home', team: 'player', x: 3, y: 12, hp: 175, maxHp: 175, attackCooldown: 0 },
    { id: 'enemy-tower-home', team: 'enemy', x: 12, y: 3, hp: 175, maxHp: 175, attackCooldown: 0 },
  ],
  explosions: [],
  selectedBuild: 'soldier',
  winner: null,
});

const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const cellOccupied = (game, x, y) => {
  if (game.units.some((unit) => unit.x === x && unit.y === y && unit.hp > 0)) return true;
  if (game.towers.some((tower) => tower.x === x && tower.y === y && tower.hp > 0)) return true;
  return Object.values(game.bases).some((base) => base.x === x && base.y === y && base.hp > 0);
};

const findTarget = (actor, game, range) => {
  const enemies = [
    ...game.units.filter((unit) => unit.team !== actor.team && unit.hp > 0),
    ...game.towers.filter((tower) => tower.team !== actor.team && tower.hp > 0),
    game.bases[actor.team === 'player' ? 'enemy' : 'player'],
  ];
  return enemies
    .filter((target) => target.hp > 0 && distance(actor, target) <= range)
    .sort((a, b) => distance(actor, a) - distance(actor, b))[0];
};

const damageTarget = (draft, target, damage) => {
  if (!target) return;
  target.hp = Math.max(0, target.hp - damage);
  if (target.hp === 0) {
    draft.explosions.push({ id: `boom-${Date.now()}-${Math.random()}`, x: target.x, y: target.y, ttl: 4 });
    if (target.team === 'enemy') {
      draft.resources.gold += target.type ? UNIT_BLUEPRINTS[target.type].reward : 90;
    }
  }
};

const moveTowardEnemyBase = (unit, game) => {
  const targetBase = game.bases[unit.team === 'player' ? 'enemy' : 'player'];
  const options = [
    { x: clamp(unit.x + Math.sign(targetBase.x - unit.x), 0, MAP_SIZE - 1), y: unit.y },
    { x: unit.x, y: clamp(unit.y + Math.sign(targetBase.y - unit.y), 0, MAP_SIZE - 1) },
    { x: clamp(unit.x + Math.sign(targetBase.x - unit.x), 0, MAP_SIZE - 1), y: clamp(unit.y + Math.sign(targetBase.y - unit.y), 0, MAP_SIZE - 1) },
  ];
  const legal = options.filter((option) => terrainFor(option.x, option.y) !== 'ridge' && !cellOccupied(game, option.x, option.y));
  const best = legal.sort((a, b) => distance(a, targetBase) - distance(b, targetBase))[0];
  if (best) {
    unit.x = best.x;
    unit.y = best.y;
  }
};

const runAiProduction = (draft) => {
  const roll = draft.tick % 5;
  const choice = draft.enemyResources.gold > 160 && draft.enemyResources.energy > 36 && roll === 0 ? 'tank' : 'soldier';
  const cost = UNIT_BLUEPRINTS[choice];
  if (draft.enemyResources.gold >= cost.gold && draft.enemyResources.energy >= cost.energy) {
    draft.enemyResources.gold -= cost.gold;
    draft.enemyResources.energy -= cost.energy;
    draft.units.push(makeUnit(choice, 'enemy', draft.tick));
    draft.message = choice === 'tank' ? 'Düşman ağır tank sevk etti!' : 'Düşman yeni asker çıkardı.';
  }
};

const advanceGame = (game) => {
  if (!game.running || game.winner) return game;
  const draft = structuredClone(game);
  draft.tick += 1;
  draft.resources.gold += 22 + draft.towers.filter((tower) => tower.team === 'player').length * 2;
  draft.resources.energy += 9;
  draft.enemyResources.gold += 19;
  draft.enemyResources.energy += 8;
  draft.explosions = draft.explosions.map((boom) => ({ ...boom, ttl: boom.ttl - 1 })).filter((boom) => boom.ttl > 0);

  runAiProduction(draft);

  for (const unit of draft.units) {
    if (unit.hp <= 0) continue;
    const blueprint = UNIT_BLUEPRINTS[unit.type];
    const target = findTarget(unit, draft, blueprint.range);
    if (target && unit.attackCooldown <= 0) {
      damageTarget(draft, target, blueprint.attack);
      unit.attackCooldown = 1;
    } else if (!target) {
      moveTowardEnemyBase(unit, draft);
    } else {
      unit.attackCooldown -= 1;
    }
  }

  for (const tower of draft.towers) {
    if (tower.hp <= 0) continue;
    const target = findTarget(tower, draft, TOWER_BLUEPRINT.range);
    if (target && tower.attackCooldown <= 0) {
      damageTarget(draft, target, TOWER_BLUEPRINT.attack);
      tower.attackCooldown = 1;
    } else if (tower.attackCooldown > 0) {
      tower.attackCooldown -= 1;
    }
  }

  draft.units = draft.units.filter((unit) => unit.hp > 0);
  draft.towers = draft.towers.filter((tower) => tower.hp > 0);

  if (draft.bases.enemy.hp <= 0) {
    draft.running = false;
    draft.winner = 'player';
    draft.message = 'Zafer! Düşman üssü düştü.';
  } else if (draft.bases.player.hp <= 0) {
    draft.running = false;
    draft.winner = 'enemy';
    draft.message = 'Yenilgi! Kaplan Üssü kaybedildi.';
  }

  return draft;
};

function HealthBar({ current, max }) {
  const pct = clamp((current / max) * 100, 0, 100);
  return (
    <div className="health" title={`${current}/${max}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="stat-card" style={{ '--accent': accent }}>
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function App() {
  const [game, setGame] = useState(createInitialGame);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!game.running) return undefined;
    intervalRef.current = setInterval(() => setGame((current) => advanceGame(current)), TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [game.running]);

  const entitiesByCell = useMemo(() => {
    const map = new Map();
    const add = (entity, kind) => map.set(`${entity.x}-${entity.y}`, { ...entity, kind });
    Object.entries(game.bases).forEach(([team, base]) => add({ ...base, team }, 'base'));
    game.towers.forEach((tower) => add(tower, 'tower'));
    game.units.forEach((unit) => add(unit, 'unit'));
    return map;
  }, [game]);

  const produce = useCallback((type) => {
    setGame((current) => {
      if (current.winner) return current;
      const cost = UNIT_BLUEPRINTS[type];
      if (current.resources.gold < cost.gold || current.resources.energy < cost.energy) {
        return { ...current, message: `${cost.label} için yeterli kaynak yok.` };
      }
      return {
        ...current,
        resources: { gold: current.resources.gold - cost.gold, energy: current.resources.energy - cost.energy },
        units: [...current.units, makeUnit(type, 'player', current.tick)],
        message: `${cost.label} üretildi ve cepheye yollandı.`,
      };
    });
  }, []);

  const buildTower = useCallback((slot) => {
    setGame((current) => {
      if (current.winner) return current;
      if (current.towers.some((tower) => tower.x === slot.x && tower.y === slot.y)) {
        return { ...current, message: 'Bu savunma noktasında zaten kule var.' };
      }
      if (current.resources.gold < TOWER_BLUEPRINT.gold || current.resources.energy < TOWER_BLUEPRINT.energy) {
        return { ...current, message: 'Savunma kulesi için yeterli altın veya enerji yok.' };
      }
      return {
        ...current,
        resources: {
          gold: current.resources.gold - TOWER_BLUEPRINT.gold,
          energy: current.resources.energy - TOWER_BLUEPRINT.energy,
        },
        towers: [
          ...current.towers,
          { id: `tower-${slot.x}-${slot.y}`, team: 'player', x: slot.x, y: slot.y, hp: 175, maxHp: 175, attackCooldown: 0 },
        ],
        message: 'Yeni savunma kulesi aktif edildi.',
      };
    });
  }, []);

  const toggleRun = () => setGame((current) => ({ ...current, running: !current.running && !current.winner, message: current.running ? 'Savaş duraklatıldı.' : 'Savaş başladı!' }));
  const restart = () => setGame(createInitialGame());

  const playerUnits = game.units.filter((unit) => unit.team === 'player').length;
  const enemyUnits = game.units.filter((unit) => unit.team === 'enemy').length;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Kaplan Strateji</p>
          <h1>Kare Tabanlı RTS Savaş Simülatörü</h1>
          <p className="subtitle">Altın ve enerji topla, birlik üret, kule kur ve yapay zekalı düşmanı üssüne varmadan durdur.</p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={toggleRun}>{game.running ? <span aria-hidden="true">⏸</span> : <span aria-hidden="true">▶</span>}{game.running ? 'Duraklat' : 'Başlat'}</button>
          <button onClick={restart}><span aria-hidden="true">↻</span>Yeniden Başlat</button>
        </div>
      </section>

      <section className="dashboard">
        <StatCard icon="🪙" label="Altın" value={game.resources.gold} accent="#f7c948" />
        <StatCard icon="⚡" label="Enerji" value={game.resources.energy} accent="#38bdf8" />
        <StatCard icon="⚔️" label="Kaplan Birliği" value={playerUnits} accent="#fb7185" />
        <StatCard icon="🤖" label="Düşman Birliği" value={enemyUnits} accent="#a78bfa" />
      </section>

      <section className="battle-layout">
        <aside className="control-panel">
          <h2><span aria-hidden="true">🏭</span> Üretim Merkezi</h2>
          {Object.entries(UNIT_BLUEPRINTS).map(([type, unit]) => (
            <button className="production-card" key={type} onClick={() => produce(type)}>
              <span className="unit-icon">{unit.icon}</span>
              <span><strong>{unit.label}</strong><small>{unit.gold} altın · {unit.energy} enerji · {unit.attack} saldırı</small></span>
            </button>
          ))}
          <div className="tower-box">
            <h3><span aria-hidden="true">🛡️</span> Savunma Kuleleri</h3>
            <p>Haritadaki mavi inşa noktalarına tıklayarak kule kur.</p>
            <small>Maliyet: {TOWER_BLUEPRINT.gold} altın · {TOWER_BLUEPRINT.energy} enerji</small>
          </div>
          <div className={`status ${game.winner ? 'winner' : ''}`}>{game.message}</div>
        </aside>

        <div className="map-wrap">
          <div className="map-grid">
            {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, index) => {
              const x = index % MAP_SIZE;
              const y = Math.floor(index / MAP_SIZE);
              const entity = entitiesByCell.get(`${x}-${y}`);
              const terrain = terrainFor(x, y);
              const buildSlot = TOWER_SLOTS.find((slot) => slot.x === x && slot.y === y);
              const explosion = game.explosions.find((boom) => boom.x === x && boom.y === y);
              return (
                <button
                  key={`${x}-${y}`}
                  className={`tile ${terrain} ${entity ? entity.team : ''} ${buildSlot ? 'build-slot' : ''}`}
                  onClick={() => buildSlot && buildTower(buildSlot)}
                  aria-label={`Kare ${x}, ${y}`}
                >
                  {buildSlot && !entity && <span className="slot-dot">+</span>}
                  {entity && (
                    <span className={`entity ${entity.kind}`}>
                      <span>{entity.kind === 'base' ? entity.icon : entity.kind === 'tower' ? TOWER_BLUEPRINT.icon : UNIT_BLUEPRINTS[entity.type].icon}</span>
                      <HealthBar current={entity.hp} max={entity.maxHp} />
                    </span>
                  )}
                  {explosion && <span className="explosion">💥</span>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="intel-panel">
          <h2><span aria-hidden="true">📡</span> Mini Harita</h2>
          <div className="mini-map">
            {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, index) => {
              const x = index % MAP_SIZE;
              const y = Math.floor(index / MAP_SIZE);
              const entity = entitiesByCell.get(`${x}-${y}`);
              return <span key={`${x}-${y}`} className={entity ? `mini ${entity.team}` : `mini ${terrainFor(x, y)}`} />;
            })}
          </div>
          <div className="base-cards">
            {Object.entries(game.bases).map(([team, base]) => (
              <article key={team} className={`base-card ${team}`}>
                <strong>{base.icon} {base.label}</strong>
                <HealthBar current={base.hp} max={base.maxHp} />
                <small>{base.hp}/{base.maxHp} can</small>
              </article>
            ))}
          </div>
          <div className="legend">
            <span><i className="legend-player" /> Kaplan</span>
            <span><i className="legend-enemy" /> Düşman</span>
            <span><i className="legend-ore" /> Kaynak</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
