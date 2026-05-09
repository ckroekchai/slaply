"use client";

import { useState } from "react";
import { productCategories, reportLanguages } from "../lib/scan-form-options";

const acceptedImageTypes = ["image/jpeg", "image/png"];

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

  return {
    image: !image || !acceptedImageTypes.includes(image.type),
    email: !emailInput?.value.trim() || !emailInput.validity.valid,
    product_category: !categorySelect?.value,
    language: !languageSelect?.value,
    consent: !consentInput?.checked
  };
}

function hasError(errors) {
  return Object.values(errors).some(Boolean);
}

export function ScanUploadForm({ error = "" }) {
  const [fileName, setFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  function refreshValidation(form) {
    if (submitted) {
      setErrors(validateForm(form));
    }
  }

  function handleSubmit(event) {
    const nextErrors = validateForm(event.currentTarget);
    setSubmitted(true);
    setErrors(nextErrors);

    if (hasError(nextErrors)) {
      event.preventDefault();
    }
  }

  function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];
    setFileName(file?.name || "");
    refreshValidation(event.currentTarget.form);
  }

  function handleFieldChange(event) {
    refreshValidation(event.currentTarget.form);
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
        <span>High-quality PNG or JPG</span>
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png"
          aria-label="Upload artwork"
          onChange={handleFileChange}
        />
      </label>

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

        <button type="submit" className="button button-primary">Submit for scan</button>
      </div>
    </form>
  );
}
