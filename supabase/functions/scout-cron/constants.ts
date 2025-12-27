// Constants and configuration

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  
  // Blacklist of domains that cannot be scraped by Firecrawl
  // These are filtered out from search results before attempting to scrape
  export const UNSUPPORTED_DOMAINS = [
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'linkedin.com',
    'tiktok.com',
    'youtube.com',
    'reddit.com',
    'pinterest.com',
    'snapchat.com',
    'whatsapp.com',
    'telegram.org',
    'discord.com',
    'twitch.tv',
  ];
  
  // Helper to check if a URL is from a blacklisted domain
  export function isBlacklistedDomain(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return UNSUPPORTED_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false; // Invalid URL, let it through to be handled later
    }
  }
  
  // Calculate maxAge in milliseconds based on scout frequency
  export function getMaxAge(frequency: "daily" | "every_3_days" | "weekly" | null): number {
    switch (frequency) {
      case "daily":
        return 86400000; // 1 day in milliseconds
      case "every_3_days":
        return 259200000; // 3 days in milliseconds
      case "weekly":
        return 604800000; // 7 days in milliseconds
      default:
        return 86400000; // 1 day default
    }
  }