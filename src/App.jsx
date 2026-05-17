import React, { useEffect, useMemo, useRef, useState } from 'react';

const h = React.createElement;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const TICK_MS = 550;
const PLAYER_BASE_ID = 'player-base';
const ENEMY_BASE_ID = 'enemy-base';

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

const createUnit = (team, type, x, y, level = 1) => {
  const stats = {
    soldier: { hp: 52 + level * 6, damage: 8 + level, range: 1, speed: 1, icon: '🪖', name: 'Asker' },
    tank: { hp: 125 + level * 12, damage: 18 + level * 2, range: 2, speed: 1, icon: '🛡️', name: 'Tank' },
  }[type];

  return {
    id: createId(`${team}-${type}`),
    team,
    type,
    x,
    y,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: stats.damage,
    range: stats.range,
    speed: stats.speed,
    icon: stats.icon,
    name: stats.name,
    cooldown: 0,
  };
};

const makeInitialState = () => ({
  status: 'ready',
  tick: 0,
  level: 1,
  gold: 360,
  energy: 90,
  message: 'Kaplan Strateji üssünü savunmaya hazır. Başlat düğmesine bas!',
  playerBase: { id: PLAYER_BASE_ID, x: 1, y: 5, hp: 520, maxHp: 520, icon: '🏰', team: 'player' },
  enemyBase: { id: ENEMY_BASE_ID, x: 14, y: 5, hp: 520, maxHp: 520, icon: '⛔', team: 'enemy' },
  units: [createUnit('player', 'soldier', 2, 5), createUnit('enemy', 'soldier', 13, 5)],
  towers: [
    { id: 'tower-a', x: 3, y: 3, hp: 160, maxHp: 160, damage: 14, range: 3, cooldown: 0, icon: '🗼' },
  ],
  resources: [
    { id: 'mine-1', x: 5, y: 2, amount: 185 },
    { id: 'mine-2', x: 6, y: 8, amount: 220 },
    { id: 'mine-3', x: 9, y: 4, amount: 260 },
    { id: 'mine-4', x: 10, y: 9, amount: 175 },
  ],
  explosions: [],
  nextEnemyWave: 8,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

function moveToward(entity, target) {
  const next = { ...entity };
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;

  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) next.x += Math.sign(dx);
  else if (dy !== 0) next.y += Math.sign(dy);
  else if (dx !== 0) next.x += Math.sign(dx);

  next.x = clamp(next.x, 0, MAP_WIDTH - 1);
  next.y = clamp(next.y, 0, MAP_HEIGHT - 1);
  return next;
}

function nearest(entity, targets) {
  if (!targets.length) return null;
  return [...targets].sort((a, b) => distance(entity, a) - distance(entity, b))[0];
}

function healthPercent(item) {
  return clamp((item.hp / item.maxHp) * 100, 0, 100);
}

function simulateTick(prev) {
  if (prev.status !== 'running') return prev;

  const state = {
    ...prev,
    tick: prev.tick + 1,
    gold: prev.gold + 6 + prev.level,
    energy: clamp(prev.energy + 2, 0, 150 + prev.level * 12),
    units: prev.units.map((unit) => ({ ...unit, cooldown: Math.max(0, unit.cooldown - 1) })),
    towers: prev.towers.map((tower) => ({ ...tower, cooldown: Math.max(0, tower.cooldown - 1) })),
    playerBase: { ...prev.playerBase },
    enemyBase: { ...prev.enemyBase },
    resources: prev.resources.map((resource) => ({ ...resource })),
    explosions: prev.explosions.map((boom) => ({ ...boom, life: boom.life - 1 })).filter((boom) => boom.life > 0),
  };

  state.resources.forEach((resource) => {
    const gatherers = state.units.filter((unit) => unit.team === 'player' && distance(unit, resource) <= 1);
    if (resource.amount > 0 && gatherers.length) {
      const mined = Math.min(resource.amount, gatherers.length * (7 + state.level));
      resource.amount -= mined;
      state.gold += mined;
      state.message = `Madenden ${mined} altın toplandı.`;
    }
  });

  const enemiesForPlayer = () => [...state.units.filter((u) => u.team === 'enemy'), state.enemyBase];
  const targetsForEnemy = () => [...state.units.filter((u) => u.team === 'player'), ...state.towers, state.playerBase];

  state.units = state.units.map((unit) => {
    const targets = unit.team === 'player' ? enemiesForPlayer() : targetsForEnemy();
    const target = nearest(unit, targets);
    if (!target || distance(unit, target) <= unit.range) return unit;
    return moveToward(unit, target);
  });

  const damageQueue = [];
  state.units.forEach((unit) => {
    const targets = unit.team === 'player' ? enemiesForPlayer() : targetsForEnemy();
    const target = nearest(unit, targets.filter((candidate) => distance(unit, candidate) <= unit.range));
    if (target && unit.cooldown === 0) {
      damageQueue.push({ targetId: target.id, damage: unit.damage, x: target.x, y: target.y });
      unit.cooldown = unit.type === 'tank' ? 2 : 1;
    }
  });

  state.towers.forEach((tower) => {
    const target = nearest(tower, state.units.filter((unit) => unit.team === 'enemy' && distance(tower, unit) <= tower.range));
    if (target && tower.cooldown === 0) {
      damageQueue.push({ targetId: target.id, damage: tower.damage + state.level * 2, x: target.x, y: target.y });
      tower.cooldown = 1;
      state.energy = Math.max(0, state.energy - 2);
    }
  });

  damageQueue.forEach((hit) => {
    const unit = state.units.find((candidate) => candidate.id === hit.targetId);
    const tower = state.towers.find((candidate) => candidate.id === hit.targetId);
    if (unit) unit.hp -= hit.damage;
    if (tower) tower.hp -= hit.damage;
    if (hit.targetId === PLAYER_BASE_ID) state.playerBase.hp -= hit.damage;
    if (hit.targetId === ENEMY_BASE_ID) state.enemyBase.hp -= hit.damage;
    state.explosions.push({ id: createId(`boom-${state.tick}`), x: hit.x, y: hit.y, life: 2 });
  });

  const defeatedEnemies = state.units.filter((unit) => unit.team === 'enemy' && unit.hp <= 0).length;
  state.gold += defeatedEnemies * 18;
  state.units = state.units.filter((unit) => unit.hp > 0);
  state.towers = state.towers.filter((tower) => tower.hp > 0);

  if (state.tick >= state.nextEnemyWave) {
    const waveSize = 1 + Math.floor(state.level / 2);
    for (let i = 0; i < waveSize; i += 1) {
      const type = state.level > 1 && i % 2 === 0 ? 'tank' : 'soldier';
      state.units.push(createUnit('enemy', type, 13 + (i % 2), 4 + i, state.level));
    }
    state.nextEnemyWave = state.tick + Math.max(5, 10 - state.level);
    state.message = `Düşman ${waveSize} birliklik yeni saldırı dalgası gönderdi!`;
  }

  const nextLevel = 1 + Math.floor(state.tick / 28) + Math.floor((520 - state.enemyBase.hp) / 170);
  if (nextLevel > state.level) {
    state.level = nextLevel;
    state.gold += 90;
    state.energy = clamp(state.energy + 35, 0, 150 + state.level * 12);
    state.message = `Seviye ${state.level}! Komuta merkezi güçlendi.`;
  }

  if (state.enemyBase.hp <= 0) {
    state.status = 'won';
    state.message = 'Zafer! Düşman üssü yok edildi.';
  } else if (state.playerBase.hp <= 0) {
    state.status = 'lost';
    state.message = 'Üs düştü. Yeniden Başlat ile karşı saldırıya hazırlan.';
  }

  return state;
}

function Entity({ item, className, compact = false }) {
  return h(
    'div',
    { className: `${className} entity ${compact ? 'compact' : ''}`, title: `${item.name || 'Yapı'} ${Math.ceil(item.hp)}/${item.maxHp}` },
    h('span', null, item.icon),
    'hp' in item ? h('div', { className: 'hpBar' }, h('i', { style: { width: `${healthPercent(item)}%` } })) : null,
  );
}

function Cell({ x, y, state }) {
  const playerBase = sameCell(state.playerBase, { x, y }) ? state.playerBase : null;
  const enemyBase = sameCell(state.enemyBase, { x, y }) ? state.enemyBase : null;
  const resource = state.resources.find((item) => item.x === x && item.y === y && item.amount > 0);
  const tower = state.towers.find((item) => item.x === x && item.y === y);
  const units = state.units.filter((item) => item.x === x && item.y === y);
  const explosion = state.explosions.find((item) => item.x === x && item.y === y);
  const occupant = playerBase || enemyBase || tower || resource;

  return h(
    'div',
    { className: `cell ${(x + y) % 2 ? 'cellAlt' : ''}` },
    resource ? h('span', { className: 'resource' }, '⛏️', h('small', null, resource.amount)) : null,
    tower ? h(Entity, { item: tower, className: 'tower' }) : null,
    playerBase ? h(Entity, { item: playerBase, className: 'base player' }) : null,
    enemyBase ? h(Entity, { item: enemyBase, className: 'base enemy' }) : null,
    units.map((unit) => h(Entity, { key: unit.id, item: unit, className: `unit ${unit.team}`, compact: units.length > 1 || Boolean(occupant) })),
    explosion ? h('div', { className: 'explosion' }, '💥') : null,
  );
}

function App() {
  const [game, setGame] = useState(makeInitialState);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setGame(simulateTick), TICK_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  const cells = useMemo(() => Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, index) => ({ x: index % MAP_WIDTH, y: Math.floor(index / MAP_WIDTH) })), []);
  const playerUnits = game.units.filter((unit) => unit.team === 'player');
  const enemyUnits = game.units.filter((unit) => unit.team === 'enemy');

  const start = () => setGame((prev) => ({ ...prev, status: 'running', message: 'Savaş başladı. Birlikler otomatik hedeflere ilerliyor.' }));
  const pause = () => setGame((prev) => ({ ...prev, status: prev.status === 'running' ? 'paused' : 'running', message: prev.status === 'running' ? 'Oyun duraklatıldı.' : 'Savaş devam ediyor.' }));
  const restart = () => setGame(makeInitialState());

  const spend = (goldCost, energyCost, action) => {
    setGame((prev) => {
      if (prev.status === 'won' || prev.status === 'lost') return prev;
      if (prev.gold < goldCost || prev.energy < energyCost) return { ...prev, message: 'Yeterli altın veya enerji yok.' };
      return action({ ...prev, gold: prev.gold - goldCost, energy: prev.energy - energyCost });
    });
  };

  const train = (type) => spend(type === 'tank' ? 150 : 60, type === 'tank' ? 28 : 10, (prev) => ({
    ...prev,
    units: [...prev.units, createUnit('player', type, 2, type === 'tank' ? 6 : 5, prev.level)],
    message: `${type === 'tank' ? 'Tank' : 'Asker'} üretildi.`,
  }));

  const buildTower = () => spend(125, 35, (prev) => {
    const spots = [{ x: 3, y: 8 }, { x: 4, y: 5 }, { x: 6, y: 4 }, { x: 7, y: 7 }];
    const spot = spots.find((candidate) => !prev.towers.some((tower) => sameCell(tower, candidate))) || { x: 2, y: 2 };
    return {
      ...prev,
      towers: [...prev.towers, { id: createId('tower'), ...spot, hp: 150, maxHp: 150, damage: 14 + prev.level, range: 3, cooldown: 0, icon: '🗼' }],
      message: 'Yeni savunma kulesi inşa edildi.',
    };
  });

  const statusText = game.status === 'ready' ? 'Hazır' : game.status === 'running' ? 'Çalışıyor' : game.status === 'paused' ? 'Duraklatıldı' : game.status === 'won' ? 'Zafer' : 'Yenilgi';

  return h(
    'main',
    { className: 'appShell' },
    h('section', { className: 'heroPanel' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Gerçek Zamanlı Strateji'),
        h('h1', null, 'Kaplan Strateji'),
        h('p', { className: 'subtitle' }, 'Kare haritada altın topla, enerji yönet, birlik üret ve düşman üssünü yık.'),
      ),
      h('div', { className: `statusBadge ${game.status}` }, statusText),
    ),
    h('section', { className: 'dashboard' },
      h('div', { className: 'stat' }, h('span', null, 'Altın'), h('strong', null, Math.floor(game.gold))),
      h('div', { className: 'stat' }, h('span', null, 'Enerji'), h('strong', null, Math.floor(game.energy))),
      h('div', { className: 'stat' }, h('span', null, 'Seviye'), h('strong', null, game.level)),
      h('div', { className: 'stat' }, h('span', null, 'Dalga'), h('strong', null, Math.max(0, game.nextEnemyWave - game.tick))),
    ),
    h('section', { className: 'layout' },
      h('aside', { className: 'controlPanel' },
        h('h2', null, 'Komuta'),
        h('div', { className: 'buttonGrid' },
          h('button', { onClick: start, disabled: game.status === 'running' }, 'Başlat'),
          h('button', { onClick: pause, disabled: game.status === 'ready' || game.status === 'won' || game.status === 'lost' }, game.status === 'paused' ? 'Sürdür' : 'Duraklat'),
          h('button', { onClick: restart }, 'Yeniden Başlat'),
        ),
        h('h2', null, 'Üretim'),
        h('button', { className: 'action', onClick: () => train('soldier') }, '🪖 Asker Üret ', h('small', null, '60 altın / 10 enerji')),
        h('button', { className: 'action', onClick: () => train('tank') }, '🛡️ Tank Üret ', h('small', null, '150 altın / 28 enerji')),
        h('button', { className: 'action', onClick: buildTower }, '🗼 Savunma Kulesi ', h('small', null, '125 altın / 35 enerji')),
        h('div', { className: 'intel' },
          h('h2', null, 'Durum'),
          h('p', null, game.message),
          h('ul', null,
            h('li', null, `Oyuncu birlikleri: ${playerUnits.length}`),
            h('li', null, `Düşman birlikleri: ${enemyUnits.length}`),
            h('li', null, `Kuleler: ${game.towers.length}`),
          ),
        ),
      ),
      h('section', { className: 'battlefieldWrap' },
        h('div', { className: 'baseBars' },
          h('label', null, 'Oyuncu Üssü ', h('span', null, `${Math.max(0, Math.ceil(game.playerBase.hp))}/${game.playerBase.maxHp}`), h('b', null, h('i', { style: { width: `${healthPercent(game.playerBase)}%` } }))),
          h('label', null, 'Düşman Üssü ', h('span', null, `${Math.max(0, Math.ceil(game.enemyBase.hp))}/${game.enemyBase.maxHp}`), h('b', null, h('i', { style: { width: `${healthPercent(game.enemyBase)}%` } }))),
        ),
        h('div', { className: 'battlefield', style: { gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)` } }, cells.map((cell) => h(Cell, { key: `${cell.x}-${cell.y}`, x: cell.x, y: cell.y, state: game }))),
      ),
      h('aside', { className: 'miniPanel' },
        h('h2', null, 'Mini Harita'),
        h('div', { className: 'minimap', style: { gridTemplateColumns: `repeat(${MAP_WIDTH}, 1fr)` } }, cells.map((cell) => {
          const hasPlayer = playerUnits.some((unit) => sameCell(unit, cell)) || sameCell(game.playerBase, cell);
          const hasEnemy = enemyUnits.some((unit) => sameCell(unit, cell)) || sameCell(game.enemyBase, cell);
          const hasTower = game.towers.some((tower) => sameCell(tower, cell));
          const hasResource = game.resources.some((resource) => sameCell(resource, cell) && resource.amount > 0);
          const className = hasPlayer ? 'miniPlayer' : hasEnemy ? 'miniEnemy' : hasTower ? 'miniTower' : hasResource ? 'miniResource' : '';
          return h('span', { key: `mini-${cell.x}-${cell.y}`, className });
        })),
        h('div', { className: 'legend' },
          h('span', null, h('i', { className: 'dot playerDot' }), ' Oyuncu'),
          h('span', null, h('i', { className: 'dot enemyDot' }), ' Düşman'),
          h('span', null, h('i', { className: 'dot goldDot' }), ' Maden'),
        ),
      ),
    ),
  );
}

export default App;
