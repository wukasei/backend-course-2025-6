# Вибираємо легкий Node.js образ
FROM node:20-alpine

# Робоча директорія в контейнері
WORKDIR /app

# Копіюємо package.json та package-lock.json і встановлюємо залежності
COPY package*.json ./
RUN npm install

# Копіюємо весь код у контейнер
COPY . .

# Відкриваємо порт (той же, що у твоїй програмі)
EXPOSE 3000

# Команда для запуску сервера
# Тут можна передавати host, port і cache
CMD ["node", "index.js", "-h", "0.0.0.0", "-p", "3000", "-c", "memory"]
