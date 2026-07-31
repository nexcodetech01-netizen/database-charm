import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

const CANONICAL = "https://nexos.nexxcode.com.br/data-deletion";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Exclusão de Dados — NexOS" },
      {
        name: "description",
        content:
          "Instruções para solicitar a exclusão de dados pessoais e desconectar integrações da plataforma NexOS.",
      },
      { property: "og:title", content: "Exclusão de Dados — NexOS" },
      {
        property: "og:description",
        content: "Como solicitar a exclusão dos seus dados no NexOS.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: DataDeletionPage,
});

function DataDeletionPage() {
  return (
    <LegalPage title="Exclusão de Dados" updatedAt="16 de julho de 2026">
      <p>
        Esta página explica como solicitar a exclusão dos dados pessoais tratados pelo
        <strong> NexOS</strong>, bem como a desconexão de integrações de terceiros (ex.:
        Facebook, Instagram e demais serviços da Meta) associadas à sua conta.
      </p>

      <h2>1. Exclusão pela própria plataforma</h2>
      <ol>
        <li>
          Acesse <a href="https://nexos.nexxcode.com.br">nexos.nexxcode.com.br</a> e faça
          login com suas credenciais.
        </li>
        <li>
          Vá em <strong>Configurações → Conta</strong> e utilize a opção{" "}
          <em>“Excluir conta”</em>.
        </li>
        <li>
          Confirme a solicitação. Sua conta e os dados operacionais associados serão
          removidos em até <strong>30 dias</strong>, exceto quando a retenção for exigida
          por obrigação legal (ex.: registros fiscais).
        </li>
      </ol>

      <h2>2. Desconexão de integrações Meta (Facebook / Instagram)</h2>
      <p>
        Se você conectou uma conta Meta ao NexOS e deseja que apaguemos os tokens e dados
        recebidos por essa integração:
      </p>
      <ol>
        <li>
          Acesse <strong>Configurações → Integrações → Meta</strong> e clique em{" "}
          <em>“Desconectar”</em>; ou
        </li>
        <li>
          Remova o app NexOS diretamente em{" "}
          <a
            href="https://www.facebook.com/settings?tab=business_tools"
            target="_blank"
            rel="noreferrer"
          >
            facebook.com/settings?tab=business_tools
          </a>
          .
        </li>
      </ol>
      <p>
        Ao desconectar, os tokens de acesso e os identificadores de páginas, contas do
        Instagram, Business Manager e catálogos vinculados serão excluídos em até{" "}
        <strong>7 dias</strong>.
      </p>

      <h2>3. Solicitação por e-mail</h2>
      <p>
        Caso não consiga acessar a plataforma, envie uma solicitação para{" "}
        <strong>privacidade@nexxcode.com.br</strong> com as seguintes informações:
      </p>
      <ul>
        <li>Nome completo;</li>
        <li>E-mail cadastrado na plataforma;</li>
        <li>
          Descrição do pedido (exclusão total da conta, exclusão apenas da integração Meta,
          etc.).
        </li>
      </ul>
      <p>
        Responderemos em até <strong>15 dias úteis</strong>, conforme previsto na Lei Geral
        de Proteção de Dados (LGPD).
      </p>

      <h2>4. O que é preservado</h2>
      <p>
        Podemos reter, de forma segregada e por prazo limitado, informações mínimas
        necessárias ao cumprimento de obrigações legais, regulatórias, contábeis ou para
        exercício regular de direitos em processos administrativos e judiciais.
      </p>

      <h2>5. Contato</h2>
      <p>
        Encarregado de tratamento de dados (DPO):{" "}
        <strong>privacidade@nexxcode.com.br</strong>.
      </p>
    </LegalPage>
  );
}
