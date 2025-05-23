import React, { useRef, useState } from "react";
import { FaGoogleDrive, FaDropbox } from "react-icons/fa";
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- IMPORTANT ---
// Replace "YOUR_GEMINI_API_KEY" with your actual API key.
// For development, you can hardcode it here, but for production,
// use environment variables or a backend proxy.
const GEMINI_API_KEY = "AIzaSyD9GRxGaIMOt9EeOiFIFONlrM5iEBILyFM"; // <--- REPLACE THIS!
// --- --- --- ---

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; // Ensure this path is correct for your setup

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or "gemini-1.5-flash-latest" etc.

const UploadAndGenerate = () => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [generatedNotes, setGeneratedNotes] = useState("");

  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [errorPdf, setErrorPdf] = useState(null);
  const [errorGemini, setErrorGemini] = useState(null);

  const resetState = () => {
    setSelectedFile(null);
    setFileName("");
    setExtractedText("");
    setGeneratedNotes("");
    setErrorPdf(null);
    setErrorGemini(null);
    setIsLoadingPdf(false);
    setIsLoadingGemini(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleSelectFileClick = () => {
    resetState(); // Reset everything when changing/selecting a new file
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        console.log("Selected file:", file.name);
        setSelectedFile(file);
        setFileName(file.name);
        setExtractedText(""); // Clear previous extracted text
        setGeneratedNotes(""); // Clear previous notes
        setErrorPdf(null);
        setErrorGemini(null);
      } else {
        resetState();
        setErrorPdf("Please select a valid PDF file.");
        alert("Please select a valid PDF file.");
      }
    }
  };

  const handleProcessAndGenerate = async () => {
    if (!selectedFile) {
      alert("Please select a PDF file first.");
      return;
    }

    setIsLoadingPdf(true);
    setExtractedText("");
    setGeneratedNotes("");
    setErrorPdf(null);
    setErrorGemini(null);
    console.log("Processing PDF:", selectedFile.name);

    const reader = new FileReader();

    reader.onload = async (e) => {
      const typedArray = new Uint8Array(e.target.result);
      let currentExtractedText = "";

      try {
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        console.log("PDF loaded. Number of pages:", pdf.numPages);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(" ");
          currentExtractedText += pageText + "\n\n";
        }

        currentExtractedText = currentExtractedText.trim();
        setExtractedText(currentExtractedText);
        console.log("\n\n--- Full Extracted Text ---");
        console.log(currentExtractedText);
        
        setIsLoadingPdf(false); // PDF processing done

        if (currentExtractedText) {
          await generateNotesFromText(currentExtractedText);
        } else {
          setErrorPdf("No text could be extracted from the PDF.");
          alert("No text could be extracted from the PDF.");
        }

      } catch (err) {
        console.error("Error extracting PDF text:", err);
        setErrorPdf(`Error extracting PDF text: ${err.message}`);
        alert(`Error extracting PDF text. See console for details.`);
        setIsLoadingPdf(false);
      }
    };

    reader.onerror = (err) => {
      console.error("Error reading file:", err);
      setErrorPdf("Error reading file.");
      alert("Error reading file.");
      setIsLoadingPdf(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const generateNotesFromText = async (textToProcess) => {
    if (!textToProcess) {
      setErrorGemini("No text provided to generate notes from.");
      return;
    }

    const promptForGemini = textToProcess + "\n\n---\n\nMake proper detailed notes of given topic which are provided above. The notes should be well-structured, covering key concepts, definitions, examples if applicable, and main takeaways. Organize them in a way that is easy to read and understand, possibly using headings, bullet points, or numbered lists.";

    setIsLoadingGemini(true);
    setErrorGemini(null);
    setGeneratedNotes("");
    console.log(`Sending prompt to Gemini (length: ${promptForGemini.length})`);

    try {
      const result = await geminiModel.generateContent(promptForGemini);
      const response = await result.response;
      const notes = response.text();

      console.log("--- Gemini Response ---");
      console.log(notes);
      console.log("-----------------------");
      setGeneratedNotes(notes);

    } catch (e) {
      console.error("Error calling Gemini API:", e);
      let errorMessage = "Failed to get response from Gemini. Check the console for details.";
      if (e.message && e.message.includes("API key not valid")) {
        errorMessage = "Gemini API Key is not valid. Please check your API_KEY.";
      } else if (e.message && e.message.includes("quota")) {
        errorMessage = "You have exceeded your Gemini API quota. Please check your Google Cloud Console.";
      }
      setErrorGemini(errorMessage);
      alert(errorMessage);
    } finally {
      setIsLoadingGemini(false);
    }
  };

  const isLoading = isLoadingPdf || isLoadingGemini;

  return (
    <div className="bg-[#23236a] m-10 rounded-2xl shadow-lg p-8 flex flex-col items-center w-full max-w-2xl">
      <h1 className="text-4xl font-bold mb-2 text-white">Get Your Notes</h1>
      <p className="text-lg text-gray-300 mb-6 text-center max-w-xl">
        Upload your syllabus PDF to generate smart notes using AI.
      </p>

      <div className="flex items-center space-x-3 mb-4">
        <button
          className="bg-red-600 hover:bg-red-700 cursor-pointer text-white font-semibold px-6 py-3 rounded-lg text-lg disabled:opacity-50"
          onClick={handleSelectFileClick}
          disabled={isLoading}
        >
          {fileName ? "Change Syllabus PDF" : "Select Syllabus PDF"}
        </button>

        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={isLoading}
        />

        {selectedFile && !extractedText && !generatedNotes && (
          <button
            className="bg-green-600 hover:bg-green-700 cursor-pointer text-white font-semibold px-6 py-3 rounded-lg text-lg disabled:opacity-50"
            onClick={handleProcessAndGenerate}
            disabled={isLoading || !selectedFile}
          >
            Process & Generate Notes
          </button>
        )}
      </div>
      
      <div className="flex items-center space-x-3 mb-4">
         <p className="text-sm text-gray-400">
            Or use cloud storage (not implemented):
        </p>
        <button className="bg-blue-500 hover:bg-blue-600 cursor-pointer p-3 rounded-full text-white" title="Upload from Google Drive (Not Implemented)" disabled>
            <FaGoogleDrive />
        </button>
        <button className="bg-blue-400 hover:bg-blue-500 cursor-pointer p-3 rounded-full text-white" title="Upload from Dropbox (Not Implemented)" disabled>
            <FaDropbox />
        </button>
      </div>


      {fileName && (
        <p className="text-sm text-gray-300 mt-3">
          Selected File: <span className="font-semibold">{fileName}</span>
        </p>
      )}

      {isLoadingPdf && <p className="text-yellow-300 mt-3">Extracting text from PDF, please wait...</p>}
      {errorPdf && <p className="text-red-400 mt-3">PDF Error: {errorPdf}</p>}

      {isLoadingGemini && <p className="text-yellow-300 mt-3">Generating notes with AI, this may take a moment...</p>}
      {errorGemini && <p className="text-red-400 mt-3">Gemini Error: {errorGemini}</p>}
      
      {GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" && (
         <p className="mt-4 p-3 bg-yellow-200 text-yellow-800 rounded-md text-sm font-semibold">
            Warning: Please replace "YOUR_GEMINI_API_KEY" in the code with your actual Google Generative AI API Key.
        </p>
      )}

      {generatedNotes && (
        <div className="mt-6 w-full bg-gray-800 p-6 rounded-lg">
          <h3 className="text-2xl font-semibold mb-3 text-white">Generated Notes:</h3>
          <pre className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed font-sans">
            {generatedNotes}
          </pre>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6">
        Note: PDF text extraction and AI generation happen in your browser. For large files or complex requests, it might take some time.
      </p>
    </div>
  );
};

export default UploadAndGenerate;