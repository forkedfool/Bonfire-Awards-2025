# Гайд по деплою Bonfire Awards 2025 на VPS

Этот гайд поможет вам развернуть приложение Bonfire Awards 2025 на VPS сервере.

## 📋 Требования

- VPS сервер с Ubuntu 20.04+ или Debian 11+
- Доступ по SSH с правами root или sudo
- Доменное имя (опционально, но рекомендуется)
- Бэкенд API должен быть готов к деплою

## 🚀 Шаг 1: Подготовка VPS

### 1.1 Подключение к серверу

```bash
ssh root@your-server-ip
```

### 1.2 Обновление системы

```bash
apt update && apt upgrade -y
```

### 1.3 Установка необходимых пакетов

```bash
apt install -y curl wget git build-essential
```

## 📦 Шаг 2: Установка Node.js

### 2.1 Установка Node.js через NodeSource

```bash
# Для Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 2.2 Проверка установки

```bash
node --version
npm --version
```

Должны отображаться версии Node.js и npm.

## 🌐 Шаг 3: Установка и настройка Nginx

### 3.1 Установка Nginx

```bash
apt install -y nginx
systemctl start nginx
systemctl enable nginx
```

### 3.2 Проверка статуса

```bash
systemctl status nginx
```

## 🔧 Шаг 4: Настройка бэкенда API

### 4.1 Клонирование/загрузка бэкенда

```bash
# Создаем директорию для бэкенда
mkdir -p /var/www/backend
cd /var/www/backend

# Если бэкенд в Git репозитории:
# git clone https://your-repo-url.git .

# Или загрузите файлы бэкенда через SCP/SFTP
```

### 4.2 Установка зависимостей бэкенда

```bash
cd /var/www/backend
npm install
```

### 4.3 Настройка переменных окружения бэкенда

Создайте файл `.env` в директории бэкенда:

```bash
nano /var/www/backend/.env
```

Пример содержимого:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
# Добавьте другие необходимые переменные
```

### 4.4 Установка PM2 для управления процессами

```bash
npm install -g pm2
```

### 4.5 Запуск бэкенда через PM2

```bash
cd /var/www/backend
pm2 start npm --name "bonfire-api" -- start
pm2 save
pm2 startup
```

PM2 автоматически запустит бэкенд при перезагрузке сервера.

### 4.6 Проверка работы бэкенда

```bash
pm2 status
pm2 logs bonfire-api
```

## 🎨 Шаг 5: Деплой фронтенда

### 5.1 Клонирование/загрузка фронтенда

```bash
# Создаем директорию для фронтенда
mkdir -p /var/www/frontend
cd /var/www/frontend

# Если фронтенд в Git репозитории:
# git clone https://your-repo-url.git .

# Или загрузите файлы через SCP/SFTP
```

### 5.2 Установка зависимостей

```bash
cd /var/www/frontend
npm install
```

### 5.3 Настройка переменных окружения

Создайте файл `.env.production`:

```bash
nano /var/www/frontend/.env.production
```

Содержимое:

```env
VITE_API_URL=https://yourdomain.com/api
```

**Важно:** Замените `yourdomain.com` на ваш домен или IP адрес сервера.

### 5.4 Сборка проекта

```bash
cd /var/www/frontend
npm run build
```

После сборки файлы будут в директории `dist/`.

### 5.5 Настройка прав доступа

```bash
chown -R www-data:www-data /var/www/frontend/dist
```

## 🔄 Шаг 6: Настройка Nginx

### 6.1 Создание конфигурации сайта

```bash
nano /etc/nginx/sites-available/bonfire-awards
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Если используете IP вместо домена:
    # server_name your-server-ip;

    # Логи
    access_log /var/log/nginx/bonfire-access.log;
    error_log /var/log/nginx/bonfire-error.log;

    # Корневая директория фронтенда
    root /var/www/frontend/dist;
    index index.html;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Проксирование API запросов на бэкенд
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Статические файлы фронтенда
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Кэширование статических ресурсов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Важно:** Замените `yourdomain.com` на ваш домен или используйте IP адрес.

### 6.2 Активация конфигурации

```bash
# Создаем символическую ссылку
ln -s /etc/nginx/sites-available/bonfire-awards /etc/nginx/sites-enabled/

# Удаляем дефолтную конфигурацию (опционально)
rm /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
nginx -t

# Перезагружаем Nginx
systemctl reload nginx
```

## 🔒 Шаг 7: Настройка SSL (Let's Encrypt)

### 7.1 Установка Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 7.2 Получение SSL сертификата

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Следуйте инструкциям Certbot. Сертификат будет автоматически обновляться.

### 7.3 Автоматическое обновление сертификата

Certbot автоматически настроит cron задачу для обновления сертификата.

Проверить можно командой:

```bash
certbot renew --dry-run
```

## 🔄 Шаг 8: Автоматизация деплоя

### 8.1 Создание скрипта деплоя

```bash
nano /usr/local/bin/deploy-bonfire.sh
```

Содержимое скрипта:

```bash
#!/bin/bash

