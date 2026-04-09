import {
  Box,
  Title,
  Text,
  Flex,
  Group,
  TextInput,
  Button,
} from '@mantine/core';
import '@mantine/core/styles.css';

const images = [
  "https://picsum.photos/id/1043/1920/1080", // 16:9 — будет крупнее по площади
  "https://picsum.photos/id/1069/1920/1080",
  "https://picsum.photos/id/1015/1920/1080",
  "https://picsum.photos/id/201/1920/1080",
  "https://picsum.photos/id/133/1920/1080",
  "https://picsum.photos/id/243/1920/1080",
  "https://picsum.photos/id/1025/800/600",
  "https://picsum.photos/id/1074/600/600",
  "https://picsum.photos/id/1084/600/600",
  "https://picsum.photos/id/237/600/800",
  "https://picsum.photos/id/238/600/800",
  "https://picsum.photos/id/239/540/960",
  "https://picsum.photos/id/240/540/960",
  "https://picsum.photos/id/241/600/1000",
  "https://picsum.photos/id/242/600/1100",
  "https://picsum.photos/id/244/1200/400",
  "https://picsum.photos/id/29/800/600",
  "https://picsum.photos/id/160/600/650",
];

const Home = () => {
  return (
    <Box bg="#0a0a0a" mih="100vh" c="white" pb={40}>
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        p="md"
        style={{
          borderBottom: '1px solid #222',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: '#0a0a0a',
        }}
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

      {/* ПЛОТНЫЙ 3-КОЛОНОЧНЫЙ MASONRY — ZERO ПРОМЕЖУТКОВ */}
      <div
        style={{
          columnCount: 3,           // строго 3 колонки
          columnGap: '0px',         // горизонтального пространства нет
          padding: '0 8px',         // лёгкие отступы по краям страницы
        }}
      >
        {images.map((src, index) => (
          <div
            key={index}
            
            style={{
                  // радиус скругления
              breakInside: 'avoid',   // не разрывает карточку посередине
              marginBottom: '0px',    // вертикального пространства между фото — 0
              padding: '4px',           // дополнительно убираем любые отступы
            }}
          >
            <img
              src={src}
              alt={`Hentai #${index}`}
              style={{
            
                width: '100%',        // занимает всю ширину колонки
                height: 'auto',       // высота по пропорциям (не обрезается)
                display: 'block',
                borderRadius: '8px',    // если хочешь совсем плотно — 0, или оставь '8px'
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              }}
            />
          </div>
        ))}
      </div>

      <Text ta="center" c="dimmed" mt={60} size="sm">
        3 колонки • Максимально плотно • Между фото нет ни пикселя пространства
      </Text>
    </Box>
  );
};

export default Home;