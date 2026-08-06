import { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/prisma';

export async function proposalRoutes(app: FastifyInstance) {
  // 📝 Cadastrar Nova Proposta
  app.post('/api/proposals', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');
      const decoded = app.jwt.verify<{ userId: string; companyId: string }>(token);

      const { title, clientName, clientEmail, clientPhone, totalValue, blocks } = req.body as any;

      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;

      const proposal = await prisma.proposal.create({
        data: {
          slug,
          title,
          clientName,
          clientEmail,
          clientPhone,
          totalValue: parseFloat(totalValue) || 0,
          companyId: decoded.companyId,
          userId: decoded.userId,
          blocks: {
            create: (blocks || []).map((b: any, index: number) => ({
              type: b.type || 'TEXT',
              title: b.title || '',
              content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
              order: index + 1,
            })),
          },
        },
        include: { blocks: true },
      });

      return reply.status(201).send({ proposal });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar proposta' });
    }
  });

  // 📋 Listar Propostas
  app.get('/api/proposals', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');
      const decoded = app.jwt.verify<{ userId: string; role: string; companyId: string }>(token);

      const proposals = await prisma.proposal.findMany({
        where: decoded.role === 'SUPER_ADMIN' ? {} : { companyId: decoded.companyId },
        include: {
          company: true,
          user: true,
          views: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { proposals };
    } catch (err) {
      return reply.status(401).send({ error: 'Sessão expirada' });
    }
  });

  // ✍️ ACEITE DIGITAL / APROVAÇÃO DA PROPOSTA
  app.post('/api/proposals/:id/accept', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const { signerName, signerDoc, signerEmail } = req.body as { signerName: string; signerDoc: string; signerEmail: string };

      const proposal = await prisma.proposal.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
        },
      });

      console.log(`🎉 [APROVAÇÃO DIGITAL] Proposta ${proposal.title} foi aprovada por ${signerName} (Doc: ${signerDoc})!`);

      return { success: true, message: 'Proposta aprovada com sucesso!', proposal };
    } catch (err: any) {
      return reply.status(400).send({ error: 'Erro ao aprovar proposta' });
    }
  });

  // 📄 ROTA PÚBLICA DA PROPOSTA (HTML Renderizado)
  app.get('/p/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const proposal = await prisma.proposal.findUnique({
      where: { slug },
      include: {
        company: true,
        blocks: { orderBy: { order: 'asc' } },
      },
    });

    if (!proposal) {
      return reply.status(404).send('Proposta não encontrada');
    }

    const blocksFormatted = proposal.blocks.map((b) => ({
      ...b,
      content: typeof b.content === 'string' ? JSON.parse(b.content) : b.content,
    }));

    return reply.view('proposal.ejs', {
      proposal,
      company: proposal.company,
      blocks: blocksFormatted,
    });
  });

  // 🚨 RASTREAMENTO EM TEMPO REAL
  app.post('/api/track/open', async (req, reply) => {
    const { proposalId, userAgent } = req.body as { proposalId: string; userAgent: string };

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'VIEWED' },
    });

    const viewEvent = await prisma.viewEvent.create({
      data: {
        proposalId,
        userAgent,
        durationSec: 0,
      },
    });

    return { success: true, eventId: viewEvent.id };
  });

  app.post('/api/track/ping', async (req, reply) => {
    const { proposalId, durationSec } = req.body as { proposalId: string; durationSec: number };

    await prisma.viewEvent.create({
      data: { proposalId, durationSec },
    });

    return { success: true };
  });
}
