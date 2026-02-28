import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const DEFAULT_ARENA_WIDTH = 960
const DEFAULT_ARENA_HEIGHT = 540

const PLAYER_RADIUS = 18
const HOME_RADIUS = 34
const HAZARD_RADIUS = 21

const COMBO_WINDOW_MS = 3200
const SHIELD_INVULNERABILITY_MS = 1800
const HIT_INVULNERABILITY_MS = 1300
const MAX_SOUND_VOLUME = 0.6
const DEFAULT_SESSION_REMINDER_MS = 20 * 60 * 1000

export type Difficulty = 'easy' | 'normal' | 'hard'
export type ControlSide = 'left' | 'right'
export type RocketSkin = 'classic' | 'neon' | 'comet' | 'solar'
export type MissionKind = 'earth' | 'mars' | 'sun' | 'survive'

export type Vector = {
  x: number
  y: number
}

type DynamicEntity = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  visible: boolean
  cooldownMs: number
  impactMs: number
}

type Collectible = DynamicEntity & {
  id: 'earth' | 'mars'
  points: number
  threshold: number
}

type HomePortal = {
  x: number
  y: number
  radius: number
  visible: boolean
  cooldownMs: number
  impactMs: number
  points: number
  threshold: number
}

type Hazard = DynamicEntity & {
  active: boolean
}

type ExtraPlanetId = 'mercury' | 'venus' | 'saturn' | 'uranus' | 'neptune'

type ExtraPlanet = DynamicEntity & {
  id: ExtraPlanetId
  points: number
  speedFactor: number
}

type ParentSettings = {
  soundVolume: number
  vibrationEnabled: boolean
  sessionReminderEnabled: boolean
  sessionReminderMs: number
}

type MissionState = {
  id: string
  label: string
  kind: MissionKind
  target: number
  progress: number
  rewardPoints: number
  timeLimitMs: number
  timeLeftMs: number
}

type PlanetCatchStats = {
  mercury: number
  venus: number
  earth: number
  mars: number
  jupiter: number
  saturn: number
  uranus: number
  neptune: number
  sun: number
}

type EventSignal = {
  collect: number
  hit: number
  mission: number
  badge: number
  level: number
  unlock: number
  shield: number
}

type DifficultyConfig = {
  maxSpeed: number
  cruiseSpeed: number
  windThreshold: number
  steeringResponse: number
  idleDamping: number
  minDriftSpeed: number
  playerBounceDamping: number
  secondThreshold: number
  thirdThreshold: number
  sunThreshold: number
  earthPoints: number
  marsPoints: number
  sunPoints: number
  baseLives: number
  baseShieldCharges: number
  hazardUnlockLevel: number
  hazardSpeedMultiplier: number
  planetSpawnSpeed: number
  hazardSpawnSpeed: number
  planetMaxSpeed: number
  hazardMaxSpeed: number
  planetLevelBoostPerLevel: number
  hazardLevelBoostPerLevel: number
  impactImpulseScale: number
  solarInfluence: number
  levelScoreStep: number
  missionTargetScale: number
  missionRewardScale: number
}

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    maxSpeed: 7,
    cruiseSpeed: 6.2,
    windThreshold: 4,
    steeringResponse: 0.38,
    idleDamping: 0.92,
    minDriftSpeed: 1,
    playerBounceDamping: 0.94,
    secondThreshold: 0,
    thirdThreshold: 0,
    sunThreshold: 0,
    earthPoints: 14,
    marsPoints: 22,
    sunPoints: 110,
    baseLives: 5,
    baseShieldCharges: 3,
    hazardUnlockLevel: 3,
    hazardSpeedMultiplier: 0.88,
    planetSpawnSpeed: 1.35,
    hazardSpawnSpeed: 1.7,
    planetMaxSpeed: 2.25,
    hazardMaxSpeed: 2.8,
    planetLevelBoostPerLevel: 0.018,
    hazardLevelBoostPerLevel: 0.03,
    impactImpulseScale: 0.55,
    solarInfluence: 0.5,
    levelScoreStep: 230,
    missionTargetScale: 0.85,
    missionRewardScale: 1,
  },
  normal: {
    maxSpeed: 8,
    cruiseSpeed: 7.2,
    windThreshold: 4.8,
    steeringResponse: 0.34,
    idleDamping: 0.9,
    minDriftSpeed: 1.15,
    playerBounceDamping: 0.9,
    secondThreshold: 0,
    thirdThreshold: 0,
    sunThreshold: 0,
    earthPoints: 16,
    marsPoints: 24,
    sunPoints: 120,
    baseLives: 4,
    baseShieldCharges: 2,
    hazardUnlockLevel: 2,
    hazardSpeedMultiplier: 1,
    planetSpawnSpeed: 1.65,
    hazardSpawnSpeed: 2.1,
    planetMaxSpeed: 2.8,
    hazardMaxSpeed: 3.4,
    planetLevelBoostPerLevel: 0.022,
    hazardLevelBoostPerLevel: 0.036,
    impactImpulseScale: 0.64,
    solarInfluence: 0.62,
    levelScoreStep: 200,
    missionTargetScale: 1,
    missionRewardScale: 1.12,
  },
  hard: {
    maxSpeed: 9.3,
    cruiseSpeed: 8.1,
    windThreshold: 5.6,
    steeringResponse: 0.31,
    idleDamping: 0.88,
    minDriftSpeed: 1.2,
    playerBounceDamping: 0.86,
    secondThreshold: 0,
    thirdThreshold: 0,
    sunThreshold: 0,
    earthPoints: 18,
    marsPoints: 30,
    sunPoints: 145,
    baseLives: 3,
    baseShieldCharges: 1,
    hazardUnlockLevel: 1,
    hazardSpeedMultiplier: 1.2,
    planetSpawnSpeed: 2.1,
    hazardSpawnSpeed: 2.7,
    planetMaxSpeed: 3.5,
    hazardMaxSpeed: 4.2,
    planetLevelBoostPerLevel: 0.028,
    hazardLevelBoostPerLevel: 0.045,
    impactImpulseScale: 0.74,
    solarInfluence: 0.8,
    levelScoreStep: 170,
    missionTargetScale: 1.2,
    missionRewardScale: 1.28,
  },
}

