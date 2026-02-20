/**
 * TrendAccom - Static File Server with Upload Support
 *
 * Serves the site from the project root and provides a POST /upload
 * endpoint that saves files into the uploads/ directory.
 *
 * Usage:
 *   npm install
 *   node server.js          (runs on port 3000)
 *   PORT=8080 node server.js
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

/* -------------------------------------------------------
   Ensure the uploads directory exists
-------------------------------------------------------- */
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* -------------------------------------------------------
   Multer storage – preserve original extension
-------------------------------------------------------- */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename(req, file, cb) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const basename = path.basename(file.originalname, ext)
                       .replace(/[^a-z0-9_\-]/gi, '_')
                       .toLowerCase();
    const unique   = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${basename}-${unique}${ext}`);
  }
});

/* Only allow image types */
function imageFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPG, PNG, WebP, GIF, SVG)'));
  }
}

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

/* -------------------------------------------------------
   Serve static files from the project root
   Uploaded images are also served from /uploads/
-------------------------------------------------------- */
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_DIR));

/* -------------------------------------------------------
   POST /upload  – single or multiple files
   Field name: "file" for single, "files" for multiple
   Returns JSON: { success, files: [{ filename, url }] }
-------------------------------------------------------- */
app.post('/upload', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }

  const result = req.files.map(f => ({
    filename: f.filename,
    originalName: f.originalname,
    size: f.size,
    url: `/uploads/${f.filename}`
  }));

  res.json({ success: true, files: result });
});

/* Single-file convenience endpoint (field name: "file") */
app.post('/upload/single', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  res.json({
    success: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`
  });
});

/* -------------------------------------------------------
   DELETE /upload/:filename  – remove an uploaded file
-------------------------------------------------------- */
app.delete('/upload/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filepath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  fs.unlink(filepath, err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not delete file' });
    }
    res.json({ success: true, message: `${filename} deleted` });
  });
});

/* -------------------------------------------------------
   Error handler for multer / general errors
-------------------------------------------------------- */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

/* -------------------------------------------------------
   Start
-------------------------------------------------------- */
app.listen(PORT, () => {
  console.log(`TrendAccom running at http://localhost:${PORT}`);
  console.log(`Uploaded images served from /uploads/`);
});
