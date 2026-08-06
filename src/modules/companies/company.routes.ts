import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';

export async function companyRoutes(app: FastifyInstance) {
  // 🏢 Cadastrar Nova Loja / Empresa (Supervisor)
  app.post('/api/admin/companies', async (req, reply) => {
    try {
      const { name, cnpj, logoUrl, primaryColor, maxSellers, adminName, adminEmail, adminPassword } = req.body as any;

      const company = await prisma.company.create({
        data: {
          name,
          cnpj,
          logoUrl: logoUrl || '',
          primaryColor: primaryColor || '#10B981',
          maxSellers: maxSellers || 5,
          planStatus: 'ACTIVE',
        },
      });

      const hashedPassword = await bcrypt.hash(adminPassword || '123456', 10);
      const adminUser = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'COMPANY_ADMIN',
          companyId: company.id,
        },
      });

      return reply.status(201).send({ company, adminUser });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao cadastrar empresa' });
    }
  });

  // 🏢 Listar Lojas (Supervisor)
  app.get('/api/admin/companies', async (req, reply) => {
    const companies = await prisma.company.findMany({
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { proposals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { companies };
  });

  // 🎨 Alterar Tema / Logo da Proposta (Admin)
  app.patch('/api/companies/theme', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');
      const decoded = app.jwt.verify<{ companyId: string }>(token);

      const { logoUrl, primaryColor } = req.body as { logoUrl?: string; primaryColor?: string };

      const updatedCompany = await prisma.company.update({
        where: { id: decoded.companyId },
        data: {
          ...(logoUrl !== undefined && { logoUrl }),
          ...(primaryColor !== undefined && { primaryColor }),
        },
      });

      return { company: updatedCompany };
    } catch (err) {
      return reply.status(401).send({ error: 'Falha ao atualizar tema da empresa' });
    }
  });
}
