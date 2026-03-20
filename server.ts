import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { put, del } from '@vercel/blob';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { filename } = req.body;
      const blob = await put(filename || req.file.originalname, req.file.buffer, {
        access: 'private',
        contentType: 'application/pdf',
        addRandomSuffix: true,
      });

      res.json(blob);
    } catch (error: any) {
      console.error('Error uploading to Vercel Blob:', error);
      res.status(500).json({ error: error.message || 'Failed to upload to Vercel Blob' });
    }
  });

  app.post('/api/delete-pdf', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
      }

      await del(url);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting from Vercel Blob:', error);
      res.status(500).json({ error: error.message || 'Failed to delete from Vercel Blob' });
    }
  });

  app.get('/api/proxy-pdf', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'No URL provided' });
      }

      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        console.error('BLOB_READ_WRITE_TOKEN is not set');
        return res.status(500).json({ error: 'Server configuration error: Missing blob token' });
      }

      console.log(`Proxying PDF from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch blob: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error('Error proxying PDF:', error);
      res.status(500).json({ error: error.message || 'Failed to proxy PDF' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