const PLANET_FACTS: Record<'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'sun', string> = {
  mercury: 'Merkur, Gunes Sistemindeki en kucuk ve Gunes\'e en yakin gezegendir.',
  venus: 'Venus en sicak gezegendir; kalin atmosferi isi hapseder.',
  earth: 'Dunya, yuzeyinde sivisi halde su bulunan tek bilinen gezegendir.',
  mars: 'Mars kizil gorunur; sebebi yuzeyindeki demir oksittir.',
  jupiter: 'Jupiter en buyuk gezegendir ve Buyuk Kirmizi Leke dev bir firtinadir.',
  saturn: 'Saturn, buz ve toz parcaciklarindan olusan belirgin halkalara sahiptir.',
  uranus: 'Uranus neredeyse yana yatmis ekseniyle diger gezegenlerden ayrilir.',
  neptune: 'Neptune cok uzak ve cok ruzgarli bir buz dev gezegendir.',
  sun: 'Gunes, Gunes Sistemi kutlesinin neredeyse tamamina sahiptir.',
}

const EXTRA_PLANET_BLUEPRINTS: Array<{
  id: ExtraPlanetId
  radius: number
  points: number
  speedFactor: number
}> = [
  { id: 'mercury', radius: 9, points: 10, speedFactor: 1.35 },
  { id: 'venus', radius: 14, points: 14, speedFactor: 0.82 },
  { id: 'saturn', radius: 18, points: 24, speedFactor: 0.96 },
  { id: 'uranus', radius: 15, points: 18, speedFactor: 0.88 },
  { id: 'neptune', radius: 16, points: 22, speedFactor: 1.08 },
]

const MISSION_TEMPLATES: Array<{
  kind: MissionKind
  label: string
  baseTarget: number
  baseReward: number
  timeMs: number
}> = [
  {
    kind: 'earth',
    label: '2 Dunya yakala',
    baseTarget: 2,
    baseReward: 50,
    timeMs: 34000,
  },
  {
    kind: 'mars',
    label: '2 Mars yakala',
    baseTarget: 2,
    baseReward: 75,
    timeMs: 36000,
  },
  {
    kind: 'sun',
    label: '1 Gunes bonusu al',
    baseTarget: 1,
    baseReward: 95,
    timeMs: 35000,
  },
  {
    kind: 'survive',
    label: '22 saniye hayatta kal',
    baseTarget: 22,
    baseReward: 70,
    timeMs: 30000,
  },
]

export type GameState = {
  arenaWidth: number
  arenaHeight: number
  difficulty: Difficulty
  controlSide: ControlSide
  input: Vector
  lastDirection: Vector
  player: DynamicEntity
  spark: Collectible
  comet: Collectible
  home: HomePortal
  hazard: Hazard
  extraPlanets: ExtraPlanet[]
  score: number
  highScore: number
  combo: number
  comboTimerMs: number
  level: number
  lives: number
  shieldCharges: number
  invulnerabilityMs: number
  secondChanceUsed: boolean
  windMode: boolean
  isPaused: boolean
  isGameOver: boolean
  announcement: string
  announcementTimerMs: number
  planetChainMs: number
  missionsCompleted: number
  missionSeed: number
  currentMission: MissionState
  planetCatches: PlanetCatchStats
  learningFact: string
  learningFactTimerMs: number
  unlockedSkins: RocketSkin[]
  selectedSkin: RocketSkin
  badges: string[]
  settings: ParentSettings
  sessionElapsedMs: number
  showBreakReminder: boolean
  eventSignal: EventSignal
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function randomPosition(width: number, height: number, radius: number) {
  return {
    x: randomBetween(radius, Math.max(radius, width - radius)),
    y: randomBetween(radius, Math.max(radius, height - radius)),
  }
}

function clampPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function getDifficultyConfig(difficulty: Difficulty) {
  return DIFFICULTY_CONFIGS[difficulty]
}

function loadStoredHighScore() {
  if (typeof window === 'undefined') {
    return 0
  }

  const rawValue = window.localStorage.getItem('space-action-high-score')
  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.floor(parsed))
}

function createCollectible(
  id: Collectible['id'],
  points: number,
  threshold: number,
  radius: number,
  width: number,
  height: number,
  spawnSpeed: number,
): Collectible {
  const position = randomPosition(width, height, radius)

  return {
    id,
    x: position.x,
    y: position.y,
    vx: randomBetween(-spawnSpeed, spawnSpeed),
    vy: randomBetween(-spawnSpeed, spawnSpeed),
    radius,
    visible: false,
    cooldownMs: 0,
    impactMs: 0,
    points,
    threshold,
  }
}

function createHome(points: number, threshold: number, width: number, height: number): HomePortal {
  const position = randomPosition(width, height, HOME_RADIUS)

  return {
    x: position.x,
    y: position.y,
    radius: HOME_RADIUS,
    visible: false,
    cooldownMs: 0,
    impactMs: 0,
    points,
    threshold,
  }
}

function createHazard(width: number, height: number, spawnSpeed: number): Hazard {
  const position = randomPosition(width, height, HAZARD_RADIUS)

  return {
    x: position.x,
    y: position.y,
    vx: randomBetween(-spawnSpeed, spawnSpeed),
    vy: randomBetween(-spawnSpeed, spawnSpeed),
    radius: HAZARD_RADIUS,
    visible: false,
    cooldownMs: 0,
    impactMs: 0,
    active: false,
  }
}

