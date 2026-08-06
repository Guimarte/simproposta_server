import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';
import { supabase } from '../../shared/supabase';

export async function companyRoutes(app: FastifyInstance) {
  // 🏢 Cadastrar Nova Loja / Empresa (Supervisor)
  app.post('/api/admin/companies', async (req, reply) => {
    try {
      const { name, cnpj, logoUrl, primaryColor, maxSellers, adminName, adminEmail, adminPassword } = req.body as any;

      if (!name || !adminEmail) {
        return reply.status(400).send({ error: 'Nome da loja e e-mail do admin são obrigatórios' });
      }

      // 1. Criar a empresa no banco relacional
      const company = await prisma.company.create({
        data: {
          name,
          cnpj: cnpj || null,
          logoUrl: logoUrl || '',
          primaryColor: primaryColor || '#066B63',
          maxSellers: parseInt(maxSellers) || 5,
          planStatus: 'ACTIVE',
        },
      });

      // 2. Criptografar a senha do Admin da Loja
      const rawPassword = adminPassword || 'Mudar123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      // 3. Criar o usuário Admin da Loja no Prisma (role: COMPANY_ADMIN)
      const adminUser = await prisma.user.create({
        data: {
          name: adminName || `Admin ${name}`,
          email: adminEmail,
          password: hashedPassword,
          role: 'COMPANY_ADMIN',
          companyId: company.id,
        },
      });

      // 4. Registrar o usuário no Supabase Auth para permitir login gerenciado
      try {
        await supabase.auth.signUp({
          email: adminEmail,
          password: rawPassword,
          options: {
            data: {
              name: adminUser.name,
              role: 'COMPANY_ADMIN',
              companyId: company.id,
            },
          },
        });
      } catch (supabaseErr) {
        console.warn('⚠️ Nota: Supabase Auth já registrado ou em modo local fallback.');
      }

      return reply.status(201).send({
        success: true,
        message: `Loja ${name} cadastrada com sucesso!`,
        company,
        adminUser: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
      });
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

  // 🎨 Alterar Tema / Logo da Proposta (Admin da Loja)
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
