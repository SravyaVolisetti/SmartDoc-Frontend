

import { useEffect, useRef, useState } from "react";

import "./App.css";



const API_BASE = "http://localhost:8080";



// Browser storage for converted files

function openHistoryDB(ownerEmail) {

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(`SmartDocFiles-${encodeURIComponent(ownerEmail.toLowerCase())}`, 1);



    request.onupgradeneeded = () => {

      const db = request.result;

      if (!db.objectStoreNames.contains("files")) {

        db.createObjectStore("files", { keyPath: "id" });

      }

    };



    request.onsuccess = () => resolve(request.result);

    request.onerror = () => reject(request.error);

  });

}



async function saveHistoryFile(ownerEmail, id, blob) {

  const db = await openHistoryDB(ownerEmail);



  return new Promise((resolve, reject) => {

    const transaction = db.transaction("files", "readwrite");

    transaction.objectStore("files").put({ id, blob });



    transaction.oncomplete = () => {

      db.close();

      resolve();

    };



    transaction.onerror = () => {

      db.close();

      reject(transaction.error);

    };

  });

}



async function getHistoryFile(ownerEmail, id) {

  const db = await openHistoryDB(ownerEmail);



  return new Promise((resolve, reject) => {

    const request = db

      .transaction("files", "readonly")

      .objectStore("files")

      .get(id);



    request.onsuccess = () => {

      db.close();

      resolve(request.result?.blob || null);

    };



    request.onerror = () => {

      db.close();

      reject(request.error);

    };

  });

}



// NEW: Delete a converted file from browser storage

async function deleteHistoryFile(ownerEmail, id) {

  const db = await openHistoryDB(ownerEmail);



  return new Promise((resolve, reject) => {

    const transaction = db.transaction("files", "readwrite");

    transaction.objectStore("files").delete(id);



    transaction.oncomplete = () => {

      db.close();

      resolve();

    };



    transaction.onerror = () => {

      db.close();

      reject(transaction.error);

    };

  });

}



const FORMATS = ["PDF", "DOCX", "TXT", "JPG", "PNG", "WEBP"];



const ALLOWED_EXTENSIONS = [

  "pdf",

  "docx",

  "txt",

  "jpg",

  "jpeg",

  "png",

  "webp",

];



const IMAGE_FORMATS = ["JPG", "PNG", "WEBP"];