function createExtraPlanets(
  width: number,
  height: number,
  baseSpawnSpeed: number,
): ExtraPlanet[] {
  return EXTRA_PLANET_BLUEPRINTS.map((planet) => {
    const position = randomPosition(width, height, planet.radius)
    const speed = baseSpawnSpeed * planet.speedFactor

    return {
      id: planet.id,
      x: position.x,
      y: position.y,
      vx: randomBetween(-speed, speed),
      vy: randomBetween(-speed, speed),
      radius: planet.radius,
      visible: true,
      cooldownMs: 0,
      impactMs: 0,
      points: planet.points,
      speedFactor: planet.speedFactor,
    }
  })
}

function createMission(seed: number, difficulty: Difficulty): MissionState {
  const template = MISSION_TEMPLATES[seed % MISSION_TEMPLATES.length]
  const config = getDifficultyConfig(difficulty)

  const target = Math.max(1, Math.round(template.baseTarget * config.missionTargetScale))
  const rewardPoints = Math.max(25, Math.round(template.baseReward * config.missionRewardScale))

  return {
    id: `mission-${seed}`,
    kind: template.kind,
    label: template.label,
    target,
    progress: 0,
    rewardPoints,
    timeLimitMs: template.timeMs,
    timeLeftMs: template.timeMs,
  }
}

function emptyEventSignal(): EventSignal {
  return {
    collect: 0,
    hit: 0,
    mission: 0,
    badge: 0,
    level: 0,
    unlock: 0,
    shield: 0,
  }
}

function createInitialState(): GameState {
  const difficulty: Difficulty = 'normal'
  const config = getDifficultyConfig(difficulty)

  const baseState: GameState = {
    arenaWidth: DEFAULT_ARENA_WIDTH,
    arenaHeight: DEFAULT_ARENA_HEIGHT,
    difficulty,
    controlSide: 'left',
    input: { x: 0, y: 0 },
    lastDirection: { x: 0, y: 0 },
    player: {
      x: DEFAULT_ARENA_WIDTH / 2,
      y: DEFAULT_ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      visible: true,
      cooldownMs: 0,
      impactMs: 0,
    },
    spark: createCollectible(
      'earth',
      config.earthPoints,
      config.secondThreshold,
      16,
      DEFAULT_ARENA_WIDTH,
      DEFAULT_ARENA_HEIGHT,
      config.planetSpawnSpeed,
    ),
    comet: createCollectible(
      'mars',
      config.marsPoints,
      config.thirdThreshold,
      13,
      DEFAULT_ARENA_WIDTH,
      DEFAULT_ARENA_HEIGHT,
      config.planetSpawnSpeed,
    ),
    home: createHome(config.sunPoints, config.sunThreshold, DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT),
    hazard: createHazard(DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT, config.hazardSpawnSpeed),
    extraPlanets: createExtraPlanets(
      DEFAULT_ARENA_WIDTH,
      DEFAULT_ARENA_HEIGHT,
      config.planetSpawnSpeed,
    ),
    score: 0,
    highScore: loadStoredHighScore(),
    combo: 1,
    comboTimerMs: 0,
    level: 1,
    lives: config.baseLives,
    shieldCharges: config.baseShieldCharges,
    invulnerabilityMs: 0,
    secondChanceUsed: false,
    windMode: false,
    isPaused: false,
    isGameOver: false,
    announcement: 'Hazir! Roketini yon tuslariyla hareket ettir.',
    announcementTimerMs: 2200,
    planetChainMs: 0,
    missionsCompleted: 0,
    missionSeed: 0,
    currentMission: createMission(0, difficulty),
    planetCatches: {
      mercury: 0,
      venus: 0,
      earth: 0,
      mars: 0,
      jupiter: 0,
      saturn: 0,
      uranus: 0,
      neptune: 0,
      sun: 0,
    },
    learningFact: '',
    learningFactTimerMs: 0,
    unlockedSkins: ['classic'],
    selectedSkin: 'classic',
    badges: [],
    settings: {
      soundVolume: 0.45,
      vibrationEnabled: true,
      sessionReminderEnabled: true,
      sessionReminderMs: DEFAULT_SESSION_REMINDER_MS,
    },
    sessionElapsedMs: 0,
    showBreakReminder: false,
    eventSignal: emptyEventSignal(),
  }

  return baseState
}

function setAnnouncement(state: GameState, text: string, timerMs = 1000) {
  state.announcement = text
  state.announcementTimerMs = timerMs
}

function refreshHighScore(state: GameState) {
  if (state.score > state.highScore) {
    state.highScore = state.score
  }
}

function incrementEvent(state: GameState, key: keyof EventSignal) {
  state.eventSignal[key] += 1
}

function unlockSkin(state: GameState, skin: RocketSkin, message: string) {
  if (state.unlockedSkins.includes(skin)) {
    return
  }

  state.unlockedSkins.push(skin)
  incrementEvent(state, 'unlock')
  setAnnouncement(state, message, 1700)
}

function grantBadge(state: GameState, badgeId: string, message: string) {
  if (state.badges.includes(badgeId)) {
    return
  }

  state.badges.push(badgeId)
  incrementEvent(state, 'badge')
  setAnnouncement(state, message, 1700)
}

function setLearningFact(
  state: GameState,
  key: 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'sun',
) {
  state.learningFact = PLANET_FACTS[key]
  state.learningFactTimerMs = 6200
}

function maybeLevelUp(state: GameState) {
  const config = getDifficultyConfig(state.difficulty)
  const nextLevel = Math.floor(state.score / config.levelScoreStep) + 1

  if (nextLevel > state.level) {
    state.level = nextLevel
    state.shieldCharges = Math.min(5, state.shieldCharges + 1)
    incrementEvent(state, 'level')
    setAnnouncement(state, `Seviye ${state.level}!`, 1400)
  }
}

