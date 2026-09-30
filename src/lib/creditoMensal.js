// ---------------------------------------------------------------------------
// Pagamento mensal de crédito.
//
// No Base44 isto corria no servidor, no dia 27 de cada mês. Aqui não há
// servidor, por isso corre quando abres a app: verifica se falta criar algum
// pagamento e cria-o. Como pode ter passado mais de um mês sem abrires — ou
// sem passares o dia 27 com a app aberta — recupera também os meses em falta,
// coisa que a versão do servidor não fazia.
//
// A regra é a mesma: o último pagamento serve de molde, e o valor é o dele,
// excepto no último mês, em que se paga apenas o que falta para liquidar.
// ---------------------------------------------------------------------------

import { base44 } from '@/api/base44Client';

const CATEGORIA = 'Empréstimos';
const DIA_DE_PAGAMENTO = 27;

function dataDoPagamento(ano, mes) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(DIA_DE_PAGAMENTO).padStart(2, '0')}`;
}

export async function criarPagamentosEmFalta() {
  const criados = [];

  const veiculos = await base44.entities.Vehicle.list();
  const comEmprestimo = veiculos.filter((v) => Number(v.loan_amount) > 0);
  if (!comEmprestimo.length) return criados;

  const hoje = new Date();

  for (const veiculo of comEmprestimo) {
    const pagamentos = await base44.entities.Expense.filter(
      { vehicle_id: veiculo.id, category: CATEGORIA },
      '-date'
    );

    // Sem histórico não há molde: o primeiro pagamento é sempre manual.
    if (!pagamentos.length) continue;

    const molde = pagamentos[0];
    const mensalidade = Number(molde.amount) || 0;
    if (mensalidade <= 0) continue;

    let pago = pagamentos.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    let emFalta = Number(veiculo.loan_amount) - pago;
    if (emFalta <= 0) continue;

    const jaExiste = new Set(pagamentos.map((p) => p.date));

    // Percorre do mês a seguir ao último pagamento até ao mês corrente.
    const ultimo = new Date(`${molde.date}T00:00:00`);
    let ano = ultimo.getFullYear();
    let mes = ultimo.getMonth() + 1;

    while (emFalta > 0) {
      if (mes > 11) { mes = 0; ano += 1; }

      const data = dataDoPagamento(ano, mes);

      // Ainda não chegou o dia de pagamento deste mês.
      if (new Date(`${data}T00:00:00`) > hoje) break;

      if (!jaExiste.has(data)) {
        const valor = Number(Math.min(mensalidade, emFalta).toFixed(2));

        const novo = await base44.entities.Expense.create({
          vehicle_id: veiculo.id,
          category: CATEGORIA,
          sub_category: molde.sub_category || 'Crédito',
          amount: valor,
          date: data,
          location: molde.location || undefined,
          description: molde.description || undefined,
        });

        criados.push({ veiculo: `${veiculo.brand} ${veiculo.model}`, data, valor, id: novo.id });
        emFalta -= valor;
      }

      mes += 1;

      // Segurança: nunca mais de 120 meses de uma vez.
      if (criados.length > 120) break;
    }
  }

  return criados;
}
