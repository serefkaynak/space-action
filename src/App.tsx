import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import {
  nudgePlayer,
  resetPlayerPosition,
  restartGame,
  setArenaSize,
  setInput,
  stopPlayer,
  tick,
  togglePause,
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
const JOYSTICK_DEADZONE = 0.15

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
  const [menu, setMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0 })
  const [joystickActive, setJoystickActive] = useState(false)
  const [joystickThumb, setJoystickThumb] = useState<JoystickThumb>({ x: 0, y: 0 })
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const speed = useMemo(
    () => Number(Math.hypot(game.player.vx, game.player.vy).toFixed(1)),
    [game.player.vx, game.player.vy],
  )

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
    if (game.isPaused || game.isGameOver) {
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
  }, [dispatch, game.isGameOver, game.isPaused])

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
      top: Math.max(8, Math.min(menu.y, game.arenaHeight - 144)),
    }),
    [game.arenaHeight, game.arenaWidth, menu.x, menu.y],
  )

  const resetJoystickInput = () => {
    setJoystickActive(false)
    setJoystickThumb({ x: 0, y: 0 })
    dispatch(setInput({ x: 0, y: 0 }))
  }

  const updateJoystickInput = (clientX: number, clientY: number) => {
    if (!joystickRef.current || game.isPaused || game.isGameOver) {
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
    if (game.isPaused || game.isGameOver) {
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

  const handleJoystickTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (game.isPaused || game.isGameOver) {
      return
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    event.preventDefault()
    setJoystickActive(true)
    updateJoystickInput(touch.clientX, touch.clientY)
  }

  const handleJoystickTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!joystickActive) {
      return
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    event.preventDefault()
    updateJoystickInput(touch.clientX, touch.clientY)
  }

  const handleJoystickTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault()
    resetJoystickInput()
  }

  const joystickThumbStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate(calc(-50% + ${joystickThumb.x}px), calc(-50% + ${joystickThumb.y}px))`,
    }),
    [joystickThumb.x, joystickThumb.y],
  )

  const stageBaseClass = game.windMode
    ? 'game-stage game-stage--wind relative h-[62vh] min-h-[340px] max-h-[640px] w-full overflow-hidden rounded-[30px] border border-amber-300/35 bg-[radial-gradient(circle_at_18%_16%,_rgba(251,191,36,0.28),_transparent_44%),radial-gradient(circle_at_76%_2%,_rgba(251,146,60,0.22),_transparent_40%),linear-gradient(160deg,_rgba(30,58,138,0.88),_rgba(15,23,42,0.95))] shadow-[0_24px_90px_rgba(30,64,175,0.45)]'
    : 'game-stage relative h-[62vh] min-h-[340px] max-h-[640px] w-full overflow-hidden rounded-[30px] border border-cyan-300/25 bg-[radial-gradient(circle_at_25%_20%,_rgba(14,116,144,0.4),_transparent_44%),radial-gradient(circle_at_80%_0%,_rgba(251,146,60,0.22),_transparent_42%),linear-gradient(160deg,_rgba(2,6,23,0.95),_rgba(15,23,42,0.92))] shadow-[0_24px_90px_rgba(8,47,73,0.55)]'

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

  const playerShipClass = game.windMode
    ? 'player-ship player-ship--boost absolute'
    : 'player-ship absolute'

  return (
    <main
      className={
        isTouchDevice
          ? 'min-h-screen bg-[radial-gradient(circle_at_top,_#12365f_0%,_#04111f_50%,_#020617_100%)] px-3 py-4 pb-56 text-slate-100 md:px-6 md:py-6'
          : 'min-h-screen bg-[radial-gradient(circle_at_top,_#12365f_0%,_#04111f_50%,_#020617_100%)] px-3 py-4 text-slate-100 md:px-6 md:py-6'
      }
    >
      <div className="mx-auto w-full max-w-[1450px]">
        <header className="glass-card stagger-entry rounded-3xl border border-cyan-200/20 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="title-font text-[11px] uppercase tracking-[0.26em] text-cyan-200/80">Space Action</p>
              <h1 className="title-font mt-1 text-2xl font-semibold text-cyan-50 md:text-3xl">Roketinle Gezegen Avı</h1>
              <p className="mt-1 text-sm text-slate-200/90">Uzay aracını ok tuşlarıyla yönet, gezegenleri yakala ve puan rekoru kır.</p>
            </div>

            <div className="flex gap-2">
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
                Yeniden Başlat
              </button>
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)_270px]">
          <aside className="order-2 space-y-4 lg:order-1">
            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h2 className="title-font text-lg text-cyan-100">Genel Bilgiler</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Puan</p>
                  <p className="title-font text-xl text-cyan-50">{game.score}</p>
                </div>
                <div className="rounded-2xl border border-amber-200/15 bg-amber-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-amber-100/75">En Yüksek</p>
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
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Hız</p>
                  <p className="title-font text-xl text-cyan-100">{speed}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/10 px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Çarpan</p>
                  <p className="title-font text-xl text-cyan-100">x{game.combo}</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Gezegen Rehberi</h3>
              <p className="mt-2 text-sm text-slate-200">Dünya (mavi-yeşil): +15</p>
              <p className="mt-1 text-sm text-slate-200">Mars (kızıl): +25</p>
              <p className="mt-1 text-sm text-slate-200">Güneş (büyük, sarı-turuncu): +120</p>
              <p className="mt-1 text-sm text-rose-200">Jüpiter fırtınası: can azaltır</p>
            </div>
          </aside>

          <section
            ref={arenaRef}
            className={`${stageClass} stagger-entry order-1 lg:order-2`}
            onContextMenu={onArenaContextMenu}
            onClick={() => setMenu((current) => ({ ...current, open: false }))}
          >
            <div className="pointer-events-none absolute inset-0">
              {sparkles.map((star, index) => (
                <div
                  key={`${star.left}-${star.top}`}
                  className={index % 2 === 0 ? 'absolute rounded-full bg-white/50 animate-twinkle-fast' : 'absolute rounded-full bg-cyan-200/45 animate-twinkle-slow'}
                  style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
                />
              ))}
            </div>

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
                    ? 'planet planet--hazard planet-impact opacity-100'
                    : 'planet planet--hazard opacity-100'
                  : 'planet planet--hazard opacity-0'
              }
              style={hazardStyle}
            />

            {game.announcement ? (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-cyan-100/30 bg-slate-950/60 px-4 py-1 text-sm font-semibold tracking-wide text-cyan-100 backdrop-blur animate-pop-note">
                {game.announcement}
              </div>
            ) : null}

            {game.isPaused && !game.isGameOver ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                <div className="rounded-2xl border border-cyan-100/25 bg-slate-900/75 px-5 py-4 text-center">
                  <p className="title-font text-2xl text-cyan-100">Duraklatıldı</p>
                  <p className="mt-1 text-sm text-slate-200">Devam etmek için Devam butonuna veya P tuşuna bas.</p>
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
                    Yeniden Başla
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
                <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">Kısa Menü</p>
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

          <aside className="order-3 space-y-4 lg:order-3">
            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h2 className="title-font text-lg text-cyan-100">Kontroller</h2>
              <p className="mt-2 text-sm text-slate-200"><span className="font-semibold text-cyan-100">Ok Tuşları / WASD:</span> Roketi yönlendir</p>
              <p className="mt-1 text-sm text-slate-200"><span className="font-semibold text-cyan-100">Boşluk:</span> Gemiyi durdur</p>
              <p className="mt-1 text-sm text-slate-200"><span className="font-semibold text-cyan-100">P:</span> Duraklat / devam</p>
              <p className="mt-1 text-sm text-slate-200"><span className="font-semibold text-cyan-100">Tablet:</span> Joystick alanına dokunup sürükle</p>

              <div className={isTouchDevice ? 'desktop-dpad mt-3 hidden grid-cols-3 gap-2' : 'desktop-dpad mt-3 grid grid-cols-3 gap-2'}>
                <div />
                <ControlButton label="↑" direction={{ x: 0, y: -1 }} onPress={(vector) => dispatch(nudgePlayer(vector))} />
                <div />
                <ControlButton label="←" direction={{ x: -1, y: 0 }} onPress={(vector) => dispatch(nudgePlayer(vector))} />
                <ControlButton label="↓" direction={{ x: 0, y: 1 }} onPress={(vector) => dispatch(nudgePlayer(vector))} />
                <ControlButton label="→" direction={{ x: 1, y: 0 }} onPress={(vector) => dispatch(nudgePlayer(vector))} />
              </div>
              <p className={isTouchDevice ? 'mt-3 text-xs uppercase tracking-[0.18em] text-cyan-100/80' : 'hidden'}>
                Dokunmatik joystick ekranın altına taşındı.
              </p>
            </div>

            <div className="glass-card rounded-3xl border border-cyan-200/20 px-4 py-4">
              <h3 className="title-font text-base text-cyan-100">Sağ Panel</h3>
              <p className="mt-2 text-sm text-slate-200">Durum: {game.isPaused ? 'Duraklatıldı' : 'Aktif'}</p>
              <p className="mt-1 text-sm text-slate-200">Anlık hız üst sınırı: 8.0</p>
              <p className="mt-1 text-sm text-slate-200">Sabit hız limitiyle roket kontrolü daha stabil.</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-300/80">İpucu: Uzun süre tek yöne basmak hızı arttırmaz, yalnızca yönü korur.</p>
            </div>
          </aside>
        </section>
      </div>

      {isTouchDevice ? (
        <div className="touch-control-dock">
          <div className="touch-control-dock__inner">
            <div
              ref={joystickRef}
              className={joystickActive ? 'virtual-joystick virtual-joystick--active' : 'virtual-joystick'}
              onPointerDown={handleJoystickPointerDown}
              onPointerMove={handleJoystickPointerMove}
              onPointerUp={handleJoystickPointerUp}
              onPointerCancel={handleJoystickPointerUp}
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              onTouchCancel={handleJoystickTouchEnd}
            >
              <div className="virtual-joystick__rings" />
              <div className="virtual-joystick__thumb" style={joystickThumbStyle} />
            </div>

            <div className="tablet-action-stack">
              <button
                type="button"
                className="tablet-action-button"
                onClick={() => dispatch(stopPlayer())}
              >
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
