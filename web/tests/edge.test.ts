import { describe, expect, it } from 'vitest';
import { edgeErrorMessage } from '../src/data/edge';

const failed = (body: unknown, message = 'Edge Function returned a non-2xx status code') => ({ message, context: new Response(JSON.stringify(body), { status: 400 }) });

describe('the message from a failed Edge Function call', () => {
  it('is the reason the function gave, without its internal stage label', async () => {
    const m = await edgeErrorMessage(failed({ error: 'Finish your details first: signature on the terms and waiver.', stage: 'context' }), 'fallback');
    expect(m).toBe('Finish your details first: signature on the terms and waiver.');
    expect(m).not.toContain('context');
  });
  it('is the reason when there is no stage', async () => {
    expect(await edgeErrorMessage(failed({ error: 'Not allowed.' }), 'fallback')).toBe('Not allowed.');
  });
  it('falls back to the generic message when the body has no reason', async () => {
    expect(await edgeErrorMessage(failed({ stage: 'context' }), 'fallback')).toBe('Edge Function returned a non-2xx status code');
  });
  it('uses the fallback when there is nothing at all', async () => {
    expect(await edgeErrorMessage({ message: '' }, 'The payment service did not answer.')).toBe('The payment service did not answer.');
  });
});
