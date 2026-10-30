// tests/contract/webhooks.api.test.ts — webhooks de instalación y facturación con firma HMAC-SHA256.

import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, seed } from '../helpers/testApp';

const SECRET = 'secreto-de-test';

let current: FastifyInstance | undefined;

const sign = (body: string, secret = SECRET) =>
  createHmac('sha256', secret).update(body).digest('hex');

async function setup(status: 'PENDING_INSTALLATION' | 'ACTIVE' | 'SUSPENDED') {
  const app = await buildTestApp({ webhookSecret: SECRET });
  current = app;
  return { app, contract: await seed.contract(app, { status }) };
}

function post(app: FastifyInstance, url: string, payload: object, signature?: string) {
  const body = JSON.stringify(payload);
  return app.inject({
    method: 'POST',
    url,
    headers: {
      'content-type': 'application/json',
      ...(signature === undefined ? {} : { 'x-signature': signature }),
    },
    payload: body,
  });
}

const signed = (app: FastifyInstance, url: string, payload: object) =>
  post(app, url, payload, sign(JSON.stringify(payload)));

afterEach(async () => {
  await current?.close();
});

describe('POST /webhooks/installation', () => {
  // @AC-TELCO-001
  it('INSTALLATION_COMPLETED con firma válida → 200 y ACTIVE', async () => {
    const { app, contract } = await setup('PENDING_INSTALLATION');

    const res = await signed(app, '/webhooks/installation', {
      contractId: contract.id,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ACTIVE' });
    expect((await app.store.getContract(contract.id))?.status).toBe('ACTIVE');
  });

  // @AC-TELCO-015
  it.each([
    ['ausente', undefined],
    ['inválida', 'deadbeef'],
    ['de otro secreto', sign('{"contractId":"x"}', 'otro-secreto')],
  ])('firma %s → 401 y no altera el estado', async (_caso, signature) => {
    const { app, contract } = await setup('PENDING_INSTALLATION');

    const res = await post(
      app,
      '/webhooks/installation',
      { contractId: contract.id },
      signature,
    );

    expect(res.statusCode).toBe(401);
    expect((await app.store.getContract(contract.id))?.status).toBe(
      'PENDING_INSTALLATION',
    );
  });

  // @AC-TELCO-015
  it('sin secreto configurado rechaza todo (401)', async () => {
    const app = await buildTestApp();
    current = app;
    const contract = await seed.contract(app, { status: 'PENDING_INSTALLATION' });

    const res = await signed(app, '/webhooks/installation', {
      contractId: contract.id,
    });

    expect(res.statusCode).toBe(401);
  });

  // @AC-TELCO-001
  it('servicio fuera de PENDING_INSTALLATION → 409', async () => {
    const { app, contract } = await setup('ACTIVE');

    const res = await signed(app, '/webhooks/installation', {
      contractId: contract.id,
    });

    expect(res.statusCode).toBe(409);
  });

  // @AC-TELCO-001
  it('contrato inexistente → 404 y cuerpo inválido con firma válida → 400', async () => {
    const { app } = await setup('PENDING_INSTALLATION');

    const missing = await signed(app, '/webhooks/installation', { contractId: 'no' });
    const invalid = await signed(app, '/webhooks/installation', {});

    expect(missing.statusCode).toBe(404);
    expect(invalid.statusCode).toBe(400);
  });
});

describe('POST /webhooks/billing', () => {
  // @AC-TELCO-016
  it('PAYMENT_DEFAULT suspende y PAYMENT_REGULARIZED reactiva', async () => {
    const { app, contract } = await setup('ACTIVE');

    const suspend = await signed(app, '/webhooks/billing', {
      contractId: contract.id,
      event: 'PAYMENT_DEFAULT',
    });
    expect(suspend.json()).toMatchObject({ status: 'SUSPENDED' });

    const reactivate = await signed(app, '/webhooks/billing', {
      contractId: contract.id,
      event: 'PAYMENT_REGULARIZED',
    });
    expect(reactivate.statusCode).toBe(200);
    expect(reactivate.json()).toMatchObject({ status: 'ACTIVE' });
  });

  // @AC-TELCO-016
  it.each([
    ['PAYMENT_DEFAULT', 'SUSPENDED'],
    ['PAYMENT_REGULARIZED', 'ACTIVE'],
  ] as const)('%s fuera de su estado de origen → 409', async (event, status) => {
    const { app, contract } = await setup(status);

    const res = await signed(app, '/webhooks/billing', {
      contractId: contract.id,
      event,
    });

    expect(res.statusCode).toBe(409);
    expect((await app.store.getContract(contract.id))?.status).toBe(status);
  });

  // @AC-TELCO-015
  it('firma inválida → 401 y no altera el estado', async () => {
    const { app, contract } = await setup('ACTIVE');

    const res = await post(
      app,
      '/webhooks/billing',
      { contractId: contract.id, event: 'PAYMENT_DEFAULT' },
      'deadbeef',
    );

    expect(res.statusCode).toBe(401);
    expect((await app.store.getContract(contract.id))?.status).toBe('ACTIVE');
  });
});
