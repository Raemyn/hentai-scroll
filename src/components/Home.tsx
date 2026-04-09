import { useEffect, useMemo, useState } from 'react';
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
};

const API_URL = 'http://localhost:3001';

function buildColumns(items: Post[], count: number) {
  const columns: Post[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const item of items) {
    const w = item.preview_width ?? item.width ?? 1;
    const h = item.preview_height ?? item.height ?? 1;
    const ratio = h / w;

    let target = 0;
    for (let i = 1; i < heights.length; i += 1) {
      if (heights[i] < heights[target]) target = i;
    }

    columns[target].push(item);
    heights[target] += ratio;
  }

  return columns;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/posts?limit=50`)
      .then((res) => res.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('Ошибка загрузки:', error);
        setPosts([]);
      });
  }, []);

  const columns = useMemo(() => buildColumns(posts, 3), [posts]);

  return (
    <Box bg="#0a0a0a" mih="100vh" c="white" pb={40}>
      <Flex
        align="center"
        justify="space-between"
        p="md"
        className={classes.header}
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

        <Button color="pink" radius="md" fw={600}>
          Сортировать по новые
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
                const src = post.sample_url || '';
                if (!src) return null;

                return (
                  <Box
                    key={`${post.id}-${columnIndex}-${index}`}
                    style={{
                      margin: 0,
                      padding: 0,
                      lineHeight: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={src}
                      alt={`Post ${post.id}`}
                      loading="lazy"
                      draggable={false}
                      style={{
                        width: '100%',
                        display: 'block',
                        margin: 0,
                        padding: 2,
                        border: 8,
                        borderRadius: 0,
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          ))}
        </Flex>
      </Container>

      <Text ta="center" c="dimmed" mt={60} size="sm">
        3 колонки • без промежутков • preview_url
      </Text>
    </Box>
  );
}