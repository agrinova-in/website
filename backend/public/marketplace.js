const API_URL = '/api';

/* --- AUTH STATE MANAGEMENT --- */
function getUser() {
    const userStr = localStorage.getItem('agrinova_user');
    return userStr ? JSON.parse(userStr) : null;
}

function getToken() {
    return localStorage.getItem('agrinova_token');
}

function logout() {
    localStorage.removeItem('agrinova_token');
    localStorage.removeItem('agrinova_user');
    window.location.href = 'index.html';
}

function updateNav() {
    const user = getUser();
    const navActions = document.querySelector('.nav-actions');
    
    if (!navActions) return; 
    
    if (user) {
        // Find existing nav-links or create a user info area
        const userActions = document.createElement('div');
        userActions.className = 'user-actions hide-mobile';
        userActions.style.display = 'flex';
        userActions.style.alignItems = 'center';
        userActions.innerHTML = `
            <div class="user-badge" style="margin-right: 1.2rem; max-width: 180px;">
                <span class="user-name-label" style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</span>
                <span class="user-role-label">${user.role}</span>
            </div>
            <button class="btn btn-outline" style="padding: 6px 14px; font-size: 0.9rem; flex-shrink: 0;" onclick="logout()">Logout</button>
        `;
        
        // Remove the default "Get Started" login button
        const loginBtn = navActions.querySelector('a[href="auth.html"]');
        if (loginBtn) loginBtn.style.display = 'none';

        // Add user actions if not already there
        if (!navActions.querySelector('.user-actions')) {
            navActions.prepend(userActions);
        }
        
        // Show farmer dashboard if they are a farmer
        if (user.role === 'farmer') {
            const panel = document.getElementById('farmer-panel');
            if (panel) panel.style.display = 'block';
        }
    }
}

/* --- AUTH PAGE LOGIC --- */
function toggleAuth(type) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const panel = document.querySelector('.auth-form-panel');

    if (type === 'register') {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'flex';
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabRegister) tabRegister.classList.add('active');
    } else {
        if (registerForm) registerForm.style.display = 'none';
        if (loginForm) loginForm.style.display = 'flex';
        if (tabRegister) tabRegister.classList.remove('active');
        if (tabLogin) tabLogin.classList.add('active');
    }

    // Always scroll back to top so tabs are never hidden
    if (panel) panel.scrollTop = 0;
}


// Login Submit
const loginFormEl = document.getElementById('login-form');
if (loginFormEl) {
    loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const err = document.getElementById('login-error');
        
        btn.innerText = 'Logging in...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Login failed');
            
            localStorage.setItem('agrinova_token', data.token);
            localStorage.setItem('agrinova_user', JSON.stringify(data.user));
            window.location.href = 'marketplace.html';
        } catch (error) {
            err.innerText = error.message;
        } finally {
            btn.innerText = 'Login';
            btn.disabled = false;
        }
    });
}

// Register Submit
const registerFormEl = document.getElementById('register-form');
if (registerFormEl) {
    registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('reg-name').value,
            email: document.getElementById('reg-email').value,
            phone: document.getElementById('reg-phone').value,
            password: document.getElementById('reg-password').value,
            role: document.getElementById('reg-role').value
        };
        const btn = document.getElementById('reg-btn');
        const err = document.getElementById('reg-error');
        
        btn.innerText = 'Registering...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            
            alert('Registration successful! Please login.');
            toggleAuth('login');
        } catch (error) {
            err.innerText = error.message;
        } finally {
            btn.innerText = 'Create Account';
            btn.disabled = false;
        }
    });
}

