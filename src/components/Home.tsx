import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Container,
  Flex,
  Group,
  Text,
  Title,
} from '@mantine/core';
import '@mantine/core/styles.css';
import classes from './Home.module.scss';

type Post = {
  id: number;
  file_url: string | null;
  sample_url: string | null;
  preview_url: string | null;
  width?: number | null;
  height?: number | null;
  preview_width?: number | null;
  preview_height?: number | null;
  score?: number | null;
  tags?: string | null;
};

const API_URL = 'http://localhost:3001';
const LIMIT = 15;
const MAX_CARD_HEIGHT = 700;

type SortMode = 'newest' | 'oldest' | 'top';

function isVideoUrl(url: string) {
  return /\.(mp4|webm)(\?.*)?$/i.test(url);
}

function isGifUrl(url: string) {
  return /\.gif(\?.*)?$/i.test(url);
}

function buildColumns(items: Post[], count: number) {
  const columns: Post[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const item of items) {
    const w = item.width ?? item.preview_width ?? 1;
    const h = item.height ?? item.preview_height ?? 1;
    const ratio = h / w;
    const estimatedHeight = Math.min(MAX_CARD_HEIGHT, Math.max(120, ratio * 320));

    let target = 0;
    for (let i = 1; i < heights.length; i += 1) {
      if (heights[i] < heights[target]) target = i;
    }

    columns[target].push(item);
    heights[target] += estimatedHeight;
  }

  return columns;
}

type MediaCardProps = {
  post: Post;
  columnIndex: number;
  index: number;
};

function MediaCard({ post, columnIndex, index }: MediaCardProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fileUrl = post.file_url || '';
  const previewUrl = post.preview_url || '';
  const sampleUrl = post.sample_url || '';

  const isVideo = Boolean(fileUrl && isVideoUrl(fileUrl));
  const isGif = Boolean(fileUrl && isGifUrl(fileUrl));

  const src = isVideo ? fileUrl : sampleUrl || previewUrl || fileUrl;
  const originalSrc = fileUrl || src;

  const w = post.width ?? post.preview_width ?? 1;
  const h = post.height ?? post.preview_height ?? 1;

  useEffect(() => {
    if (!isVideo) return;
    const el = wrapperRef.current;
    const video = videoRef.current;
    if (!el || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { rootMargin: '-20% 0px -20% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVideo]);

  if (!src) return null;

  return (
    <Box style={{ padding: 4, boxSizing: 'border-box' }}>
      <Box ref={wrapperRef} style={{ width: '100%', aspectRatio: `${w} / ${h}`, maxHeight: MAX_CARD_HEIGHT, overflow: 'hidden', backgroundColor: '#111', borderRadius: 6, position: 'relative' }}>
        {(isVideo || isGif) && (
          <Box style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 12, fontWeight: 700 }}>
            {isVideo ? 'Видео' : 'GIF'}
          </Box>
        )}

        {isVideo ? (
          <video ref={videoRef} src={src} poster={previewUrl} muted loop playsInline onClick={() => window.open(originalSrc, '_blank')} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
        ) : (
          <Box component="img" src={src} alt={`Post ${post.id}`} loading="lazy" onClick={() => window.open(originalSrc, '_blank')} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
        )}
      </Box>
    </Box>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [tagInput, setTagInput] = useState('');
  const [appliedTags, setAppliedTags] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // === ОТЛАДКА: основной useEffect для подсказок ===
  useEffect(() => {
    console.log('🔍 useEffect сработал, tagInput =', tagInput); // ← должно появляться

    if (tagInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const url = `${API_URL}/api/tags?q=${encodeURIComponent(tagInput.trim())}`;
        console.log('📡 Запрос к:', url);

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          console.log('✅ Получено подсказок:', data);
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('❌ Ошибка запроса тегов:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [tagInput]);

  // Применение тега
  useEffect(() => {
    const timer = setTimeout(() => setAppliedTags(tagInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [tagInput]);

  // Сброс постов
  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
  }, [appliedTags, sortMode]);

  // Загрузка постов (оставил как было)
  useEffect(() => {
    // ... (твой код загрузки постов без изменений)
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const url = new URL(`${API_URL}/api/posts`);
        url.searchParams.set('limit', String(LIMIT));
        url.searchParams.set('pid', String(page));
        if (appliedTags.trim()) url.searchParams.set('tags', appliedTags.trim());

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list: Post[] = Array.isArray(data) ? data : [];

        setPosts((prev) => {
          const merged = page === 0 ? list : [...prev, ...list];
          const seen = new Set<number>();
          return merged.filter((p) => !seen.has(p.id) && seen.add(p.id));
        });

        setHasMore(list.length === LIMIT);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [page, appliedTags]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) setPage((p) => p + 1);
      },
      { rootMargin: '2000px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const visiblePosts = useMemo(() => [...posts].sort((a, b) => {
    if (sortMode === 'oldest') return (a.id ?? 0) - (b.id ?? 0);
    if (sortMode === 'top') return (b.score ?? 0) - (a.score ?? 0) || (b.id ?? 0) - (a.id ?? 0);
    return (b.id ?? 0) - (a.id ?? 0);
  }), [posts, sortMode]);

  const columns = useMemo(() => buildColumns(visiblePosts, 3), [visiblePosts]);
  const sortLabel = sortMode === 'newest' ? 'Новые' : sortMode === 'oldest' ? 'Старые' : 'Топ';

  return (
    <Box bg="#0a0a0a" mih="100vh" c="white" pb={40}>
      <Flex align="center" justify="space-between" p="md" gap="md" wrap="wrap">
        <Title order={1} size="h2">Hentai Scroller</Title>

        <Group gap="xl">
          <Text component="a" href="#" c="white" td="none" fw={500}>🏠 Главная</Text>
          <Text component="a" href="#" c="white" td="none" fw={500}>🔥 В тренде</Text>
          <Text component="a" href="#" c="white" td="none" fw={500}>⭐ Лучшие</Text>
        </Group>

        <Autocomplete
          placeholder="Введите тег (например: anime, female)..."
          leftSection="🔎"
          value={tagInput}
          onChange={(value) => {
            console.log('⌨️ onChange вызван:', value); // ← самое важное!
            setTagInput(value);
          }}
          data={suggestions}
          limit={10}
          onOptionSubmit={(value) => {
            setTagInput(value);
            setAppliedTags(value);
          }}
          w={360}
          radius="md"
        />

        <Button color="pink" onClick={() => setSortMode(c => c === 'newest' ? 'oldest' : c === 'oldest' ? 'top' : 'newest')}>
          Сортировка: {sortLabel}
        </Button>
      </Flex>

      {/* Остальная часть с постами */}
      <Container size="xl" px={0} py={0}>
        <Flex align="flex-start" gap={0} style={{ width: '100%' }}>
          {columns.map((column, i) => (
            <Box key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {column.map((post, idx) => (
                <MediaCard key={post.id} post={post} columnIndex={i} index={idx} />
              ))}
            </Box>
          ))}
        </Flex>
        <div ref={sentinelRef} style={{ height: 1 }} />
      </Container>

      {loading && <Text ta="center" mt={20}>Загружаю...</Text>}
    </Box>
  );
}