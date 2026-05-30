const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

if (!NEXT_PUBLIC_SITE_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL is required in production')
  } else {
    console.warn('NEXT_PUBLIC_SITE_URL is not set, using default')
  }
}

export const env = {
  NEXT_PUBLIC_SITE_URL: NEXT_PUBLIC_SITE_URL ?? 'https://eta.hkjc.uk',
}
