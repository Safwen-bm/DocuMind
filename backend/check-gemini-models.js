// Run this from your backend folder:
// node check-gemini-models.js

const API_KEY = "AIzaSyA0f4myY6ie6v6KwZtP5gvaOtKxQMf6LVc";

async function listModels() {
  console.log("\n=== Fetching available Gemini models ===\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
  );
  const data = await res.json();

  if (data.error) {
    console.error("API Error:", data.error);
    return;
  }

  const allModels = data.models || [];
  console.log(`Total models available: ${allModels.length}\n`);

  // Show embedding models specifically
  const embeddingModels = allModels.filter(m =>
    m.supportedGenerationMethods?.includes("embedContent")
  );

  console.log("=== EMBEDDING MODELS (support embedContent) ===");
  if (embeddingModels.length === 0) {
    console.log("❌ NO EMBEDDING MODELS AVAILABLE FOR YOUR KEY/REGION");
  } else {
    embeddingModels.forEach(m => {
      console.log(`✅ ${m.name}`);
      console.log(`   Display: ${m.displayName}`);
      console.log(`   Description: ${m.description}`);
      console.log(`   Methods: ${m.supportedGenerationMethods?.join(", ")}`);
      console.log("");
    });
  }

  console.log("\n=== ALL MODELS (name + methods) ===");
  allModels.forEach(m => {
    console.log(`${m.name} | ${m.supportedGenerationMethods?.join(", ")}`);
  });

  // Also test a direct embedding call with the first embedding model found
  if (embeddingModels.length > 0) {
    const modelName = embeddingModels[0].name; // e.g. "models/text-embedding-004"
    const shortName = modelName.replace("models/", "");
    console.log(`\n=== TESTING DIRECT EMBED CALL with ${shortName} ===`);

    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: "Hello world test" }] },
        }),
      }
    );
    const embedData = await embedRes.json();
    if (embedData.embedding) {
      console.log(`✅ Embedding works! Vector length: ${embedData.embedding.values.length}`);
    } else {
      console.log("❌ Embed call failed:", JSON.stringify(embedData, null, 2));
    }
  }
}

listModels().catch(console.error);