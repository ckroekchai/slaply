import { launchStages, priceTiers, productCategories, reportLanguages, salesChannels } from "../../lib/scan-form-options";

export default async function ScanPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <main id="scan" className="cta page-shell">
      <div className="container cta-grid">
        <div className="cta-copy">
          <span className="eyebrow">Start scan</span>
          <h2>Upload one artwork.<br />Get a clearer visual decision.</h2>
          <p>
            Phase 1 accepts one JPG or PNG front packaging image. Slaply returns an AI visual review,
            not legal, compliance, FDA, Thai FDA, or print approval.
          </p>
        </div>

        <form className="scan-form" action="/api/create-scan" method="post" encType="multipart/form-data">
          {error ? <div className="form-alert">{error}</div> : null}

          <div className="dropzone">
            <span className="upload-icon">+</span>
            <strong>Upload your artwork</strong>
            <p>High-quality PNG or JPG</p>
            <input type="file" name="image" accept="image/png,image/jpeg" aria-label="Upload artwork" />
          </div>

          <input type="email" name="email" placeholder="Email" required />

          <select name="product_category" defaultValue="" required>
            <option value="" disabled>Product category</option>
            {productCategories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select name="sales_channel" defaultValue="" required>
            <option value="" disabled>Sales channel</option>
            {salesChannels.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <input name="target_customer" placeholder="Target customer" required />
          <input name="main_concern" placeholder="Main concern" required />

          <select name="price_tier" defaultValue="" required>
            <option value="" disabled>Price tier</option>
            {priceTiers.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select name="launch_stage" defaultValue="" required>
            <option value="" disabled>Launch stage</option>
            {launchStages.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select name="language" defaultValue="thai" required>
            {reportLanguages.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <label className="consent-row">
            <input type="checkbox" name="consent" required />
            <span>I own or have permission to upload this artwork and understand this is an AI visual review only.</span>
          </label>

          <button type="submit" className="button button-primary">Submit for scan</button>
        </form>
      </div>
    </main>
  );
}
