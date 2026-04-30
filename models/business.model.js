const { v4: uuidv4 } = require('uuid');

/**
 * Business Profile — stored per widget.
 * AI uses this as full sales context every conversation.
 *
 * Supports all business types:
 *   F&O Trader, Product/Service, Real Estate, Restaurant, SaaS, Healthcare, Education, E-commerce
 */

exports.createBusinessProfile = (data = {}) => {
  if (!data.widgetId || !data.ownerId) throw new Error('widgetId and ownerId required');

  const now = new Date().toISOString();
  return {
    id:          uuidv4(),
    widgetId:    data.widgetId,
    ownerId:     data.ownerId,

    // ── Core Business Info ──────────────────────────────────────────────────
    businessName:     data.businessName     || '',
    businessType:     data.businessType     || 'generic',   // real_estate | restaurant | saas | fno | ecommerce | healthcare | education | generic
    tagline:          data.tagline          || '',
    description:      data.description      || '',          // What the business does (2-3 lines)
    uniqueValue:      data.uniqueValue      || '',          // Why choose us / USP
    targetAudience:   data.targetAudience   || '',          // Who is the ideal customer

    // ── Contact & Location ──────────────────────────────────────────────────
    websiteUrl:       data.websiteUrl       || '',
    phone:            data.phone            || '',
    email:            data.email            || '',
    address:          data.address          || '',
    city:             data.city             || '',
    country:          data.country          || '',
    workingHours:     data.workingHours     || '',          // e.g. "Mon-Sat 9am-7pm"

    // ── Top 5 Products / Services ────────────────────────────────────────────
    // Each item: { name, description, price, imageUrl, badge }
    // badge examples: "Bestseller", "New", "Limited", "Popular"
    topProducts: data.topProducts || [],

    // ── Menu (for restaurants) ────────────────────────────────────────────────
    // Each item: { category, name, description, price, imageUrl, isVeg }
    menuItems: data.menuItems || [],

    // ── F&O / Trading specific ────────────────────────────────────────────────
    fnoDetails: data.fnoDetails || {
      services:     [],    // e.g. ["Options advisory", "Algo trading", "Portfolio review"]
      riskDisclaimer: '',  // mandatory disclaimer
      returns:      '',    // e.g. "15-20% monthly (not guaranteed)"
      minCapital:   '',    // e.g. "₹50,000 minimum"
    },

    // ── Real Estate specific ──────────────────────────────────────────────────
    realEstateDetails: data.realEstateDetails || {
      propertyTypes: [],   // ["1BHK", "2BHK", "Villa", "Commercial"]
      locations:     [],   // ["Pune", "Mumbai", "Baner"]
      priceRange:    '',   // "₹40L - ₹2Cr"
      amenities:     [],   // ["Swimming pool", "Gym", "24x7 Security"]
      reraNumber:    '',
    },

    // ── Website scraped content ────────────────────────────────────────────────
    scrapedContent: data.scrapedContent || {
      lastScraped:  null,
      pageTitle:    '',
      metaDesc:     '',
      keyPoints:    [],    // AI-extracted key points from homepage
      faqs:         [],    // [{question, answer}]
    },

    // ── Sales Settings ─────────────────────────────────────────────────────────
    offers:           data.offers           || '',          // Current offers/discounts
    ctaGoal:          data.ctaGoal          || 'lead',      // lead | booking | purchase | call
    ctaText:          data.ctaText          || 'Get in Touch',
    followUpMessage:  data.followUpMessage  || '',          // message shown after lead captured

    // ── Social Proof ───────────────────────────────────────────────────────────
    ratings:          data.ratings          || '',          // e.g. "4.8★ on Google (200+ reviews)"
    testimonials:     data.testimonials     || [],          // ["Great service!" - Rahul K.]
    clientCount:      data.clientCount      || '',          // e.g. "500+ happy clients"

    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Build a rich AI context string from a business profile.
 * This gets injected into the AI system prompt for every chat.
 */
exports.buildAIContext = (profile) => {
  if (!profile) return '';

  const sections = [];

  // Core info
  sections.push(`=== BUSINESS PROFILE ===`);
  sections.push(`Business Name: ${profile.businessName || 'N/A'}`);
  sections.push(`Type: ${profile.businessType}`);
  if (profile.tagline)        sections.push(`Tagline: ${profile.tagline}`);
  if (profile.description)    sections.push(`About: ${profile.description}`);
  if (profile.uniqueValue)    sections.push(`Why Choose Us: ${profile.uniqueValue}`);
  if (profile.targetAudience) sections.push(`Ideal Customer: ${profile.targetAudience}`);

  // Contact
  const contact = [profile.phone, profile.email, profile.address, profile.city].filter(Boolean);
  if (contact.length) sections.push(`Contact: ${contact.join(' | ')}`);
  if (profile.workingHours)   sections.push(`Working Hours: ${profile.workingHours}`);
  if (profile.websiteUrl)     sections.push(`Website: ${profile.websiteUrl}`);

  // Top Products/Services
  if (profile.topProducts?.length) {
    sections.push(`\n=== TOP PRODUCTS / SERVICES ===`);
    profile.topProducts.slice(0, 5).forEach((p, i) => {
      let line = `${i + 1}. ${p.name}`;
      if (p.price)       line += ` — ${p.price}`;
      if (p.badge)       line += ` [${p.badge}]`;
      if (p.description) line += `\n   ${p.description}`;
      if (p.imageUrl)    line += `\n   Image: ${p.imageUrl}`;
      sections.push(line);
    });
  }

  // Menu (restaurants)
  if (profile.menuItems?.length) {
    sections.push(`\n=== MENU ===`);
    const byCategory = {};
    profile.menuItems.forEach(item => {
      const cat = item.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });
    Object.entries(byCategory).forEach(([cat, items]) => {
      sections.push(`[${cat}]`);
      items.forEach(item => {
        let line = `  • ${item.name}`;
        if (item.price)    line += ` — ${item.price}`;
        if (item.isVeg !== undefined) line += item.isVeg ? ' 🟢' : ' 🔴';
        if (item.description) line += ` (${item.description})`;
        sections.push(line);
      });
    });
  }

  // F&O details
  if (profile.fnoDetails?.services?.length) {
    sections.push(`\n=== F&O / TRADING SERVICES ===`);
    sections.push(`Services: ${profile.fnoDetails.services.join(', ')}`);
    if (profile.fnoDetails.returns)    sections.push(`Expected Returns: ${profile.fnoDetails.returns}`);
    if (profile.fnoDetails.minCapital) sections.push(`Min Capital: ${profile.fnoDetails.minCapital}`);
    if (profile.fnoDetails.riskDisclaimer) {
      sections.push(`⚠️ DISCLAIMER (always mention): ${profile.fnoDetails.riskDisclaimer}`);
    }
  }

  // Real estate details
  if (profile.realEstateDetails?.propertyTypes?.length) {
    sections.push(`\n=== REAL ESTATE DETAILS ===`);
    sections.push(`Property Types: ${profile.realEstateDetails.propertyTypes.join(', ')}`);
    if (profile.realEstateDetails.locations?.length)
      sections.push(`Locations: ${profile.realEstateDetails.locations.join(', ')}`);
    if (profile.realEstateDetails.priceRange)
      sections.push(`Price Range: ${profile.realEstateDetails.priceRange}`);
    if (profile.realEstateDetails.amenities?.length)
      sections.push(`Amenities: ${profile.realEstateDetails.amenities.join(', ')}`);
    if (profile.realEstateDetails.reraNumber)
      sections.push(`RERA: ${profile.realEstateDetails.reraNumber}`);
  }

  // Website scraped content
  if (profile.scrapedContent?.keyPoints?.length) {
    sections.push(`\n=== KEY WEBSITE INFO ===`);
    profile.scrapedContent.keyPoints.forEach(p => sections.push(`• ${p}`));
  }
  if (profile.scrapedContent?.faqs?.length) {
    sections.push(`\n=== FAQS ===`);
    profile.scrapedContent.faqs.slice(0, 5).forEach(f =>
      sections.push(`Q: ${f.question}\nA: ${f.answer}`)
    );
  }

  // Social proof
  if (profile.ratings || profile.clientCount) {
    sections.push(`\n=== SOCIAL PROOF ===`);
    if (profile.ratings)     sections.push(`Rating: ${profile.ratings}`);
    if (profile.clientCount) sections.push(`Clients: ${profile.clientCount}`);
    if (profile.testimonials?.length)
      sections.push(`Testimonials: ${profile.testimonials.slice(0, 2).join(' | ')}`);
  }

  // Current offers
  if (profile.offers) sections.push(`\n🔥 CURRENT OFFERS: ${profile.offers}`);

  // Sales goal
  sections.push(`\n=== YOUR SALES GOAL ===`);
  sections.push(`Primary CTA: ${profile.ctaGoal} — "${profile.ctaText}"`);
  if (profile.followUpMessage) sections.push(`After lead captured, say: "${profile.followUpMessage}"`);

  sections.push(`\nIMPORTANT: Use ALL this business information naturally in conversation. Mention specific products, prices, locations, and offers when relevant. Always guide toward the CTA goal.`);

  return sections.join('\n');
};
