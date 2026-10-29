import { describe, expect, it } from 'vitest';
import { popupAction } from './popupPolicy';

const origin = 'https://app.hiveop.io';

describe('popupAction', () => {
  const table: Array<[string, string, ReturnType<typeof popupAction>]> = [
    ['stripe return to site', 'https://app.hiveop.io/billing?session=1', 'return'],
    ['cancel url on site', 'https://app.hiveop.io/billing?cancelled=1', 'return'],
    ['github setup url on site', 'https://app.hiveop.io/settings/github?installation_id=9', 'return'],
    ['stripe hosted page', 'https://checkout.stripe.com/c/pay/cs_1', 'stay'],
    ['stripe 3ds hop', 'https://hooks.stripe.com/3d_secure/x', 'stay'],
    ['github install page', 'https://github.com/apps/hiveop/installations/new', 'stay'],
    ['github login inside install', 'https://github.com/login?return_to=x', 'stay'],
    ['lookalike host is not the site', 'https://app.hiveop.io.evil.com/', 'stay'],
    ['userinfo trick is not the site', 'https://app.hiveop.io@evil.com/', 'stay'],
    ['site on another port', 'https://app.hiveop.io:8443/', 'stay'],
    ['javascript scheme', 'javascript:alert(1)', 'block'],
    ['file scheme', 'file:///etc/passwd', 'block'],
    ['hiveop scheme', 'hiveop://open?path=/x', 'block'],
    ['garbage', 'not a url', 'block'],
  ];
  it.each(table)('%s', (_n, url, want) => {
    expect(popupAction(url, origin)).toBe(want);
  });
  it('matches a localhost dev site', () => {
    expect(popupAction('http://localhost:3000/x', 'http://localhost:3000')).toBe('return');
  });
});
