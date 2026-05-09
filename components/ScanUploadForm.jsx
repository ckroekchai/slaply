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

function CustomSelect({ error, label, name, onChange, options, value }) {
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(nextValue) {
    onChange(name, nextValue);
    setIsOpen(false);
  }

  function handleOpen(event) {
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    setIsOpen((current) => !current);
  }

  function handleKeyDown(event) {
    if ([" ", "Enter", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div
      className={`custom-select ${isOpen ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <select
        className={error ? "is-invalid" : ""}
        name={name}
        aria-expanded={isOpen}
        aria-label={label}
        onChange={(event) => handleSelect(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onPointerDown={handleOpen}
        value={value}
      >
        <option value="" disabled>{label}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>

      {isOpen ? (
        <div className="custom-select-menu" role="listbox" aria-label={label}>
          {options.map((item) => (
            <button
              type="button"
              className={`custom-select-option ${item.value === value ? "is-selected" : ""}`}
              key={item.value}
              role="option"
              aria-selected={item.value === value}
              onClick={() => handleSelect(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScanUploadForm({ error = "" }) {
  const [fileName, setFileName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectValues, setSelectValues] = useState({
    product_category: "",
    language: ""
  });

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

  function handleSelectChange(name, value) {
    setSelectValues((current) => ({
      ...current,
      [name]: value
    }));

    if (submitted) {
      setErrors((current) => ({
        ...current,
        [name]: !value
      }));
    }
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

        <CustomSelect
          error={errors.product_category}
          label="Product category"
          name="product_category"
          onChange={handleSelectChange}
          options={productCategories.map((item) => ({ label: item, value: item }))}
          value={selectValues.product_category}
        />

        <CustomSelect
          error={errors.language}
          label="Report language"
          name="language"
          onChange={handleSelectChange}
          options={reportLanguages}
          value={selectValues.language}
        />

        <label className={`consent-row ${errors.consent ? "is-invalid" : ""}`}>
          <input type="checkbox" name="consent" onChange={handleFieldChange} />
          <span>I own or have permission to upload this artwork and understand this is an AI visual review only.</span>
        </label>

        <button type="submit" className="button button-primary">Submit for scan</button>
      </div>
    </form>
  );
}
