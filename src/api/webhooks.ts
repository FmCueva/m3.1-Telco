// src/api/webhooks.ts — webhooks de instalación y facturación (FR-DOM-009/010/011, NFR-SEC-001).
// Firma HMAC-SHA256 hex en la cabecera x-signature, calculada sobre el cuerpo crudo.
// Capa delgada: la regla de la transición vive en transition() (dominio).

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { transition } from '../domain/serviceTransitions';
import type { ServiceEvent } from '../domain/types';

const installationBody = z.object({ contractId: z.string().min(1) });
const billingBody = z.object({
  contractId: z.string().min(1),
  event: z.enum(['PAYMENT_DEFAULT', 'PAYMENT_REGULARIZED']),
});
const BILLING_EVENTS: Record<'PAYMENT_DEFAULT' | 'PAYMENT_REGULARIZED', ServiceEvent> =
  {
    PAYMENT_DEFAULT: 'paymentDefault',
    PAYMENT_REGULARIZED: 'paymentRegularized',
  };

const err = (code: string, message: string) => ({ code, message });

function validSignature(secret: string | undefined, raw: string, header: unknown) {
  if (!secret || typeof header !== 'string') return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(header, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function applyEvent(app: FastifyInstance, contractId: string, event: ServiceEvent) {
  const contract = app.store.getContract(contractId);
  if (!contract) return undefined;
  return app.store.putContract({
    ...contract,
    status: transition(contract.status, event),
  });
}

export function registerWebhookRoutes(app: FastifyInstance, secret?: string): void {
  // Scope propio: solo estas rutas conservan el cuerpo crudo para verificar la firma.
  void app.register(async (scope) => {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (req, body, done) => {
        (req as FastifyRequest & { rawBody?: string }).rawBody = body as string;
        try {
          done(null, JSON.parse(body as string));
        } catch {
          done(
            Object.assign(new Error('JSON inválido'), { statusCode: 400 }),
            undefined,
          );
        }
      },
    );
    // La firma se comprueba ANTES de validar el cuerpo: sin firma no se revela nada más.
    scope.addHook('preHandler', async (request, reply) => {
      const raw = (request as FastifyRequest & { rawBody?: string }).rawBody ?? '';
      if (!validSignature(secret, raw, request.headers['x-signature']))
        return reply.status(401).send(err('INVALID_SIGNATURE', 'Firma inválida'));
    });

    scope.post('/webhooks/installation', async (request, reply) => {
      const { contractId } = installationBody.parse(request.body);
      const updated = applyEvent(app, contractId, 'installationCompleted');
      if (!updated)
        return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
      return updated;
    });

    scope.post('/webhooks/billing', async (request, reply) => {
      const { contractId, event } = billingBody.parse(request.body);
      const updated = applyEvent(app, contractId, BILLING_EVENTS[event]);
      if (!updated)
        return reply.status(404).send(err('CONTRACT_NOT_FOUND', 'Contrato no existe'));
      return updated;
    });
  });
}
