// Run this from your backend folder:
// node check-gemini-models.js

// Save as: find-my-models.js
const API_KEY = "AIzaSyA0f4myY6ie6v6KwZtP5gvaOtKxQMf6LVc";

async function findModels() {
    console.log("--- Checking Authorized Gemini Models ---\n");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.error) {
            console.error("Error:", data.error.message);
            return;
        }

        // Filter for models that support "generateContent" (Text/Image generation)
        const genModels = data.models.filter(m => 
            m.supportedGenerationMethods.includes("generateContent")
        );

        console.log(`Found ${genModels.length} compatible models:\n`);
        genModels.forEach(m => {
            const modelId = m.name.replace('models/', '');
            console.log(`> ID: ${modelId}`);
            console.log(`  Display Name: ${m.displayName}`);
            console.log(`  Input Limit: ${m.inputTokenLimit} tokens`);
            console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
            console.log('-------------------------------------------');
        });

    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

findModels();