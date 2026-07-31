import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

const CANONICAL = "https://nexos.nexxcode.com.br/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — NexOS" },
      {
        name: "description",
        content:
          "Condições gerais de uso da plataforma NexOS, incluindo direitos, deveres e responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — NexOS" },
      {
        property: "og:description",
        content: "Condições gerais de uso da plataforma NexOS.",
      },
      { property: "og:url", content: CANONICAL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="16 de julho de 2026">
      <p>
        Estes Termos de Uso regulam a utilização da plataforma <strong>NexOS</strong>,
        operada pela NexxCode, disponível em{" "}
        <a href="https://nexos.nexxcode.com.br">nexos.nexxcode.com.br</a>. Ao criar uma
        conta ou utilizar o serviço, o usuário declara estar de acordo com este documento.
      </p>

      <h2>1. Objeto</h2>
      <p>
        O NexOS é uma plataforma SaaS de gestão empresarial que oferece módulos de vendas,
        estoque, financeiro, catálogo, CRM e integrações com serviços de terceiros.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>O usuário é responsável pela veracidade das informações fornecidas;</li>
        <li>É vedado compartilhar credenciais de acesso;</li>
        <li>Contas inativas ou em desacordo com estes Termos podem ser suspensas.</li>
      </ul>

      <h2>3. Uso permitido</h2>
      <p>
        O usuário compromete-se a utilizar a plataforma exclusivamente para fins lícitos
        relacionados à gestão do seu próprio negócio. É proibido:
      </p>
      <ul>
        <li>Utilizar o serviço para práticas fraudulentas, spam ou atividades ilegais;</li>
        <li>Realizar engenharia reversa, cópia ou distribuição do software;</li>
        <li>Interferir na infraestrutura ou tentar acessar dados de outros usuários.</li>
      </ul>

      <h2>4. Integrações de terceiros</h2>
      <p>
        Ao conectar contas de terceiros (ex.: Meta, Asaas), o usuário concede ao NexOS
        autorização para executar as operações permitidas pelos respectivos escopos. A
        conexão pode ser revogada a qualquer momento nas configurações da plataforma ou
        diretamente no provedor.
      </p>

      <h2>5. Pagamentos e assinatura</h2>
      <p>
        As condições comerciais (plano, valores, ciclo de cobrança) são definidas no
        momento da contratação. O não pagamento pode resultar em suspensão do acesso.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        Todo o código, marca, interface e materiais do NexOS são de propriedade da
        NexxCode. Os dados inseridos pelo usuário permanecem de sua titularidade.
      </p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>
        O NexOS é fornecido “como está”. Envidamos esforços razoáveis para manter o serviço
        disponível e seguro, mas não garantimos operação ininterrupta ou livre de erros. Na
        máxima extensão permitida pela legislação, não seremos responsáveis por danos
        indiretos, lucros cessantes ou perda de dados decorrentes do uso do serviço.
      </p>

      <h2>8. Rescisão</h2>
      <p>
        O usuário pode encerrar a conta a qualquer momento. Após o encerramento, seus dados
        serão tratados conforme descrito na página de{" "}
        <a href="/data-deletion">Exclusão de dados</a>.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão
        comunicadas pelos canais oficiais da plataforma.
      </p>

      <h2>10. Legislação e foro</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca da
        sede da NexxCode para dirimir eventuais controvérsias.
      </p>

      <h2>11. Contato</h2>
      <p>
        Dúvidas sobre estes Termos: <strong>contato@nexxcode.com.br</strong>.
      </p>
    </LegalPage>
  );
}
