# 🔧 Исправление проблемы с Nginx

## Проблема
Nginx не может загрузиться из-за битой символической ссылки на несуществующий файл `chillville-awards`.

## Решение

Выполните следующие команды на сервере:

### 1. Проверьте содержимое sites-enabled

```bash
ls -la /etc/nginx/sites-enabled/
```

Вы увидите битую ссылку на `chillville-awards`.

### 2. Удалите битую ссылку

```bash
sudo rm /etc/nginx/sites-enabled/chillville-awards
```

### 3. Убедитесь, что конфигурация bonfire-awards создана

```bash
# Проверьте, существует ли файл конфигурации
ls -la /etc/nginx/sites-available/bonfire-awards

# Если файла нет, создайте его:
sudo nano /etc/nginx/sites-available/bonfire-awards
```

Вставьте следующую конфигурацию (замените `yourdomain.com` на ваш домен или IP):

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

Сохраните файл (Ctrl+O, Enter, Ctrl+X в nano).

### 4. Создайте символическую ссылку (если еще не создана)

```bash
sudo ln -s /etc/nginx/sites-available/bonfire-awards /etc/nginx/sites-enabled/bonfire-awards
```

### 5. Проверьте конфигурацию

```bash
sudo nginx -t
```

Должно вывести:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Перезагрузите Nginx

```bash
sudo systemctl reload nginx
```

### 7. Проверьте статус

```bash
sudo systemctl status nginx
```

## Полная последовательность команд

```bash
# 1. Удалить битую ссылку
sudo rm /etc/nginx/sites-enabled/chillville-awards

# 2. Проверить наличие конфигурации bonfire-awards
ls -la /etc/nginx/sites-available/bonfire-awards

# 3. Если файла нет - создать (см. выше)

# 4. Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/bonfire-awards /etc/nginx/sites-enabled/bonfire-awards

# 5. Проверить конфигурацию
sudo nginx -t

# 6. Перезагрузить Nginx
sudo systemctl reload nginx

# 7. Проверить статус
sudo systemctl status nginx
```

## Дополнительная проверка

Если проблема сохраняется, проверьте:

```bash
# Все ссылки в sites-enabled
ls -la /etc/nginx/sites-enabled/

# Содержимое nginx.conf (строка 60)
sudo cat /etc/nginx/nginx.conf | grep -n "sites-enabled"

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
```

---

**После выполнения этих шагов Nginx должен запуститься успешно!** ✅

