/**
 * Declared-agent tokens: lowercase substrings that, when found in a request's
 * User-Agent, mean the client announced itself as a crawler, an AI fetcher, or
 * an uptime or preview robot.
 *
 * This is DATA, not logic, so it can be edited without touching the
 * classifier. IT WILL GO STALE. New crawlers appear constantly and old ones
 * change their strings, so treat this list as a maintained file, not a fixed
 * one. Adding a line is the whole edit.
 *
 * Matching is a plain case-insensitive substring test, so every token here
 * must be distinctive enough not to appear inside an ordinary browser
 * User-Agent. A bare "bot" is deliberately absent: it matches phone model
 * names that appear in real Android strings.
 *
 * The User-Agent is read to derive one label and is then discarded. It is
 * never stored. See functions/lib/arrival-counting.ts.
 */
export const DECLARED_AGENT_TOKENS: readonly string[] = [
  // Search crawlers.
  'googlebot',
  'storebot-google',
  'google-inspectiontool',
  'bingbot',
  'bingpreview',
  'yandexbot',
  'duckduckbot',
  'duckduckgo-favicons-bot',
  'baiduspider',
  'slurp',
  'applebot',
  'sogou',
  'seznambot',
  'petalbot',
  'exabot',
  'mojeekbot',
  'qwantbot',
  'marginaliabot',

  // AI crawlers and assistant fetchers.
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-web',
  'claude-user',
  'claude-searchbot',
  'anthropic-ai',
  'perplexitybot',
  'perplexity-user',
  'google-extended',
  'ccbot',
  'bytespider',
  'amazonbot',
  'meta-externalagent',
  'meta-externalfetcher',
  'facebookbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'diffbot',
  'imagesiftbot',
  'omgili',
  'timpibot',
  'youbot',
  'ai2bot',
  'firecrawl',
  'mistralai-user',

  // Uptime, preview and link-unfurl fetchers.
  'uptimerobot',
  'pingdom',
  'statuscake',
  'betteruptime',
  'site24x7',
  'slackbot',
  'discordbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'embedly',
  'redditbot',
  'chrome-lighthouse',
  'headlesschrome',

  // Generic automation and scripted clients.
  'crawler',
  'spider',
  'scrapy',
  'python-requests',
  'python-httpx',
  'aiohttp',
  'curl/',
  'wget/',
  'go-http-client',
  'java/',
  'okhttp',
  'libwww-perl',
  'httpclient',
  'axios/',
  'node-fetch',
  'phantomjs',
  'puppeteer',
  'playwright',
];
