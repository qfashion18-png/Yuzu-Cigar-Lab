export const productionSiteUrl = "https://www.yuzucigarclub.com";

export const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? productionSiteUrl;
