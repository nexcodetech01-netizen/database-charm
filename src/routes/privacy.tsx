import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

const CANONICAL = "https://nexos.nexxcode.com.br/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — NexOS" },
      {
        name: "description",
        content:
          "Como o NexOS coleta, utiliza, armazena e protege os dados dos seus usuários e clientes.",
      },
      { property: "og:title", content: "Política de Privacidade — NexOS" },
      {
        property: "og:description",
        content: "Como o NexOS trata os dados dos seus usuários e clientes.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="16 de julho de 2026">
      <p>
        Esta Política de Privacidade descreve como o <strong>NexOS</strong> (“nós”, “nosso”),
        operado pela NexxCode, coleta, utiliza, armazena e protege as informações pessoais
        tratadas por meio da plataforma disponível em{" "}
        <a href="https://nexos.nexxcode.com.br">nexos.nexxcode.com.br</a>.
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Dados de cadastro:</strong> nome, e-mail, telefone e dados da empresa
          fornecidos durante o onboarding.
        </li>
        <li>
          <strong>Dados operacionais:</strong> produtos, clientes, vendas, pagamentos e
          demais informações inseridas pelo próprio usuário para operar seu negócio.
        </li>
        <li>
          <strong>Dados técnicos:</strong> logs de acesso, endereço IP, tipo de navegador e
          identificadores de sessão, coletados para segurança e diagnóstico.
        </li>
        <li>
          <strong>Integrações:</strong> quando o usuário conecta serviços de terceiros (ex.:
          Meta, Asaas), coletamos apenas os tokens e identificadores necessários ao
          funcionamento da integração autorizada.
        </li>
      </ul>

      <h2>2. Finalidades do tratamento</h2>
      <ul>
        <li>Prover as funcionalidades contratadas da plataforma;</li>
        <li>Autenticar usuários e proteger contas contra acessos não autorizados;</li>
        <li>Processar pagamentos, emitir recibos e apoiar a gestão financeira;</li>
        <li>Enviar notificações operacionais e transacionais;</li>
        <li>Cumprir obrigações legais, regulatórias e fiscais.</li>
      </ul>

      <h2>3. Compartilhamento com terceiros</h2>
      <p>
        Compartilhamos dados exclusivamente com subprocessadores necessários à operação da
        plataforma — como provedores de infraestrutura, banco de dados, envio de e-mail,
        gateway de pagamento e integrações explicitamente ativadas pelo próprio usuário.
        Não vendemos dados pessoais.
      </p>

      <h2>4. Armazenamento e segurança</h2>
      <p>
        Aplicamos controles de segurança compatíveis com boas práticas de mercado, incluindo
        criptografia em trânsito (HTTPS), criptografia em repouso para credenciais sensíveis
        e controle de acesso baseado em papéis (RBAC). Tokens de integrações de terceiros
        são armazenados de forma criptografada.
      </p>

      <h2>5. Direitos do titular (LGPD)</h2>
      <p>
        Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o titular pode
        solicitar acesso, correção, portabilidade, anonimização, bloqueio ou eliminação de
        seus dados pessoais. Para exercer esses direitos, entre em contato pelos canais
        indicados no item 8.
      </p>

      <h2>6. Retenção</h2>
      <p>
        Mantemos os dados pelo tempo necessário para prestar o serviço e cumprir obrigações
        legais. Após o encerramento da conta, dados operacionais podem ser removidos
        conforme descrito em nossa página de{" "}
        <a href="/data-deletion">Exclusão de dados</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Utilizamos cookies estritamente necessários para autenticação e preferências de
        interface (ex.: tema claro/escuro). Não utilizamos cookies de rastreamento
        publicitário de terceiros na área autenticada.
      </p>

      <h2>8. Contato</h2>
      <p>
        Encarregado de tratamento de dados (DPO): <strong>privacidade@nexxcode.com.br</strong>.
        Responderemos solicitações em até 15 dias úteis.
      </p>
    </LegalPage>
  );
}
