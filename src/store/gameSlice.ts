import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const DEFAULT_ARENA_WIDTH = 960
const DEFAULT_ARENA_HEIGHT = 540

const PLAYER_RADIUS = 18
const HOME_RADIUS = 26
const HAZARD_RADIUS = 20

const MAX_PLAYER_SPEED = 8
const PLAYER_CRUISE_SPEED = 7.2
const TURBO_WIND_SPEED = 4.8
const SECOND_ORB_THRESHOLD = 2.2
const THIRD_ORB_THRESHOLD = 3.5
const HOME_THRESHOLD = 5.2

const STEERING_RESPONSE = 0.34
const IDLE_DAMPING = 0.9
const MIN_DRIFT_SPEED = 1.15
const PLAYER_BOUNCE_DAMPING = 0.9
const LEVEL_SCORE_STEP = 180
const COMBO_WINDOW_MS = 3200

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
}

type Collectible = DynamicEntity & {
  id: 'spark' | 'comet'
  points: number
  threshold: number
}

type HomePortal = {
  x: number
  y: number
  radius: number
  visible: boolean
  cooldownMs: number
  points: number
  threshold: number
}

type Hazard = DynamicEntity & {
  active: boolean
}

export type GameState = {
  arenaWidth: number
  arenaHeight: number
  input: Vector
  lastDirection: Vector
  player: DynamicEntity
  spark: Collectible
  comet: Collectible
  home: HomePortal
  hazard: Hazard
  score: number
  highScore: number
  combo: number
  comboTimerMs: number
  level: number
  lives: number
  windMode: boolean
  isPaused: boolean
  isGameOver: boolean
  announcement: string
  announcementTimerMs: number
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

function createCollectible(
  id: Collectible['id'],
  points: number,
  threshold: number,
  radius: number,
  width: number,
  height: number,
): Collectible {
  const position = randomPosition(width, height, radius)

  return {
    id,
    x: position.x,
    y: position.y,
    vx: randomBetween(-5, 5),
    vy: randomBetween(-5, 5),
    radius,
    visible: false,
    cooldownMs: 0,
    points,
    threshold,
  }
}

function createHome(width: number, height: number): HomePortal {
  const position = randomPosition(width, height, HOME_RADIUS)

  return {
    x: position.x,
    y: position.y,
    radius: HOME_RADIUS,
    visible: false,
    cooldownMs: 0,
    points: 100,
    threshold: HOME_THRESHOLD,
  }
}

function createHazard(width: number, height: number): Hazard {
  const position = randomPosition(width, height, HAZARD_RADIUS)

  return {
    x: position.x,
    y: position.y,
    vx: randomBetween(-7, 7),
    vy: randomBetween(-7, 7),
    radius: HAZARD_RADIUS,
    visible: false,
    cooldownMs: 0,
    active: false,
  }
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

function createInitialState(): GameState {
  const centerX = DEFAULT_ARENA_WIDTH / 2
  const centerY = DEFAULT_ARENA_HEIGHT / 2

  return {
    arenaWidth: DEFAULT_ARENA_WIDTH,
    arenaHeight: DEFAULT_ARENA_HEIGHT,
    input: { x: 0, y: 0 },
    lastDirection: { x: 0, y: 0 },
    player: {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      visible: true,
      cooldownMs: 0,
    },
    spark: createCollectible('spark', 10, SECOND_ORB_THRESHOLD, 14, DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT),
    comet: createCollectible('comet', 20, THIRD_ORB_THRESHOLD, 16, DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT),
    home: createHome(DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT),
    hazard: createHazard(DEFAULT_ARENA_WIDTH, DEFAULT_ARENA_HEIGHT),
    score: 0,
    highScore: loadStoredHighScore(),
    combo: 1,
    comboTimerMs: 0,
    level: 1,
    lives: 3,
    windMode: false,
    isPaused: false,
    isGameOver: false,
    announcement: 'Hazır! Roketini yön tuşlarıyla hareket ettir.',
    announcementTimerMs: 2200,
  }
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

function refreshHighScore(state: GameState) {
  if (state.score > state.highScore) {
    state.highScore = state.score
  }
}

function maybeLevelUp(state: GameState) {
  const nextLevel = Math.floor(state.score / LEVEL_SCORE_STEP) + 1

  if (nextLevel > state.level) {
    state.level = nextLevel
    state.announcement = `Seviye ${state.level}!`
    state.announcementTimerMs = 1400
  }
}

function collectPoints(state: GameState, points: number, text: string) {
  const safePoints = Math.max(0, Math.round(points))

  state.score += safePoints
  refreshHighScore(state)
  maybeLevelUp(state)

  state.combo = Math.min(9, state.combo + 1)
  state.comboTimerMs = COMBO_WINDOW_MS

    state.announcement = `${text} +${safePoints}`
  state.announcementTimerMs = 1000
}

function moveCollectible(state: GameState, collectible: Collectible, deltaMs: number, frameScale: number, playerSpeed: number) {
  collectible.visible = playerSpeed >= collectible.threshold

  if (!collectible.visible) {
    collectible.cooldownMs = Math.max(0, collectible.cooldownMs - deltaMs)
    return
  }

  const levelBoost = 1 + (state.level - 1) * 0.08

  bounceInsideArena(collectible, state.arenaWidth, state.arenaHeight, frameScale * levelBoost)

  if (collectible.cooldownMs > 0) {
    collectible.cooldownMs = Math.max(0, collectible.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + collectible.radius

  if (getDistance(state.player, collectible) <= hitDistance) {
    const points = collectible.points * state.combo
    collectPoints(state, points, collectible.id === 'spark' ? 'Gezegen yakalandı!' : 'Mavi gezegen yakalandı!')

    const nextPosition = randomPosition(state.arenaWidth, state.arenaHeight, collectible.radius)
    collectible.x = nextPosition.x
    collectible.y = nextPosition.y
    collectible.cooldownMs = 500
  }
}

function moveHome(state: GameState, deltaMs: number, playerSpeed: number) {
  state.home.visible = playerSpeed >= state.home.threshold

  if (!state.home.visible) {
    state.home.cooldownMs = Math.max(0, state.home.cooldownMs - deltaMs)
    return
  }

  if (state.home.cooldownMs > 0) {
    state.home.cooldownMs = Math.max(0, state.home.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + state.home.radius

  if (getDistance(state.player, state.home) <= hitDistance) {
    const points = state.home.points * state.combo
    collectPoints(state, points, 'Uzay istasyonu bonusu!')

    const nextPosition = randomPosition(state.arenaWidth, state.arenaHeight, state.home.radius)
    state.home.x = nextPosition.x
    state.home.y = nextPosition.y
    state.home.cooldownMs = 1000
  }
}

function moveHazard(state: GameState, deltaMs: number, frameScale: number) {
  state.hazard.active = state.level >= 2
  state.hazard.visible = state.hazard.active

  if (!state.hazard.active) {
    return
  }

  const levelBoost = 1.1 + (state.level - 1) * 0.1

  bounceInsideArena(state.hazard, state.arenaWidth, state.arenaHeight, frameScale * levelBoost)

  if (state.hazard.cooldownMs > 0) {
    state.hazard.cooldownMs = Math.max(0, state.hazard.cooldownMs - deltaMs)
    return
  }

  const hitDistance = state.player.radius + state.hazard.radius

  if (getDistance(state.player, state.hazard) <= hitDistance) {
    state.lives -= 1
    state.combo = 1
    state.comboTimerMs = 0

    state.announcement = 'Dikkat! Kızıl gezegene çarptın.'
    state.announcementTimerMs = 1200

    const position = randomPosition(state.arenaWidth, state.arenaHeight, state.hazard.radius)
    state.hazard.x = position.x
    state.hazard.y = position.y
    state.hazard.cooldownMs = 1200

    if (state.lives <= 0) {
      state.isGameOver = true
      state.isPaused = true
      state.input = { x: 0, y: 0 }
      state.player.vx = 0
      state.player.vy = 0
      state.announcement = 'Görev bitti! Yeniden başla.'
      state.announcementTimerMs = 2500
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
    },
    setInput: (state, action: PayloadAction<Vector>) => {
      state.input = action.payload
    },
    nudgePlayer: (state, action: PayloadAction<Vector>) => {
      if (state.isGameOver || state.isPaused) {
        return
      }

      state.player.vx += action.payload.x * 1.1
      state.player.vy += action.payload.y * 1.1

      const tapSpeed = Math.hypot(state.player.vx, state.player.vy)

      if (tapSpeed > MAX_PLAYER_SPEED && tapSpeed > 0) {
        const ratio = MAX_PLAYER_SPEED / tapSpeed
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

      state.announcement = 'Roket merkeze alındı.'
      state.announcementTimerMs = 1000
    },
    togglePause: (state) => {
      if (state.isGameOver) {
        return
      }

      state.isPaused = !state.isPaused
      state.announcement = state.isPaused ? 'Duraklatıldı' : 'Devam!'
      state.announcementTimerMs = 700
    },
    restartGame: (state) => {
      const highScore = state.highScore
      const width = state.arenaWidth
      const height = state.arenaHeight
      const freshState = createInitialState()

      Object.assign(state, freshState)

      state.highScore = Math.max(highScore, freshState.highScore)
      state.arenaWidth = width
      state.arenaHeight = height

      state.player.x = width / 2
      state.player.y = height / 2

      state.spark = createCollectible('spark', 10, SECOND_ORB_THRESHOLD, 14, width, height)
      state.comet = createCollectible('comet', 20, THIRD_ORB_THRESHOLD, 16, width, height)
      state.home = createHome(width, height)
      state.hazard = createHazard(width, height)

      state.announcement = 'Yeni oyun başladı!'
      state.announcementTimerMs = 1500
    },
    tick: (state, action: PayloadAction<{ deltaMs: number }>) => {
      if (state.isPaused || state.isGameOver) {
        return
      }

      const deltaMs = Math.min(48, Math.max(8, action.payload.deltaMs))
      const frameScale = deltaMs / 16.6667

      const inputMagnitude = Math.hypot(state.input.x, state.input.y)
      const normalizedX = inputMagnitude > 0 ? state.input.x / inputMagnitude : 0
      const normalizedY = inputMagnitude > 0 ? state.input.y / inputMagnitude : 0

      if (inputMagnitude > 0) {
        state.lastDirection.x = normalizedX
        state.lastDirection.y = normalizedY
      }

      const targetVx = normalizedX * PLAYER_CRUISE_SPEED
      const targetVy = normalizedY * PLAYER_CRUISE_SPEED
      const steeringBlend = Math.min(1, STEERING_RESPONSE * frameScale)

      state.player.vx += (targetVx - state.player.vx) * steeringBlend
      state.player.vy += (targetVy - state.player.vy) * steeringBlend

      if (inputMagnitude === 0) {
        const idleDamping = Math.pow(IDLE_DAMPING, frameScale)
        state.player.vx *= idleDamping
        state.player.vy *= idleDamping

        const driftSpeed = Math.hypot(state.player.vx, state.player.vy)
        const hasLastDirection =
          Math.abs(state.lastDirection.x) > 0 || Math.abs(state.lastDirection.y) > 0

        if (hasLastDirection && driftSpeed > 0 && driftSpeed < MIN_DRIFT_SPEED) {
          state.player.vx = state.lastDirection.x * MIN_DRIFT_SPEED
          state.player.vy = state.lastDirection.y * MIN_DRIFT_SPEED
        }
      }

      const currentSpeed = Math.hypot(state.player.vx, state.player.vy)

      if (currentSpeed > MAX_PLAYER_SPEED && currentSpeed > 0) {
        const ratio = MAX_PLAYER_SPEED / currentSpeed
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
        PLAYER_BOUNCE_DAMPING,
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
      state.windMode = speed >= TURBO_WIND_SPEED

      moveCollectible(state, state.spark, deltaMs, frameScale, speed)
      moveCollectible(state, state.comet, deltaMs, frameScale, speed)
      moveHome(state, deltaMs, speed)
      moveHazard(state, deltaMs, frameScale)

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
    },
  },
})

export const {
  setArenaSize,
  setInput,
  nudgePlayer,
  stopPlayer,
  resetPlayerPosition,
  togglePause,
  restartGame,
  tick,
} = gameSlice.actions

export default gameSlice.reducer
