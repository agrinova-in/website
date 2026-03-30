require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

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

// --- AI PLANT DISEASE PREDICTION ROUTE ---
app.post('/api/predict-disease', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const mimeType = req.file.mimetype;
    const imagePath = req.file.path;
    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // Option B: Real AI if API Key exists
        if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

            const prompt = "Act as an expert agricultural botanist. Analyze this plant leaf image. Identify any disease, pest, or deficiency. If it is healthy, state 'Healthy'. Return ONLY a strictly valid JSON object with absolutely NO markdown wrapping or formatting. The JSON object must have exactly these keys: { \"diseaseName\": \"string\", \"confidence\": a float number between 0 and 1, \"treatment\": [\"array of string actionable advice points\"] }";

            const imageParts = [
                {
                    inlineData: {
                        data: fs.readFileSync(imagePath).toString("base64"),
                        mimeType
                    }
                }
            ];

            const result = await model.generateContent([prompt, ...imageParts]);
            const responseText = result.response.text();

            // Extract JSON from potential markdown blocks if AI ignored instructions
            let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(jsonStr);

            return res.json(aiData);
        }

        // Option A: Simulated AI (Fallback if no API key is set)
        console.log("⚠️ No GEMINI_API_KEY found in .env. Running Simulated AI Demo mode.");
        setTimeout(() => {
            const mockDiseases = [
                { name: "Tomato Early Blight", confidence: 0.94, treatment: ["Remove affected leaves immediately", "Apply a copper-based fungicide", "Ensure proper spacing for air circulation"] },
                { name: "Wheat Leaf Rust", confidence: 0.88, treatment: ["Use disease-resistant varieties next season", "Apply systemic fungicides within 7 days", "Monitor adjacent fields"] },
                { name: "Healthy Plant", confidence: 0.99, treatment: ["Continue regular watering schedule", "Maintain current nutrient balance"] }
            ];
            const randomPick = mockDiseases[Math.floor(Math.random() * mockDiseases.length)];
            res.json({
                diseaseName: randomPick.name,
                confidence: randomPick.confidence,
                treatment: randomPick.treatment
            });
        }, 2500); // 2.5s simulated delay

    } catch (err) {
        console.error("AI Error:", err);
        res.status(500).json({ error: 'Failed to analyze the image using AI.' });
    }
});

// --- SMART CROP RECOMMENDATION ROUTE ---
app.post('/api/recommend-crops', async (req, res) => {
    const { n, p, k, ph, temp, humidity, rainfall } = req.body;

    // Basic validation
    if (n === undefined || p === undefined || k === undefined || ph === undefined) {
        return res.status(400).json({ error: 'Soil parameters (N, P, K, pH) are required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

            const prompt = `Act as an expert agronomist advisor. Based on the following soil and environmental data:
            - Nitrogen (N): ${n}
            - Phosphorus (P): ${p}
            - Potassium (K): ${k}
            - Soil pH: ${ph}
            - Temperature: ${temp || 'Average'} °C
            - Humidity: ${humidity || 'Average'} %
            - Rainfall: ${rainfall || 'Average'} mm

            Recommend the top 3 most suitable crops for these conditions. 
            Return ONLY a strictly valid JSON object with absolutely NO markdown wrapping.
            The JSON must follow this exact structure:
            {
              "recommendations": [
                {
                  "cropName": "string",
                  "suitabilityScore": number (0-100),
                  "reasoning": "string (brief but expert)",
                  "growthTips": ["string advice 1", "string advice 2"]
                }
              ]
            }`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(jsonStr);
            return res.json(aiData);
        }

        // Option A: Simulated AI Fallback
        console.log("⚠️ No GEMINI_API_KEY found. Running Crop Recommendation in Demo mode.");
        setTimeout(() => {
            res.json({
                recommendations: [
                    {
                        cropName: "Maize (Corn)",
                        suitabilityScore: 92,
                        reasoning: "The soil has high nitrogen content and ideal pH for cereal crops.",
                        growthTips: ["Ensure consistent irrigation during the silking stage", "Monitor for corn borers"]
                    },
                    {
                        cropName: "Soybeans",
                        suitabilityScore: 85,
                        reasoning: "Phosphorus levels are optimal for nitrogen-fixing legumes.",
                        growthTips: ["Inoculate seeds with Rhizobium", "Maintain weed control early on"]
                    },
                    {
                        cropName: "Cotton",
                        suitabilityScore: 78,
                        reasoning: "Potassium levels and rainfall patterns suggest moderate success for fiber crops.",
                        growthTips: ["Apply boron if deficiency is noted", "Manage plant height with regulators"]
                    }
                ]
            });
        }, 2000);

    } catch (err) {
        console.error("Crop Recommendation Error:", err);
        res.status(500).json({ error: 'Failed to process crop recommendations.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AgriNova Backend API running on http://localhost:${PORT}`);
});
