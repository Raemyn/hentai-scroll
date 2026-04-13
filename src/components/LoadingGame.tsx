import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Flex, Text, Title } from '@mantine/core';

type GameState = 'idle' | 'playing' | 'dead' | 'won';

type PipeInstance = {
    id: number;
    x: number;
    topHeight: number;
    passed: boolean;
    el: HTMLDivElement;
};

const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;
const BIRD_X = 50;
const BIRD_SIZE = 85;
const PIPE_WIDTH = 90;
const PIPE_GAP = 200;
const PIPE_SPAWN_RATE = 1400;
const GRAVITY = 0.05;
const JUMP_STRENGTH = -2.2;
const SPEED = 1.2;
const LEVEL_DURATION = 22400;
const WIN_BEFORE_END = 2000;
const PROGRESS_TICK_MS = 60;
const CATGIRL_URL = '/public/altBerd.png';

const PIPE_MIN_HEIGHT = 90;
const PIPE_MAX_HEIGHT = GAME_HEIGHT - PIPE_GAP - 120;
const PIPE_MAX_STEP = 90;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function useResponsiveScale() {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => {
            const widthAvail = Math.max(320, window.innerWidth - 16);
            const heightAvail = Math.max(420, window.innerHeight - 160);
            const next = Math.min(widthAvail / GAME_WIDTH, heightAvail / GAME_HEIGHT, 1);
            setScale(Number.isFinite(next) && next > 0 ? next : 1);
        };

        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return scale;
}

const LoadingProgressBar = memo(function LoadingProgressBar() {
    const [progress, setProgress] = useState(0);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        startRef.current = performance.now();

        const timer = window.setInterval(() => {
            if (startRef.current === null) return;
            const elapsed = performance.now() - startRef.current;
            setProgress(clamp((elapsed / LEVEL_DURATION) * 100, 0, 100));
        }, PROGRESS_TICK_MS);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <Box style={{ width: 'min(100vw - 16px, 600px)', marginBottom: 12, flexShrink: 0 }}>
            <Text size="sm" fw={700} c="#ff1493" style={{ textAlign: 'center', marginBottom: 4 }}>
                Грузим данные с сервера не больше 20сек
            </Text>
            <Box
                style={{
                    width: '100%',
                    height: 14,
                    background: '#ff1493',
                    borderRadius: 999,
                    overflow: 'hidden',
                    boxShadow: '0 0 8px rgba(255, 20, 147, 0.22)',
                }}
            >
                <Box
                    style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: '#7000ff',
                        borderRadius: 999,
                        transition: 'none',
                        willChange: 'width',
                    }}
                />
            </Box>
        </Box>
    );
});

