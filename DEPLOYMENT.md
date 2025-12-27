# Hướng dẫn Deploy LoopAI lên VPS với Nginx, CentOS 7 và Docker

## Yêu cầu hệ thống

- VPS với CentOS 7
- Quyền root hoặc sudo
- Tối thiểu 2GB RAM, 2 CPU cores
- Domain name đã trỏ về IP VPS (tùy chọn nhưng khuyến nghị)

## Bước 1: Cài đặt Docker và Docker Compose

### 1.1. Cài đặt Docker

```bash
# Cập nhật hệ thống
sudo yum update -y

# Cài đặt các package cần thiết
sudo yum install -y yum-utils device-mapper-persistent-data lvm2

# Thêm Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Cài đặt Docker CE
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Khởi động Docker
sudo systemctl start docker
sudo systemctl enable docker

# Kiểm tra cài đặt
sudo docker --version
```

### 1.2. Cài đặt Docker Compose

```bash
# Docker Compose V2 được cài đặt như một plugin của Docker CLI
# Với Docker CE mới, Docker Compose V2 đã được bao gồm sẵn

# Kiểm tra cài đặt
docker compose version

# Nếu chưa có, cài đặt Docker Compose plugin
sudo yum install -y docker-compose-plugin
```

### 1.3. Cấu hình Docker (tùy chọn)

```bash
# Thêm user vào group docker để không cần sudo
sudo usermod -aG docker $USER

# Logout và login lại để áp dụng thay đổi
```

## Bước 2: Cài đặt Nginx

```bash
# Cài đặt Nginx
sudo yum install -y epel-release
sudo yum install -y nginx

# Khởi động Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Kiểm tra trạng thái
sudo systemctl status nginx
```

## Bước 3: Chuẩn bị ứng dụng

### 3.1. Clone repository

```bash
# Tạo thư mục cho ứng dụng
sudo mkdir -p /var/www/loopai
cd /var/www/loopai

# Clone repository (thay YOUR_REPO_URL bằng URL repo của bạn)
git clone YOUR_REPO_URL .

# Hoặc upload code lên server qua SCP/SFTP
```

### 3.2. Tạo Dockerfile

Tạo file `Dockerfile` trong thư mục gốc của project:

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3345

ENV PORT 3345
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 3.3. Cấu hình Next.js cho standalone output

Cập nhật `next.config.js` (hoặc `next.config.mjs`):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ... các cấu hình khác
}

module.exports = nextConfig
```

### 3.4. Tạo docker-compose.yml

Tạo file `docker-compose.yml` trong thư mục gốc:

```yaml
version: '3.8'

services:
  loopai:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: loopai-app
    restart: unless-stopped
    ports:
      - "3345:3345"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
      - NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST:-https://us.i.posthog.com}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - RESEND_FROM_EMAIL=${RESEND_FROM_EMAIL:-LoopAI <onboarding@resend.dev>}
      - DATABASE_URL=${DATABASE_URL}
    env_file:
      - .env.production
    networks:
      - loopai-network

networks:
  loopai-network:
    driver: bridge