echo "🚀 Начало деплоя Bonfire Awards..."

# Переход в директорию фронтенда
cd /var/www/frontend

# Обновление кода (если используете Git)
# git pull origin main

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# Сборка проекта
echo "🔨 Сборка проекта..."
npm run build

# Установка прав
chown -R www-data:www-data /var/www/frontend/dist

# Перезагрузка Nginx
echo "🔄 Перезагрузка Nginx..."
systemctl reload nginx

# Перезапуск бэкенда (если нужно)
# pm2 restart bonfire-api

echo "✅ Деплой завершен!"
```

### 8.2 Делаем скрипт исполняемым

```bash
chmod +x /usr/local/bin/deploy-bonfire.sh
```

### 8.3 Использование скрипта

```bash
deploy-bonfire.sh
```

## 🛠️ Шаг 9: Настройка файрвола

### 9.1 Настройка UFW (Uncomplicated Firewall)

```bash
# Разрешаем SSH
ufw allow 22/tcp

# Разрешаем HTTP и HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Включаем файрвол
ufw enable

# Проверяем статус
ufw status
```

## 📊 Шаг 10: Мониторинг и логи

### 10.1 Просмотр логов Nginx

```bash
# Логи доступа
tail -f /var/log/nginx/bonfire-access.log

# Логи ошибок
tail -f /var/log/nginx/bonfire-error.log
```

### 10.2 Просмотр логов бэкенда через PM2

```bash
# Все логи
pm2 logs bonfire-api

# Только ошибки
pm2 logs bonfire-api --err

# Только вывод
pm2 logs bonfire-api --out
```

### 10.3 Мониторинг PM2

```bash
# Статус процессов
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Информация о процессе
pm2 info bonfire-api
```

## 🔧 Шаг 11: Обновление приложения

### 11.1 Обновление фронтенда

```bash
cd /var/www/frontend
git pull origin main  # Если используете Git
npm install
npm run build
chown -R www-data:www-data /var/www/frontend/dist
systemctl reload nginx
```

### 11.2 Обновление бэкенда

```bash
cd /var/www/backend
git pull origin main  # Если используете Git
npm install
pm2 restart bonfire-api
```

## 🐛 Решение проблем

### Проблема: Бэкенд не отвечает

```bash
# Проверьте статус PM2
pm2 status

# Проверьте логи
pm2 logs bonfire-api

# Перезапустите бэкенд
pm2 restart bonfire-api
```

### Проблема: Nginx не работает

```bash
# Проверьте конфигурацию
nginx -t

# Проверьте статус
systemctl status nginx

# Перезапустите
systemctl restart nginx
```

### Проблема: 502 Bad Gateway

1. Убедитесь, что бэкенд запущен: `pm2 status`
2. Проверьте, что бэкенд слушает порт 3000: `netstat -tulpn | grep 3000`
3. Проверьте логи Nginx: `tail -f /var/log/nginx/bonfire-error.log`

### Проблема: CORS ошибки

Убедитесь, что в бэкенде настроен CORS для вашего домена:

```javascript
// Пример для Express
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

## 📝 Чеклист деплоя

- [ ] VPS сервер настроен и обновлен
- [ ] Node.js установлен
- [ ] Nginx установлен и настроен
- [ ] Бэкенд загружен и запущен через PM2
- [ ] Фронтенд собран и размещен в `/var/www/frontend/dist`
- [ ] Переменные окружения настроены
- [ ] Nginx конфигурация создана и активирована
- [ ] SSL сертификат установлен (если используется домен)
- [ ] Файрвол настроен
- [ ] Домен указывает на IP сервера (если используется домен)
- [ ] Приложение доступно по адресу

## 🔗 Полезные команды

```bash
# Перезапуск бэкенда
pm2 restart bonfire-api

# Перезапуск Nginx
systemctl restart nginx

# Проверка конфигурации Nginx
nginx -t

# Просмотр активных процессов Node.js
pm2 list

# Остановка бэкенда
pm2 stop bonfire-api

# Удаление бэкенда из PM2
pm2 delete bonfire-api

# Просмотр использования ресурсов
htop
# или
top
```

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи Nginx: `/var/log/nginx/bonfire-error.log`
2. Логи PM2: `pm2 logs bonfire-api`
3. Статус сервисов: `systemctl status nginx`, `pm2 status`

---

**Успешного деплоя! 🔥**

