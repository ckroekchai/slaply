import { z } from "zod";
import { launchStages, priceTiers, productCategories, reportLanguages, salesChannels } from "./scan-form-options";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

export const scanContextSchema = z.object({
  email: z.string().trim().email(),
  product_category: z.enum(productCategories),
  sales_channel: z.enum(salesChannels),
  target_customer: z.string().trim().min(2).max(240),
  price_tier: z.enum(priceTiers),
  main_concern: z.string().trim().min(2).max(240),
  launch_stage: z.enum(launchStages),
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