```

### 3.5. Tạo file .env.production

Tạo file `.env.production` trong thư mục gốc:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://postgres:password@your-db-host:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Firecrawl (optional - users can add their own)
FIRECRAWL_API_KEY=your-firecrawl-key

# Resend Email (optional)
RESEND_API_KEY=re_your-resend-key
RESEND_FROM_EMAIL=LoopAI <noreply@yourdomain.com>

# PostHog Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

**Lưu ý bảo mật:**
- Không commit file `.env.production` vào Git
- Sử dụng quyền hạn chế cho file: `chmod 600 .env.production`
- Cân nhắc sử dụng Docker secrets hoặc vault cho production

## Bước 4: Cấu hình Nginx

### 4.1. Tạo cấu hình Nginx

Tạo file `/etc/nginx/conf.d/loopai.conf`:

```nginx
upstream loopai {
    server 127.0.0.1:3345;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (nếu có SSL)
    # return 301 https://$server_name$request_uri;

    # Hoặc phục vụ trực tiếp trên HTTP (không khuyến nghị cho production)
    location / {
        proxy_pass http://loopai;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Tối ưu hóa cho static files
    location /_next/static {
        proxy_pass http://loopai;
        proxy_cache_valid 200 60m;
        add_header Cache-Control "public, immutable";
    }

    # Logging
    access_log /var/log/nginx/loopai-access.log;
    error_log /var/log/nginx/loopai-error.log;
}
```

### 4.2. Kiểm tra và reload Nginx

```bash
# Kiểm tra cấu hình
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Bước 5: Cài đặt SSL với Let's Encrypt (Khuyến nghị)

```bash
# Cài đặt Certbot
sudo yum install -y certbot python3-certbot-nginx

# Lấy chứng chỉ SSL
sudo certbot --nginx -d loopai.tonyx.dev

# Certbot sẽ tự động cập nhật cấu hình Nginx
# Chứng chỉ sẽ tự động gia hạn
```

Sau khi cài SSL, cập nhật lại file Nginx config để redirect HTTP sang HTTPS.

## Bước 6: Build và Deploy ứng dụng

### 6.1. Tạo package-lock.json (nếu chưa có)

```bash
cd /var/www/loopai

# Nếu chưa có package-lock.json, tạo nó bằng cách chạy:
npm install --package-lock-only

# Hoặc nếu đã có node_modules, chỉ cần:
npm install
```

### 6.2. Build Docker image

```bash
cd /var/www/loopai

# Build image
docker compose build

# Hoặc build trực tiếp
docker build -t loopai:latest .
```

### 6.3. Chạy ứng dụng

```bash
# Chạy với docker compose
docker compose up -d

# Kiểm tra logs
docker compose logs -f

# Kiểm tra container đang chạy
docker ps
```

### 6.4. Kiểm tra ứng dụng

```bash
# Kiểm tra từ server
curl http://localhost:3345

# Kiểm tra từ browser
# Truy cập http://yourdomain.com hoặc https://yourdomain.com
```

## Bước 7: Cấu hình Firewall

```bash
# Cài đặt firewalld nếu chưa có
sudo yum install -y firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Mở port HTTP và HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Kiểm tra
sudo firewall-cmd --list-all
```

## Bước 8: Tự động restart và monitoring

### 8.1. Tạo systemd service (tùy chọn)

Tạo file `/etc/systemd/system/loopai.service`:

```ini
[Unit]
Description=LoopAI Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/var/www/loopai
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable loopai

# Start service
sudo systemctl start loopai
```

### 8.2. Setup log rotation

Tạo file `/etc/logrotate.d/loopai`:

```
/var/www/loopai/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    missingok
}
```

## Bước 9: Cập nhật ứng dụng

```bash
cd /var/www/loopai

# Pull code mới nhất
git pull origin main

# Rebuild và restart
docker compose down
docker compose build --no-cache
docker compose up -d

# Xóa images cũ (tùy chọn)
docker image prune -f
```

## Bước 10: Troubleshooting

### Kiểm tra logs

```bash
# Docker logs
docker compose logs -f loopai

# Nginx logs
sudo tail -f /var/log/nginx/loopai-access.log
sudo tail -f /var/log/nginx/loopai-error.log

# System logs
sudo journalctl -u nginx -f
```

### Kiểm tra kết nối

```bash
# Kiểm tra port 3345
sudo netstat -tlnp | grep 3345

# Kiểm tra Nginx
sudo nginx -t
sudo systemctl status nginx

# Kiểm tra Docker
sudo systemctl status docker
docker ps
```

### Restart services

```bash
# Restart Docker container
docker compose restart

# Restart Nginx
sudo systemctl restart nginx

# Restart Docker daemon
sudo systemctl restart docker
```

## Bước 11: Tối ưu hóa Performance

### 11.1. Tối ưu Nginx

Thêm vào file cấu hình Nginx:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

# Caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=loopai_cache:10m max_size=1g inactive=60m use_temp_path=off;
```

### 11.2. Tối ưu Docker

Tạo file `.dockerignore`:

```
node_modules
.next
.git
.env*
*.log
.DS_Store
README.md
```

### 11.3. Resource limits

Cập nhật `docker-compose.yml`:

```yaml
services:
  loopai:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Lưu ý quan trọng

1. **Bảo mật:**
   - Luôn sử dụng HTTPS cho production
   - Không commit file `.env` vào Git
   - Sử dụng strong passwords cho database
   - Cập nhật hệ thống thường xuyên

2. **Backup:**
   - Backup database thường xuyên
   - Backup file `.env.production`
   - Cân nhắc sử dụng automated backup

3. **Monitoring:**
   - Setup monitoring cho server (CPU, RAM, Disk)
   - Monitor Docker container health
   - Setup alerts cho errors

4. **Supabase Edge Functions:**
   - Edge functions cần được deploy riêng trên Supabase
   - Sử dụng Supabase CLI: `supabase functions deploy scout-cron`

## Tài liệu tham khảo

- [Docker Documentation](https://docs.docker.com/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
