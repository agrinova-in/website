const fs = require('fs');

async function test() {
    try {
        const formData = new FormData();
        const fileContent = fs.readFileSync('package.json');
        
        // Use a standard fetch since node v18+ supports it globally
        const blob = new Blob([fileContent], { type: 'application/json' });
        formData.append('image', blob, 'package.json');
        
        const response = await fetch('http://localhost:5000/api/predict-disease', {
            method: 'POST',
            body: formData
        });
        
        const text = await response.text();
        console.log("STATUS:", response.status);
        console.log("RESPONSE:", text.substring(0, 200));
    } catch(err) {
        console.error(err);
    }
}
test();
