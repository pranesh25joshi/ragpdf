# PDF Chat Frontend

A modern React frontend for the PDF Chat AI Assistant application.

## Features

- 📄 PDF and TXT file upload with drag & drop support
- 💬 Real-time streaming chat with AI assistant
- 🎨 Beautiful dark mode UI with Tailwind CSS
- 📱 Fully responsive design
- 🔄 Job status polling for document processing
- 📋 Recent uploads history

## Prerequisites

- Node.js 16+ installed
- Backend server running on `http://localhost:8000`

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Environment Configuration

The frontend is configured to proxy API requests to `http://localhost:8000`. 

To change the backend URL, modify the `proxy` configuration in `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'YOUR_BACKEND_URL',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

## API Integration

The frontend connects to these backend endpoints:

- `POST /upload` - Upload PDF/TXT files
- `GET /job-status?job_id={id}` - Check upload processing status
- `POST /chat?query={query}&collection_name={name}&top_k={k}` - Stream chat responses

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Axios
- Google Material Symbols Icons
- Spline Sans Font