function checkUnlocksAndBadges(state: GameState) {
  if (state.score >= 160) {
    unlockSkin(state, 'neon', 'Yeni roket skini acildi: Neon!')
  }

  if (state.missionsCompleted >= 3) {
    unlockSkin(state, 'comet', 'Yeni roket skini acildi: Kuyruklu Yildiz!')
  }

  if (state.planetCatches.sun >= 5) {
    unlockSkin(state, 'solar', 'Yeni roket skini acildi: Solar Core!')
  }

  if (state.missionsCompleted >= 1) {
    grantBadge(state, 'mission-starter', 'Rozet acildi: Gorev Baslangici')
  }

  if (state.planetCatches.mars >= 6) {
    grantBadge(state, 'mars-collector', 'Rozet acildi: Mars Koleksiyoncusu')
  }

  if (state.score >= 500) {
    grantBadge(state, 'score-500', 'Rozet acildi: 500+ Puan')
  }

  const caughtAllPlanets =
    state.planetCatches.mercury > 0 &&
    state.planetCatches.venus > 0 &&
    state.planetCatches.earth > 0 &&
    state.planetCatches.mars > 0 &&
    state.planetCatches.jupiter > 0 &&
    state.planetCatches.saturn > 0 &&
    state.planetCatches.uranus > 0 &&
    state.planetCatches.neptune > 0

  if (caughtAllPlanets) {
    grantBadge(state, 'solar-explorer', 'Rozet acildi: Gunes Sistemi Kesifcisi')
  }

  if (state.sessionElapsedMs >= 3 * 60 * 1000) {
    grantBadge(state, 'space-marathon', 'Rozet acildi: Uzay Maratoncusu')
  }
}

function createNextMission(state: GameState) {
  state.missionSeed += 1
  state.currentMission = createMission(state.missionSeed, state.difficulty)
}

function completeMission(state: GameState) {
  const reward = state.currentMission.rewardPoints

  state.score += reward
  refreshHighScore(state)
  maybeLevelUp(state)

  state.missionsCompleted += 1
  state.shieldCharges = Math.min(5, state.shieldCharges + 1)
  state.lives = Math.min(getDifficultyConfig(state.difficulty).baseLives + 1, state.lives + 1)

  incrementEvent(state, 'mission')
  setAnnouncement(state, `Gorev tamamlandi! +${reward}`, 1600)

  checkUnlocksAndBadges(state)
  createNextMission(state)
}

function failMission(state: GameState) {
  setAnnouncement(state, 'Gorev suresi doldu. Yeni gorev geldi!', 1500)
  createNextMission(state)
}

function progressMission(state: GameState, kind: MissionKind, amount: number) {
  if (state.currentMission.kind !== kind) {
    return
  }

  state.currentMission.progress = Math.min(
    state.currentMission.target,
    state.currentMission.progress + amount,
  )

  if (state.currentMission.progress >= state.currentMission.target) {
    completeMission(state)
  }
}

function collectPoints(state: GameState, points: number, text: string) {
  const safePoints = Math.max(0, Math.round(points))

  state.score += safePoints
  refreshHighScore(state)
  maybeLevelUp(state)

  state.combo = Math.min(9, state.combo + 1)
  state.comboTimerMs = COMBO_WINDOW_MS

  incrementEvent(state, 'collect')
  setAnnouncement(state, `${text} +${safePoints}`, 1000)

  checkUnlocksAndBadges(state)
}

type PlanetImpactSource =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'sun'

function getMovingPlanets(state: GameState) {
  return [state.spark, state.comet, state.hazard, ...state.extraPlanets]
}

function getPlanetSourcePosition(state: GameState, source: PlanetImpactSource) {
  if (source === 'earth') {
    return { x: state.spark.x, y: state.spark.y }
  }

  if (source === 'mars') {
    return { x: state.comet.x, y: state.comet.y }
  }

  if (source === 'jupiter') {
    return { x: state.hazard.x, y: state.hazard.y }
  }

  if (source === 'sun') {
    return { x: state.home.x, y: state.home.y }
  }

  const planet = state.extraPlanets.find((item) => item.id === source)
  if (planet) {
    return { x: planet.x, y: planet.y }
  }

  return { x: state.player.x, y: state.player.y }
}

function triggerPlanetImpact(state: GameState, source: PlanetImpactSource) {
  const config = getDifficultyConfig(state.difficulty)
  const sourcePosition = getPlanetSourcePosition(state, source)
  const strongImpact = 420
  const lightImpact = 180

  state.spark.impactMs = source === 'earth' ? strongImpact : Math.max(state.spark.impactMs, lightImpact)
  state.comet.impactMs = source === 'mars' ? strongImpact : Math.max(state.comet.impactMs, lightImpact)
  state.home.impactMs = source === 'sun' ? strongImpact : Math.max(state.home.impactMs, lightImpact)
  state.hazard.impactMs = source === 'jupiter' ? strongImpact : Math.max(state.hazard.impactMs, lightImpact)
  for (const planet of state.extraPlanets) {
    planet.impactMs = planet.id === source ? strongImpact : Math.max(planet.impactMs, lightImpact)
  }
  state.planetChainMs = 220

  const movingBodies = getMovingPlanets(state)

  for (const entity of movingBodies) {
    const dx = entity.x - sourcePosition.x
    const dy = entity.y - sourcePosition.y
    const distance = Math.hypot(dx, dy)

    if (distance < 1) {
      continue
    }

    const nx = dx / distance
    const ny = dy / distance
    const impulse =
      Math.max(0.14, 2.1 / Math.max(1, distance / 45)) * config.impactImpulseScale

    entity.vx += nx * impulse
    entity.vy += ny * impulse
  }
}

function applySolarInfluence(state: GameState, frameScale: number) {
  const config = getDifficultyConfig(state.difficulty)
  const movingBodies = getMovingPlanets(state)

  for (const entity of movingBodies) {
    const dx = state.home.x - entity.x
    const dy = state.home.y - entity.y
    const distance = Math.hypot(dx, dy)

    if (distance < 1) {
      continue
    }

    const nx = dx / distance
    const ny = dy / distance
    const gravity =
      Math.min(0.18, 1600 / Math.max(1100, distance * distance)) *
      frameScale *
      config.solarInfluence

    entity.vx += nx * gravity
    entity.vy += ny * gravity
  }
}