export default function NormalFlappyBird() {
    const scale = useResponsiveScale();

    const [gameState, setGameState] = useState<GameState>('idle');
    const [score, setScore] = useState(0);
    const [flash, setFlash] = useState(false);

    const gameStateRef = useRef<GameState>('idle');
    const birdYRef = useRef(250);
    const velocityRef = useRef(0);
    const pipesRef = useRef<PipeInstance[]>([]);
    const frameId = useRef<number>(0);
    const lastPipeTime = useRef<number>(0);
    const gameStartRef = useRef<number>(0);
    const flashTimeoutRef = useRef<number | null>(null);
    const lastTopHeightRef = useRef<number>(Math.floor((PIPE_MIN_HEIGHT + PIPE_MAX_HEIGHT) / 2));

    const birdElRef = useRef<HTMLDivElement | null>(null);
    const pipesLayerRef = useRef<HTMLDivElement | null>(null);

    const changeState = useCallback((next: GameState) => {
        gameStateRef.current = next;
        setGameState(next);
    }, []);

    const setBirdTransform = useCallback((y: number, rotation: number) => {
        const el = birdElRef.current;
        if (!el) return;
        el.style.transform = `translate3d(0, ${y}px, 0) rotate(${rotation}deg)`;
    }, []);

    const removePipe = useCallback((pipe: PipeInstance) => {
        pipe.el.remove();
    }, []);

    const generateTopHeight = useCallback(() => {
        const previous = lastTopHeightRef.current;
        const step = Math.round((Math.random() * 2 - 1) * PIPE_MAX_STEP);
        const next = clamp(previous + step, PIPE_MIN_HEIGHT, PIPE_MAX_HEIGHT);
        lastTopHeightRef.current = next;
        return next;
    }, []);

    const resetToIdle = useCallback(() => {
        birdYRef.current = 250;
        velocityRef.current = 0;
        gameStartRef.current = 0;
        lastPipeTime.current = 0;
        lastTopHeightRef.current = Math.floor((PIPE_MIN_HEIGHT + PIPE_MAX_HEIGHT) / 2);
        setScore(0);
        setFlash(false);

        if (flashTimeoutRef.current !== null) {
            window.clearTimeout(flashTimeoutRef.current);
            flashTimeoutRef.current = null;
        }

        for (const pipe of pipesRef.current) removePipe(pipe);
        pipesRef.current = [];

        setBirdTransform(250, 0);
        changeState('idle');
    }, [changeState, removePipe, setBirdTransform]);

    const jump = useCallback(() => {
        if (gameStateRef.current === 'dead') {
            resetToIdle();
            return;
        }

        if (gameStateRef.current === 'won') return;

        if (gameStateRef.current === 'idle') {
            changeState('playing');
        }

        velocityRef.current = JUMP_STRENGTH;
    }, [changeState, resetToIdle]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                jump();
            }
        };

        window.addEventListener('keydown', handleKey, { passive: false });
        return () => window.removeEventListener('keydown', handleKey);
    }, [jump]);

    useEffect(() => {
        const loop = (time: number) => {
            const state = gameStateRef.current;

            if (state === 'idle') {
                const bob = Math.sin(time / 200) * 15;
                birdYRef.current = 250 + bob;
                setBirdTransform(birdYRef.current, Math.sin(time / 200) * 10);
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            if (gameStartRef.current === 0) gameStartRef.current = time;
            const elapsed = time - gameStartRef.current;

            if (elapsed >= LEVEL_DURATION - WIN_BEFORE_END && state !== 'won') {
                changeState('won');
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            if (state === 'dead') {
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            if (state === 'won') {
                birdYRef.current += (250 - birdYRef.current) * 0.05;
                setBirdTransform(birdYRef.current, 0);
                for (const pipe of pipesRef.current) {
                    pipe.x -= SPEED;
                    pipe.el.style.transform = `translate3d(${pipe.x}px, 0, 0)`;
                }
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            if (lastPipeTime.current === 0) lastPipeTime.current = time;

            velocityRef.current += GRAVITY;
            birdYRef.current += velocityRef.current;
            setBirdTransform(birdYRef.current, clamp(velocityRef.current * 4, -25, 90));

            if (time - lastPipeTime.current > PIPE_SPAWN_RATE && elapsed < LEVEL_DURATION - WIN_BEFORE_END) {
                const topHeight = generateTopHeight();

                const pair = document.createElement('div');
                pair.style.position = 'absolute';
                pair.style.left = '0';
                pair.style.top = '0';
                pair.style.willChange = 'transform';
                pair.style.transform = `translate3d(${GAME_WIDTH}px, 0, 0)`;

                const top = document.createElement('div');
                top.style.position = 'absolute';
                top.style.left = '0';
                top.style.top = '0';
                top.style.width = `${PIPE_WIDTH}px`;
                top.style.height = `${topHeight}px`;
                top.style.background = 'linear-gradient(to bottom, #ff00ff, #7000ff)';
                top.style.borderRadius = '0 0 8px 8px';
                top.style.border = '2px solid rgba(255,255,255,0.75)';
                top.style.boxShadow = '0 0 8px rgba(255,0,255,0.3)';

                const bottom = document.createElement('div');
                bottom.style.position = 'absolute';
                bottom.style.left = '0';
                bottom.style.top = `${topHeight + PIPE_GAP}px`;
                bottom.style.width = `${PIPE_WIDTH}px`;
                bottom.style.height = `${GAME_HEIGHT - (topHeight + PIPE_GAP)}px`;
                bottom.style.background = 'linear-gradient(to top, #ff00ff, #7000ff)';
                bottom.style.borderRadius = '8px 8px 0 0';
                bottom.style.border = '2px solid rgba(255,255,255,0.75)';
                bottom.style.boxShadow = '0 0 8px rgba(255,0,255,0.3)';

                pair.appendChild(top);
                pair.appendChild(bottom);
                pipesLayerRef.current?.appendChild(pair);

                pipesRef.current.push({
                    id: time + Math.random(),
                    x: GAME_WIDTH,
                    topHeight,
                    passed: false,
                    el: pair,
                });
                lastPipeTime.current = time;
            }

            const hitBoxBuffer = 12;
            const birdRight = BIRD_X + BIRD_SIZE - hitBoxBuffer;
            const birdLeft = BIRD_X + hitBoxBuffer;
            const birdTop = birdYRef.current + hitBoxBuffer;
            const birdBottom = birdYRef.current + BIRD_SIZE - hitBoxBuffer;

            let hit = false;
            const nextPipes: PipeInstance[] = [];

            for (const pipe of pipesRef.current) {
                pipe.x -= SPEED;
                pipe.el.style.transform = `translate3d(${pipe.x}px, 0, 0)`;

                if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
                    pipe.passed = true;
                    setScore((prev) => prev + 1);
                }

                if (birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH) {
                    if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
                        hit = true;
                    }
                }

                if (pipe.x > -PIPE_WIDTH) {
                    nextPipes.push(pipe);
                } else {
                    removePipe(pipe);
                }
            }

            pipesRef.current = nextPipes;

            if (birdYRef.current > GAME_HEIGHT - BIRD_SIZE || birdYRef.current < 0) {
                hit = true;
            }

            if (hit) {
                changeState('dead');
                setFlash(true);
                if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
                flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 140);
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            frameId.current = requestAnimationFrame(loop);
        };

        frameId.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId.current);
    }, [changeState, generateTopHeight, removePipe, setBirdTransform]);

    const borderColor = useMemo(() => {
        if (gameState === 'dead') return '#ff1493';
        if (gameState === 'won') return '#00ffcc';
        return '#7000ff';
    }, [gameState]);

    const boxShadow = useMemo(() => {
        if (gameState === 'dead') return '0 0 14px rgba(255, 20, 147, 0.35)';
        if (gameState === 'won') return '0 0 18px rgba(0, 255, 204, 0.28)';
        return '0 0 12px rgba(112, 0, 255, 0.3)';
    }, [gameState]);

    const scaledWidth = GAME_WIDTH * scale;
    const scaledHeight = GAME_HEIGHT * scale;

    return (
        <Flex direction="column" align="center" style={{ margin: '20px auto', width: '100%' }}>
            <LoadingProgressBar />

            <Box style={{ width: scaledWidth, height: scaledHeight, margin: '0 auto' }}>
                <Box
                    onClick={jump}
                    style={{
                        width: GAME_WIDTH,
                        height: GAME_HEIGHT,
                        position: 'relative',
                        backgroundColor: '#0a001a',
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: `2px solid ${borderColor}`,
                        boxShadow,
                        cursor: 'pointer',
                        userSelect: 'none',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        willChange: 'transform',
                        contain: 'layout paint size',
                    }}
                >
                    <Box
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage:
                                'linear-gradient(rgba(255, 20, 147, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 20, 147, 0.08) 1px, transparent 1px)',
                            backgroundSize: '42px 42px',
                            opacity: gameState === 'won' ? 0.15 : 0.32,
                            pointerEvents: 'none',
                        }}
                    />

                    <Box ref={pipesLayerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

                    <Box
                        ref={birdElRef}
                        style={{
                            position: 'absolute',
                            left: BIRD_X,
                            top: 0,
                            width: BIRD_SIZE,
                            height: BIRD_SIZE,
                            zIndex: 10,
                            willChange: 'transform',
                            transform: 'translate3d(0, 250px, 0) rotate(0deg)',
                            filter: gameState === 'won' ? 'drop-shadow(0 0 8px rgba(0,255,204,0.45))' : 'none',
                        }}
                    >
                        <img
                            src={CATGIRL_URL}
                            alt="catgirl"
                            draggable={false}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                        />
                    </Box>

                    {(gameState === 'playing' || gameState === 'idle') && (
                        <Title
                            order={1}
                            style={{
                                position: 'absolute',
                                top: 18,
                                width: '100%',
                                textAlign: 'center',
                                color: '#fff',
                                textShadow: '0 0 8px rgba(255, 20, 147, 0.35)',
                                zIndex: 20,
                                fontFamily: 'monospace',
                                fontSize: 42,
                                pointerEvents: 'none',
                            }}
                        >
                            {score}
                        </Title>
                    )}

                    {gameState === 'idle' && (
                        <Box
                            style={{
                                position: 'absolute',
                                top: '60%',
                                width: '100%',
                                textAlign: 'center',
                                color: '#fff',
                                zIndex: 20,
                                pointerEvents: 'none',
                            }}
                        >
                            <Text fw={800} size="lg">
                                КЛИКНИ ИЛИ НАЖМИ ПРОБЕЛ
                            </Text>
                            <Text size="sm">ЛЕТИМ 20 СЕКУНД 💦</Text>
                        </Box>
                    )}

                    {gameState === 'dead' && (
                        <Flex
                            direction="column"
                            align="center"
                            justify="center"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(0,0,0,0.82)',
                                zIndex: 100,
                                pointerEvents: 'none',
                            }}
                        >
                            <Text c="#ff1493" fw={900} style={{ fontSize: 34, textShadow: '0 0 10px rgba(255, 20, 147, 0.45)' }}>
                                GAME OVER
                            </Text>
                            <Text c="#fff" size="xl" mb={18}>
                                Труб пройдено: {score}
                            </Text>
                            <Box style={{ padding: '10px 18px', background: '#ff1493', color: '#fff', borderRadius: 8, fontWeight: 700 }}>
                                КЛИКНИ, ЧТОБЫ ПОВТОРИТЬ
                            </Box>
                        </Flex>
                    )}

                    {gameState === 'won' && (
                        <Flex
                            direction="column"
                            align="center"
                            justify="center"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(10, 0, 26, 0.86)',
                                zIndex: 100,
                                pointerEvents: 'none',
                            }}
                        >
                            <Text c="#00ffcc" fw={900} style={{ fontSize: 38, textShadow: '0 0 14px rgba(0,255,204,0.45)', textAlign: 'center' }}>
                                Данные<br />ЗАГРУЖЕННЫ!
                            </Text>
                        </Flex>
                    )}
                </Box>
            </Box>
        </Flex>
    );
}


<Text c="#00ffcc" fw={900} style={{ fontSize: 38, textShadow: '0 0 14px rgba(0,255,204,0.45)', textAlign: 'center' }}>
    Данные<br />ЗАГРУЖЕННЫ!
</Text>






