import React, { useMemo } from 'react';
import { asset } from './assets.js';
import { buildGuidelineModel, renderGuidelineMarkup, renderGuidelineDetails, renderObjectSprite } from './brand-guideline-model.js';
import './brand-guideline.css';

export default function BrandGuideline({ recipe, mood }) {
  const markup = useMemo(() => renderGuidelineMarkup(buildGuidelineModel(recipe, mood), asset), [recipe, mood]);
  // Shared escaped markup keeps the live artwork and standalone HTML identical.
  return <div className="brand-guideline" dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function GuidelineDetails({ recipe, mood }) {
  const markup = useMemo(() => renderGuidelineDetails(buildGuidelineModel(recipe, mood)), [recipe, mood]);
  return <div className="brand-guideline-details" dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function BrandObjectPreview({ style = 'bloom', className = '' }) {
  const markup = useMemo(() => renderObjectSprite(style, asset), [style]);
  return <span className={`guide-object-preview ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
