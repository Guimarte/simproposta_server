import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados SimProposta...');

  // 1. Criar Super Admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@simproposta.com' },
    update: {},
    create: {
      name: 'Super Admin SimProposta',
      email: 'admin@simproposta.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Super Admin criado:', superAdmin.email);

  // 2. Criar Empresa Cliente de Exemplo
  const company = await prisma.company.create({
    data: {
      name: 'Agência Soluções Digitais',
      cnpj: '12.345.678/0001-90',
      logoUrl: '',
      primaryColor: '#10B981',
      planStatus: 'ACTIVE',
      maxSellers: 5,
    },
  });

  console.log('✅ Empresa criada:', company.name);

  // 3. Criar Vendedor da Empresa
  const sellerPassword = await bcrypt.hash('vendedor123', 10);
  const seller = await prisma.user.create({
    data: {
      name: 'Carlos Vendedor',
      email: 'carlos@agenciasolucao.com.br',
      password: sellerPassword,
      phone: '11999998888',
      role: 'COMPANY_ADMIN',
      companyId: company.id,
    },
  });

  console.log('✅ Vendedor criado:', seller.email);

  // 4. Criar Proposta de Exemplo
  const proposal = await prisma.proposal.create({
    data: {
      slug: 'redesign-ecommerce-abc',
      title: 'Proposta Comercial - Redesign & Tráfego Pago',
      clientName: 'Loja ABC E-commerce',
      clientEmail: 'diretoria@lojaabc.com.br',
      clientPhone: '11988887777',
      totalValue: 8500.0,
      status: 'SENT',
      companyId: company.id,
      userId: seller.id,
      blocks: {
        create: [
          {
            type: 'TEXT',
            title: 'Objetivo do Projeto',
            content: JSON.stringify({
              text: 'Desenvolvimento de uma nova plataforma de e-commerce integrada com sistema de pagamentos Pix, cartão de crédito e régua de automação no WhatsApp.',
            }),
            order: 1,
          },
          {
            type: 'VIDEO',
            title: 'Vídeo de Apresentação da Equipe',
            content: JSON.stringify({
              videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            }),
            order: 2,
          },
          {
            type: 'PRICE_TABLE',
            title: 'Investimento & Pacotes',
            content: JSON.stringify({
              items: [
                {
                  name: 'Desenvolvimento do E-commerce Next.js',
                  description: 'Design responsivo, alta velocidade e SEO otimizado.',
                  price: 5500.0,
                },
                {
                  name: 'Gestão de Tráfego Pago (3 Meses)',
                  description: 'Campanhas no Meta Ads e Google Ads com foco em ROI.',
                  price: 3000.0,
                },
              ],
            }),
            order: 3,
          },
        ],
      },
    },
  });

  console.log('✅ Proposta criada:', proposal.slug);
  console.log('🎉 Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
