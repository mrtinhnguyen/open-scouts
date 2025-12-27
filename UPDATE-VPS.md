echo "🔄 Pulling latest code..."
git pull origin main

echo "🏗️  Building new Docker image..."
docker build -t open-scouts .

echo "🔄 Restarting containers..."
docker compose down
docker compose up -d

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Update completed!"
docker compose ps