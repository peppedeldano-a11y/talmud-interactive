const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const app = express();
const PORT = 3000;

// Configuration Cloudinary
cloudinary.config({
    cloud_name: 'dulsajvpb',
    api_key: '681899794284849',
    api_secret: 'oIummUWfggd6auwLJe-phutaPuI'
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuration Multer pour upload en mémoire (pas de stockage local)
const storage = multer.memoryStorage();

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

// Fonction pour uploader vers Cloudinary
const uploadToCloudinary = (buffer, resourceType, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                folder: `talmud/${folder}`,
                transformation: resourceType === 'image' ? [
                    { quality: 'auto', fetch_format: 'auto' }
                ] : []
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

// Routes

// Upload audio vers Cloudinary
app.post('/upload/audio', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier reçu' });
        }
        
        const result = await uploadToCloudinary(req.file.buffer, 'video', 'audio'); // 'video' pour audio dans Cloudinary
        
        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            size: result.bytes
        });
    } catch (error) {
        console.error('Erreur upload audio:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload image vers Cloudinary
app.post('/upload/image', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier reçu' });
        }
        
        const result = await uploadToCloudinary(req.file.buffer, 'image', 'images');
        
        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            size: result.bytes
        });
    } catch (error) {
        console.error('Erreur upload image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Servir les fichiers HTML
app.use(express.static(__dirname));

// Lister les fichiers uploadés sur Cloudinary (pour debug/admin)
app.get('/api/files', async (req, res) => {
    try {
        const audioFiles = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'talmud/audio',
            resource_type: 'video',
            max_results: 100
        });
        
        const imageFiles = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'talmud/images',
            max_results: 100
        });
        
        res.json({
            audio: audioFiles.resources.map(r => ({
                name: r.public_id,
                type: 'audio',
                url: r.secure_url,
                size: r.bytes
            })),
            images: imageFiles.resources.map(r => ({
                name: r.public_id,
                type: 'image',
                url: r.secure_url,
                size: r.bytes
            })),
            total: audioFiles.resources.length + imageFiles.resources.length
        });
    } catch (error) {
        console.error('Erreur listing:', error);
        res.status(500).json({ error: error.message });
    }
});

// Supprimer un fichier de Cloudinary
app.delete('/api/file', async (req, res) => {
    try {
        const { publicId, resourceType } = req.body;
        if (!publicId) {
            return res.status(400).json({ error: 'Public ID manquant' });
        }
        
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
        res.json({ success: true, message: 'Fichier supprimé' });
    } catch (error) {
        console.error('Erreur suppression:', error);
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
