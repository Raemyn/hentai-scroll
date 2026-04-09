import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Group,
  Text,
  TextInput,
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
const PREFETCH_BUFFER = 45;
const MAX_CARD_HEIGHT = 700;

type SortMode = 'newest' | 'oldest' | 'top';

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

function normalizeTags(input: string) {
  return input
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesTags(post: Post, query: string) {
  const tags = normalizeTags(query);
  if (tags.length === 0) return true;

  const haystack = (post.tags ?? '').toLowerCase();
  return tags.every((tag) => haystack.includes(tag));
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [tagInput, setTagInput] = useState('');
  const [appliedTags, setAppliedTags] = useState('');

  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const prefetchLockRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedTags(tagInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [tagInput]);

  useEffect(() => {
    setPosts([]);
    setPage(0);
    setHasMore(true);
    prefetchLockRef.current = false;
  }, [appliedTags, sortMode]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);

        const url = new URL(`${API_URL}/api/posts`);
        url.searchParams.set('limit', String(LIMIT));
        url.searchParams.set('pid', String(page * LIMIT));

        if (appliedTags.trim()) {
          url.searchParams.set('tags', appliedTags.trim());
        }

        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const list = Array.isArray(data) ? (data as Post[]) : [];

        setPosts((prev) => {
          const merged = page === 0 ? list : [...prev, ...list];
          const seen = new Set<number>();

          const unique = merged.filter((post) => {
            if (seen.has(post.id)) return false;
            seen.add(post.id);
            return true;
          });

          if (
            list.length === LIMIT &&
            unique.length < PREFETCH_BUFFER &&
            !prefetchLockRef.current
          ) {
            prefetchLockRef.current = true;
            window.setTimeout(() => {
              prefetchLockRef.current = false;
              setPage((p) => p + 1);
            }, 0);
          }

          return unique;
        });

        setHasMore(list.length === LIMIT);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Ошибка загрузки:', error);
          setHasMore(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [page, appliedTags]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      {
        root: null,
        rootMargin: '2500px 0px',
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter((post) => matchesTags(post, appliedTags));

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'oldest') return (a.id ?? 0) - (b.id ?? 0);
      if (sortMode === 'top') {
        return (b.score ?? 0) - (a.score ?? 0) || (b.id ?? 0) - (a.id ?? 0);
      }
      return (b.id ?? 0) - (a.id ?? 0);
    });

    return sorted;
  }, [posts, appliedTags, sortMode]);

  const columns = useMemo(() => buildColumns(visiblePosts, 3), [visiblePosts]);

  const sortLabel =
    sortMode === 'newest' ? 'Новые' : sortMode === 'oldest' ? 'Старые' : 'Топ';

  return (
    <Box bg="#0a0a0a" mih="100vh" c="white" pb={40}>
      <Flex
        align="center"
        justify="space-between"
        p="md"
        className={classes.header}
        gap="md"
        wrap="wrap"
      >
        <Title order={1} size="h2">
          Hentai Scroller
        </Title>

        <Group gap="xl">
          <Text component="a" href="#" c="white" td="none" fw={500}>
            🏠 Главная
          </Text>
          <Text component="a" href="#" c="white" td="none" fw={500}>
            🔥 В тренде
          </Text>
          <Text component="a" href="#" c="white" td="none" fw={500}>
            ⭐ Лучшие
          </Text>
          <Text component="a" href="#" c="white" td="none" fw={500}>
            🏷️ Теги
          </Text>
        </Group>

        <TextInput
          placeholder="Введите теги..."
          leftSection="🔎"
          value={tagInput}
          onChange={(event) => setTagInput(event.currentTarget.value)}
          w={320}
          radius="md"
          styles={{
            input: {
              backgroundColor: '#1a1a1a',
              borderColor: '#333',
              color: 'white',
            },
          }}
        />

        <Button
          color="pink"
          radius="md"
          fw={600}
          onClick={() =>
            setSortMode((current) =>
              current === 'newest'
                ? 'oldest'
                : current === 'oldest'
                  ? 'top'
                  : 'newest'
            )
          }
        >
          Сортировка: {sortLabel}
        </Button>
      </Flex>

      <Container size="xl" px={0} py={0}>
        <Flex align="flex-start" gap={0} style={{ width: '100%' }}>
          {columns.map((column, columnIndex) => (
            <Box
              key={columnIndex}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                margin: 0,
                padding: 0,
              }}
            >
              {column.map((post, index) => {
                const src = post.sample_url || post.preview_url || post.file_url || '';
                if (!src) return null;

                const originalSrc = post.file_url || src;
                const w = post.width ?? post.preview_width ?? 1;
                const h = post.height ?? post.preview_height ?? 1;

                return (
                  <Box
                    key={`${post.id}-${columnIndex}-${index}`}
                    style={{
                      padding: 1,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Box
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
                      <Box
                        component="img"
                        src={src}
                        alt={`Post ${post.id}`}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onClick={() => window.open(originalSrc, '_blank')}
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'block',
                          objectFit: 'cover',
                          cursor: post.file_url ? 'pointer' : 'default',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Flex>

        <div ref={sentinelRef} style={{ height: 1 }} />
      </Container>

      <Text ta="center" c="dimmed" mt={60} size="sm">
        3 колонки • infinite scroll • ранний prefetch • aspect-ratio placeholders
      </Text>

      {loading && (
        <Text ta="center" c="dimmed" mt={12} size="sm">
          Загружаю...
        </Text>
      )}

      {!hasMore && (
        <Text ta="center" c="dimmed" mt={12} size="sm">
          Больше постов нет
        </Text>
      )}
    </Box>
  );
}