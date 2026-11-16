import { afterEach, describe, expect, it, vi } from 'vitest';
import { Invidious, requestJson } from '../src/api';
import { defaultLibrary } from '../src/model';
afterEach(() => vi.unstubAllGlobals());
describe('Invidious client', () => {
  it('does not treat HTML challenge pages as successful API responses', async () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Challenge</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(requestJson('https://example.com/api/v1/search')).rejects.toThrow('web page');
  });
  it('reports rate limiting without retry storms', async () => {
    vi.stubGlobal('window', {}); const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 })); vi.stubGlobal('fetch', fetcher);
    await expect(requestJson('https://example.com/api/v1/search')).rejects.toThrow('429'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('routes audio through the selected instance with local proxy enabled', () => {
    const api = new Invidious({ ...defaultLibrary().settings, instance: 'https://example.com' });
    expect(api.stream('5NV6Rdv1a3I', '140')).toBe('https://example.com/latest_version?id=5NV6Rdv1a3I&itag=140&local=true');
  });
  it('reuses resolved proxy URLs but never accepts a different media origin',()=>{
    const api = new Invidious({...defaultLibrary().settings,instance:'https://example.com'});
    expect(api.stream('5NV6Rdv1a3I','140','https://example.com/videoplayback?token=abc')).toBe('https://example.com/videoplayback?token=abc');
    for(const url of ['https://googlevideo.com/videoplayback?token=abc','https://example.com/other','https://user:pass@example.com/videoplayback']) expect(api.stream('5NV6Rdv1a3I','140',url)).toContain('/latest_version?');
  });
  it('does not return late native/desktop results after navigation aborts', async () => {
    const abort = new AbortController(); vi.stubGlobal('window', { kubeDesktop: { request: async () => { abort.abort(); return []; } } });
    await expect(requestJson('https://example.com/api/v1/search', abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