/* --- MARKETPLACE LOGIC --- */
function initMarketplace() {
    updateNav();
    fetchProducts();

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal() {
    document.getElementById('crop-modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeModal() {
    const overlay = document.getElementById('crop-modal-overlay');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('add-product-form').reset();
}

// Close only if click is directly on the dark overlay, not the modal box
function handleOverlayClick(e) {
    if (e.target === document.getElementById('crop-modal-overlay')) closeModal();
}

// Keep backward-compat alias (used inline in old markup — no longer needed but safe)
function toggleAddProductForm() { openModal(); }


// Add Product Handle
const addProductForm = document.getElementById('add-product-form');
if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerText = 'Publishing...';
        btn.disabled = true;
        
        const formData = new FormData();
        formData.append('name', document.getElementById('p-name').value);
        formData.append('price', document.getElementById('p-price').value);
        formData.append('quantity', document.getElementById('p-qty').value);
        formData.append('location', document.getElementById('p-location').value);
        formData.append('image', document.getElementById('p-image').files[0]);

        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to add product');
            
            closeModal();
            fetchProducts();
        } catch (error) {
            alert(error.message);
        } finally {
            btn.innerText = 'Publish Listing';
            btn.disabled = false;
        }
    });
}

let allProducts = [];
let _searchTimer = null;

// Debounced search — waits 300ms after user stops typing before hitting the API
function debouncedSearch() {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
        const query = document.getElementById('search-input').value;
        fetchProducts(query);
    }, 300);
}

// Keep alias for any other callers
function searchProducts() {
    const query = document.getElementById('search-input').value;
    fetchProducts(query);
}

async function fetchProducts(query = '') {
    const statusDiv = document.getElementById('product-status');
    const grid = document.getElementById('products-grid');
    if (!statusDiv) return;

    // Show a subtle loading state WITHOUT wiping the current grid
    statusDiv.style.display = 'block';
    statusDiv.innerText = 'Searching...';

    try {
        const res = await fetch(`${API_URL}/products?q=${encodeURIComponent(query)}`);
        const products = await res.json();
        
        if (!res.ok) throw new Error('Failed to load products');
        allProducts = products;
        
        // Only now clear and re-render
        grid.innerHTML = '';

        if (products.length === 0) {
            statusDiv.innerText = query ? 'No crops found matching your search.' : 'No crops available in the market right now.';
            return;
        }
        
        statusDiv.style.display = 'none';
        renderProducts(products);
    } catch (error) {
        statusDiv.innerText = 'Error loading products. Make sure the backend server is running.';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    const user = getUser();

    products.forEach(p => {
        const isOwner = user && user.id === p.farmer_id;
        // Clean phone number for WhatsApp (remove any non-digits)
        const waNumber = p.farmer_phone ? p.farmer_phone.replace(/\D/g, '') : '';
        const waUrl = `https://wa.me/${waNumber}?text=Hi%20${encodeURIComponent(p.farmer_name)},%20I'm%20interested%20in%20your%20${encodeURIComponent(p.name)}%20listing%20on%20AgriNova.`;

        const card = document.createElement('div');
        card.className = 'p-card';
        card.innerHTML = `
            <div class="p-img-container">
                <span class="p-tag">${p.quantity} kg</span>
                <img src="${p.image}" alt="${p.name}" class="p-img">
            </div>
            <div class="p-details">
                <h3 class="p-name">${p.name}</h3>
                <div class="p-price-row">
                    <span class="p-price">₹${p.price} <span style="font-size:0.9rem;color:#718096">/ kg</span></span>
                </div>
                <div class="p-meta">
                    <div>📍 ${p.location}</div>
                    <div>👨‍🌾 ${p.farmer_name}</div>
                </div>
                
                ${isOwner ? `
                    <button class="btn btn-danger" style="width:100%" onclick="deleteProduct(${p.id})">Delete Your Listing</button>
                ` : `
                    <a href="${waUrl}" target="_blank" class="btn btn-whatsapp">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        Contact via WhatsApp
                    </a>
                `}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
        const res = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        if (!res.ok) throw new Error('Failed to delete product');
        fetchProducts(); // refresh
    } catch (error) {
        alert(error.message);
    }
}
