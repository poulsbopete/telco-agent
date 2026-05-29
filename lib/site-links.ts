export const GITHUB_REPO_URL = "https://github.com/poulsbopete/telco-agent";
export const SLIDES_URL = "https://poulsbopete.github.io/telco-agent/";

/** Optional override for slides badge on the live demo (defaults to SLIDES_URL). */
export const PUBLIC_SLIDES_URL =
  process.env.NEXT_PUBLIC_SLIDES_URL?.replace(/\/$/, "") || SLIDES_URL;

export const PUBLIC_GITHUB_REPO_URL =
  process.env.NEXT_PUBLIC_GITHUB_REPO_URL?.replace(/\/$/, "") || GITHUB_REPO_URL;
