export function allowedArtistImage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.port === '' &&
      ['lh3.googleusercontent.com','yt3.ggpht.com','yt3.googleusercontent.com'].includes(url.hostname);
  } catch { return false; }
}
export function artistImage(value: string) {
  return allowedArtistImage(value) ? 'https://kube.jamesd.uk/catalog/image?url=' + encodeURIComponent(value) : '';
}
