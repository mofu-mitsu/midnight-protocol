import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Register custom MIME types for VRM 3D assets
express.static.mime.define({
  'model/gltf-binary': ['vrm', 'glb'],
  'application/json': ['gltf']
});

// Favicon handler to prevent 404
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><polygon points="32,4 58,18 58,46 32,60 6,46 6,18" fill="#070b16" stroke="#72f6ff" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="none" stroke="#ff75c8" stroke-width="2" stroke-dasharray="4 2"/><polygon points="32,18 37,32 32,46 27,32" fill="#72f6ff"/><circle cx="32" cy="32" r="3.5" fill="#00ffc2"/></svg>');
});

// Serve static assets from project root
app.use(express.static(__dirname, {
  extensions: ['html', 'htm']
}));

// Route fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