function clampVelocity(entity: DynamicEntity, maxSpeed: number) {
  const speed = Math.hypot(entity.vx, entity.vy)

  if (speed <= maxSpeed || speed <= 0) {
    return
  }

  const ratio = maxSpeed / speed
  entity.vx *= ratio
  entity.vy *= ratio
}

function bounceInsideArena(
  entity: DynamicEntity,
  width: number,
  height: number,
  movementScale: number,
  bounceDamping = 1,
) {
  entity.x += entity.vx * movementScale
  entity.y += entity.vy * movementScale

  const minX = entity.radius
  const maxX = Math.max(entity.radius, width - entity.radius)
  const minY = entity.radius
  const maxY = Math.max(entity.radius, height - entity.radius)

  if (entity.x <= minX) {
    entity.x = minX
    entity.vx = Math.abs(entity.vx) * bounceDamping
  }

  if (entity.x >= maxX) {
    entity.x = maxX
    entity.vx = -Math.abs(entity.vx) * bounceDamping
  }

  if (entity.y <= minY) {
    entity.y = minY
    entity.vy = Math.abs(entity.vy) * bounceDamping
  }

  if (entity.y >= maxY) {
    entity.y = maxY
    entity.vy = -Math.abs(entity.vy) * bounceDamping
  }
}

function resolvePlanetPair(first: DynamicEntity, second: DynamicEntity) {
  if (!first.visible || !second.visible) {
    return
  }

  const dx = second.x - first.x
  const dy = second.y - first.y
  const distance = Math.hypot(dx, dy)
  const minDistance = first.radius + second.radius

  if (distance <= 0.001 || distance >= minDistance) {
    return
  }

  const nx = dx / distance
  const ny = dy / distance
  const overlap = minDistance - distance

  first.x -= nx * overlap * 0.5
  first.y -= ny * overlap * 0.5
  second.x += nx * overlap * 0.5
  second.y += ny * overlap * 0.5

  const firstNormalVelocity = first.vx * nx + first.vy * ny
  const secondNormalVelocity = second.vx * nx + second.vy * ny
  const relativeVelocity = secondNormalVelocity - firstNormalVelocity

  if (relativeVelocity <= 0) {
    const bounce = relativeVelocity * 0.9
    first.vx += nx * bounce
    first.vy += ny * bounce
    second.vx -= nx * bounce
    second.vy -= ny * bounce
  }

  first.impactMs = Math.max(first.impactMs, 170)
  second.impactMs = Math.max(second.impactMs, 170)
}

function resolvePlanetCollisions(state: GameState) {
  const planets = getMovingPlanets(state)

  for (let firstIndex = 0; firstIndex < planets.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < planets.length; secondIndex += 1) {
      resolvePlanetPair(planets[firstIndex], planets[secondIndex])
    }
  }
}

function setupRound(state: GameState, message: string) {
  const config = getDifficultyConfig(state.difficulty)
  const width = state.arenaWidth
  const height = state.arenaHeight

  state.input = { x: 0, y: 0 }
  state.lastDirection = { x: 0, y: 0 }

  state.player = {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    visible: true,
    cooldownMs: 0,
    impactMs: 0,
  }

  state.spark = createCollectible(
    'earth',
    config.earthPoints,
    config.secondThreshold,
    16,
    width,
    height,
    config.planetSpawnSpeed,
  )
  state.comet = createCollectible(
    'mars',
    config.marsPoints,
    config.thirdThreshold,
    13,
    width,
    height,
    config.planetSpawnSpeed,
  )
  state.home = createHome(config.sunPoints, config.sunThreshold, width, height)
  state.hazard = createHazard(width, height, config.hazardSpawnSpeed)
  state.extraPlanets = createExtraPlanets(width, height, config.planetSpawnSpeed)

  state.score = 0
  state.combo = 1
  state.comboTimerMs = 0
  state.level = 1
  state.lives = config.baseLives
  state.shieldCharges = config.baseShieldCharges
  state.invulnerabilityMs = 0
  state.secondChanceUsed = false
  state.windMode = false
  state.isPaused = false
  state.isGameOver = false
  state.planetChainMs = 0
  state.planetCatches = {
    mercury: 0,
    venus: 0,
    earth: 0,
    mars: 0,
    jupiter: 0,
    saturn: 0,
    uranus: 0,
    neptune: 0,
    sun: 0,
  }

  state.currentMission = createMission(state.missionSeed + 1, state.difficulty)
  state.missionSeed += 1

  state.learningFact = ''
  state.learningFactTimerMs = 0

  state.sessionElapsedMs = 0
  state.showBreakReminder = false

  state.eventSignal = emptyEventSignal()

  setAnnouncement(state, message, 1600)
}

