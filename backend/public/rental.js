document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('rental-booking-form');
    const bSize = document.getElementById('b-size');
    const bPricingModel = document.getElementById('b-pricing-model');
    const estPriceSpan = document.getElementById('est-price');

    // Phone number from footer/requirements
    const AGRINOVA_PHONE = '916261475021';

    // Pricing Constants
    const PRICE_PER_ACRE = 500;
    const PRICE_PER_HOUR = 300;

    // Estimate Calculator
    function calculateEstimate() {
        const size = parseFloat(bSize.value);
        const model = bPricingModel.value;

        if (isNaN(size) || size <= 0) {
            estPriceSpan.textContent = '₹0';
            return;
        }

        let total = 0;
        if (model.includes('Per Acre')) {
            total = size * PRICE_PER_ACRE;
        } else if (model.includes('Hourly')) {
            // Rough estimation: assuming 1 Hour covers roughly 1 Acre for simplicity in MVP
            total = size * PRICE_PER_HOUR;
        }

        // Format to Indian Rupees loosely
        estPriceSpan.textContent = `₹${total.toLocaleString('en-IN')}`;
    }

    // Attach listeners for live calculation
    bSize.addEventListener('input', calculateEstimate);
    bPricingModel.addEventListener('change', calculateEstimate);

    // Form Submission (WhatsApp Redirect)
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent standard form submission

        // Gather data
        const service = document.getElementById('b-service').value;
        const size = document.getElementById('b-size').value;
        const model = document.getElementById('b-pricing-model').value;
        const crop = document.getElementById('b-crop').value;
        const date = document.getElementById('b-date').value;
        const location = document.getElementById('b-location').value;
        const notes = document.getElementById('b-notes').value;
        const estimatedCost = estPriceSpan.textContent;

        // Construct formatting for WhatsApp
        let message = `*AgriNova Smart Service Booking*\n\n`;
        message += `Hi! I would like to book a service with the following details:\n\n`;
        message += `*Service:* ${service}\n`;
        message += `*Field Size:* ${size} Acres\n`;
        message += `*Crop Type:* ${crop}\n`;
        message += `*Pricing:* ${model}\n`;
        message += `*Preferred Date:* ${date}\n`;
        message += `*Location:* ${location}\n`;

        if (notes.trim() !== '') {
            message += `*Notes:* ${notes}\n`;
        }

        message += `\n*Estimated Cost:* ${estimatedCost}\n\n`;
        message += `Please confirm my booking.`;

        // URL Encode the message
        const encodedMessage = encodeURIComponent(message);

        // Open WhatsApp in a new tab
        const whatsappUrl = `https://wa.me/${AGRINOVA_PHONE}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    });
});
