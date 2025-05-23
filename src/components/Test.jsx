import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- IMPORTANT ---
// Replace "YOUR_GEMINI_API_KEY" with your actual API key.
// For development, you can hardcode it here, but for production,
// use environment variables or a backend proxy.
const API_KEY = "AIzaSyD9GRxGaIMOt9EeOiFIFONlrM5iEBILyFM";
// --- --- --- ---

const genAI = new GoogleGenerativeAI(API_KEY);

function Test() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (event) => {
    setPrompt(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    const promptAdded = prompt.trim() + " Make proper detailed notes of given topic which are provided";

    setIsLoading(true);
    setError(null);
    console.log(`Sending prompt to Gemini: "${prompt}"`);

    try {
      // For text-only input, use the gemini-pro model
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent(promptAdded);
      const response = await result.response;
      const text = response.text();

      console.log("--- Gemini Response ---");
      console.log(text);
      console.log("-----------------------");
      // You could also set this text to a state variable to display it in the UI
      // setGeneratedText(text);

    } catch (e) {
      console.error("Error calling Gemini API:", e);
      setError("Failed to get response from Gemini. Check the console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white rounded-lg shadow-lg font-sans">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Gemini API Prompt</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={handleInputChange}
          placeholder="Enter your prompt here..."
          rows="5"
          className="w-full mb-4 p-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:bg-gray-100"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors duration-200 ${
            isLoading
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Generating...' : 'Generate Text & Print to Console'}
        </button>
      </form>
      {error && (
        <p className="text-red-600 mt-4 font-medium">Error: {error}</p>
      )}
      <p className="mt-6 italic text-gray-600">
        Generated text will be printed to your browser&apos;s developer console.
      </p>
      <p className="mt-4 text-orange-600 font-bold">
        Warning: API Key is embedded in client-side code. This is insecure for production.
      </p>
    </div>
  );
}

export default Test;