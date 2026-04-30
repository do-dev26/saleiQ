const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../utils/logger');

/**
 * Scrape a website URL and extract useful business content.
 * Returns structured data that gets stored in business profile.
 */
exports.scrapeWebsite = async (url) => {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;

    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SalesBot/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, iframe, noscript').remove();

    // ── Extract fields ──────────────────────────────────────────────────────
    const pageTitle = $('title').text().trim() || $('h1').first().text().trim();
    const metaDesc  = $('meta[name="description"]').attr('content')
                   || $('meta[property="og:description"]').attr('content')
                   || '';

    // Headings as key points
    const headings = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5 && text.length < 120) headings.push(text);
    });

    // Paragraphs — first 8 meaningful ones
    const paragraphs = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 30 && text.length < 400) paragraphs.push(text);
    });

    // FAQs — look for common patterns
    const faqs = [];
    $('[class*="faq"], [class*="accordion"], [id*="faq"]').each((_, el) => {
      const q = $(el).find('[class*="question"], h3, h4, dt, summary').first().text().trim();
      const a = $(el).find('[class*="answer"], p, dd').first().text().trim();
      if (q && a && q.length < 200) faqs.push({ question: q, answer: a });
    });

    // Prices — look for common price patterns
    const priceMatches = [];
    const bodyText = $('body').text();
    const priceRegex = /(?:₹|Rs\.?|INR|USD|\$)\s?[\d,]+(?:\s?(?:Lakh|L|Cr|K|k))?/g;
    const found = bodyText.match(priceRegex) || [];
    const uniquePrices = [...new Set(found)].slice(0, 10);

    // Phone numbers
    const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}/g;
    const phones = [...new Set(bodyText.match(phoneRegex) || [])].slice(0, 3);

    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(bodyText.match(emailRegex) || [])]
      .filter(e => !e.includes('example') && !e.includes('sentry'))
      .slice(0, 3);

    // Build key points from headings + top paragraphs
    const keyPoints = [
      ...headings.slice(0, 6),
      ...paragraphs.slice(0, 4),
    ].slice(0, 10);

    return {
      success:    true,
      lastScraped: new Date().toISOString(),
      pageTitle:  pageTitle.slice(0, 200),
      metaDesc:   metaDesc.slice(0, 400),
      keyPoints,
      faqs:       faqs.slice(0, 8),
      prices:     uniquePrices,
      phones,
      emails,
      rawText:    bodyText.replace(/\s+/g, ' ').slice(0, 3000), // for AI summarisation
    };
  } catch (err) {
    logger.error('[Scraper] Failed:', err.message);
    return {
      success:    false,
      error:      err.message,
      lastScraped: new Date().toISOString(),
      pageTitle:  '',
      metaDesc:   '',
      keyPoints:  [],
      faqs:       [],
      prices:     [],
      phones:     [],
      emails:     [],
      rawText:    '',
    };
  }
};

/**
 * Use AI to extract structured key points from raw scraped text.
 * Called after scraping to clean up and summarise.
 */
exports.summariseWithAI = async (rawText, businessName) => {
  if (!rawText || rawText.length < 50) return [];

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const { anthropic: cfg } = require('../config/env');
    const client = new Anthropic({ apiKey: cfg.apiKey });

    const response = await client.messages.create({
      model:      cfg.model,
      max_tokens: 400,
      system:     `You are a business analyst. Extract the most important sales-relevant facts from this website content.
Respond ONLY with a JSON array of strings. Max 8 items. Each item max 100 chars.
Focus on: products/services, pricing, USPs, locations, offers, contact info.
No markdown. No explanation. Just the JSON array.`,
      messages: [{
        role: 'user',
        content: `Business: ${businessName}\n\nWebsite content:\n${rawText.slice(0, 2000)}`,
      }],
    });

    const text = response.content[0]?.text?.trim() || '[]';
    return JSON.parse(text);
  } catch (err) {
    logger.error('[Scraper] AI summarise failed:', err.message);
    return [];
  }
};