function App() {

  const [file, setFile] = useState(null);

  const [format, setFormat] = useState("PDF");

  const [message, setMessage] = useState("");

  const [isConverting, setIsConverting] = useState(false);

  const [isAiBusy, setIsAiBusy] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const [activePage, setActivePage] = useState("Overview");



  const [convertedFile, setConvertedFile] = useState(null);

  const [reviewText, setReviewText] = useState("");

  const [reviewReady, setReviewReady] = useState(false);

  const [reviewMessage, setReviewMessage] = useState("");



  const [userEmail, setUserEmail] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsMessage, setDocumentsMessage] = useState("");



  const [darkMode, setDarkMode] = useState(

    () => localStorage.getItem("smartdoc-theme") === "dark"

  );



  const [isDragging, setIsDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");



  const fileInputRef = useRef(null);

  const converterRef = useRef(null);

  const reviewRef = useRef(null);



  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setUserEmail(String(data.email || "").trim().toLowerCase());
      })
      .catch((error) => {
        console.error("Could not identify the signed-in user:", error);
        if (!cancelled) setDocumentsMessage("Could not verify your account. Please sign out and sign in again.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    try {
      const saved = localStorage.getItem(`smartdoc-history:${userEmail}`) || "[]";
      setRecentFiles(JSON.parse(saved));
    } catch (error) {
      console.error("Could not load this account's history:", error);
      setRecentFiles([]);
    } finally {
      setHistoryLoaded(true);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || !historyLoaded) return;
    try {
      localStorage.setItem(`smartdoc-history:${userEmail}`, JSON.stringify(recentFiles));
    } catch (error) {
      console.error("Could not save history:", error);
    }
  }, [recentFiles, userEmail, historyLoaded]);

  async function refreshDocuments() {
    try {
      const response = await fetch(`${API_BASE}/api/documents`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.text()) || `Could not load documents (${response.status}).`);
      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
      setDocumentsMessage("");
    } catch (error) {
      console.error("Could not load documents:", error);
      setDocumentsMessage(error.message || "Could not load your documents.");
    }
  }

  useEffect(() => {
    if (userEmail) refreshDocuments();
  }, [userEmail]);



  useEffect(() => {

    localStorage.setItem(

      "smartdoc-theme",

      darkMode ? "dark" : "light"

    );

  }, [darkMode]);



  function navigateTo(page) {

    setActivePage(page);

    setSearchQuery("");



    if (page === "Convert files") {

      window.requestAnimationFrame(() => {

        converterRef.current?.scrollIntoView({

          behavior: "smooth",

          block: "start",

        });

      });

    }

  }



  function startNewConversion() {

    setFile(null);

    setFormat("PDF");

    setMessage("");

    setConvertedFile(null);

    setReviewText("");

    setReviewReady(false);

    setReviewMessage("");

    setActivePage("Convert files");



    window.setTimeout(() => {

      converterRef.current?.scrollIntoView({

        behavior: "smooth",

        block: "start",

      });

    }, 50);

  }



  function selectFile(selectedFile) {

    if (!selectedFile) return;



    const extension = selectedFile.name

      .split(".")

      .pop()

      .toLowerCase();



    if (!ALLOWED_EXTENSIONS.includes(extension)) {

      setMessage("This file type is not supported.");

      return;

    }



    setFile(selectedFile);

    setMessage("");

    setConvertedFile(null);

    setReviewText("");

    setReviewReady(false);

    setReviewMessage("");

  }



  function handleFileChange(event) {

    selectFile(event.target.files?.[0] || null);

    event.target.value = "";

  }



  async function getCsrfToken() {

    const response = await fetch(

      `${API_BASE}/api/auth/csrf`,

      {

        method: "GET",

        credentials: "include",

      }

    );



    if (!response.ok) {

      throw new Error(

        `Could not get security token (${response.status}). Please log in again.`

      );

    }



    const csrfCookie = document.cookie

      .split("; ")

      .find((cookie) => cookie.startsWith("XSRF-TOKEN="));



    if (csrfCookie) {

      return decodeURIComponent(

        csrfCookie.substring("XSRF-TOKEN=".length)

      );

    }



    const contentType =

      response.headers.get("content-type") || "";



    if (contentType.includes("application/json")) {

      const data = await response.json();



      if (data.token) return data.token;

      if (data.csrfToken) return data.csrfToken;

    }



    throw new Error(

      "CSRF token not found. Please check the backend security configuration."

    );

  }



  function getConversionEndpoint(extension, outputFormat) {

    const imageFormats = ["jpg", "jpeg", "png", "webp"];



    if (extension === "txt" && outputFormat === "pdf") {

      return "txt-to-pdf";

    }



    if (extension === "pdf" && outputFormat === "txt") {

      return "pdf-to-txt";

    }



    if (extension === "pdf" && outputFormat === "docx") {

      return "pdf-to-docx";

    }



    if (extension === "docx" && outputFormat === "pdf") {

      return "docx-to-pdf";

    }



    if (extension === "docx" && outputFormat === "txt") {

      return "docx-to-txt";

    }



    if (extension === "txt" && outputFormat === "docx") {

      return "txt-to-docx";

    }



    if (

      imageFormats.includes(extension) &&

      outputFormat === "pdf"

    ) {

      return "image-to-pdf";

    }



    if (

      imageFormats.includes(extension) &&

      ["jpg", "png", "webp"].includes(outputFormat)

    ) {

      const inputFormat =

        extension === "jpeg" ? "jpg" : extension;



      if (inputFormat === outputFormat) return null;



      return "image-format";

    }



    return undefined;

  }



  function getOutputName(outputFormat) {

    const names = {

      PDF: "converted-document.pdf",

      DOCX: "converted-document.docx",

      TXT: "converted-document.txt",

      JPG: "converted-image.jpg",

      PNG: "converted-image.png",

      WEBP: "converted-image.webp",

    };



    return names[outputFormat] || "converted-document";

  }



  function downloadBlob(blob, filename) {

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");



    link.href = url;

    link.download = filename;



    document.body.appendChild(link);

    link.click();

    link.remove();



    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  }



  function addHistory(originalName, outputFormat, convertedBlob) {
    if (!userEmail || !historyLoaded) {
      setMessage("Your account is still loading. Please try again in a moment.");
      return;
    }

    const item = {

      id: `${Date.now()}-${Math.random()

        .toString(36)

        .slice(2, 8)}`,

      name: originalName,

      output: outputFormat,

      time: new Date().toLocaleString([], {

        dateStyle: "medium",

        timeStyle: "short",

      }),

      status: "Completed",

    };



    saveHistoryFile(userEmail, item.id, convertedBlob).catch((error) => {

      console.error("Could not save converted file:", error);

    });



    setRecentFiles((previous) => [item, ...previous]);

  }



  async function handleHistoryDownload(item) {
    if (item.source === "document") {
      try {
        const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(item.id)}/download`, { credentials: "include" });
        if (!response.ok) throw new Error((await response.text()) || "Could not download this document.");
        downloadBlob(await response.blob(), item.name || "document");
      } catch (error) {
        console.error("Document download failed:", error);
        window.alert(error.message || "Could not download this document.");
      }
      return;
    }

    try {
      const savedBlob = await getHistoryFile(userEmail, item.id);
      if (!savedBlob) {
        window.alert("This file was converted before download history was added. Please convert it again.");
        return;
      }
      const originalName = item.name || "converted-file";
      const baseName = originalName.includes(".") ? originalName.slice(0, originalName.lastIndexOf(".")) : originalName;
      const extension = (item.output || "pdf").toLowerCase();
      downloadBlob(savedBlob, `${baseName}.${extension}`);
    } catch (error) {
      console.error("History download failed:", error);
      window.alert("Could not download this file. Please try again.");
    }
  }

  // NEW: Delete the selected conversion

  async function handleHistoryDelete(item) {
    const confirmed = window.confirm(
      item.source === "document"
        ? `Are you sure you want to delete "${item.name}" from your documents?`
        : `Are you sure you want to remove "${item.name}" from this account's conversion history?`
    );
    if (!confirmed) return;

    try {
      if (item.source === "document") {
        const csrfToken = await getCsrfToken();
        const response = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(item.id)}`, {
          method: "DELETE",
          credentials: "include",
          headers: { "X-XSRF-TOKEN": csrfToken },
        });
        if (!response.ok && response.status !== 204) {
          throw new Error((await response.text()) || "Could not delete this document.");
        }
        await refreshDocuments();
        return;
      }
      setRecentFiles((previous) => previous.filter((fileItem) => fileItem.id !== item.id));
      if (item.id) await deleteHistoryFile(userEmail, item.id);
    } catch (error) {
      console.error("Could not delete item:", error);
      window.alert(error.message || "Could not delete this item. Please try again.");
    }
  }

  async function handleConvert() {

    if (isConverting || isSaving) return;



    if (!file) {

      setMessage("Please choose a file before converting.");

      return;

    }



    const extension = file.name

      .split(".")

      .pop()

      .toLowerCase();



    const outputFormat = format.toLowerCase();

    const endpoint = getConversionEndpoint(

      extension,

      outputFormat

    );



    if (endpoint === undefined) {

      setMessage(

        `Conversion from ${extension.toUpperCase()} to ${format} is not supported.`

      );

      return;

    }



    if (endpoint === null) {

      setMessage("Your file is already in that format.");

      return;

    }



    setIsConverting(true);

    setMessage("Preparing your file...");

    setConvertedFile(null);

    setReviewText("");

    setReviewReady(false);

    setReviewMessage("");



    try {

      const csrfToken = await getCsrfToken();

      const formData = new FormData();



      formData.append("file", file);

      setMessage("Uploading your file...");



      const uploadResponse = await fetch(

        `${API_BASE}/api/documents/upload`,

        {

          method: "POST",

          credentials: "include",

          headers: {

            "X-XSRF-TOKEN": csrfToken,

          },

          body: formData,

        }

      );



      if (!uploadResponse.ok) {

        throw new Error(

          (await uploadResponse.text()) ||

            `Upload failed (${uploadResponse.status}).`

        );

      }



      const uploadedDocument = await uploadResponse.json();
      await refreshDocuments();



      if (!uploadedDocument.id) {

        throw new Error(

          "The server did not return a document ID."

        );

      }



      const conversionUrl =

        endpoint === "image-format"

          ? `${API_BASE}/api/convert/image-format/${encodeURIComponent(

              uploadedDocument.id

            )}?format=${encodeURIComponent(outputFormat)}`

          : `${API_BASE}/api/convert/${endpoint}/${encodeURIComponent(

              uploadedDocument.id

            )}`;



      setMessage("Converting your file...");



      const conversionResponse = await fetch(conversionUrl, {

        method: "POST",

        credentials: "include",

        headers: {

          "X-XSRF-TOKEN": csrfToken,

        },

      });



      if (!conversionResponse.ok) {

        throw new Error(

          (await conversionResponse.text()) ||

            `Conversion failed (${conversionResponse.status}).`

        );

      }



      const blob = await conversionResponse.blob();
      await refreshDocuments();

      const outputName = getOutputName(format);



      const resultFile = new File([blob], outputName, {

        type: blob.type || "application/octet-stream",

      });



      setConvertedFile(resultFile);

      addHistory(file.name, format, resultFile);



      if (IMAGE_FORMATS.includes(format)) {

        setReviewReady(true);

        setReviewMessage(

          "Image conversion is complete. You can download the converted image. AI text editing is available for PDF, DOCX, and TXT files."

        );

        setMessage(

          "Conversion complete. Review your result below."

        );



        window.setTimeout(() => {

          reviewRef.current?.scrollIntoView({

            behavior: "smooth",

            block: "start",

          });

        }, 100);



        return;

      }



      if (format === "TXT") {

        setReviewText(await blob.text());

        setReviewReady(true);

        setReviewMessage(

          "Conversion complete. Review or edit the text below."

        );

        setMessage(

          "Conversion complete. Review your result below."

        );

      } else {

        setReviewReady(false);

        setReviewMessage(

          "Your converted file is ready. Use AI Format Text to extract and prepare its content for review."

        );

        setMessage(

          "Conversion complete. Your file is ready for AI review."

        );

      }



      window.setTimeout(() => {

        reviewRef.current?.scrollIntoView({

          behavior: "smooth",

          block: "start",

        });

      }, 100);

    } catch (error) {

      console.error("SmartDoc conversion error:", error);

      setMessage(error.message || "Conversion failed.");

    } finally {

      setIsConverting(false);

    }

  }



  async function handleAiAction(action) {

    if (isAiBusy || !convertedFile) return;



    if (IMAGE_FORMATS.includes(format)) {

      setReviewMessage(

        "AI text editing is not available for image files in this workflow."

      );

      return;

    }



    setIsAiBusy(true);

    setReviewMessage("Sending the converted file to local AI...");



    try {

      const csrfToken = await getCsrfToken();

      const formData = new FormData();



      formData.append("file", convertedFile);



      const response = await fetch(

        `${API_BASE}/api/ai/${action}`,

        {

          method: "POST",

          credentials: "include",

          headers: {

            "X-XSRF-TOKEN": csrfToken,

          },

          body: formData,

        }

      );



      if (!response.ok) {

        throw new Error(

          (await response.text()) ||

            `AI request failed (${response.status}).`

        );

      }



      const data = await response.json();



      if (!data.text) {

        throw new Error("The AI did not return any text.");

      }



      setReviewText(data.text);

      setReviewReady(true);

      setReviewMessage(

        "AI review is complete. You can edit the content below before saving."

      );

    } catch (error) {

      console.error("SmartDoc AI error:", error);

      setReviewMessage(

        error.message || "AI review failed. Please try again."

      );

    } finally {

      setIsAiBusy(false);

    }

  }



  async function handleSaveAndDownload() {

    if (!convertedFile || isSaving || isAiBusy) return;



    if (IMAGE_FORMATS.includes(format)) {

      downloadBlob(convertedFile, convertedFile.name);

      setReviewMessage("Converted image downloaded.");

      return;

    }



    if (!reviewReady) {

      setReviewMessage(

        "Please prepare the content for review using AI Format Text first."

      );

      return;

    }



    setIsSaving(true);

    setReviewMessage("Preparing your final file...");



    try {

      if (format === "TXT") {

        const finalBlob = new Blob([reviewText], {

          type: "text/plain;charset=utf-8",

        });



        downloadBlob(finalBlob, "final-document.txt");

        setReviewMessage(

          "Your final TXT file has been downloaded."

        );

        return;

      }



      if (format !== "PDF" && format !== "DOCX") {

        throw new Error(

          "Saving edited text is currently supported for PDF, DOCX, and TXT."

        );

      }



      const csrfToken = await getCsrfToken();



      const editedTextFile = new File(

        [reviewText],

        "edited-document.txt",

        { type: "text/plain" }

      );



      const formData = new FormData();

      formData.append("file", editedTextFile);



      const uploadResponse = await fetch(

        `${API_BASE}/api/documents/upload`,

        {

          method: "POST",

          credentials: "include",

          headers: {

            "X-XSRF-TOKEN": csrfToken,

          },

          body: formData,

        }

      );



      if (!uploadResponse.ok) {

        throw new Error(

          (await uploadResponse.text()) ||

            `Final file upload failed (${uploadResponse.status}).`

        );

      }



      const uploadedDocument = await uploadResponse.json();
      await refreshDocuments();



      if (!uploadedDocument.id) {

        throw new Error("Could not prepare the final file.");

      }



      const finalEndpoint =

        format === "PDF" ? "txt-to-pdf" : "txt-to-docx";



      const finalResponse = await fetch(

        `${API_BASE}/api/convert/${finalEndpoint}/${encodeURIComponent(

          uploadedDocument.id

        )}`,

        {

          method: "POST",

          credentials: "include",

          headers: {

            "X-XSRF-TOKEN": csrfToken,

          },

        }

      );



      if (!finalResponse.ok) {

        throw new Error(

          (await finalResponse.text()) ||

            `Could not create the final ${format} file.`

        );

      }



      const finalBlob = await finalResponse.blob();



      const finalName =

        format === "PDF"

          ? "final-document.pdf"

          : "final-document.docx";



      downloadBlob(finalBlob, finalName);



      setReviewMessage(

        `Your edited ${format} file has been saved and downloaded.`

      );

    } catch (error) {

      console.error("SmartDoc save error:", error);

      setReviewMessage(

        error.message || "Could not save the final file."

      );

    } finally {

      setIsSaving(false);

    }

  }



  const navItems = [

    { name: "Overview", icon: "◫" },

    { name: "Convert files", icon: "⇄" },

    { name: "My documents", icon: "▤" },

    { name: "Conversion history", icon: "◷" },

  ];



  const filteredFiles = recentFiles.filter((item) =>

    item.name.toLowerCase().includes(searchQuery.toLowerCase())

  );

  const filteredDocuments = documents
    .map((doc) => ({
      ...doc,
      source: "document",
      name: doc.fileName || "Untitled document",
      output: doc.fileType || "—",
      time: "—",
      status: doc.status || "Uploaded",
    }))
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));



  return (

    <div className={`app-shell ${darkMode ? "dark-mode" : ""}`}>

      <aside className="sidebar">

        <a

          className="brand"

          href="#overview"

          onClick={(event) => {

            event.preventDefault();

            navigateTo("Overview");

          }}

        >

          <span className="brand-mark">{(userEmail || "S").charAt(0).toUpperCase()}</span>

          <span>

            Smart<span className="brand-light">Doc</span>

          </span>

        </a>



        <div className="workspace-label">WORKSPACE</div>



        <nav className="side-nav" aria-label="Main navigation">

          {navItems.map((item) => (

            <button

              key={item.name}

              type="button"

              className={`nav-item ${

                activePage === item.name ? "active" : ""

              }`}

              onClick={() => navigateTo(item.name)}

            >

              <span className="nav-icon">{item.icon}</span>

              {item.name}

              {item.name === "Conversion history" && (

                <span className="nav-count">

                  {recentFiles.length}

                </span>

              )}

            </button>

          ))}

        </nav>



        <div className="sidebar-bottom">

          <div className="help-card">

            <span className="help-icon">✳</span>

            <strong>Need a hand?</strong>

            <p>Your document workspace, made simple.</p>

          </div>



          <div className="profile">

            <div className="avatar">S</div>

            <div className="profile-copy">

              <strong>{userEmail || "My Workspace"}</strong>

              <span>Personal account</span>

            </div>

            <span className="profile-more">···</span>

          </div>

        </div>

      </aside>



      <main className="main-panel">

        <header className="topbar">

          <div className="breadcrumbs">

            <span>Workspace</span>

            <span className="breadcrumb-slash">/</span>

            <strong>{activePage}</strong>

          </div>



          <div className="topbar-right">

            <button

              className="theme-toggle"

              type="button"

              onClick={() =>

                setDarkMode((previous) => !previous)

              }

            >

              {darkMode ? "☀️ Light mode" : "🌙 Dark mode"}

            </button>



            <span className="system-status">

              <span className="status-dot" />

              System operational

            </span>



            <div className="top-avatar">S</div>

          </div>

        </header>



        <div className="page-content">

          <section className="welcome-row">

            <div>

              <div className="eyebrow">

                YOUR DOCUMENT WORKSPACE

              </div>



              <h1>

                {activePage === "Overview"

                  ? "Welcome to SmartDoc 👋"

                  : activePage}

              </h1>



              <p>

                Convert your files, review them with AI, edit, save,

                and download.

              </p>

            </div>



            <button

              type="button"

              className="primary-button header-button"

              onClick={startNewConversion}

            >

              ＋ New conversion

            </button>

          </section>



          <section className="stats-grid">

            <article className="stat-card">

              <div className="stat-top">

                <span>Files processed</span>

                <span className="stat-icon green">▤</span>

              </div>

              <strong className="stat-number">

                {recentFiles.length}

              </strong>

              <span className="stat-note">Saved conversions</span>

            </article>



            <article className="stat-card">

              <div className="stat-top">

                <span>Conversions</span>

                <span className="stat-icon purple">⇄</span>

              </div>

              <strong className="stat-number">

                {

                  recentFiles.filter(

                    (item) => item.status === "Completed"

                  ).length

                }

              </strong>

              <span className="stat-note">

                Completed conversions

              </span>

            </article>



            <article className="stat-card">

              <div className="stat-top">

                <span>Available formats</span>

                <span className="stat-icon orange">◈</span>

              </div>

              <strong className="stat-number">6</strong>

              <span className="stat-note">

                PDF, DOCX, TXT &amp; images

              </span>

            </article>



            <article className="stat-card">

              <div className="stat-top">

                <span>Workspace status</span>

                <span className="stat-icon blue">✓</span>

              </div>

              <strong className="stat-number stat-ready">

                Ready

              </strong>

              <span className="stat-note">

                Ready to convert files

              </span>

            </article>

          </section>



          {(activePage === "Overview" ||

            activePage === "Convert files") && (

            <>

              <section

                className="converter-card"

                id="converter"

                ref={converterRef}

              >

                <div className="section-heading">

                  <div>

                    <div className="section-kicker">STEP 1</div>

                    <h2>Convert a file</h2>

                    <p>

                      Choose a file and the format you need. Your file

                      will be sent for review instead of downloading

                      immediately.

                    </p>

                  </div>

                  <span className="secure-badge">

                    Simple &amp; secure

                  </span>

                </div>



                <div

                  className={`drop-zone ${file ? "has-file" : ""} ${

                    isDragging ? "is-dragging" : ""

                  }`}

                  onDragEnter={(event) => {

                    event.preventDefault();

                    setIsDragging(true);

                  }}

                  onDragOver={(event) => event.preventDefault()}

                  onDragLeave={(event) => {

                    if (

                      !event.currentTarget.contains(

                        event.relatedTarget

                      )

                    ) {

                      setIsDragging(false);

                    }

                  }}

                  onDrop={(event) => {

                    event.preventDefault();

                    setIsDragging(false);

                    selectFile(

                      event.dataTransfer.files?.[0] || null

                    );

                  }}

                  onClick={() => fileInputRef.current?.click()}

                  role="button"

                  tabIndex={0}

                  onKeyDown={(event) => {

                    if (

                      event.key === "Enter" ||

                      event.key === " "

                    ) {

                      event.preventDefault();

                      fileInputRef.current?.click();

                    }

                  }}

                >

                  <input

                    ref={fileInputRef}

                    type="file"

                    accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"

                    onChange={handleFileChange}

                    onClick={(event) => event.stopPropagation()}

                    style={{ display: "none" }}

                  />



                  <span className="upload-art">

                    {file ? "✓" : "↑"}

                  </span>



                  <strong>

                    {file

                      ? file.name

                      : "Drag and drop your file here"}

                  </strong>



                  <span className="upload-subtext">

                    {file

                      ? `${(file.size / 1024).toFixed(1)} KB · Ready to convert`

                      : "or click to browse files on your computer"}

                  </span>



                  {!file && (

                    <span className="browse-button">

                      Browse files

                    </span>

                  )}



                  {file && (

                    <button

                      type="button"

                      className="text-button"

                      onClick={(event) => {

                        event.stopPropagation();

                        setFile(null);

                        setMessage("");

                        setConvertedFile(null);

                        setReviewText("");

                        setReviewReady(false);

                      }}

                    >

                      Remove selected file

                    </button>

                  )}



                  <span className="supported-text">

                    PDF, DOCX, TXT, JPG, PNG, WEBP

                  </span>

                </div>



                <div className="conversion-controls">

                  <div className="format-control">

                    <label htmlFor="output-format">

                      CONVERT TO

                    </label>

                    <select

                      id="output-format"

                      value={format}

                      onChange={(event) =>

                        setFormat(event.target.value)

                      }

                      disabled={isConverting}

                    >

                      {FORMATS.map((item) => (

                        <option key={item} value={item}>

                          {item}

                        </option>

                      ))}

                    </select>

                  </div>



                  <button

                    type="button"

                    className="primary-button convert-button"

                    onClick={handleConvert}

                    disabled={

                      isConverting || isAiBusy || isSaving

                    }

                  >

                    {isConverting

                      ? "Converting..."

                      : "Convert and review →"}

                  </button>

                </div>



                {message && (

                  <div

                    className="feedback"

                    role="status"

                    aria-live="polite"

                  >

                    ℹ &nbsp;{message}

                  </div>

                )}

              </section>



              {convertedFile && (

                <section

                  className="converter-card"

                  style={{ marginTop: 24 }}

                  ref={reviewRef}

                >

                  <div className="section-heading">

                    <div>

                      <div className="section-kicker">STEP 2</div>

                      <h2>AI Review &amp; Edit</h2>

                      <p>

                        Review the converted file, apply AI

                        improvements, or edit the text yourself.

                      </p>

                    </div>

                    <span className="secure-badge">Local AI</span>

                  </div>



                  <p>

                    Converted file:{" "}

                    <strong>{convertedFile.name}</strong>

                  </p>



                  {!IMAGE_FORMATS.includes(format) && (

                    <>

                      <div

                        style={{

                          display: "flex",

                          flexWrap: "wrap",

                          gap: 10,

                          margin: "20px 0",

                        }}

                      >

                        <button

                          type="button"

                          className="primary-button"

                          disabled={isAiBusy || isSaving}

                          onClick={() =>

                            handleAiAction("grammar")

                          }

                        >

                          Grammar Correction

                        </button>



                        <button

                          type="button"

                          className="primary-button"

                          disabled={isAiBusy || isSaving}

                          onClick={() =>

                            handleAiAction("summary")

                          }

                        >

                          Summarize

                        </button>



                        <button

                          type="button"

                          className="primary-button"

                          disabled={isAiBusy || isSaving}

                          onClick={() =>

                            handleAiAction("format")

                          }

                        >

                          {isAiBusy

                            ? "Processing..."

                            : "AI Format Text"}

                        </button>

                      </div>



                      <label

                        htmlFor="review-text"

                        style={{

                          display: "block",

                          marginBottom: 8,

                        }}

                      >

                        Step 3: Edit your final content

                      </label>



                      <textarea

                        id="review-text"

                        value={reviewText}

                        onChange={(event) => {

                          setReviewText(event.target.value);

                          setReviewReady(true);

                        }}

                        placeholder="For PDF and DOCX, click AI Format Text to extract the document content for review. You can then edit it here."

                        rows={14}

                        style={{

                          width: "100%",

                          boxSizing: "border-box",

                          padding: 14,

                          borderRadius: 10,

                          resize: "vertical",

                          fontFamily: "inherit",

                          lineHeight: 1.6,

                        }}

                        disabled={isAiBusy || isSaving}

                      />

                    </>

                  )}



                  {reviewMessage && (

                    <div

                      className="feedback"

                      role="status"

                      aria-live="polite"

                      style={{ marginTop: 16 }}

                    >

                      {reviewMessage}

                    </div>

                  )}



                  <div

                    style={{

                      display: "flex",

                      flexWrap: "wrap",

                      gap: 12,

                      marginTop: 20,

                    }}

                  >

                    <button

                      type="button"

                      className="primary-button"

                      disabled={isSaving || isAiBusy}

                      onClick={handleSaveAndDownload}

                    >

                      {isSaving

                        ? "Saving..."

                        : "Save and Download Final File"}

                    </button>



                    <button

                      type="button"

                      className="text-button"

                      disabled={isSaving || isAiBusy}

                      onClick={() => {

                        if (convertedFile) {

                          downloadBlob(

                            convertedFile,

                            convertedFile.name

                          );

                        }

                      }}

                    >

                      Download Converted Original

                    </button>

                  </div>



                  {["PDF", "DOCX"].includes(format) && (

                    <p style={{ marginTop: 16, fontSize: 13 }}>

                      Note: Saving an edited PDF or DOCX regenerates

                      the document from text. The original layout,

                      images, and tables may not be preserved.

                    </p>

                  )}

                </section>

              )}

            </>

          )}



          {activePage === "My documents" && (

            <section className="table-card">

              <div className="table-heading">

                <div>

                  <h2>My documents</h2>

                  <p>

                    Documents saved to your account.

                  </p>

                </div>

              </div>



              <div className="document-search">

                <input

                  type="search"

                  placeholder="Search by file name..."

                  value={searchQuery}

                  onChange={(event) =>

                    setSearchQuery(event.target.value)

                  }

                />

              </div>



              {documentsMessage && <p className="review-message">{documentsMessage}</p>}
              <DocumentTable

                files={filteredDocuments}

                onDownload={handleHistoryDownload}

                onDelete={handleHistoryDelete}

              />

            </section>

          )}



          {activePage === "Conversion history" && (

            <section className="table-card">

              <div className="table-heading">

                <div>

                  <h2>Conversion history</h2>

                  <p>Your saved conversion activity.</p>

                </div>



                {recentFiles.length > 0 && (

                  <button

                    type="button"

                    className="text-button"

                    onClick={() => {

                      if (

                        window.confirm(

                          "Clear all saved conversion history?"

                        )

                      ) {

                        setRecentFiles([]);

                        setSearchQuery("");

                      }

                    }}

                  >

                    Clear history

                  </button>

                )}

              </div>



              <div className="document-search">

                <input

                  type="search"

                  placeholder="Search conversion history..."

                  value={searchQuery}

                  onChange={(event) =>

                    setSearchQuery(event.target.value)

                  }

                />

              </div>



              <DocumentTable

                files={filteredFiles}

                onDownload={handleHistoryDownload}

                onDelete={handleHistoryDelete}

              />

            </section>

          )}



          {(activePage === "Overview" ||

            activePage === "Convert files") && (

            <section className="recent-section">

              <div className="recent-heading">

                <div>

                  <h2>Recent activity</h2>

                  <p>

                    Your latest file conversions appear here.

                  </p>

                </div>



                <button

                  type="button"

                  className="text-button"

                  onClick={() =>

                    navigateTo("Conversion history")

                  }

                >

                  View history →

                </button>

              </div>



              <DocumentTable

                files={recentFiles.slice(0, 4)}

                onDownload={handleHistoryDownload}

                onDelete={handleHistoryDelete}

              />

            </section>

          )}



          <footer className="app-footer">

            <span>© 2026 SmartDoc</span>

            <span>

              Built for a simpler workflow{" "}

              <span className="footer-heart">♥</span>

            </span>

          </footer>

        </div>

      </main>

    </div>

  );

}



function DocumentTable({ files, onDownload, onDelete }) {

  if (files.length === 0) {

    return (

      <div className="empty-state">

        <span className="empty-icon">▤</span>

        <strong>No files yet</strong>

        <p>Your completed conversions will appear here.</p>

      </div>

    );

  }



  return (

    <div className="table-scroll">

      <table className="files-table">

        <thead>

          <tr>

            <th>FILE NAME</th>

            <th>OUTPUT FORMAT</th>

            <th>TIME</th>

            <th>STATUS</th>

            <th>ACTION</th>

          </tr>

        </thead>



        <tbody>

          {files.map((item, index) => (

            <tr

              key={

                item.id ||

                `${item.name}-${item.time}-${index}`

              }

            >

              <td>

                <div className="file-cell">

                  <span className="file-icon">▤</span>

                  <span

                    className="file-name"

                    title={item.name}

                  >

                    {item.name}

                  </span>

                </div>

              </td>



              <td>

                <span className="format-pill">

                  {item.output}

                </span>

              </td>



              <td className="time-cell">{item.time}</td>



              <td>

                <span className="completed-status">

                  <span /> {item.status}

                </span>

              </td>



              <td>

                <div

                  style={{

                    display: "flex",

                    alignItems: "center",

                    gap: 8,

                    flexWrap: "wrap",

                  }}

                >

                  <button

                    type="button"

                    className="text-button"

                    title="Download converted file"

                    aria-label={`Download ${item.name}`}

                    onClick={() => onDownload?.(item)}

                  >

                    ⬇ Download

                  </button>



                  <button

                    type="button"

                    className="text-button"

                    title="Delete this conversion"

                    aria-label={`Delete ${item.name}`}

                    onClick={() => onDelete?.(item)}

                    style={{ color: "#dc2626" }}

                  >

                    🗑 Delete

                  </button>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}



export default App;
