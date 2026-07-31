interface Props {
  name: string;
  companyName: string;
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function Greeting({ name, companyName }: Props) {
  const first = name.split(" ")[0] || name;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {companyName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {timeGreeting()}, {first} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Aqui está um resumo do que está acontecendo no seu negócio hoje.
      </p>
    </div>
  );
}
