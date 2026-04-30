const fb                 = require('./firebase.service');
const scraperSvc         = require('./scraper.service');
const { createBusinessProfile, buildAIContext } = require('../models/business.model');
const logger             = require('../utils/logger');

/**
 * Create or overwrite a business profile for a widget.
 * Automatically scrapes website if URL provided.
 */
exports.upsertProfile = async (widgetId, ownerId, data) => {
  // Check widget ownership
  const widget = await fb.getDoc('widgets', widgetId);
  if (!widget) { const e = new Error('Widget not found'); e.status = 404; throw e; }
  if (widget.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }

  // Check if profile already exists
  const existing = await exports.getProfile(widgetId);

  const profile = createBusinessProfile({
    ...(existing || {}),
    ...data,
    widgetId,
    ownerId,
    id: existing?.id,
  });

  // Auto-scrape website if URL provided and changed
  if (data.websiteUrl && data.websiteUrl !== existing?.websiteUrl) {
    logger.info(`[Business] Scraping: ${data.websiteUrl}`);
    try {
      const scraped = await scraperSvc.scrapeWebsite(data.websiteUrl);
      if (scraped.success) {
        // AI summarise the scraped content
        const aiPoints = await scraperSvc.summariseWithAI(scraped.rawText, data.businessName || '');

        profile.scrapedContent = {
          lastScraped: scraped.lastScraped,
          pageTitle:   scraped.pageTitle,
          metaDesc:    scraped.metaDesc,
          keyPoints:   aiPoints.length ? aiPoints : scraped.keyPoints,
          faqs:        scraped.faqs,
          prices:      scraped.prices,
          phones:      scraped.phones.length ? scraped.phones : [],
          emails:      scraped.emails.length ? scraped.emails : [],
        };

        // Auto-fill phone/email if not manually provided
        if (!profile.phone && scraped.phones[0]) profile.phone = scraped.phones[0];
        if (!profile.email && scraped.emails[0]) profile.email = scraped.emails[0];

        logger.info(`[Business] Scrape success — ${aiPoints.length} AI key points extracted`);
      }
    } catch (err) {
      logger.error('[Business] Scrape failed (non-fatal):', err.message);
    }
  }

  // Save to Firestore under widgetId (one profile per widget)
  await fb.setDoc('business_profiles', widgetId, profile);

  // Also update widget's brainType if businessType changed
  if (data.businessType) {
    await fb.updateDoc('widgets', widgetId, { brainType: data.businessType });
  }

  return profile;
};

/**
 * Get business profile for a widget.
 */
exports.getProfile = (widgetId) => fb.getDoc('business_profiles', widgetId);

/**
 * Re-scrape website on demand.
 */
exports.rescrape = async (widgetId, ownerId) => {
  const profile = await exports.getProfile(widgetId);
  if (!profile) { const e = new Error('Profile not found'); e.status = 404; throw e; }
  if (profile.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  if (!profile.websiteUrl) { const e = new Error('No website URL set'); e.status = 400; throw e; }

  const scraped = await scraperSvc.scrapeWebsite(profile.websiteUrl);
  if (!scraped.success) throw new Error(`Scrape failed: ${scraped.error}`);

  const aiPoints = await scraperSvc.summariseWithAI(scraped.rawText, profile.businessName);

  const updatedContent = {
    lastScraped: scraped.lastScraped,
    pageTitle:   scraped.pageTitle,
    metaDesc:    scraped.metaDesc,
    keyPoints:   aiPoints.length ? aiPoints : scraped.keyPoints,
    faqs:        scraped.faqs,
    prices:      scraped.prices,
    phones:      scraped.phones,
    emails:      scraped.emails,
  };

  await fb.updateDoc('business_profiles', widgetId, { scrapedContent: updatedContent });
  return updatedContent;
};

/**
 * Delete business profile.
 */
exports.deleteProfile = async (widgetId, ownerId) => {
  const profile = await exports.getProfile(widgetId);
  if (!profile) return; // already gone
  if (profile.ownerId !== ownerId) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  await fb.deleteDoc('business_profiles', widgetId);
};

/**
 * Build full AI system context string for a widget's business profile.
 * Used by chat controller to inject into every AI call.
 */
exports.getAIContext = async (widgetId) => {
  try {
    const profile = await exports.getProfile(widgetId);
    if (!profile) return '';
    return buildAIContext(profile);
  } catch (err) {
    logger.error('[Business] getAIContext error:', err.message);
    return '';
  }
};
