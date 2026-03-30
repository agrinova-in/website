require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-agrinova';

// --- Database & Storage Initialization ---

// Neon Postgres Client
const sql = neon(process.env.DATABASE_URL);

// Cloudinary Configuration (Uses CLOUDINARY_URL from .env)
cloudinary.config({ secure: true });

// Multer Storage for Marketplace (Persistent Cloudinary Storage)
const productStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'agrinova/products',
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 800, height: 600, crop: 'limit' }],
        use_filename: true,
        unique_filename: true,
    },
});

// Multer Storage for AI Scanner (Stateless Memory Storage)
const memoryStorage = multer.memoryStorage();

const upload = multer({ storage: productStorage });
const scannerUpload = multer({ storage: memoryStorage });

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Database Schema Initialization (Postgres)
(async () => {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('farmer', 'buyer')),
                phone TEXT NOT NULL
            );
        `;
        await sql`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                quantity TEXT NOT NULL,
                location TEXT NOT NULL,
                image TEXT NOT NULL,
                farmer_id INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Neon Postgres Database initialized.");
    } catch (err) {
        console.error("Database initialization error:", err);
    }
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
        await sql`
            INSERT INTO users (name, email, password, role, phone) 
            VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${phone})
        `;
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (err) {
        if (err.message && err.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Email already exists.' });
        }
        console.error("Registration error:", err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
        const user = rows[0];

        if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password.' });

        const token = jwt.sign({
            id: user.id,
            role: user.role,
            name: user.name,
            phone: user.phone
        }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
    } catch (err) {
        console.error("Login error:", err);
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
    const image = req.file ? req.file.path : null; // Cloudinary URL

    if (!name || !price || !quantity || !location || !image) {
        return res.status(400).json({ error: 'All fields including an image are required.' });
    }

    try {
        await sql`
            INSERT INTO products (name, price, quantity, location, image, farmer_id) 
            VALUES (${name}, ${price}, ${quantity}, ${location}, ${image}, ${req.user.id})
        `;
        res.status(201).json({ message: 'Product added successfully!' });
    } catch (err) {
        console.error("Add product error:", err);
        res.status(500).json({ error: 'Server error while adding product.' });
    }
});

// Get All Products (For Buyers/Browsing)
app.get('/api/products', async (req, res) => {
    try {
        const q = req.query.q || '';
        const searchPattern = `%${q}%`;

        const products = await sql`
            SELECT p.id, p.name, p.price::float as price, p.quantity, p.location, p.image, p.farmer_id, p.created_at, u.name as farmer_name, u.phone as farmer_phone 
            FROM products p 
            JOIN users u ON p.farmer_id = u.id 
            WHERE p.name ILIKE ${searchPattern} OR p.location ILIKE ${searchPattern}
            ORDER BY p.created_at DESC
        `;
        res.json(products);
    } catch (err) {
        console.error("Fetch products error:", err);
        res.status(500).json({ error: 'Server error while fetching products.' });
    }
});

// Get My Products (For Farmer Dashboard)
app.get('/api/products/me', authenticateToken, async (req, res) => {
    if (req.user.role !== 'farmer') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        const products = await sql`SELECT id, name, price::float as price, quantity, location, image, farmer_id, created_at FROM products WHERE farmer_id = ${req.user.id} ORDER BY created_at DESC`;
        res.json(products);
    } catch (err) {
        console.error("Fetch my products error:", err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// Delete Product (Farmers Only)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'farmer') return res.status(403).json({ error: 'Unauthorized.' });

    try {
        const result = await sql`
            DELETE FROM products 
            WHERE id = ${req.params.id} AND farmer_id = ${req.user.id} 
            RETURNING id
        `;
        if (result.length === 0) return res.status(404).json({ error: 'Product not found or unauthorized.' });
        res.json({ message: 'Product deleted.' });
    } catch (err) {
        console.error("Delete product error:", err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// --- AI PLANT DISEASE PREDICTION ROUTE (Stateless) ---
app.post('/api/predict-disease', scannerUpload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (apiKey) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

            const prompt = "Act as an expert agricultural botanist. Analyze this plant leaf image. Identify any disease, pest, or deficiency. If it is healthy, state 'Healthy'. Return ONLY a strictly valid JSON object with absolutely NO markdown wrapping or formatting. The JSON object must have exactly these keys: { \"diseaseName\": \"string\", \"confidence\": a float number between 0 and 1, \"treatment\": [\"array of string actionable advice points\"] }";

            const imagePart = {
                inlineData: {
                    data: req.file.buffer.toString("base64"),
                    mimeType: req.file.mimetype
                }
            };

            const result = await model.generateContent([prompt, imagePart]);
            const responseText = result.response.text();

            let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(jsonStr);

            return res.json(aiData);
        }

        // Fallback for Demo Mode
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
        console.error("AI Prediction Error:", err);
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
