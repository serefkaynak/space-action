import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  answerQuiz,
  dismissBreakReminder,
  nudgePlayer,
  resetPlayerPosition,
  restartGame,
  selectRocketSkin,
  setArenaSize,
  setControlSide,
  setDifficulty,
  setInput,
  setQuizEnabled,
  setSessionReminderEnabled,
  setSessionReminderMinutes,
  setSoundVolume,
  setVibrationEnabled,
  stopPlayer,
  tick,
  togglePause,
  skipQuiz,
  type Difficulty,
  type RocketSkin,
} from './store/gameSlice'
import { useAppDispatch, useAppSelector } from './store/hooks'

type ContextMenuState = {
  open: boolean
  x: number
  y: number
}

type ControlButtonProps = {
  label: string
  direction: { x: number; y: number }
  onPress: (direction: { x: number; y: number }) => void
}

type JoystickThumb = {
  x: number
  y: number
}

const JOYSTICK_MAX_OFFSET = 58
const JOYSTICK_DEADZONE = 0.14

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Kolay',
  normal: 'Normal',
  hard: 'Zor',
}

const SPEED_LIMIT_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 7,
  normal: 8,
  hard: 9.3,
}

const SKIN_LABELS: Record<RocketSkin, string> = {
  classic: 'Classic',
  neon: 'Neon',
  comet: 'Comet',
  solar: 'Solar Core',
}

const BADGE_LABELS: Record<string, string> = {
  'mission-starter': 'Gorev Baslangici',
  'mars-collector': 'Mars Koleksiyoncusu',
  'score-500': '500+ Puan',
  'solar-explorer': 'Gunes Sistemi Kesifcisi',
  'space-marathon': 'Uzay Maratoncusu',
}

const PLANET_GUIDE: Array<{ id: string; title: string; trait: string; size: number }> = [
  { id: 'mercury', title: 'Merkur', trait: 'Cok hizli, kucuk hedef.', size: 14 },
  { id: 'venus', title: 'Venus', trait: 'Kalkan destegi verir.', size: 18 },
  { id: 'earth', title: 'Dunya', trait: 'Dengeli puan.', size: 18 },
  { id: 'mars', title: 'Mars', trait: 'Kizil gezegen, ekstra puan.', size: 16 },
  { id: 'jupiter', title: 'Jupiter', trait: 'Dev firtina, riskli temas.', size: 24 },
  { id: 'saturn', title: 'Saturn', trait: 'Halka etkisiyle akisi yavaslatir.', size: 22 },
  { id: 'uranus', title: 'Uranus', trait: 'Ekstra can kazandirir.', size: 20 },
  { id: 'neptune', title: 'Neptune', trait: 'Combo suresini uzatir.', size: 20 },
]

const PLANET_DISPLAY_LABELS: Record<string, string> = {
  mercury: 'Merkur',
  venus: 'Venus',
  earth: 'Dunya',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  sun: 'Gunes',
}

function ControlButton({ label, direction, onPress }: ControlButtonProps) {
  return (
    <button
      type="button"
      className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-400/10 text-lg font-bold text-cyan-100 transition-transform duration-150 hover:scale-105 hover:bg-cyan-300/20 active:scale-95"
      onClick={() => onPress(direction)}
      onTouchStart={() => onPress(direction)}
      aria-label={label}
    >
      {label}
    </button>
  )
}

