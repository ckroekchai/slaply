"use client";

import { useEffect, useRef, useState } from "react";
import { productCategories, reportLanguages } from "../lib/scan-form-options";

const acceptedImageTypes = ["image/jpeg", "image/png"];
const uploadingLetters = "Uploading".split("");
const fullCrop = { x: 0, y: 0, width: 100, height: 100 };
const minimumCropSize = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isFullCrop(crop) {
  return crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
}

function getCroppedFileName(file) {
  const baseName = file.name.replace(/\.[^/.]+$/, "") || "artwork";
  const extension = file.type === "image/png" ? "png" : "jpg";

  return `${baseName}-cropped.${extension}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.94 : undefined);
  });
}

function getField(form, name) {
  return form.elements.namedItem(name);
}

function validateForm(form) {
  const imageInput = getField(form, "image");
  const emailInput = getField(form, "email");
  const categorySelect = getField(form, "product_category");
  const languageSelect = getField(form, "language");
  const consentInput = getField(form, "consent");
  const image = imageInput?.files?.[0];
  const email = emailInput?.value.trim() || "";

  return {
    image: !image || !acceptedImageTypes.includes(image.type),
    email: Boolean(email) && !emailInput.validity.valid,
    product_category: !categorySelect?.value,
    language: !languageSelect?.value,
    consent: !consentInput?.checked
  };
}

function hasError(errors) {
  return Object.values(errors).some(Boolean);
}

export function ScanUploadForm({ error = "" }) {
  const fileInputRef = useRef(null);
  const cropStageRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [originalFile, setOriginalFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [crop, setCrop] = useState(fullCrop);
  const [dragState, setDragState] = useState(null);
  const [cropApplied, setCropApplied] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropMessage, setCropMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isCropModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsCropModalOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCropModalOpen]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    function handlePointerMove(event) {
      const point = getCropPointer(event);

      if (!point) {
        return;
      }

      const deltaX = point.x - dragState.startPoint.x;
      const deltaY = point.y - dragState.startPoint.y;
      const start = dragState.startCrop;
      let nextCrop = start;

      if (dragState.mode === "move") {
        nextCrop = {
          ...start,
          x: clamp(start.x + deltaX, 0, 100 - start.width),
          y: clamp(start.y + deltaY, 0, 100 - start.height)
        };
      }

      if (dragState.mode.includes("right")) {
        nextCrop = {
          ...nextCrop,
          width: clamp(start.width + deltaX, minimumCropSize, 100 - start.x)
        };
      }

      if (dragState.mode.includes("bottom")) {
        nextCrop = {
          ...nextCrop,
          height: clamp(start.height + deltaY, minimumCropSize, 100 - start.y)
        };
      }

      if (dragState.mode.includes("left")) {
        const nextX = clamp(start.x + deltaX, 0, start.x + start.width - minimumCropSize);

        nextCrop = {
          ...nextCrop,
          x: nextX,
          width: start.width + start.x - nextX
        };
      }

      if (dragState.mode.includes("top")) {
        const nextY = clamp(start.y + deltaY, 0, start.y + start.height - minimumCropSize);

        nextCrop = {
          ...nextCrop,
          y: nextY,
          height: start.height + start.y - nextY
        };
      }

      setCrop(nextCrop);
      setCropApplied(false);
      setCropMessage("Adjust the frame, then apply crop before submitting.");
    }

    function handlePointerUp() {
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  function refreshValidation(form) {
    if (submitted) {
      setErrors(validateForm(form));
    }
  }

  function getCropPointer(event) {
    const stage = cropStageRef.current;

    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  }

  function assignFileToInput(file) {
    const input = fileInputRef.current;

    if (!input || typeof DataTransfer === "undefined") {
      return false;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;

    return true;
  }

  async function applyCrop() {
    if (!originalFile || !previewUrl) {
      return false;
    }

    if (isFullCrop(crop)) {
      assignFileToInput(originalFile);
      setFileName(originalFile.name);
      setCropApplied(false);
      setIsCropModalOpen(false);
      setCropMessage("Full image selected. You can still drag the crop frame to trim the artwork.");
      refreshValidation(fileInputRef.current?.form);
      return true;
    }

    try {
      setCropMessage("Applying crop...");

      const image = await loadImage(previewUrl);
      const sourceX = Math.round((crop.x / 100) * image.naturalWidth);
      const sourceY = Math.round((crop.y / 100) * image.naturalHeight);
      const sourceWidth = Math.max(1, Math.round((crop.width / 100) * image.naturalWidth));
      const sourceHeight = Math.max(1, Math.round((crop.height / 100) * image.naturalHeight));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);

      const croppedBlob = await canvasToBlob(canvas, originalFile.type);

      if (!croppedBlob) {
        throw new Error("Crop failed");
      }

      const croppedFile = new File([croppedBlob], getCroppedFileName(originalFile), {
        type: originalFile.type,
        lastModified: Date.now()
      });

      if (!assignFileToInput(croppedFile)) {
        throw new Error("Could not update upload file");
      }

      setFileName(croppedFile.name);
      setCropApplied(true);
      setIsCropModalOpen(false);
      setCropMessage("Crop applied. This cropped artwork will be scanned.");
      refreshValidation(fileInputRef.current?.form);
      return true;
    } catch {
      setCropMessage("Could not apply the crop. Please try another image or use the full file.");
      return false;
    }
  }

  async function handleSubmit(event) {
    const form = event.currentTarget;
    const nextErrors = validateForm(form);
    setSubmitted(true);
    setErrors(nextErrors);

    if (hasError(nextErrors)) {
      event.preventDefault();
      setIsUploading(false);
      return;
    }

    if (originalFile && previewUrl && !cropApplied && !isFullCrop(crop)) {
      event.preventDefault();
      setIsUploading(true);

      const cropWasApplied = await applyCrop();

      if (cropWasApplied) {
        form.submit();
        return;
      }

      setIsUploading(false);
      return;
    }

    setIsUploading(true);
  }

  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];

    setFileName(file?.name || "");
    setCrop(fullCrop);
    setCropApplied(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }

    if (file && acceptedImageTypes.includes(file.type)) {
      setOriginalFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsCropModalOpen(true);
      setCropMessage("Drag the crop frame to keep only the artwork area, then apply crop.");
    } else {
      setOriginalFile(null);
      setIsCropModalOpen(false);
      setCropMessage("");
    }

    refreshValidation(event.currentTarget.form);
  }

  function handleFieldChange(event) {
    refreshValidation(event.currentTarget.form);
  }

  function handleCropPointerDown(event, mode) {
    const point = getCropPointer(event);

    if (!point) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragState({ mode, startPoint: point, startCrop: crop });
  }

  function handleResetCrop() {
    if (originalFile) {
      assignFileToInput(originalFile);
      setFileName(originalFile.name);
    }

    setCrop(fullCrop);
    setCropApplied(false);
    setCropMessage("Full image selected. You can still drag the crop frame to trim the artwork.");
    refreshValidation(fileInputRef.current?.form);
  }

  function handleUseFullImage() {
    handleResetCrop();
    setIsCropModalOpen(false);
  }

  return (
    <form
      className="scan-form"
      action="/api/create-scan"
      method="post"
      encType="multipart/form-data"
      noValidate
      onSubmit={handleSubmit}
    >
      {error ? <div className="form-alert">{error}</div> : null}

      <label className={`dropzone upload-dropzone ${errors.image ? "is-invalid" : ""}`}>
        <span className={`upload-icon ${fileName ? "has-file" : ""}`} title={fileName || undefined}>
          {fileName || "+"}
        </span>
        <strong>Upload your artwork</strong>
        <span>
          High-quality PNG or JPG
          <br />
          Cropped to artwork only
        </span>
        <input
          ref={fileInputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png"
          aria-label="Upload artwork"
          onChange={handleFileChange}
        />
      </label>

      {previewUrl ? (
        <div className="crop-summary">
          <span>{cropApplied ? "Crop applied" : "Ready to crop"}</span>
          <button type="button" className="crop-edit-button" onClick={() => setIsCropModalOpen(true)}>
            Edit crop
          </button>
        </div>
      ) : null}

      <div className="field-grid">
        <input
          className={errors.email ? "is-invalid" : ""}
          type="email"
          name="email"
          placeholder="Email"
          aria-label="Email"
          onChange={handleFieldChange}
        />

        <select
          className={errors.product_category ? "is-invalid" : ""}
          name="product_category"
          aria-label="Product category"
          defaultValue=""
          onChange={handleFieldChange}
        >
          <option value="" disabled>Product category</option>
          {productCategories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select
          className={errors.language ? "is-invalid" : ""}
          name="language"
          aria-label="Report language"
          defaultValue=""
          onChange={handleFieldChange}
        >
          <option value="" disabled>Report language</option>
          {reportLanguages.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        <label className={`consent-row ${errors.consent ? "is-invalid" : ""}`}>
          <input type="checkbox" name="consent" onChange={handleFieldChange} />
          <span>I own or have permission to upload this artwork and understand this is an AI visual review only.</span>
        </label>

        <button type="submit" className="button button-primary" disabled={isUploading} aria-live="polite">
          {isUploading ? (
            <span className="thinking-word" aria-label="Uploading">
              {uploadingLetters.map((letter, index) => (
                <span key={`${letter}-${index}`} style={{ "--letter-index": index }} aria-hidden="true">
                  {letter}
                </span>
              ))}
            </span>
          ) : (
            "Submit for scan"
          )}
        </button>
      </div>

      {previewUrl && isCropModalOpen ? (
        <div className="crop-modal-backdrop" onPointerDown={() => setIsCropModalOpen(false)}>
          <div
            className="crop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-modal-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="crop-modal-head">
              <div>
                <h3 id="crop-modal-title">Crop artwork</h3>
                <p>Remove title blocks, notes, mockup background, or non-artwork areas.</p>
              </div>
              <button type="button" className="crop-modal-close" onClick={() => setIsCropModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="crop-tool">
              <div className="crop-stage" ref={cropStageRef}>
                <img src={previewUrl} alt="Selected artwork preview" className="crop-image" draggable="false" />
                <div
                  className="crop-selection"
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.width}%`,
                    height: `${crop.height}%`
                  }}
                  onPointerDown={(event) => handleCropPointerDown(event, "move")}
                  role="presentation"
                >
                  <span
                    className="crop-handle top-left"
                    onPointerDown={(event) => handleCropPointerDown(event, "top-left")}
                    aria-hidden="true"
                  />
                  <span
                    className="crop-handle top-right"
                    onPointerDown={(event) => handleCropPointerDown(event, "top-right")}
                    aria-hidden="true"
                  />
                  <span
                    className="crop-handle bottom-left"
                    onPointerDown={(event) => handleCropPointerDown(event, "bottom-left")}
                    aria-hidden="true"
                  />
                  <span
                    className="crop-handle bottom-right"
                    onPointerDown={(event) => handleCropPointerDown(event, "bottom-right")}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="crop-tool-actions">
                <button type="button" className="crop-action primary" onClick={applyCrop}>
                  Apply crop
                </button>
                <button type="button" className="crop-action" onClick={handleResetCrop}>
                  Reset crop
                </button>
                <button type="button" className="crop-action" onClick={handleUseFullImage}>
                  Use full image
                </button>
              </div>

              {cropMessage ? <p className="crop-message">{cropMessage}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
