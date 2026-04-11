import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Flex, Text, Title } from '@mantine/core';

// --- НАСТРОЙКИ ИГРЫ (плавная версия) ---
const GAME_WIDTH = 380;
const GAME_HEIGHT = 500;
const BIRD_X = 50;
const BIRD_SIZE = 45;
const PIPE_WIDTH = 60;
const PIPE_GAP = 160; 
const PIPE_SPAWN_RATE = 1400; 
const GRAVITY = 0.05;
const JUMP_STRENGTH = -2.2;
const SPEED = 1.2;
const LEVEL_DURATION = 16400;   // 16.4 секунды — прогресс-бар всегда идёт до конца

// ← НОВОЕ: точно 2 секунды до конца прогресс-бара
const TIME_TO_SHOW_WIN_BEFORE_END = 2000;

const CATGIRL_URL = '../../public/favicon.ico';

type PipeData = {
    id: number;
    x: number;
    topHeight: number;
    passed: boolean;
};

type GameState = 'idle' | 'playing' | 'dead' | 'won';

export default function NormalFlappyBird() {
    const [gameState, setGameState] = useState<GameState>('idle');
    const [birdY, setBirdY] = useState(250);
    const [score, setScore] = useState(0);
    const [rotation, setRotation] = useState(0);
    const [pipes, setPipes] = useState<PipeData[]>([]);
    const [flash, setFlash] = useState(false);
    const [timeProgress, setTimeProgress] = useState(0);

    const gameStateRef = useRef<GameState>('idle');
    const birdYRef = useRef(250);
    const velocityRef = useRef(0);
    const pipesRef = useRef<PipeData[]>([]);
    const frameId = useRef<number>(0);
    const lastPipeTime = useRef<number>(0);
    const startTimeRef = useRef<number>(0);

    const changeState = (newState: GameState) => {
        gameStateRef.current = newState;
        setGameState(newState);
    };

    const jump = useCallback(() => {
        if (gameStateRef.current === 'dead') {
            // Ресет ТОЛЬКО игры. Прогресс-бар НЕ сбрасывается!
            birdYRef.current = 250;
            velocityRef.current = 0;
            pipesRef.current = [];
            setScore(0);
            setFlash(false);
            lastPipeTime.current = 0;
            changeState('idle');
            return;
        }

        if (gameStateRef.current === 'won') return;

        if (gameStateRef.current === 'idle') {
            changeState('playing');
        }

        velocityRef.current = JUMP_STRENGTH;
    }, []);

    useEffect(() => {
        const loop = (time: number) => {
            if (gameStateRef.current === 'idle') {
                birdYRef.current = 250 + Math.sin(time / 200) * 15;
                setBirdY(birdYRef.current);
                setRotation(Math.sin(time / 200) * 10);
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            // ─────── ПРОГРЕСС-БАР ВСЕГДА РАБОТАЕТ (даже если dead или won) ───────
            if (startTimeRef.current === 0) startTimeRef.current = time;
            const elapsed = time - startTimeRef.current;
            const currentProgress = Math.min((elapsed / LEVEL_DURATION) * 100, 100);
            setTimeProgress(currentProgress);

            // ─────── ПОБЕДА РОВНО ЗА 2 СЕКУНДЫ ДО КОНЦА (независимо от смерти) ───────
            if (elapsed >= LEVEL_DURATION - TIME_TO_SHOW_WIN_BEFORE_END && gameStateRef.current !== 'won') {
                changeState('won');
            }

            if (gameStateRef.current === 'dead') {
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            if (gameStateRef.current === 'won') {
                birdYRef.current += (250 - birdYRef.current) * 0.05;
                setBirdY(birdYRef.current);
                setRotation(0);
                pipesRef.current = pipesRef.current.map(p => ({ ...p, x: p.x - SPEED }));
                setPipes([...pipesRef.current]);
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            // ─────── ИГРА ИДЁТ ТОЛЬКО В СОСТОЯНИИ 'playing' ───────
            if (lastPipeTime.current === 0) lastPipeTime.current = time;

            velocityRef.current += GRAVITY;
            birdYRef.current += velocityRef.current;
            setRotation(Math.min(Math.max(velocityRef.current * 4, -25), 90));

            // Спавн труб — перестаём ровно за 2 секунды до конца
            if (time - lastPipeTime.current > PIPE_SPAWN_RATE && elapsed < LEVEL_DURATION - TIME_TO_SHOW_WIN_BEFORE_END) {
                const minH = 50;
                const maxH = GAME_HEIGHT - PIPE_GAP - 50;
                const topHeight = Math.floor(Math.random() * (maxH - minH + 1) + minH);

                pipesRef.current.push({
                    id: Date.now(),
                    x: GAME_WIDTH,
                    topHeight,
                    passed: false
                });
                lastPipeTime.current = time;
            }

            const hitBoxBuffer = 12;
            let hit = false;

            pipesRef.current = pipesRef.current
                .map(pipe => ({ ...pipe, x: pipe.x - SPEED }))
                .filter(pipe => {
                    if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
                        pipe.passed = true;
                        setScore(s => s + 1);
                    }

                    const birdRight = BIRD_X + BIRD_SIZE - hitBoxBuffer;
                    const birdLeft = BIRD_X + hitBoxBuffer;
                    const birdTop = birdYRef.current + hitBoxBuffer;
                    const birdBottom = birdYRef.current + BIRD_SIZE - hitBoxBuffer;

                    if (birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH) {
                        if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
                            hit = true;
                        }
                    }
                    return pipe.x > -PIPE_WIDTH;
                });

            if (birdYRef.current > GAME_HEIGHT - BIRD_SIZE || birdYRef.current < 0) {
                hit = true;
            }

            if (hit) {
                changeState('dead');
                setFlash(true);
                setTimeout(() => setFlash(false), 150);
                frameId.current = requestAnimationFrame(loop);
                return;
            }

            setBirdY(birdYRef.current);
            setPipes([...pipesRef.current]);
            frameId.current = requestAnimationFrame(loop);
        };

        frameId.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId.current);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                jump();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [jump]);

    return (
        <Flex direction="column" align="center" style={{ margin: '20px auto' }}>
            
            {/* PROGRESS-БАР — полностью независим от игры */}
            <Box style={{ width: GAME_WIDTH, marginBottom: 12 }}>
                <Text 
                    size="sm" 
                    fw={700} 
                    c="#ff1493" 
                    style={{ 
                        textAlign: 'center', 
                        marginBottom: 4,
                        textShadow: '0 0 8px #ff1493'
                    }}
                >
                    Грузим данные с сервера
                </Text>
                <Box
                    style={{
                        height: '10px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.3)'
                    }}
                >
                    <Box
                        style={{
                            width: `${timeProgress}%`,
                            height: '100%',
                            background: timeProgress >= 100 ? '#00ffcc' : '#ff1493',
                            boxShadow: `0 0 12px ${timeProgress >= 100 ? '#00ffcc' : '#ff1493'}`,
                            transition: 'width 0.1s linear'
                        }}
                    />
                </Box>
            </Box>

            {/* Сама игра */}
            <Box
                onClick={jump}
                style={{
                    width: GAME_WIDTH,
                    height: GAME_HEIGHT,
                    position: 'relative',
                    backgroundColor: '#0a001a',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: `3px solid ${gameState === 'dead' ? '#ff1493' : gameState === 'won' ? '#00ffcc' : '#7000ff'}`,
                    boxShadow: gameState === 'dead' ? '0 0 30px #ff1493' : gameState === 'won' ? '0 0 40px #00ffcc' : '0 0 20px #7000ff',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'transform 0.1s linear, border 0.3s, box-shadow 0.3s',
                    transform: flash ? 'scale(1.03) translateY(-5px)' : 'scale(1)',
                }}
            >
                {/* Неоновый фон */}
                <Box
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `
                            linear-gradient(rgba(255, 20, 147, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 20, 147, 0.1) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                        opacity: gameState === 'won' ? 0.2 : 0.5,
                    }}
                />

                {/* Трубы */}
                {pipes.map(pipe => (
                    <Box key={pipe.id}>
                        <Box
                            style={{
                                position: 'absolute',
                                left: pipe.x,
                                top: 0,
                                width: PIPE_WIDTH,
                                height: pipe.topHeight,
                                background: 'linear-gradient(to bottom, #ff00ff, #7000ff)',
                                borderRadius: '0 0 8px 8px',
                                boxShadow: '0 0 15px #ff00ff',
                                border: '2px solid #fff',
                            }}
                        />
                        <Box
                            style={{
                                position: 'absolute',
                                left: pipe.x,
                                top: pipe.topHeight + PIPE_GAP,
                                width: PIPE_WIDTH,
                                height: GAME_HEIGHT - (pipe.topHeight + PIPE_GAP),
                                background: 'linear-gradient(to top, #ff00ff, #7000ff)',
                                borderRadius: '8px 8px 0 0',
                                boxShadow: '0 0 15px #ff00ff',
                                border: '2px solid #fff',
                            }}
                        />
                    </Box>
                ))}

                {/* Киска */}
                <Box
                    style={{
                        position: 'absolute',
                        left: BIRD_X,
                        top: birdY,
                        width: BIRD_SIZE,
                        height: BIRD_SIZE,
                        zIndex: 10,
                        transform: `rotate(${rotation}deg)`,
                        filter: gameState === 'won' ? 'drop-shadow(0 0 20px #00ffcc)' : 'drop-shadow(0 0 10px #ff1493)',
                    }}
                >
                    <img
                        src={CATGIRL_URL}
                        alt="catgirl"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </Box>

                {/* Счёт */}
                {(gameState === 'playing' || gameState === 'idle') && (
                    <Title
                        order={1}
                        style={{
                            position: 'absolute',
                            top: 20,
                            width: '100%',
                            textAlign: 'center',
                            color: '#fff',
                            textShadow: '0 0 10px #ff1493',
                            zIndex: 20,
                            fontFamily: 'monospace',
                            fontSize: '48px'
                        }}
                    >
                        {score}
                    </Title>
                )}

                {/* Сообщение в idle */}
                {gameState === 'idle' && (
                    <Box
                        style={{
                            position: 'absolute',
                            top: '60%',
                            width: '100%',
                            textAlign: 'center',
                            color: '#fff',
                            textShadow: '0 0 10px #ff1493',
                            animation: 'pulse 1.5s infinite',
                            zIndex: 20,
                        }}
                    >
                        <Text fw={800} size="lg">КЛИКНИ ИЛИ НАЖМИ ПРОБЕЛ</Text>
                        <Text size="sm">ЛЕТИМ 16 СЕКУНД 💦</Text>
                    </Box>
                )}

                {/* GAME OVER */}
                {gameState === 'dead' && (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100 }}
                    >
                        <Text c="#ff1493" fw={900} style={{ fontSize: '36px', textShadow: '0 0 15px #ff1493' }}>
                            GAME OVER
                        </Text>
                        <Text c="#fff" size="xl" mb={20}>Труб пройдено: {score}</Text>
                        <Box style={{ padding: '10px 20px', background: '#ff1493', color: '#fff', borderRadius: '8px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                            КЛИКНИ, ЧТОБЫ ПОВТОРИТЬ
                        </Box>
                    </Flex>
                )}

                {/* ПОБЕДА — появляется ровно за 2 секунды до конца прогресс-бара */}
                {gameState === 'won' && (
                    <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(10, 0, 26, 0.85)', zIndex: 100, backdropFilter: 'blur(3px)' }}
                    >
                        <Text c="#00ffcc" fw={900} style={{ fontSize: '42px', textShadow: '0 0 25px #00ffcc', textAlign: 'center' }}>
                            АХЕГАО<br/>ДОСТИГНУТО!
                        </Text>
                        <Text c="#fff" size="lg" mt={10}>Уровень пройден 😻</Text>
                    </Flex>
                )}

                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `}</style>
            </Box>
        </Flex>
    );
}