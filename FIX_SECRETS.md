# Hướng dẫn xóa secrets khỏi Git history

GitHub đã phát hiện secrets trong file `.env.production` và chặn push. Cần xóa file này khỏi Git history.

## Bước 1: Xóa file khỏi Git tracking (nhưng giữ lại trên local)

```bash
# Xóa file khỏi Git nhưng giữ lại trên máy local
git rm --cached .env.production

# Commit thay đổi
git commit -m "Remove .env.production from Git tracking"
```

## Bước 2: Xóa file khỏi commit history (nếu đã commit)

Nếu file đã được commit vào history, cần xóa nó khỏi tất cả các commit:

```bash
# Sử dụng git filter-branch hoặc BFG Repo-Cleaner
# Cách 1: Sử dụng git filter-repo (khuyến nghị)
git filter-repo --path .env.production --invert-paths

# Cách 2: Sử dụng git filter-branch (nếu không có filter-repo)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.production" \
  --prune-empty --tag-name-filter cat -- --all
```

## Bước 3: Force push (cẩn thận!)

**CẢNH BÁO:** Chỉ làm điều này nếu bạn chắc chắn và đã backup code!

```bash
# Force push để cập nhật remote repository
git push origin --force --all
git push origin --force --tags
```

## Bước 4: Đảm bảo file không bị commit lại

1. Kiểm tra `.gitignore` đã có `.env.production` chưa
2. Kiểm tra file không còn trong Git:
   ```bash
   git ls-files | grep .env.production
   ```
   Nếu không có output, file đã được xóa thành công.

## Bước 5: Tạo file .env.production.example

Tạo file template không chứa secrets:

```bash
cp .env.production .env.production.example
# Xóa tất cả giá trị thực và thay bằng placeholder
# Sau đó commit file .env.production.example
```

## Lưu ý quan trọng:

1. **Không bao giờ commit file `.env.production`** vào Git
2. **Không hardcode secrets** trong Dockerfile hoặc source code
3. **Sử dụng environment variables** hoặc secrets management
4. **Rotate keys** nếu đã bị expose (tạo keys mới trên Supabase)

## Nếu đã push secrets lên GitHub:

1. **Rotate tất cả keys ngay lập tức:**
   - Tạo Supabase project mới hoặc rotate keys
   - Tạo OpenAI API key mới
   - Tạo các API keys khác nếu cần

2. **Xóa secrets khỏi Git history** (theo hướng dẫn trên)

3. **Sử dụng GitHub Secrets** hoặc environment variables cho CI/CD

## Best Practices:

- Sử dụng `.env.production.example` làm template
- Sử dụng Docker secrets hoặc environment variables
- Sử dụng secret management tools (AWS Secrets Manager, HashiCorp Vault, etc.)
- Không commit bất kỳ file nào chứa secrets
