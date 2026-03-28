const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'super-secret-key-agrinova';

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Serve uploaded images statically
app.use('/uploads', express.static(uploadDir));

// Multer Storage Setup for Local Images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database initialization
let db;
(async () => {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Create Tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('farmer', 'buyer')),
            phone TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            quantity TEXT NOT NULL,
            location TEXT NOT NULL,
            image TEXT NOT NULL,
            farmer_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(farmer_id) REFERENCES users(id)
        );
    `);
    console.log("SQLite Database initialized.");
})();

// JWT Verification Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

/* --- AUTHENTICATION ROUTES --- */

// Register Route
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role || !phone) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.run(
            `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, role, phone]
        );
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists.' });
        }
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
        if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: 'Server error during login.' });
    }
});

/* --- PRODUCT ROUTES --- */

// Add Product (Farmers Only)
app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    if (req.user.role !== 'farmer') {
        return res.status(403).json({ error: 'Only farmers can add products.' });
    }

    const { name, price, quantity, location } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !price || !quantity || !location || !image) {
        return res.status(400).json({ error: 'All fields including an image are required.' });
    }

    try {
        const result = await db.run(
            `INSERT INTO products (name, price, quantity, location, image, farmer_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, price, quantity, location, image, req.user.id]
        );
        res.status(201).json({ message: 'Product added successfully!', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server error while adding product.' });
    }
});

// Get All Products (For Buyers/Browsing)
app.get('/api/products', async (req, res) => {
    try {
        // We do a JOIN to get the farmer's name and phone number for WhatsApp contact
        const q = req.query.q || '';
        let query = `
            SELECT p.*, u.name as farmer_name, u.phone as farmer_phone 
            FROM products p 
            JOIN users u ON p.farmer_id = u.id 
            WHERE p.name LIKE ? OR p.location LIKE ?
            ORDER BY p.created_at DESC
        `;
        const products = await db.all(query, [`%${q}%`, `%${q}%`]);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error while fetching products.' });
    }
});

// Get My Products (For Farmer Dashboard)
app.get('/api/products/me', authenticateToken, async (req, res) => {
    if (req.user.role !== 'farmer') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        const products = await db.all(`SELECT * FROM products WHERE farmer_id = ? ORDER BY created_at DESC`, [req.user.id]);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Delete Product (Farmers Only)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'farmer') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        // Prevent deleting someone else's product
        const result = await db.run(`DELETE FROM products WHERE id = ? AND farmer_id = ?`, [req.params.id, req.user.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Product not found or unauthorized.' });
        res.json({ message: 'Product deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AgriNova Backend API running on http://localhost:${PORT}`);
});
