import { z } from "zod";
import { productCategories, reportLanguages } from "./scan-form-options";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

export const scanContextSchema = z.object({
  email: z.preprocess((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const email = value.trim();
    return email || null;
  }, z.string().email().nullable()),
  product_category: z.enum(productCategories),
  language: z.enum(reportLanguages.map((item) => item.value)),
  consent: z.literal("on")
});

export function validateUploadFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    return "Please upload one JPG or PNG artwork image.";
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG and PNG images are accepted in Phase 1.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Please upload an image smaller than 10 MB.";
  }

  return null;
}
