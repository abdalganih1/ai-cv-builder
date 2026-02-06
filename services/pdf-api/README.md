# PDF Text Extractor API - VPS Deployment Guide

## 📋 Overview

This is a self-hosted PDF text extraction API using PyMuPDF (fitz).
It's designed to be deployed on your VPS as a Docker container.

## 🚀 Quick Start

### 1. Clone and Deploy

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Create directory
mkdir -p ~/services/pdf-api
cd ~/services/pdf-api

# Copy files (or use git)
scp -r services/pdf-api/* user@your-vps-ip:~/services/pdf-api/
```

### 2. Configure Environment

```bash
# Create .env file
cp .env.example .env

# Edit and set secure API key
nano .env
# PDF_API_KEY=your-super-secure-key-here
```

### 3. Run with Docker

```bash
# Build and start
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Extract text from PDF
curl -X POST http://localhost:8000/api/extract \
  -H "X-API-Key: your-api-key" \
  -F "file=@test.pdf"
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PDF_API_KEY` | API key for authentication | `change-me-in-production` |

### Ports

| Port | Description |
|------|-------------|
| `8000` | API server |

---

## 🌐 Nginx Reverse Proxy (Optional)

For SSL and domain access:

```nginx
# /etc/nginx/sites-available/pdf-api
server {
    listen 443 ssl;
    server_name pdf.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pdf.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pdf.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }
}
```

---

## 📡 API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{"status": "healthy"}
```

### `POST /api/extract`
Extract text from a PDF file.

**Headers:**
- `X-API-Key`: Your API key

**Body:** `multipart/form-data`
- `file`: PDF file

**Response:**
```json
{
  "success": true,
  "text": "--- صفحة 1 ---\n...",
  "text_length": 7832,
  "images_count": 5,
  "profile_image_base64": "/9j/4AAQ..."
}
```

### `POST /api/extract-base64`
Extract text from base64-encoded PDF.

**Headers:**
- `X-API-Key`: Your API key
- `Content-Type`: application/json

**Body:**
```json
{
  "pdf_base64": "JVBERi0xLjcK..."
}
```

---

## 🔄 Integration with AI CV Builder

In your main application, set these environment variables:

```env
# Point to your VPS API
PDF_API_URL=https://pdf.yourdomain.com/api/extract
PDF_API_KEY=your-api-key
```

The application will automatically use your VPS API instead of OCR.space.

---

## 🐳 CloudPanel Deployment

If using CloudPanel:

1. Create a new Python site
2. Set the domain (e.g., `pdf.yourdomain.com`)
3. SSH into the container
4. Clone/copy your files
5. Build and run with Docker

```bash
# In CloudPanel site directory
cd /home/your-site/htdocs
git clone <repo> pdf-api
cd pdf-api/services/pdf-api
docker-compose up -d --build
```

---

## 🛠️ Troubleshooting

### Container won't start
```bash
docker-compose logs pdf-api
```

### PyMuPDF errors
```bash
# Ensure system dependencies
docker-compose exec pdf-api apt-get update
docker-compose exec pdf-api apt-get install -y libmupdf-dev
```

### Connection refused
```bash
# Check if container is running
docker-compose ps

# Check port binding
netstat -tlnp | grep 8000
```
