import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Autocomplete,
  Box,
  Button,
  CloseButton,
  Container,
  Flex,
  Group,
  Text,
  Title,
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import '@mantine/core/styles.css';
import LoadingGame from './LoadingGame';

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

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
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

function extractTagName(option: string) {
  return option.replace(/\s*\(\d+\)\s*$/, '').trim();
}

function normalizeSuggestion(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const value = item as { label?: unknown; value?: unknown };
    if (typeof value.label === 'string' && value.label.trim()) return value.label;
    if (typeof value.value === 'string' && value.value.trim()) return value.value;
  }
  return '';
}

type MediaCardProps = { post: Post };

function MediaCard({ post }: MediaCardProps) {
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
        if (entry.isIntersecting) video.play().catch(() => { });
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
      <Box
        ref={wrapperRef}
        style={{
          width: '100%',
          aspectRatio: `${w} / ${h}`,
          maxHeight: MAX_CARD_HEIGHT,
          overflow: 'hidden',
          backgroundColor: '#111',
          borderRadius: 6,
          position: 'relative',
        }}
      >
        {(isVideo || isGif) && (
          <Box
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.65)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {isVideo ? 'Видео' : 'GIF'}
          </Box>
        )}

        {isVideo ? (
          <video
            ref={videoRef}
            src={src}
            poster={previewUrl || undefined}
            muted
            loop
            playsInline
            onClick={() => window.open(originalSrc, '_blank')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              cursor: 'pointer',
            }}
          />
        ) : (
          <Box
            component="img"
            src={src}
            alt={`Post ${post.id}`}
            loading="lazy"
            onClick={() => window.open(originalSrc, '_blank')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              cursor: 'pointer',
            }}
          />
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [onlyVideos, setOnlyVideos] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(0);
  const [searchOpened, setSearchOpened] = useState(false);

  // ─────── Логика показа игры только после 4 секунд ───────
  const [showFullGame, setShowFullGame] = useState(false);
  const gameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // ← ИСПРАВЛЕНО

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const suppressNextInputChangeRef = useRef(false);

  const appliedTags = useMemo(() => selectedTags.join(' '), [selectedTags]);

  const isMobile = useMediaQuery('(max-width: 750px)');
  const is3Col = useMediaQuery('(min-width: 1100px)');
  const is2Col = useMediaQuery('(min-width: 750px)');
  const columnCount = is3Col ? 3 : is2Col ? 2 : 1;

  const visiblePosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        if (sortMode === 'oldest') return (a.id ?? 0) - (b.id ?? 0);
        if (sortMode === 'top') {
          return (b.score ?? 0) - (a.score ?? 0) || (b.id ?? 0) - (a.id ?? 0);
        }
        return (b.id ?? 0) - (a.id ?? 0);
      }),
    [posts, sortMode]
  );

  const columns = useMemo(() => buildColumns(visiblePosts, columnCount), [visiblePosts, columnCount]);

  // Управление показом игры
  useEffect(() => {
    if (loading) {
      gameTimeoutRef.current = setTimeout(() => {
        setShowFullGame(true);
      }, 8000);
    } else {
      if (gameTimeoutRef.current) {
        clearTimeout(gameTimeoutRef.current);
        gameTimeoutRef.current = null;
      }
      setShowFullGame(false);
    }

    return () => {
      if (gameTimeoutRef.current) clearTimeout(gameTimeoutRef.current);
    };
  }, [loading]);

  function clearSearchInput() {
    suppressNextInputChangeRef.current = true;
    setTagInput('');
    setSuggestions([]);

    window.setTimeout(() => {
      setTagInput('');
      setSuggestions([]);
      suppressNextInputChangeRef.current = false;
    }, 0);
  }

  function addTag(rawTag: string) {
    const cleanTag = extractTagName(rawTag);
    if (!cleanTag) {
      clearSearchInput();
      return;
    }

    setSelectedTags((prev) => (prev.includes(cleanTag) ? prev : [...prev, cleanTag]));
    clearSearchInput();

    if (isMobile) setSearchOpened(false);
  }

  function removeTag(tagToRemove: string) {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  }

  useEffect(() => {
    if (tagInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/tags?q=${encodeURIComponent(tagInput.trim())}`);
        if (!res.ok) return setSuggestions([]);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.map(normalizeSuggestion).filter(Boolean) : []);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [tagInput]);

  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
  }, [appliedTags, onlyVideos]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const url = new URL(`${API_URL}/api/posts`);
        url.searchParams.set('limit', String(LIMIT));
        url.searchParams.set('pid', String(page));

        if (appliedTags.trim()) url.searchParams.set('tags', appliedTags.trim());
        if (onlyVideos) url.searchParams.set('onlyVideos', '1');

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error();

        const list: Post[] = await res.json() || [];

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
  }, [page, appliedTags, onlyVideos]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '2000px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const sortLabel = sortMode === 'newest' ? 'Новые' : sortMode === 'oldest' ? 'Старые' : 'Топ';

  const SearchPanel = (
    <Box style={{ width: '100%', maxWidth: 420 }}>
      {selectedTags.length > 0 && (
        <Group gap={8} wrap="wrap" mb={8}>
          {selectedTags.map((tag) => (
            <Box
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: '#1a1a1a',
                border: '1px solid #333',
                color: 'white',
              }}
            >
              <Text size="sm" fw={600}>{tag}</Text>
              <CloseButton size="sm" onClick={() => removeTag(tag)} />
            </Box>
          ))}
        </Group>
      )}

      <Autocomplete
        placeholder="Введите тег и нажмите Enter..."
        leftSection="🔎"
        value={tagInput}
        onChange={(value) => {
          if (suppressNextInputChangeRef.current) return;
          setTagInput(value);
        }}
        data={suggestions}
        limit={10}
        onOptionSubmit={addTag}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag(tagInput);
          }
        }}
        w="100%"
        radius="md"
        comboboxProps={{ position: 'bottom', middlewares: { flip: false, shift: false } }}
        styles={{
          input: { backgroundColor: '#1a1a1a', borderColor: '#333', color: 'white' },
          dropdown: { backgroundColor: '#1a1a1a', borderColor: '#333', color: '#ff00d4', fontWeight: 600 },
        }}
      />
    </Box>
  );

  return (
    <Box bg="#0a0a0a" mih="100vh" c="white" pb={40}>
      {/* Хедер (без изменений) */}
      <Box style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#0a0a0a', borderBottom: '1px solid #222' }}>
        <Container size="xl" px="md" py="sm">
          <Flex align="center" justify="space-between" gap="sm" style={{ width: '100%' }}>
            <Box style={{ width: 72 }} />
            <Group gap={8} align="center" justify="center" style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSearchOpened((o) => !o)}>
              <Title order={2} size="h4" style={{ textAlign: 'center' }}>hentai-scroll</Title>
              <Box style={{ transform: searchOpened ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <IconChevronDown size={20} stroke={2.2} />
              </Box>
            </Group>
            <Box style={{ width: 72 }} />
          </Flex>

          <Box style={{ maxHeight: searchOpened ? 220 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
            <Box mt="sm" p="sm" style={{ background: '#111', borderRadius: 12, border: '1px solid #222' }}>
              <Flex gap="sm" align="center" justify="center" wrap="wrap" mb="sm">
                <Text onClick={() => setOnlyVideos((v) => !v)} style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 999, fontWeight: 600, background: onlyVideos ? '#ff4d6d' : 'transparent', color: onlyVideos ? 'white' : '#aaa' }}>
                  🎬 Только видео
                </Text>
                <Button color="pink" size="sm" onClick={() => setSortMode((c) => (c === 'newest' ? 'oldest' : c === 'oldest' ? 'top' : 'newest'))}>
                  Сортировка: {sortLabel}
                </Button>
              </Flex>
              <Flex justify="center">{SearchPanel}</Flex>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container size="xl" px={0} py={0}>
        <Flex align="flex-start" gap={0} style={{ width: '100%' }}>
          {columns.map((column, i) => (
            <Box key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
              {column.map((post) => <MediaCard key={post.id} post={post} />)}
            </Box>
          ))}
        </Flex>
        <div ref={sentinelRef} style={{ height: 1 }} />
      </Container>

      {/* Лоадер */}
      {loading && (
        <>
          {!showFullGame && (
            <Box
              style={{
                position: 'relative',
                zIndex: 5,
                display: 'flex',
                justifyContent: 'center',
                marginTop: 12,
                marginBottom: 6,
                opacity: 0.45,
                pointerEvents: 'none',
              }}
            >
              <Text size="xs" c="#aaa" fw={500} style={{ letterSpacing: 0.3 }}>
                Секунду...
              </Text>
            </Box>
          )}

          {showFullGame && <LoadingGame />}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
}