import ejs from 'ejs';
import path from 'path';

export interface ProposalEmailPayload {
  toEmail: string;
  clientName: string;
  proposal: any;
  company: any;
  publicUrl: string;
}

export async function sendProposalEmail(payload: ProposalEmailPayload): Promise<boolean> {
  try {
    const templatePath = path.join(__dirname, '../views/proposal-email.ejs');

    const htmlContent = await ejs.renderFile(templatePath, {
      proposal: payload.proposal,
      company: payload.company,
      publicUrl: payload.publicUrl,
    });

    console.log(`📧 [DISPARO DE E-MAIL] Processando envio de proposta em HTML para ${payload.toEmail}...`);

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'SimAprova Propostas <propostas@simaprova.com.br>',
          to: [payload.toEmail],
          subject: `📋 Proposta Comercial - ${payload.proposal.title}`,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`✅ [E-MAIL ENTREGUE COM SUCESSO] E-mail enviado para ${payload.toEmail} via Resend!`);
        return true;
      } else {
        const errData = await response.json();
        console.warn('⚠️ Erro na resposta do Resend:', errData);
      }
    } else {
      console.log(`ℹ️ [E-MAIL SIMULADO EM PRODUÇÃO/DEV] HTML gerado para ${payload.toEmail}. Link: ${payload.publicUrl}`);
    }

    return true;
  } catch (err: any) {
    console.error('❌ Falha ao processar envio de e-mail:', err.message);
    return false;
  }
}