function App() {
  const dispatch = useAppDispatch()
  const game = useAppSelector((state) => state.game)
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const joystickRef = useRef<HTMLDivElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const previousSignalRef = useRef(game.eventSignal)

  const [menu, setMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0 })
  const [joystickActive, setJoystickActive] = useState(false)
  const [joystickThumb, setJoystickThumb] = useState<JoystickThumb>({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const speed = useMemo(
    () => Number(Math.hypot(game.player.vx, game.player.vy).toFixed(1)),
    [game.player.vx, game.player.vy],
  )

  const missionProgressPercent = useMemo(() => {
    if (game.currentMission.target <= 0) {
      return 0
    }

    return Math.max(0, Math.min(100, (game.currentMission.progress / game.currentMission.target) * 100))
  }, [game.currentMission.progress, game.currentMission.target])

  const missionProgressText = useMemo(() => {
    if (game.currentMission.kind === 'survive') {
      return `${game.currentMission.progress.toFixed(1)} / ${game.currentMission.target} sn`
    }

    return `${Math.floor(game.currentMission.progress)} / ${game.currentMission.target}`
  }, [game.currentMission.kind, game.currentMission.progress, game.currentMission.target])

  const missionLabel = useMemo(() => {
    if (game.currentMission.kind === 'earth') {
      return `${game.currentMission.target} Dunya yakala`
    }

    if (game.currentMission.kind === 'mars') {
      return `${game.currentMission.target} Mars yakala`
    }

    if (game.currentMission.kind === 'sun') {
      return `${game.currentMission.target} Gunes bonusu al`
    }

    return `${game.currentMission.target} saniye hayatta kal`
  }, [game.currentMission.kind, game.currentMission.target])

  const quizAccuracy = useMemo(() => {
    if (game.quiz.askedCount === 0) {
      return 0
    }

    return Math.round((game.quiz.correctCount / game.quiz.askedCount) * 100)
  }, [game.quiz.askedCount, game.quiz.correctCount])

  const sparkles = useMemo(
    () => [
      { top: '12%', left: '14%', size: 5 },
      { top: '28%', left: '82%', size: 4 },
      { top: '61%', left: '30%', size: 6 },
      { top: '77%', left: '68%', size: 4 },
      { top: '40%', left: '54%', size: 3 },
      { top: '18%', left: '44%', size: 6 },
      { top: '71%', left: '12%', size: 3 },
    ],
    [],
  )

  const playTone = useCallback(
    (frequency: number, durationMs: number, gainScale = 1) => {
      if (typeof window === 'undefined') {
        return
      }

      const masterVolume = game.settings.soundVolume
      if (masterVolume <= 0.01) {
        return
      }

      try {
        const context = audioContextRef.current ?? new AudioContext()
        audioContextRef.current = context

        if (context.state === 'suspended') {
          void context.resume()
        }

        const oscillator = context.createOscillator()
        const gainNode = context.createGain()
        const now = context.currentTime
        const endTime = now + durationMs / 1000

        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequency, now)
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * 0.82), endTime)

        const safeGain = Math.max(0.0001, Math.min(0.6, masterVolume * gainScale))
        gainNode.gain.setValueAtTime(safeGain, now)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)

        oscillator.start(now)
        oscillator.stop(endTime)
      } catch {
        // Audio API can fail before first user gesture on some devices.
      }
    },
    [game.settings.soundVolume],
  )

  const vibrationEnabled = game.settings.vibrationEnabled

  useEffect(() => {
    return () => {
      const context = audioContextRef.current
      if (!context) {
        return
      }

      void context.close()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem('space-action-high-score', String(game.highScore))
  }, [game.highScore])

  useEffect(() => {
    const updateArenaSize = () => {
      if (!arenaRef.current) {
        return
      }

      const rect = arenaRef.current.getBoundingClientRect()

      dispatch(
        setArenaSize({
          width: rect.width,
          height: rect.height,
        }),
      )
    }

    updateArenaSize()
    window.addEventListener('resize', updateArenaSize)

    return () => {
      window.removeEventListener('resize', updateArenaSize)
    }
  }, [dispatch])

  useEffect(() => {
    if (game.isPaused || game.isGameOver || game.showBreakReminder || game.quiz.active) {
      return
    }

    let animationFrame = 0
    let lastFrameTime = performance.now()
    let accumulator = 0
    const fixedStep = 1000 / 60

    const frame = (now: number) => {
      const deltaMs = Math.min(50, now - lastFrameTime)
      lastFrameTime = now

      accumulator += deltaMs

      while (accumulator >= fixedStep) {
        dispatch(tick({ deltaMs: fixedStep }))
        accumulator -= fixedStep
      }

      animationFrame = window.requestAnimationFrame(frame)
    }

    animationFrame = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [dispatch, game.isGameOver, game.isPaused, game.quiz.active, game.showBreakReminder])

  useEffect(() => {
    const pressedKeys = new Set<string>()

    const calculateInput = () => {
      const x = Number(pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD')) - Number(pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA'))
      const y = Number(pressedKeys.has('ArrowDown') || pressedKeys.has('KeyS')) - Number(pressedKeys.has('ArrowUp') || pressedKeys.has('KeyW'))

      dispatch(setInput({ x, y }))
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const isMovementKey =
        event.code.startsWith('Arrow') ||
        event.code === 'KeyA' ||
        event.code === 'KeyS' ||
        event.code === 'KeyD' ||
        event.code === 'KeyW'

      if (isMovementKey) {
        event.preventDefault()
      }

      if (event.repeat && (event.code === 'Space' || event.code === 'KeyP')) {
        return
      }

      pressedKeys.add(event.code)

      if (event.code === 'Space') {
        dispatch(stopPlayer())
      }

      if (event.code === 'KeyP') {
        dispatch(togglePause())
      }

      calculateInput()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeys.delete(event.code)
      calculateInput()
    }

    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      dispatch(setInput({ x: 0, y: 0 }))
    }
  }, [dispatch])

  useEffect(() => {
    const detectTouch = () => {
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches
      const hoverNone = window.matchMedia('(hover: none)').matches
      const touchPoints = navigator.maxTouchPoints > 0

      setIsTouchDevice(coarsePointer || hoverNone || touchPoints)
    }

    detectTouch()
    window.addEventListener('resize', detectTouch)

    return () => {
      window.removeEventListener('resize', detectTouch)
    }
  }, [])

  useEffect(() => {
    const onWindowClick = () => {
      setMenu((current) => {
        if (!current.open) {
          return current
        }

        return { ...current, open: false }
      })
    }

    window.addEventListener('click', onWindowClick)

    return () => {
      window.removeEventListener('click', onWindowClick)
    }
  }, [])

  useEffect(() => {
    const previousSignal = previousSignalRef.current
    const hasVibrationSupport =
      vibrationEnabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

    const vibrate = (pattern: number | number[]) => {
      if (!hasVibrationSupport) {
        return
      }

      navigator.vibrate(pattern)
    }

    if (game.eventSignal.collect > previousSignal.collect) {
      playTone(720, 110, 0.65)
      vibrate(12)
    }

    if (game.eventSignal.hit > previousSignal.hit) {
      playTone(210, 190, 0.9)
      vibrate([18, 30, 18])
    }

    if (game.eventSignal.shield > previousSignal.shield) {
      playTone(460, 140, 0.75)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => playTone(640, 120, 0.7), 90)
      }
      vibrate([10, 20, 10])
    }

    if (game.eventSignal.mission > previousSignal.mission) {
      playTone(860, 140, 0.85)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => playTone(1180, 150, 0.75), 95)
      }
      vibrate([16, 18, 16])
    }

    if (game.eventSignal.level > previousSignal.level) {
      playTone(560, 120, 0.78)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => playTone(760, 120, 0.78), 80)
        window.setTimeout(() => playTone(980, 160, 0.85), 160)
      }
      vibrate([14, 12, 14, 12, 18])
    }

    if (game.eventSignal.unlock > previousSignal.unlock || game.eventSignal.badge > previousSignal.badge) {
      playTone(980, 140, 0.9)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => playTone(1320, 160, 0.82), 100)
      }
      vibrate([12, 16, 12])
    }

    previousSignalRef.current = game.eventSignal
  }, [
    game.eventSignal,
    game.eventSignal.badge,
    game.eventSignal.collect,
    game.eventSignal.hit,
    game.eventSignal.level,
    game.eventSignal.mission,
    game.eventSignal.shield,
    game.eventSignal.unlock,
    playTone,
    vibrationEnabled,
  ])

  const onArenaContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!arenaRef.current) {
      return
    }

    const rect = arenaRef.current.getBoundingClientRect()

    setMenu({
      open: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const menuStyle = useMemo<CSSProperties>(
    () => ({
      left: Math.max(8, Math.min(menu.x, game.arenaWidth - 176)),
      top: Math.max(8, Math.min(menu.y, game.arenaHeight - 164)),
    }),
    [game.arenaHeight, game.arenaWidth, menu.x, menu.y],
  )

  const resetJoystickInput = useCallback(() => {
    setJoystickActive(false)
    setJoystickThumb({ x: 0, y: 0 })
    dispatch(setInput({ x: 0, y: 0 }))
  }, [dispatch])

  useEffect(() => {
    if (game.isPaused || game.isGameOver || game.showBreakReminder || game.quiz.active) {
      dispatch(setInput({ x: 0, y: 0 }))
    }
  }, [dispatch, game.isGameOver, game.isPaused, game.quiz.active, game.showBreakReminder])

  const updateJoystickInput = (clientX: number, clientY: number) => {
    if (!joystickRef.current || game.isPaused || game.isGameOver || game.showBreakReminder || game.quiz.active) {
      return
    }

    const rect = joystickRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const rawX = clientX - centerX
    const rawY = clientY - centerY
    const distance = Math.hypot(rawX, rawY)
    const clampedDistance = Math.min(distance, JOYSTICK_MAX_OFFSET)
    const scale = distance > 0 ? clampedDistance / distance : 0

    const clampedX = rawX * scale
    const clampedY = rawY * scale

    setJoystickThumb({ x: clampedX, y: clampedY })

    const normalizedX = clampedX / JOYSTICK_MAX_OFFSET
    const normalizedY = clampedY / JOYSTICK_MAX_OFFSET
    const magnitude = Math.hypot(normalizedX, normalizedY)

    if (magnitude < JOYSTICK_DEADZONE) {
      dispatch(setInput({ x: 0, y: 0 }))
      return
    }

    dispatch(setInput({ x: normalizedX, y: normalizedY }))
  }

  const handleJoystickPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (game.isPaused || game.isGameOver || game.showBreakReminder || game.quiz.active) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setJoystickActive(true)
    updateJoystickInput(event.clientX, event.clientY)
  }

  const handleJoystickPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!joystickActive) {
      return
    }

    event.preventDefault()
    updateJoystickInput(event.clientX, event.clientY)
  }

  const handleJoystickPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resetJoystickInput()
  }

  const stageBaseClass = game.windMode
    ? 'game-stage game-stage--wind relative h-[58vh] min-h-[340px] max-h-[640px] w-full overflow-hidden rounded-[30px] border border-amber-300/35 bg-[radial-gradient(circle_at_18%_16%,_rgba(251,191,36,0.28),_transparent_44%),radial-gradient(circle_at_76%_2%,_rgba(251,146,60,0.22),_transparent_40%),linear-gradient(160deg,_rgba(30,58,138,0.88),_rgba(15,23,42,0.95))] shadow-[0_24px_90px_rgba(30,64,175,0.45)]'
    : 'game-stage relative h-[58vh] min-h-[340px] max-h-[640px] w-full overflow-hidden rounded-[30px] border border-cyan-300/25 bg-[radial-gradient(circle_at_25%_20%,_rgba(14,116,144,0.4),_transparent_44%),radial-gradient(circle_at_80%_0%,_rgba(251,146,60,0.22),_transparent_42%),linear-gradient(160deg,_rgba(2,6,23,0.95),_rgba(15,23,42,0.92))] shadow-[0_24px_90px_rgba(8,47,73,0.55)]'

  const stageClass = game.planetChainMs > 0 ? `${stageBaseClass} game-stage--chain` : stageBaseClass

  const playerStyle: CSSProperties = {
    width: game.player.radius * 2,
    height: game.player.radius * 2,
    left: `${game.player.x - game.player.radius}px`,
    top: `${game.player.y - game.player.radius}px`,
  }

  const sparkStyle: CSSProperties = {
    width: game.spark.radius * 2,
    height: game.spark.radius * 2,
    left: `${game.spark.x - game.spark.radius}px`,
    top: `${game.spark.y - game.spark.radius}px`,
  }

  const cometStyle: CSSProperties = {
    width: game.comet.radius * 2,
    height: game.comet.radius * 2,
    left: `${game.comet.x - game.comet.radius}px`,
    top: `${game.comet.y - game.comet.radius}px`,
  }

  const homeStyle: CSSProperties = {
    width: game.home.radius * 2,
    height: game.home.radius * 2,
    left: `${game.home.x - game.home.radius}px`,
    top: `${game.home.y - game.home.radius}px`,
  }

  const hazardStyle: CSSProperties = {
    width: game.hazard.radius * 2,
    height: game.hazard.radius * 2,
    left: `${game.hazard.x - game.hazard.radius}px`,
    top: `${game.hazard.y - game.hazard.radius}px`,
  }

  const blackHoleStyle: CSSProperties = {
    width: game.blackHole.radius * 2,
    height: game.blackHole.radius * 2,
    left: `${game.blackHole.x - game.blackHole.radius}px`,
    top: `${game.blackHole.y - game.blackHole.radius}px`,
  }

  const extraPlanetStyles = useMemo(
    () =>
      game.extraPlanets.map((planet) => ({
        id: planet.id,
        className: `planet planet--${planet.id} ${planet.impactMs > 0 ? 'planet-impact' : ''} ${
          planet.visible ? 'opacity-100' : 'opacity-0'
        }`,
        style: {
          width: `${planet.radius * 2}px`,
          height: `${planet.radius * 2}px`,
          left: `${planet.x - planet.radius}px`,
          top: `${planet.y - planet.radius}px`,
        } as CSSProperties,
      })),
    [game.extraPlanets],
  )

  const playerStateClass =
    game.blackHoleHitMs > 0
      ? 'player-ship--blackhole-hit'
      : game.invulnerabilityMs > 0
        ? 'player-ship--invulnerable'
        : ''

  const playerShipClass = [
    'player-ship absolute',
    `player-ship--${game.selectedSkin}`,
    game.windMode ? 'player-ship--boost' : '',
    playerStateClass,
  ]
    .filter(Boolean)
    .join(' ')

  const touchDockInnerClass =
    game.controlSide === 'left'
      ? 'touch-control-dock__inner'
      : 'touch-control-dock__inner touch-control-dock__inner--reverse'

  const joystickIsEngaged =
    joystickActive && !game.isPaused && !game.isGameOver && !game.showBreakReminder && !game.quiz.active
  const joystickVisualThumb = joystickIsEngaged ? joystickThumb : { x: 0, y: 0 }

  return (
    <main
      className={
        isTouchDevice
          ? 'min-h-screen bg-[radial-gradient(circle_at_top,_#12365f_0%,_#04111f_50%,_#020617_100%)] px-3 py-4 pb-56 text-slate-100 md:px-6 md:py-6'
          : 'min-h-screen bg-[radial-gradient(circle_at_top,_#12365f_0%,_#04111f_50%,_#020617_100%)] px-3 py-4 text-slate-100 md:px-6 md:py-6'
      }
    >
      <div className="mx-auto w-full max-w-[1520px]">
        <header className="glass-card stagger-entry rounded-3xl border border-cyan-200/20 px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="title-font text-[11px] uppercase tracking-[0.26em] text-cyan-200/80">Space Action</p>
              <h1 className="title-font mt-1 text-2xl font-semibold text-cyan-50 md:text-3xl">Uzay Roketi Gorev Merkezi</h1>
              <p className="mt-1 text-sm text-slate-200/90">Roketinle gezegenleri yakala, gorevleri bitir, rozetleri topla.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-cyan-100/30 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                Hiz Limiti: <span className="font-semibold">{SPEED_LIMIT_BY_DIFFICULTY[game.difficulty].toFixed(1)}</span>
              </div>

              <div className="flex rounded-xl border border-cyan-200/25 bg-slate-900/40 p-1">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      game.difficulty === mode
                        ? 'rounded-lg bg-cyan-300/30 px-3 py-1 text-xs font-semibold text-cyan-50'
                        : 'rounded-lg px-3 py-1 text-xs text-slate-200 transition hover:bg-cyan-200/15'
                    }
                    onClick={() => dispatch(setDifficulty(mode))}
                  >
                    {DIFFICULTY_LABELS[mode]}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={
                  game.settings.quizEnabled
                    ? 'rounded-xl border border-emerald-200/35 bg-emerald-300/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-200/30'
                    : 'rounded-xl border border-slate-200/25 bg-slate-700/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-600/55'
                }
                onClick={() => dispatch(setQuizEnabled(!game.settings.quizEnabled))}
              >
                Quiz: {game.settings.quizEnabled ? 'Acik' : 'Kapali'}
              </button>

              <button
                type="button"
                className="rounded-xl border border-cyan-100/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-200/20"
                onClick={() => {
                  resetJoystickInput()
                  dispatch(togglePause())
                }}
              >
                {game.isPaused ? 'Devam Et' : 'Duraklat'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-amber-100/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/20"
                onClick={() => dispatch(restartGame())}
              >
                Yeniden Baslat
              </button>
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <aside className="order-2 space-y-4 xl:order-1">
            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h2 className="title-font text-lg text-cyan-100">Genel Bilgiler</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Puan</p>
                  <p className="title-font text-xl text-cyan-50">{game.score}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/15 bg-amber-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/75">En Yuksek</p>
                  <p className="title-font text-xl text-amber-100">{game.highScore}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Seviye</p>
                  <p className="title-font text-xl text-cyan-100">{game.level}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Can</p>
                  <p className="title-font text-xl text-cyan-100">{game.lives}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Kalkan</p>
                  <p className="title-font text-xl text-cyan-100">{game.shieldCharges}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Hiz</p>
                  <p className="title-font text-xl text-cyan-100">{speed}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Carpan</p>
                  <p className="title-font text-xl text-cyan-100">x{game.combo}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Gorev</p>
                  <p className="title-font text-xl text-cyan-100">{game.missionsCompleted}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Karadelik</p>
                  <p className="title-font text-base text-cyan-100">{game.blackHole.visible ? 'Aktif' : 'Henuz Yok'}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Anlik Gorev</h3>
              <p className="mt-2 text-sm text-slate-200">{missionLabel}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-100/80">Odul: +{game.currentMission.rewardPoints}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,_#22d3ee,_#f59e0b)] transition-all duration-200"
                  style={{ width: `${missionProgressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-200">
                <span>{missionProgressText}</span>
                <span>{Math.ceil(game.currentMission.timeLeftMs / 1000)} sn</span>
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Bilim Quiz Durumu</h3>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl border border-cyan-200/15 bg-cyan-200/10 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">Soru</p>
                  <p className="title-font text-lg text-cyan-100">{game.quiz.askedCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200/15 bg-emerald-300/10 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">Dogru</p>
                  <p className="title-font text-lg text-emerald-100">{game.quiz.correctCount}</p>
                </div>
                <div className="rounded-xl border border-amber-200/15 bg-amber-300/10 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-300">Basari</p>
                  <p className="title-font text-lg text-amber-100">%{quizAccuracy}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {game.settings.quizEnabled
                  ? 'Her 3 gezegen yakalamada mini quiz acilir.'
                  : 'Quiz su an kapali. Ustteki Quiz butonundan tekrar acabilirsin.'}
              </p>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Gezegen Takibi</h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-200">
                <p>Merkur: {game.planetCatches.mercury}</p>
                <p>Venus: {game.planetCatches.venus}</p>
                <p>Dunya: {game.planetCatches.earth}</p>
                <p>Mars: {game.planetCatches.mars}</p>
                <p>Jupiter: {game.planetCatches.jupiter}</p>
                <p>Saturn: {game.planetCatches.saturn}</p>
                <p>Uranus: {game.planetCatches.uranus}</p>
                <p>Neptune: {game.planetCatches.neptune}</p>
                <p>Gunes: {game.planetCatches.sun}</p>
              </div>
              {game.learningFact ? (
                <div className="mt-3 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                  Bilgi: {game.learningFact}
                </div>
              ) : null}
            </div>
          </aside>

          <section
            ref={arenaRef}
            className={`${stageClass} stagger-entry order-1 xl:order-2`}
            onContextMenu={onArenaContextMenu}
            onClick={() => setMenu((current) => ({ ...current, open: false }))}
          >
            <div className="pointer-events-none absolute inset-0">
              {sparkles.map((star, index) => (
                <div
                  key={`${star.left}-${star.top}`}
                  className={
                    index % 2 === 0
                      ? 'absolute rounded-full bg-white/50 animate-twinkle-fast'
                      : 'absolute rounded-full bg-cyan-200/45 animate-twinkle-slow'
                  }
                  style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
                />
              ))}
            </div>

            {game.blackHole.visible ? (
              <div
                className={game.blackHole.pulseMs > 0 ? 'black-hole black-hole--pulse' : 'black-hole'}
                style={blackHoleStyle}
              />
            ) : null}

            <div className={playerShipClass} style={playerStyle}>
              <div className="player-ship__window" />
              <div className="player-ship__wing player-ship__wing--left" />
              <div className="player-ship__wing player-ship__wing--right" />
              <div className="player-ship__flame" />
            </div>

            <div
              className={
                game.spark.visible
                  ? game.spark.impactMs > 0
                    ? 'planet planet--earth planet-impact opacity-100'
                    : 'planet planet--earth opacity-100'
                  : 'planet planet--earth opacity-0'
              }
              style={sparkStyle}
            />

            <div
              className={
                game.comet.visible
                  ? game.comet.impactMs > 0
                    ? 'planet planet--mars planet-impact opacity-100'
                    : 'planet planet--mars opacity-100'
                  : 'planet planet--mars opacity-0'
              }
              style={cometStyle}
            />

            <div
              className={
                game.home.visible
                  ? game.home.impactMs > 0
                    ? 'space-sun planet-impact opacity-100'
                    : 'space-sun opacity-100'
                  : 'space-sun opacity-0'
              }
              style={homeStyle}
            />

            <div
              className={
                game.hazard.visible
                  ? game.hazard.impactMs > 0
                    ? 'planet planet--jupiter planet-impact opacity-100'
                    : 'planet planet--jupiter opacity-100'
                  : 'planet planet--jupiter opacity-0'
              }
              style={hazardStyle}
            />

            {extraPlanetStyles.map((planet) => (
              <div key={planet.id} className={planet.className} style={planet.style} />
            ))}

            {game.announcement ? (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-cyan-100/30 bg-slate-950/60 px-4 py-1 text-sm font-semibold tracking-wide text-cyan-100 backdrop-blur animate-pop-note">
                {game.announcement}
              </div>
            ) : null}

            {game.quiz.active && game.quiz.question ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-cyan-100/35 bg-slate-900/90 px-5 py-5 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="planet-preview-wrap">
                      <span
                        className={`planet planet-preview planet--${game.quiz.question.planet}`}
                        style={{ width: '24px', height: '24px' }}
                      />
                    </div>
                    <div>
                      <p className="title-font text-lg text-cyan-100">Mini Bilim Quiz</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                        {PLANET_DISPLAY_LABELS[game.quiz.question.planet] ?? game.quiz.question.planet}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-100">{game.quiz.question.prompt}</p>

                  <div className="mt-3 space-y-2">
                    {game.quiz.question.options.map((option, index) => (
                      <button
                        key={`${game.quiz.question?.id}-opt-${index}`}
                        type="button"
                        className="w-full rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-3 py-2 text-left text-sm text-cyan-50 transition hover:bg-cyan-200/20"
                        onClick={() => dispatch(answerQuiz({ index }))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="mt-3 w-full rounded-xl border border-slate-300/25 bg-slate-700/55 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-600/65"
                    onClick={() => dispatch(skipQuiz())}
                  >
                    Bu Soruyu Gec
                  </button>
                </div>
              </div>
            ) : null}

            {game.isPaused && !game.isGameOver && !game.showBreakReminder && !game.quiz.active ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                <div className="rounded-2xl border border-cyan-100/25 bg-slate-900/75 px-5 py-4 text-center">
                  <p className="title-font text-2xl text-cyan-100">Duraklatildi</p>
                  <p className="mt-1 text-sm text-slate-200">Devam etmek icin Duraklat dugmesine veya P tusuna bas.</p>
                </div>
              </div>
            ) : null}

            {game.showBreakReminder ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
                <div className="w-[92%] max-w-sm rounded-3xl border border-emerald-200/35 bg-slate-900/80 px-6 py-6 text-center shadow-2xl">
                  <p className="title-font text-2xl text-emerald-100">Mola Zamani</p>
                  <p className="mt-2 text-sm text-slate-200">2 dakika dinlen, su ic, sonra tekrar devam et.</p>
                  <button
                    type="button"
                    className="mt-4 rounded-xl border border-emerald-200/40 bg-emerald-300/20 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-200/30"
                    onClick={() => dispatch(dismissBreakReminder())}
                  >
                    Devam Et
                  </button>
                </div>
              </div>
            ) : null}

            {game.isGameOver ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm">
                <div className="w-[92%] max-w-sm rounded-3xl border border-rose-200/35 bg-slate-900/80 px-6 py-6 text-center shadow-2xl">
                  <p className="title-font text-3xl text-rose-100">Oyun Bitti</p>
                  <p className="mt-2 text-sm text-slate-200">Skor: {game.score}</p>
                  <button
                    type="button"
                    className="mt-4 rounded-xl border border-amber-200/40 bg-amber-300/20 px-4 py-2 font-semibold text-amber-100 transition hover:bg-amber-200/30"
                    onClick={() => dispatch(restartGame())}
                  >
                    Yeniden Basla
                  </button>
                </div>
              </div>
            ) : null}

            {menu.open ? (
              <div
                className="absolute z-40 w-44 rounded-2xl border border-cyan-100/30 bg-slate-950/90 p-2 text-sm text-slate-200 shadow-2xl backdrop-blur"
                style={menuStyle}
                onClick={(event) => event.stopPropagation()}
              >
                <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Kisa Menu</p>
                <button
                  type="button"
                  className="mb-1 w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-cyan-200/15"
                  onClick={() => {
                    dispatch(stopPlayer())
                    setMenu((current) => ({ ...current, open: false }))
                  }}
                >
                  Gemiyi Durdur
                </button>
                <button
                  type="button"
                  className="mb-1 w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-cyan-200/15"
                  onClick={() => {
                    dispatch(resetPlayerPosition())
                    setMenu((current) => ({ ...current, open: false }))
                  }}
                >
                  Gemiyi Merkeze Al
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-cyan-200/15"
                  onClick={() => {
                    resetJoystickInput()
                    dispatch(togglePause())
                    setMenu((current) => ({ ...current, open: false }))
                  }}
                >
                  {game.isPaused ? 'Devam Et' : 'Duraklat'}
                </button>
              </div>
            ) : null}
          </section>

          <aside className="order-3 space-y-4 xl:order-3">
            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h2 className="title-font text-lg text-cyan-100">Kontroller</h2>
              <p className="mt-2 text-sm text-slate-200">
                <span className="font-semibold text-cyan-100">Ok Tuslari / WASD:</span> Roketi yonlendir
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span className="font-semibold text-cyan-100">Bosluk:</span> Gemiyi durdur
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span className="font-semibold text-cyan-100">P:</span> Duraklat / devam
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span className="font-semibold text-cyan-100">Tablet:</span> Joystick alanina dokunup surukle
              </p>
              <p className="mt-1 text-sm text-amber-100">
                <span className="font-semibold text-amber-200">Karadelik:</span> Gezegenleri 5 sn icin yutar, roket girerse can gider.
              </p>

              <div
                className={
                  isTouchDevice
                    ? 'desktop-dpad mt-3 hidden grid-cols-3 gap-2'
                    : 'desktop-dpad mt-3 grid grid-cols-3 gap-2'
                }
              >
                <div />
                <ControlButton
                  label="↑"
                  direction={{ x: 0, y: -1 }}
                  onPress={(vector) => dispatch(nudgePlayer(vector))}
                />
                <div />
                <ControlButton
                  label="←"
                  direction={{ x: -1, y: 0 }}
                  onPress={(vector) => dispatch(nudgePlayer(vector))}
                />
                <ControlButton
                  label="↓"
                  direction={{ x: 0, y: 1 }}
                  onPress={(vector) => dispatch(nudgePlayer(vector))}
                />
                <ControlButton
                  label="→"
                  direction={{ x: 1, y: 0 }}
                  onPress={(vector) => dispatch(nudgePlayer(vector))}
                />
              </div>
              <p className={isTouchDevice ? 'mt-3 text-xs uppercase tracking-[0.18em] text-cyan-100/80' : 'hidden'}>
                Dokunmatik joystick ekranin altina tasindi.
              </p>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">8 Gezegen Ozellikleri</h3>
              <div className="mt-2 space-y-2">
                {PLANET_GUIDE.map((planet) => (
                  <div
                    key={planet.id}
                    className="flex items-center gap-2 rounded-xl border border-cyan-200/15 bg-cyan-200/5 px-2.5 py-2"
                  >
                    <div className="planet-preview-wrap">
                      <span
                        className={`planet planet-preview planet--${planet.id}`}
                        style={{ width: `${planet.size}px`, height: `${planet.size}px` }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cyan-100">{planet.title}</p>
                      <p className="text-xs text-slate-300">{planet.trait}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Roket Hangari</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['classic', 'neon', 'comet', 'solar'] as RocketSkin[]).map((skin) => {
                  const unlocked = game.unlockedSkins.includes(skin)

                  return (
                    <button
                      key={skin}
                      type="button"
                      className={
                        unlocked
                          ? game.selectedSkin === skin
                            ? 'rounded-xl border border-cyan-100/45 bg-cyan-300/25 px-2 py-2 text-xs font-semibold text-cyan-50'
                            : 'rounded-xl border border-cyan-100/25 bg-cyan-300/10 px-2 py-2 text-xs text-cyan-100 transition hover:bg-cyan-200/20'
                          : 'rounded-xl border border-slate-500/30 bg-slate-700/30 px-2 py-2 text-xs text-slate-400'
                      }
                      disabled={!unlocked}
                      onClick={() => dispatch(selectRocketSkin(skin))}
                    >
                      {SKIN_LABELS[skin]}
                      {!unlocked ? ' (Kilitli)' : ''}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Rozetler</h3>
              {game.badges.length === 0 ? (
                <p className="mt-2 text-sm text-slate-300">Rozet kazanmak icin gorevleri tamamla.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {game.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-amber-200/35 bg-amber-200/15 px-2.5 py-1 text-amber-100"
                    >
                      {BADGE_LABELS[badge] ?? badge}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Ebeveyn Ayarlari</h3>

              <label className="mt-2 block text-sm text-slate-200" htmlFor="sound-volume">
                Ses Seviyesi: %{Math.round((game.settings.soundVolume / 0.6) * 100)}
              </label>
              <input
                id="sound-volume"
                type="range"
                min={0}
                max={0.6}
                step={0.05}
                value={game.settings.soundVolume}
                className="mt-1 w-full accent-cyan-400"
                onChange={(event) => dispatch(setSoundVolume(Number(event.target.value)))}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    game.settings.vibrationEnabled
                      ? 'rounded-xl border border-cyan-200/35 bg-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-50'
                      : 'rounded-xl border border-cyan-200/25 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200'
                  }
                  onClick={() => dispatch(setVibrationEnabled(!game.settings.vibrationEnabled))}
                >
                  Titresim: {game.settings.vibrationEnabled ? 'Acik' : 'Kapali'}
                </button>

                <button
                  type="button"
                  className={
                    game.settings.sessionReminderEnabled
                      ? 'rounded-xl border border-cyan-200/35 bg-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-50'
                      : 'rounded-xl border border-cyan-200/25 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200'
                  }
                  onClick={() => dispatch(setSessionReminderEnabled(!game.settings.sessionReminderEnabled))}
                >
                  Mola Hatirlatici: {game.settings.sessionReminderEnabled ? 'Acik' : 'Kapali'}
                </button>
              </div>

              <label className="mt-3 block text-sm text-slate-200" htmlFor="session-minutes">
                Mola Suresi: {Math.round(game.settings.sessionReminderMs / 60000)} dk
              </label>
              <input
                id="session-minutes"
                type="range"
                min={10}
                max={45}
                step={5}
                value={Math.round(game.settings.sessionReminderMs / 60000)}
                className="mt-1 w-full accent-emerald-400"
                onChange={(event) => dispatch(setSessionReminderMinutes(Number(event.target.value)))}
              />

              {isTouchDevice ? (
                <div className="mt-3 rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/80">Tablet Kontrol Tarafi</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className={
                        game.controlSide === 'left'
                          ? 'rounded-lg bg-cyan-300/30 px-3 py-1 text-xs font-semibold text-cyan-50'
                          : 'rounded-lg bg-slate-800/70 px-3 py-1 text-xs text-slate-200'
                      }
                      onClick={() => dispatch(setControlSide('left'))}
                    >
                      Sol Joystick
                    </button>
                    <button
                      type="button"
                      className={
                        game.controlSide === 'right'
                          ? 'rounded-lg bg-cyan-300/30 px-3 py-1 text-xs font-semibold text-cyan-50'
                          : 'rounded-lg bg-slate-800/70 px-3 py-1 text-xs text-slate-200'
                      }
                      onClick={() => dispatch(setControlSide('right'))}
                    >
                      Sag Joystick
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </div>

      {isTouchDevice ? (
        <div className="touch-control-dock">
          <div className={touchDockInnerClass}>
            <div
              ref={joystickRef}
              className={joystickIsEngaged ? 'virtual-joystick virtual-joystick--active' : 'virtual-joystick'}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
            >
              <div className="virtual-joystick__rings" />
              <div
                className="virtual-joystick__thumb"
                style={{
                  transform: `translate(calc(-50% + ${joystickVisualThumb.x}px), calc(-50% + ${joystickVisualThumb.y}px))`,
                }}
              />
            </div>

            <div className="tablet-action-stack">
              <button type="button" className="tablet-action-button" onClick={() => dispatch(stopPlayer())}>
                Durdur
              </button>
              <button
                type="button"
                className="tablet-action-button"
                onClick={() => dispatch(resetPlayerPosition())}
              >
                Merkez
              </button>
              <button
                type="button"
                className="tablet-action-button"
                onClick={() => {
                  resetJoystickInput()
                  dispatch(togglePause())
                }}
              >
                {game.isPaused ? 'Devam' : 'Duraklat'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
