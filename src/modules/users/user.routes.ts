import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';

export async function userRoutes(app: FastifyInstance) {
  // 👤 Cadastrar Vendedores (Admin da Loja)
  app.post('/api/sellers', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');
      const decoded = app.jwt.verify<{ companyId: string }>(token);

      const { name, email, password, phone } = req.body as any;

      const hashedPassword = await bcrypt.hash(password || '123456', 10);
      const seller = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone,
          role: 'SELLER',
          companyId: decoded.companyId,
        },
      });

      return reply.status(201).send({ seller });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar vendedor' });
    }
  });
}
