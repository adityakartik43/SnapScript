import React, { useRef, useState, useEffect } from "react";
import { FaGoogleDrive, FaDropbox } from "react-icons/fa";
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf'; // Import jsPDF

// --- IMPORTANT ---
// Replace "YOUR_GEMINI_API_KEY" with your actual API key.
const GEMINI_API_KEY = "AIzaSyD9GRxGaIMOt9EeOiFIFONlrM5iEBILyFM"; // <--- REPLACE THIS!
// --- --- --- ---

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const UploadAndGenerate = () => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [, setExtractedText] = useState("");
  const [generatedNotes, setGeneratedNotes] = useState("");

  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // New state for PDF generation
  
  const [errorPdf, setErrorPdf] = useState(null);
  const [errorGemini, setErrorGemini] = useState(null);
  const [errorDownloadPdf, setErrorDownloadPdf] = useState(null); // New error state for PDF download

  const [showDownloadButton, setShowDownloadButton] = useState(false);


  const resetState = () => {
    setSelectedFile(null);
    setFileName("");
    setExtractedText("");
    setGeneratedNotes("");
    setErrorPdf(null);
    setErrorGemini(null);
    setErrorDownloadPdf(null);
    setIsLoadingPdf(false);
    setIsLoadingGemini(false);
    setIsGeneratingPdf(false);
    setShowDownloadButton(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  useEffect(() => {
    // This effect will make the "Download Notes as PDF" button "flash" (appear)
    // once notes are generated and Gemini is no longer loading.
    if (generatedNotes && !isLoadingGemini) {
      setShowDownloadButton(true);
    } else {
      setShowDownloadButton(false);
    }
  }, [generatedNotes, isLoadingGemini]);


  const handleSelectFileClick = () => {
    resetState();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "application/pdf") {
        resetState(); // Reset before setting new file
        setSelectedFile(file);
        setFileName(file.name);
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
    setErrorDownloadPdf(null);
    setShowDownloadButton(false);
    console.log("Processing PDF:", selectedFile.name);

    const reader = new FileReader();

    reader.onload = async (e) => {
      const typedArray = new Uint8Array(e.target.result);
      let currentExtractedText = "";

      try {
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          currentExtractedText += textContent.items.map(item => item.str).join(" ") + "\n\n";
        }
        currentExtractedText = currentExtractedText.trim();
        setExtractedText(currentExtractedText);
        setIsLoadingPdf(false);

        if (currentExtractedText) {
          await generateNotesFromText(currentExtractedText);
        } else {
          setErrorPdf("No text could be extracted from the PDF.");
        }
      } catch (err) {
        setErrorPdf(`Error extracting PDF text: ${err.message}`);
        setIsLoadingPdf(false);
      }
    };
    reader.onerror = () => {
      setErrorPdf("Error reading file.");
      setIsLoadingPdf(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const generateNotesFromText = async (textToProcess) => {
    const promptForGemini = `${textToProcess}\n\n---\n\nMake proper detailed notes of given topic which are provided above. The notes should be well-structured, covering key concepts, definitions, examples if applicable, and main takeaways. Organize them in a way that is easy to read and understand, possibly using headings, bullet points, or numbered lists.`;
    
    setIsLoadingGemini(true);
    setErrorGemini(null);
    setGeneratedNotes("");
    setShowDownloadButton(false);

    try {
      const result = await geminiModel.generateContent(promptForGemini);
      const response = await result.response;
      const notes = response.text();
      setGeneratedNotes(notes);
    } catch (e) {
      let errorMessage = "Failed to get response from Gemini.";
      if (e.message?.includes("API key not valid")) errorMessage = "Gemini API Key is not valid.";
      else if (e.message?.includes("quota")) errorMessage = "Gemini API quota exceeded.";
      setErrorGemini(errorMessage);
    } finally {
      setIsLoadingGemini(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!generatedNotes) {
      setErrorDownloadPdf("No notes available to download.");
      return;
    }
    setIsGeneratingPdf(true);
    setErrorDownloadPdf(null);
    console.log("Generating PDF for download...");

    try {
      const doc = new jsPDF({
        orientation: 'p', // portrait
        unit: 'mm', // millimeters
        format: 'a4' // A4 size
      });

      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15; // mm
      const effectivePageWidth = pageWidth - (margin * 2);
      const lineHeightFactor = 1.5; // Adjust for spacing between lines
      const fontSize = 11;
      const fontLineHeight = (fontSize / doc.internal.scaleFactor) * lineHeightFactor; // calculate line height in mm


      let y = margin;

      // Optional: Add a title to the PDF
      doc.setFontSize(16);
      doc.text("Generated Notes", pageWidth / 2, y, { align: 'center' });
      y += fontLineHeight * 2; // Move down after title

      doc.setFontSize(fontSize);
      
      // Split text into lines that fit the page width
      const lines = doc.splitTextToSize(generatedNotes, effectivePageWidth);

      lines.forEach(line => {
        if (y + fontLineHeight > pageHeight - margin) { // Check if new line exceeds page bottom
          doc.addPage();
          y = margin; // Reset y to top margin on new page
        }
        doc.text(line, margin, y);
        y += fontLineHeight;
      });

      doc.save("generated-notes.pdf");
      console.log("PDF generated and download initiated.");

    } catch (error) {
      console.error("Error generating PDF:", error);
      setErrorDownloadPdf(`Failed to generate PDF: ${error.message}`);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  const isLoading = isLoadingPdf || isLoadingGemini || isGeneratingPdf;

  return (
    <div className="bg-[#23236a] m-10 rounded-2xl shadow-lg p-8 flex flex-col items-center w-full max-w-2xl min-h-[70vh]">
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

        {selectedFile && !generatedNotes && !isLoadingPdf && !isLoadingGemini && (
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
            Cloud storage (not implemented):
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

      {isLoadingPdf && <p className="text-yellow-300 mt-3 animate-pulse">Extracting text from PDF, please wait...</p>}
      {errorPdf && <p className="text-red-400 mt-3">PDF Error: {errorPdf}</p>}

      {isLoadingGemini && <p className="text-yellow-300 mt-3 animate-pulse">Generating notes with AI, this may take a moment...</p>}
      {errorGemini && <p className="text-red-400 mt-3">Gemini Error: {errorGemini}</p>}
      
      {GEMINI_API_KEY === "YOUR_GEMINI_API_KEY" && (
         <p className="mt-4 p-3 bg-yellow-200 text-yellow-800 rounded-md text-sm font-semibold">
            Warning: Please replace "YOUR_GEMINI_API_KEY" in the code with your actual Google Generative AI API Key.
        </p>
      )}

      {generatedNotes && (
        <div className="mt-6 w-full bg-gray-800 p-6 rounded-lg max-h-[40vh] overflow-y-auto">
          <h3 className="text-2xl font-semibold mb-3 text-white">Generated Notes:</h3>
          <pre className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed font-sans">
            {generatedNotes}
          </pre>
        </div>
      )}

      {showDownloadButton && (
        <div className="mt-6">
            <button
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-lg text-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:bg-purple-400"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || !generatedNotes}
            >
                {isGeneratingPdf ? "Generating PDF..." : "Download Notes as PDF"}
            </button>
            {errorDownloadPdf && <p className="text-red-400 mt-2 text-center">{errorDownloadPdf}</p>}
        </div>
      )}
      
      {!isLoading && !fileName && (
          <p className="text-sm text-gray-400 mt-8">
            or drop PDF here (drag & drop not implemented)
          </p>
      )}
      <p className="text-xs text-gray-500 mt-auto pt-4">
        Notes are generated by AI. Please review for accuracy.
      </p>
    </div>
  );
};

export default UploadAndGenerate;