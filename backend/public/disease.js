const dragArea = document.getElementById('drag-area');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const btnReupload = document.getElementById('btn-reupload');
const btnAnalyze = document.getElementById('btn-analyze');
const aiScanning = document.getElementById('ai-scanning');
const resultsPanel = document.getElementById('results-panel');
const gridContainer = document.querySelector('.disease-grid');

let uploadedFile = null;

// --- Drag & Drop Logic ---
dragArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', function() {
    file = this.files[0];
    showPreview(file);
});

// Drag over logic
dragArea.addEventListener('dragover', (event) => {
    event.preventDefault();
    dragArea.classList.add('active');
    dragArea.querySelector('h3').textContent = "Release to Upload File";
});

// Drag leave
dragArea.addEventListener('dragleave', () => {
    dragArea.classList.remove('active');
    dragArea.querySelector('h3').textContent = "Drag & Drop to Upload";
});

// Drop logic
dragArea.addEventListener('drop', (event) => {
    event.preventDefault();
    dragArea.classList.remove('active');
    dragArea.querySelector('h3').textContent = "Drag & Drop to Upload";
    
    file = event.dataTransfer.files[0];
    showPreview(file);
});

function showPreview(file) {
    if (!file) return;
    
    let fileType = file.type;
    let validExtensions = ["image/jpeg", "image/jpg", "image/png"];
    
    if (validExtensions.includes(fileType)) {
        uploadedFile = file;
        let fileReader = new FileReader(); // reading the file object
        fileReader.onload = () => {
            let fileURL = fileReader.result;
            imagePreview.src = fileURL;
            dragArea.style.display = 'none';
            previewContainer.style.display = 'block';
        }
        fileReader.readAsDataURL(file);
    } else {
        alert("This is not an Image File! Please upload a valid JPG/PNG leaf photo.");
        dragArea.classList.remove('active');
    }
}

// Re-upload logic
btnReupload.addEventListener('click', () => {
    uploadedFile = null;
    fileInput.value = ""; // clear input
    previewContainer.style.display = 'none';
    dragArea.style.display = 'block';
    resultsPanel.style.display = 'none';
    gridContainer.classList.remove('active-result');
});

// --- API Integration Logic ---
btnAnalyze.addEventListener('click', async () => {
    if (!uploadedFile) {
        alert("Please upload an image first.");
        return;
    }

    // 1. Show scanning animation
    aiScanning.style.display = 'flex';
    resultsPanel.style.display = 'none';

    // 2. Prepare data
    const formData = new FormData();
    formData.append('image', uploadedFile);

    try {
        // 3. Send to Node backend API
        const response = await fetch('http://localhost:5000/api/predict-disease', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Failed to analyze image.");
        }

        // 4. Hide scanning and show results
        aiScanning.style.display = 'none';
        displayResults(result);

    } catch (error) {
        console.error("AI Prediction Error:", error);
        alert(`AI Error: ${error.message} \n\nCheck if your backend server is running and API keys are set up correctly.`);
        aiScanning.style.display = 'none';
    }
});

function displayResults(data) {
    // Reveal second column in grid
    gridContainer.classList.add('active-result');
    resultsPanel.style.display = 'flex';
    
    // Inject Data
    document.getElementById('res-disease').textContent = data.diseaseName;
    
    const confidencePercent = Math.round(data.confidence * 100);
    document.getElementById('res-confidence-text').textContent = confidencePercent + "%";
    
    // Animate width
    setTimeout(() => {
        document.getElementById('res-confidence').style.width = confidencePercent + "%";
    }, 100);

    // Format Treatment Points
    const treatmentListHTML = data.treatment.map(point => `<li>${point}</li>`).join('');
    document.getElementById('res-treatment').innerHTML = `<ul>${treatmentListHTML}</ul>`;
}
