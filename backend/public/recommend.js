/* --- AgriNova Smart Recommendation Logic --- */

const recommendForm = document.getElementById('recommend-form');
const aiScanning = document.getElementById('ai-scanning');
const resultsPanel = document.getElementById('results-panel');
const gridContainer = document.querySelector('.recommend-grid');
const recommendationsContainer = document.getElementById('recommendations-container');

// Form Submission
recommendForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Collect Data
    const formData = {
        n: parseFloat(document.getElementById('n').value),
        p: parseFloat(document.getElementById('p').value),
        k: parseFloat(document.getElementById('k').value),
        ph: parseFloat(document.getElementById('ph').value),
        temp: parseFloat(document.getElementById('temp').value) || null,
        humidity: parseFloat(document.getElementById('humidity').value) || null,
        rainfall: parseFloat(document.getElementById('rainfall').value) || null
    };

    // 2. Show Scanning UI
    aiScanning.style.display = 'flex';
    resultsPanel.style.display = 'none';
    gridContainer.classList.remove('active-result');

    try {
        // 3. Call Backend API
        const response = await fetch('/api/recommend-crops', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to get recommendations.');
        }

        // 4. Render Results
        renderRecommendations(data.recommendations);
        
        // 5. Success UI Update
        aiScanning.style.display = 'none';
        resultsPanel.style.display = 'flex';
        
        // On desktop, activate side-by-side view
        if (window.innerWidth >= 1000) {
            gridContainer.classList.add('active-result');
        }

        // Scroll to results on mobile
        if (window.innerWidth < 1000) {
            resultsPanel.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (error) {
        console.error("Recommendation Error:", error);
        alert(`Error: ${error.message}`);
        aiScanning.style.display = 'none';
    }
});

function renderRecommendations(recommendations) {
    recommendationsContainer.innerHTML = '';

    recommendations.forEach((item, index) => {
        const cropCard = document.createElement('div');
        cropCard.className = 'crop-card';
        cropCard.style.animationDelay = `${index * 0.1}s`;

        const tipsHTML = item.growthTips.map(tip => `<span class="tip-pill">${tip}</span>`).join('');

        cropCard.innerHTML = `
            <div class="crop-header">
                <h3>${item.cropName}</h3>
                <div class="suitability-wrap">
                    <div class="suitability-score">${item.suitabilityScore}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            <p class="crop-reasoning">${item.reasoning}</p>
            <div class="growth-tips">
                ${tipsHTML}
            </div>
        `;

        recommendationsContainer.appendChild(cropCard);

        // Animate the progress bar width after insertion
        setTimeout(() => {
            const fill = cropCard.querySelector('.progress-fill');
            if (fill) fill.style.width = `${item.suitabilityScore}%`;
        }, 100);
    });
}

function resetForm() {
    recommendForm.reset();
    resultsPanel.style.display = 'none';
    gridContainer.classList.remove('active-result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Window Resize Handling
window.addEventListener('resize', () => {
    if (resultsPanel.style.display === 'flex') {
        if (window.innerWidth >= 1000) {
            gridContainer.classList.add('active-result');
        } else {
            gridContainer.classList.remove('active-result');
        }
    }
});
