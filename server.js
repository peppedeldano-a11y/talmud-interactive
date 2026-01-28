const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Créer les dossiers nécessaires
const uploadsDir = path.join(__dirname, 'uploads');
const audioDir = path.join(uploadsDir, 'audio');
const imageDir = path.join(uploadsDir, 'images');

[uploadsDir, audioDir, imageDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configuration Multer pour l'upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, audioDir);
        } else if (file.mimetype.startsWith('image/')) {
            cb(null, imageDir);
        } else {
            cb(new Error('Type de fichier non supporté'), null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
        const allowedImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        if (allowedAudio.includes(file.mimetype) || allowedImage.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Format non supporté. Audio: mp3, wav, ogg, m4a. Image: jpg, png, gif, webp'));
        }
    }
});

// Routes

// Upload audio
app.post('/upload/audio', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier reçu' });
        }
        
        const fileUrl = `/uploads/audio/${req.file.filename}`;
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload image
app.post('/upload/image', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier reçu' });
        }
        
        const fileUrl = `/uploads/images/${req.file.filename}`;
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir les fichiers uploadés
app.use('/uploads', express.static(uploadsDir));

// Servir les fichiers HTML
app.use(express.static(__dirname));

// Lister les fichiers (pour debug/admin)
app.get('/api/files', (req, res) => {
    try {
        const audioFiles = fs.readdirSync(audioDir).map(f => ({
            name: f,
            type: 'audio',
            url: `/uploads/audio/${f}`,
            size: fs.statSync(path.join(audioDir, f)).size
        }));
        
        const imageFiles = fs.readdirSync(imageDir).map(f => ({
            name: f,
            type: 'image',
            url: `/uploads/images/${f}`,
            size: fs.statSync(path.join(imageDir, f)).size
        }));
        
        res.json({
            audio: audioFiles,
            images: imageFiles,
            total: audioFiles.length + imageFiles.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Supprimer un fichier
app.delete('/api/file', (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL manquante' });
        }
        
        const filePath = path.join(__dirname, url);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'Fichier supprimé' });
        } else {
            res.status(404).json({ error: 'Fichier introuvable' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Serveur Talmud actif' });
});

// Gestion des erreurs
app.use((error, req, res, next) => {
    console.error('Erreur:', error);
    res.status(500).json({ error: error.message });
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🕎 Serveur Talmud Interactif démarré   ║
╠══════════════════════════════════════════╣
║  URL: http://localhost:${PORT}              ║
║  Uploads: ./uploads/                     ║
║  Status: ✓ Prêt                          ║
╚══════════════════════════════════════════╝
    `);
});
