import React, { useRef, useState, useEffect } from "react";
import { FaGoogleDrive, FaDropbox } from "react-icons/fa";
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';


// --- IMPORTANT ---
// Ensure this API key is correct and valid for the Gemini API via @google/generative-ai
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API;
// --- --- --- ---

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; // Ensure this path is correct

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Using the model name you provided. Ensure it's accessible with your key.
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const UploadAndGenerate = () => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  // removed unused extractedText state
  const [rawGeneratedNotes, setRawGeneratedNotes] = useState("");
  const [displayNotes, setDisplayNotes] = useState("");

  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [errorPdf, setErrorPdf] = useState(null);
  const [errorGemini, setErrorGemini] = useState(null);
  const [errorDownloadPdf, setErrorDownloadPdf] = useState(null);

  const [showDownloadButton, setShowDownloadButton] = useState(false);

  const cleanTextForUIDisplay = (text) => {
    if (!text) return "";
    let cleaned = text;
    cleaned = cleaned.replace(/^#+\s+/gm, ''); 
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); 
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');   
    cleaned = cleaned.replace(/^- /gm, ''); 
    return cleaned;
  };

  const resetState = () => {
    setSelectedFile(null);
    setFileName("");
    setRawGeneratedNotes("");
    setDisplayNotes("");
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
    if (rawGeneratedNotes && !isLoadingGemini) {
      setShowDownloadButton(true);
    } else {
      setShowDownloadButton(false);
    }
  }, [rawGeneratedNotes, isLoadingGemini]);

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
        resetState();
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
    setRawGeneratedNotes("");
    setDisplayNotes("");
    setErrorPdf(null);
    setErrorGemini(null);
    setErrorDownloadPdf(null);
    setShowDownloadButton(false);

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
    // Updated prompt
    const promptForGemini = `${textToProcess}\n\n---\n\nMake proper detailed notes of the topic provided above.
The notes should be well-structured and easy to read.
Please start with a main title for the notes on its own line, formatted like: ## Main Topic Title
Then, cover key concepts, definitions, examples if applicable, and main takeaways.
Organize the content using Markdown-style headings (e.g., ## Section Heading, ### Subtopic), bullet points (e.g., - Point), and bold text for emphasis (e.g., **Important Concept**).`;
    
    setIsLoadingGemini(true);
    setErrorGemini(null);
    setRawGeneratedNotes("");
    setDisplayNotes("");
    setShowDownloadButton(false);

    try {
      const result = await geminiModel.generateContent(promptForGemini);
      const response = await result.response;
      const notes = response.text();
      setRawGeneratedNotes(notes);
      setDisplayNotes(cleanTextForUIDisplay(notes));
    } catch (e) {
      console.error("Gemini API Error:", e);
      let errorMessage = "Failed to get response from Gemini. Check console.";
      if (e.message?.includes("API key not valid")) errorMessage = "Gemini API Key is not valid. Please check your key and ensure it's for the correct Gemini API.";
      else if (e.message?.includes("quota")) errorMessage = "Gemini API quota exceeded.";
      else if (e.message?.includes("fetch failed") || e.message?.includes("NetworkError")) errorMessage = "Network error. Could not reach Gemini API. Check internet connection or CORS setup if running locally without a proxy.";
      else if (e.message?.includes("model") && e.message?.includes("not found")) errorMessage = `Gemini model '${geminiModel.model}' not found or not accessible with your API key. (${e.message})`;
      setErrorGemini(errorMessage);
    } finally {
      setIsLoadingGemini(false);
    }
  };

  const cleanTextForPdfLine = (line) => {
    if (typeof line !== 'string') return "";
    let cleaned = line;
    // Order matters: remove structural markers after identifying structure,
    // but remove emphasis markers before printing the text content.
    cleaned = cleaned.replace(/^#+\s*/, '');       // Remove ##, ### etc. from start
    cleaned = cleaned.replace(/^(-|\*)\s*/, ''); // Remove - or * from start of list items
    
    // Remove emphasis Markdown
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold** -> bold
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');   // *italic* -> italic (if not handled by font style)
    
    return cleaned.trim();
  };

  const handleDownloadPdf = async () => {
    if (!rawGeneratedNotes) {
      setErrorDownloadPdf("No notes available to download.");
      return;
    }
    setIsGeneratingPdf(true);
    setErrorDownloadPdf(null);

    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 15;
      const effectivePageWidth = pageWidth - (margin * 2);
      let y = margin;
      
      doc.setFont("helvetica");

      let documentTitle = "Generated Notes";
      let mainTitlePrinted = false;
      const allLines = rawGeneratedNotes.split('\n');

      // Attempt to find and print the main document title first
      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        if (line.startsWith('## ')) {
          documentTitle = cleanTextForPdfLine(line);
          
          doc.setFontSize(18);
          doc.setFont(undefined, 'bold');
          const titleTextLines = doc.splitTextToSize(documentTitle, effectivePageWidth);
          titleTextLines.forEach(ttl => {
            if (y + (18 / doc.internal.scaleFactor) * 1.5 > pageHeight - margin) { doc.addPage(); y = margin; }
            doc.text(ttl, pageWidth / 2, y, { align: 'center' });
            y += (18 / doc.internal.scaleFactor) * 1.5;
          });
          y += 7; // Extra space after the main title
          allLines.splice(i, 1); // Remove the title line so it's not processed again
          mainTitlePrinted = true;
          break; 
        }
      }
      // Fallback title if no ## line found at the beginning
      if (!mainTitlePrinted) {
        if (fileName) documentTitle = fileName.replace(/\.pdf$/i, '') + " - Notes";
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        const titleTextLines = doc.splitTextToSize(documentTitle, effectivePageWidth);
        titleTextLines.forEach(ttl => {
            if (y + (18 / doc.internal.scaleFactor) * 1.5 > pageHeight - margin) { doc.addPage(); y = margin; }
            doc.text(ttl, pageWidth / 2, y, { align: 'center' });
            y += (18 / doc.internal.scaleFactor) * 1.5;
        });
        y += 7;
      }


      // Process remaining lines for content
      for (const rawLine of allLines) {
        let textToPrint = "";
        let style = 'normal';
        let fontSize = 11;
        let indent = 0;
        let specificLineHeightFactor = 1.4;
        let isHeading = false;

        if (rawLine.startsWith('## ')) {
          textToPrint = cleanTextForPdfLine(rawLine);
          style = 'bold';
          fontSize = 14; // H2
          specificLineHeightFactor = 1.6;
          isHeading = true;
        } else if (rawLine.startsWith('### ')) {
          textToPrint = cleanTextForPdfLine(rawLine);
          style = 'bold'; // Simulating semibold
          fontSize = 12; // H3
          specificLineHeightFactor = 1.5;
          isHeading = true;
        } else if (rawLine.startsWith('#### ')) {
          textToPrint = cleanTextForPdfLine(rawLine);
          style = 'italic'; // H4
          fontSize = 11;
          specificLineHeightFactor = 1.5;
          isHeading = true;
        } else if (rawLine.trim().startsWith('- ') || rawLine.trim().startsWith('* ')) {
          textToPrint = cleanTextForPdfLine(rawLine);
          indent = 5; // Indent list items
        } else {
          textToPrint = cleanTextForPdfLine(rawLine); // Clean all other lines
        }
        
        if (textToPrint.trim() === "" && !isHeading) { // Don't skip if it was a heading line that became empty after cleaning
            if (y + 5 < pageHeight - margin) { y += 5; } 
            if (y >= pageHeight - margin && rawLine !== allLines[allLines.length - 1]) { doc.addPage(); y = margin; }
            continue;
        }
        
        doc.setFontSize(fontSize);
        doc.setFont(undefined, style);

        const fontLineHeight = (fontSize / doc.internal.scaleFactor) * specificLineHeightFactor;
        const splitContentLines = doc.splitTextToSize(textToPrint, effectivePageWidth - indent);

        for (const subLine of splitContentLines) {
            if (y + fontLineHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(subLine, margin + indent, y);
            y += fontLineHeight;
        }
        
        if (isHeading) {
            y += fontLineHeight * 0.2; 
            if (y >= pageHeight - margin && rawLine !== allLines[allLines.length - 1]) { doc.addPage(); y = margin; }
        }
      }
      const pdfFileName = fileName ? `${fileName.replace(/\.pdf$/i, '')}-notes.pdf` : "generated-notes.pdf";
      doc.save(pdfFileName);

    } catch (error) {
      console.error("Error generating PDF:", error);
      setErrorDownloadPdf(`Failed to generate PDF: ${error.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isLoading = isLoadingPdf || isLoadingGemini || isGeneratingPdf;

  return (
    <div className="bg-[#313187] m-10 rounded-2xl shadow-lg p-8 flex flex-col items-center w-full max-w-3xl min-h-[80vh]">
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

        {selectedFile && !rawGeneratedNotes && !isLoadingPdf && !isLoadingGemini && (
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
      {errorGemini && <p className="text-red-400 mt-3 text-center max-w-md">Gemini Error: {errorGemini}</p>}
      
      {GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_PLACEHOLDER" && (
         <p className="mt-4 p-3 bg-yellow-200 text-yellow-800 rounded-md text-sm font-semibold">
            Warning: Please replace the placeholder API key in the code with your actual Google Generative AI API Key.
        </p>
      )}

      {displayNotes && (
        <div className="mt-6 w-full bg-gray-800 p-6 rounded-lg max-h-[45vh] overflow-y-auto shadow-inner">
          <h3 className="text-2xl font-semibold mb-3 text-white bg-gray-800 py-2 z-10">Generated Notes Preview:</h3>
          <pre className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed font-sans">
            {displayNotes}
          </pre>
        </div>
      )}

      {showDownloadButton && (
        <div className="mt-6">
            <button
                className="bg-green-600 hover:bg-purple-700 text-white font-semibold px-8 py-4 rounded-lg text-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:bg-purple-400"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || !rawGeneratedNotes}
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
        Notes are generated by AI. Please review for accuracy. PDF styling applied for common Markdown.
      </p>
    </div>
  );
};

export default UploadAndGenerate;