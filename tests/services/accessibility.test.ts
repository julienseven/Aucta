import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Countdown } from '@/components/countdown';
import { Alert, Feedback } from '@/components/ui';

describe('shared accessibility semantics', () => {
  it('exposes countdowns as non-interrupting timers and hides visual-only units', () => {
    const html = renderToStaticMarkup(createElement(Countdown, {
      endsAt: '2026-09-21T01:01:01.000Z',
      serverTime: '2026-09-21T00:00:00.000Z',
    }));

    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-live="off"');
    expect(html).toContain('aria-label="Time remaining 01:01:01"');
    expect(html).toContain('class="timer-units" aria-hidden="true"');
  });

  it('announces feedback and alerts atomically', () => {
    const feedback = renderToStaticMarkup(createElement(Feedback, { message: 'Bid accepted.' }));
    const error = renderToStaticMarkup(createElement(Alert, { tone: 'danger' }, 'Bid could not be accepted.'));

    expect(feedback).toContain('role="status"');
    expect(feedback).toContain('aria-atomic="true"');
    expect(error).toContain('role="alert"');
    expect(error).toContain('aria-atomic="true"');
  });
});