function moveCollectible(
  state: GameState,
  collectible: Collectible,
  deltaMs: number,
  frameScale: number,
) {
  const config = getDifficultyConfig(state.difficulty)
  collectible.visible = true

  const levelBoost = 0.9 + (state.level - 1) * config.planetLevelBoostPerLevel

  clampVelocity(collectible, config.planetMaxSpeed)

  bounceInsideArena(collectible, state.arenaWidth, state.arenaHeight, frameScale * levelBoost)

  if (collectible.cooldownMs > 0) {
    collectible.cooldownMs = Math.max(0, collectible.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + collectible.radius

  if (getDistance(state.player, collectible) <= hitDistance) {
    const points = collectible.points * state.combo

    if (collectible.id === 'earth') {
      collectPoints(state, points, 'Dunya yakalandi!')
      state.planetCatches.earth += 1
      setLearningFact(state, 'earth')
      progressMission(state, 'earth', 1)
    } else {
      collectPoints(state, points, 'Mars yakalandi!')
      state.planetCatches.mars += 1
      setLearningFact(state, 'mars')
      progressMission(state, 'mars', 1)
    }

    triggerPlanetImpact(state, collectible.id)

    const nextPosition = randomPosition(state.arenaWidth, state.arenaHeight, collectible.radius)
    collectible.x = nextPosition.x
    collectible.y = nextPosition.y
    collectible.cooldownMs = 500
  }
}

function applyExtraPlanetEffect(state: GameState, planet: ExtraPlanet) {
  const movingBodies = getMovingPlanets(state)

  if (planet.id === 'mercury') {
    state.comboTimerMs = Math.max(state.comboTimerMs, COMBO_WINDOW_MS + 500)
    setAnnouncement(state, 'Merkur: mini hiz ivmesi!', 950)
    return
  }

  if (planet.id === 'venus') {
    state.shieldCharges = Math.min(5, state.shieldCharges + 1)
    setAnnouncement(state, 'Venus: kalkan +1', 1100)
    return
  }

  if (planet.id === 'saturn') {
    for (const body of movingBodies) {
      body.vx *= 0.84
      body.vy *= 0.84
    }
    setAnnouncement(state, 'Saturn halkalari: uzay akisina fren!', 1200)
    return
  }

  if (planet.id === 'uranus') {
    state.lives = Math.min(getDifficultyConfig(state.difficulty).baseLives + 2, state.lives + 1)
    setAnnouncement(state, 'Uranus: ekstra can +1', 1200)
    return
  }

  state.combo = Math.min(9, state.combo + 1)
  state.comboTimerMs = Math.max(state.comboTimerMs, COMBO_WINDOW_MS + 1000)
  for (const body of movingBodies) {
    body.vx *= 1.06
    body.vy *= 1.06
  }
  setAnnouncement(state, 'Neptune: combo uzatildi!', 1150)
}

function moveExtraPlanets(state: GameState, deltaMs: number, frameScale: number) {
  const config = getDifficultyConfig(state.difficulty)

  for (const planet of state.extraPlanets) {
    planet.visible = true

    const levelBoost = 0.88 + (state.level - 1) * config.planetLevelBoostPerLevel
    clampVelocity(planet, config.planetMaxSpeed * planet.speedFactor)
    bounceInsideArena(planet, state.arenaWidth, state.arenaHeight, frameScale * levelBoost)

    if (planet.cooldownMs > 0) {
      planet.cooldownMs = Math.max(0, planet.cooldownMs - deltaMs)
      continue
    }

    const hitDistance = state.player.radius + planet.radius
    if (getDistance(state.player, planet) > hitDistance) {
      continue
    }

    collectPoints(state, planet.points * state.combo, `${planet.id.toUpperCase()} yakalandi!`)
    setLearningFact(state, planet.id)
    state.planetCatches[planet.id] += 1
    applyExtraPlanetEffect(state, planet)
    triggerPlanetImpact(state, planet.id)

    const nextPosition = randomPosition(state.arenaWidth, state.arenaHeight, planet.radius)
    planet.x = nextPosition.x
    planet.y = nextPosition.y
    planet.cooldownMs = 650
  }
}

function moveHome(state: GameState, deltaMs: number) {
  state.home.visible = true

  if (state.home.cooldownMs > 0) {
    state.home.cooldownMs = Math.max(0, state.home.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + state.home.radius

  if (getDistance(state.player, state.home) <= hitDistance) {
    const points = state.home.points * state.combo
    collectPoints(state, points, 'Gunes bonusu!')
    state.planetCatches.sun += 1
    setLearningFact(state, 'sun')
    progressMission(state, 'sun', 1)

    triggerPlanetImpact(state, 'sun')

    const nextPosition = randomPosition(state.arenaWidth, state.arenaHeight, state.home.radius)
    state.home.x = nextPosition.x
    state.home.y = nextPosition.y
    state.home.cooldownMs = 1000
  }
}

function moveHazard(state: GameState, deltaMs: number, frameScale: number) {
  const config = getDifficultyConfig(state.difficulty)

  state.hazard.active = true
  state.hazard.visible = true

  const levelBoost =
    (0.9 + (state.level - 1) * config.hazardLevelBoostPerLevel) * config.hazardSpeedMultiplier

  clampVelocity(state.hazard, config.hazardMaxSpeed)

  bounceInsideArena(state.hazard, state.arenaWidth, state.arenaHeight, frameScale * levelBoost)

  if (state.hazard.cooldownMs > 0) {
    state.hazard.cooldownMs = Math.max(0, state.hazard.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + state.hazard.radius

  if (getDistance(state.player, state.hazard) <= hitDistance) {
    state.planetCatches.jupiter += 1
    triggerPlanetImpact(state, 'jupiter')

    if (state.invulnerabilityMs > 0) {
      state.hazard.cooldownMs = 500
      return
    }

    if (state.shieldCharges > 0) {
      state.shieldCharges -= 1
      state.invulnerabilityMs = SHIELD_INVULNERABILITY_MS
      incrementEvent(state, 'shield')
      setAnnouncement(state, 'Kalkan seni korudu!', 1100)
      setLearningFact(state, 'jupiter')

      const safePosition = randomPosition(state.arenaWidth, state.arenaHeight, state.hazard.radius)
      state.hazard.x = safePosition.x
      state.hazard.y = safePosition.y
      state.hazard.cooldownMs = 900
      return
    }

    state.lives -= 1
    state.combo = 1
    state.comboTimerMs = 0
    state.invulnerabilityMs = HIT_INVULNERABILITY_MS
    incrementEvent(state, 'hit')

    setAnnouncement(state, 'Dikkat! Jupiter firtinasina carptin.', 1200)
    setLearningFact(state, 'jupiter')

    const position = randomPosition(state.arenaWidth, state.arenaHeight, state.hazard.radius)
    state.hazard.x = position.x
    state.hazard.y = position.y
    state.hazard.cooldownMs = 1200

    if (state.lives <= 0) {
      if (!state.secondChanceUsed) {
        state.secondChanceUsed = true
        state.lives = 1
        state.shieldCharges = Math.max(state.shieldCharges, 1)
        state.invulnerabilityMs = 2600
        incrementEvent(state, 'shield')
        setAnnouncement(state, 'Son sans devrede! Devam et!', 1800)
      } else {
        state.isGameOver = true
        state.isPaused = true
        state.input = { x: 0, y: 0 }
        state.player.vx = 0
        state.player.vy = 0
        setAnnouncement(state, 'Gorev bitti! Yeniden basla.', 2500)
      }
    }
  }
}

const gameSlice = createSlice({
  name: 'game',
  initialState: createInitialState(),
  reducers: {
    setArenaSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
      const width = Math.floor(action.payload.width)
      const height = Math.floor(action.payload.height)

      if (width < 320 || height < 220) {
        return
      }

      state.arenaWidth = width
      state.arenaHeight = height

      state.player.x = clampPosition(state.player.x, state.player.radius, width - state.player.radius)
      state.player.y = clampPosition(state.player.y, state.player.radius, height - state.player.radius)

      state.spark.x = clampPosition(state.spark.x, state.spark.radius, width - state.spark.radius)
      state.spark.y = clampPosition(state.spark.y, state.spark.radius, height - state.spark.radius)

      state.comet.x = clampPosition(state.comet.x, state.comet.radius, width - state.comet.radius)
      state.comet.y = clampPosition(state.comet.y, state.comet.radius, height - state.comet.radius)

      state.home.x = clampPosition(state.home.x, state.home.radius, width - state.home.radius)
      state.home.y = clampPosition(state.home.y, state.home.radius, height - state.home.radius)

      state.hazard.x = clampPosition(state.hazard.x, state.hazard.radius, width - state.hazard.radius)
      state.hazard.y = clampPosition(state.hazard.y, state.hazard.radius, height - state.hazard.radius)

      for (const planet of state.extraPlanets) {
        planet.x = clampPosition(planet.x, planet.radius, width - planet.radius)
        planet.y = clampPosition(planet.y, planet.radius, height - planet.radius)
      }
    },
    setInput: (state, action: PayloadAction<Vector>) => {
      state.input = action.payload
    },
    setDifficulty: (state, action: PayloadAction<Difficulty>) => {
      if (state.difficulty === action.payload) {
        return
      }

      state.difficulty = action.payload
      setupRound(state, `Zorluk ayarlandi: ${action.payload.toUpperCase()}`)
    },
    setControlSide: (state, action: PayloadAction<ControlSide>) => {
      state.controlSide = action.payload
    },
    setSoundVolume: (state, action: PayloadAction<number>) => {
      const clamped = Math.max(0, Math.min(MAX_SOUND_VOLUME, action.payload))
      state.settings.soundVolume = clamped
    },
    setVibrationEnabled: (state, action: PayloadAction<boolean>) => {
      state.settings.vibrationEnabled = action.payload
    },
    setSessionReminderEnabled: (state, action: PayloadAction<boolean>) => {
      state.settings.sessionReminderEnabled = action.payload

      if (!action.payload) {
        state.showBreakReminder = false
      }
    },
    setSessionReminderMinutes: (state, action: PayloadAction<number>) => {
      const safeMinutes = Math.max(10, Math.min(45, Math.round(action.payload)))
      state.settings.sessionReminderMs = safeMinutes * 60 * 1000
    },
    dismissBreakReminder: (state) => {
      state.showBreakReminder = false
      state.sessionElapsedMs = 0

      if (!state.isGameOver) {
        state.isPaused = false
        setAnnouncement(state, 'Mola tamam! Devam ediyoruz.', 1200)
      }
    },
    selectRocketSkin: (state, action: PayloadAction<RocketSkin>) => {
      if (!state.unlockedSkins.includes(action.payload)) {
        return
      }

      state.selectedSkin = action.payload
    },
    nudgePlayer: (state, action: PayloadAction<Vector>) => {
      if (state.isGameOver || state.isPaused) {
        return
      }

      const config = getDifficultyConfig(state.difficulty)

      state.player.vx += action.payload.x * 1.1
      state.player.vy += action.payload.y * 1.1

      const tapSpeed = Math.hypot(state.player.vx, state.player.vy)

      if (tapSpeed > config.maxSpeed && tapSpeed > 0) {
        const ratio = config.maxSpeed / tapSpeed
        state.player.vx *= ratio
        state.player.vy *= ratio
      }
    },
    stopPlayer: (state) => {
      state.player.vx = 0
      state.player.vy = 0
      state.lastDirection = { x: 0, y: 0 }
    },
    resetPlayerPosition: (state) => {
      state.player.x = state.arenaWidth / 2
      state.player.y = state.arenaHeight / 2
      state.player.vx = 0
      state.player.vy = 0
      state.input = { x: 0, y: 0 }
      state.lastDirection = { x: 0, y: 0 }
      state.combo = 1
      state.comboTimerMs = 0

      setAnnouncement(state, 'Roket merkeze alindi.', 1000)
    },
    togglePause: (state) => {
      if (state.isGameOver || state.showBreakReminder) {
        return
      }

      state.isPaused = !state.isPaused
      setAnnouncement(state, state.isPaused ? 'Duraklatildi' : 'Devam!', 700)
    },
    restartGame: (state) => {
      setupRound(state, 'Yeni oyun basladi!')
    },
    tick: (state, action: PayloadAction<{ deltaMs: number }>) => {
      if (state.isPaused || state.isGameOver || state.showBreakReminder) {
        return
      }

      const config = getDifficultyConfig(state.difficulty)
      const deltaMs = Math.min(48, Math.max(8, action.payload.deltaMs))
      const frameScale = deltaMs / 16.6667

      const inputMagnitude = Math.hypot(state.input.x, state.input.y)
      const normalizedX = inputMagnitude > 0 ? state.input.x / inputMagnitude : 0
      const normalizedY = inputMagnitude > 0 ? state.input.y / inputMagnitude : 0

      if (inputMagnitude > 0) {
        state.lastDirection.x = normalizedX
        state.lastDirection.y = normalizedY
      }

      const targetVx = normalizedX * config.cruiseSpeed
      const targetVy = normalizedY * config.cruiseSpeed
      const steeringBlend = Math.min(1, config.steeringResponse * frameScale)

      state.player.vx += (targetVx - state.player.vx) * steeringBlend
      state.player.vy += (targetVy - state.player.vy) * steeringBlend

      if (inputMagnitude === 0) {
        const idleDamping = Math.pow(config.idleDamping, frameScale)
        state.player.vx *= idleDamping
        state.player.vy *= idleDamping

        const driftSpeed = Math.hypot(state.player.vx, state.player.vy)
        const hasLastDirection =
          Math.abs(state.lastDirection.x) > 0 || Math.abs(state.lastDirection.y) > 0

        if (hasLastDirection && driftSpeed > 0 && driftSpeed < config.minDriftSpeed) {
          state.player.vx = state.lastDirection.x * config.minDriftSpeed
          state.player.vy = state.lastDirection.y * config.minDriftSpeed
        }
      }

      const currentSpeed = Math.hypot(state.player.vx, state.player.vy)

      if (currentSpeed > config.maxSpeed && currentSpeed > 0) {
        const ratio = config.maxSpeed / currentSpeed
        state.player.vx *= ratio
        state.player.vy *= ratio
      }

      if (Math.abs(state.player.vx) < 0.05) {
        state.player.vx = 0
      }

      if (Math.abs(state.player.vy) < 0.05) {
        state.player.vy = 0
      }

      bounceInsideArena(
        state.player,
        state.arenaWidth,
        state.arenaHeight,
        frameScale,
        config.playerBounceDamping,
      )

      if (
        !Number.isFinite(state.player.x) ||
        !Number.isFinite(state.player.y) ||
        !Number.isFinite(state.player.vx) ||
        !Number.isFinite(state.player.vy)
      ) {
        state.player.x = state.arenaWidth / 2
        state.player.y = state.arenaHeight / 2
        state.player.vx = 0
        state.player.vy = 0
        state.input = { x: 0, y: 0 }
        state.lastDirection = { x: 0, y: 0 }
      }

      const speed = Math.hypot(state.player.vx, state.player.vy)
      state.windMode = speed >= config.windThreshold

      applySolarInfluence(state, frameScale)
      moveCollectible(state, state.spark, deltaMs, frameScale)
      moveCollectible(state, state.comet, deltaMs, frameScale)
      moveExtraPlanets(state, deltaMs, frameScale)
      moveHome(state, deltaMs)
      moveHazard(state, deltaMs, frameScale)
      resolvePlanetCollisions(state)

      state.spark.impactMs = Math.max(0, state.spark.impactMs - deltaMs)
      state.comet.impactMs = Math.max(0, state.comet.impactMs - deltaMs)
      state.home.impactMs = Math.max(0, state.home.impactMs - deltaMs)
      state.hazard.impactMs = Math.max(0, state.hazard.impactMs - deltaMs)
      for (const planet of state.extraPlanets) {
        planet.impactMs = Math.max(0, planet.impactMs - deltaMs)
      }
      state.player.impactMs = Math.max(0, state.player.impactMs - deltaMs)
      state.planetChainMs = Math.max(0, state.planetChainMs - deltaMs)

      if (state.invulnerabilityMs > 0) {
        state.invulnerabilityMs = Math.max(0, state.invulnerabilityMs - deltaMs)
      }

      if (state.currentMission.kind === 'survive') {
        progressMission(state, 'survive', deltaMs / 1000)
      }

      state.currentMission.timeLeftMs = Math.max(0, state.currentMission.timeLeftMs - deltaMs)

      if (
        state.currentMission.timeLeftMs === 0 &&
        state.currentMission.progress < state.currentMission.target
      ) {
        failMission(state)
      }

      if (state.comboTimerMs > 0) {
        state.comboTimerMs = Math.max(0, state.comboTimerMs - deltaMs)

        if (state.comboTimerMs === 0) {
          state.combo = 1
        }
      }

      if (state.announcementTimerMs > 0) {
        state.announcementTimerMs = Math.max(0, state.announcementTimerMs - deltaMs)

        if (state.announcementTimerMs === 0 && !state.isGameOver) {
          state.announcement = ''
        }
      }

      if (state.learningFactTimerMs > 0) {
        state.learningFactTimerMs = Math.max(0, state.learningFactTimerMs - deltaMs)

        if (state.learningFactTimerMs === 0) {
          state.learningFact = ''
        }
      }

      if (state.settings.sessionReminderEnabled) {
        state.sessionElapsedMs += deltaMs

        if (state.sessionElapsedMs >= state.settings.sessionReminderMs) {
          state.showBreakReminder = true
          state.isPaused = true
          setAnnouncement(state, 'Mola zamani! Su icip gozlerini dinlendirelim.', 1800)
        }
      }

      checkUnlocksAndBadges(state)
    },
  },
})

export const {
  setArenaSize,
  setInput,
  setDifficulty,
  setControlSide,
  setSoundVolume,
  setVibrationEnabled,
  setSessionReminderEnabled,
  setSessionReminderMinutes,
  dismissBreakReminder,
  selectRocketSkin,
  nudgePlayer,
  stopPlayer,
  resetPlayerPosition,
  togglePause,
  restartGame,
  tick,
} = gameSlice.actions

export default gameSlice.reducer
