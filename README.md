# Controle de Viaturas — CPA-7

Sistema de controle de viaturas do Comando de Policiamento da Fronteira Bioceânica (PMMS).
Desenvolvido por **ST Galassi**.

## Arquivos
- `index.html`, `app.js`, `styles.css` — aplicativo
- `assets/brasao_pmms.png` — brasão (otimizado)
- `manifest.json`, `sw.js`, `icon-*.png` — instalação como aplicativo no celular

Os dados ficam no Firebase (documento `app/state`), no mesmo formato da versão anterior.

## v13 — redesenho visual
- Novo visual: tipografia e espaçamento revistos, ícones SVG no lugar dos emojis, cores institucionais (azul-marinho e verde).
- Removido o `zoom: 0.5` do computador: a interface agora tem tamanho real, nítida e responsiva.
- Login em duas colunas (computador) e cartão sobre o cabeçalho (celular), com botão para mostrar a senha.
- Painel: cartões com ícones, barra de situação da frota (em dia / alerta / vencidas) e lista das trocas a fazer.
- Viaturas: placa em formato de placa Mercosul e **medidor de troca de óleo** (KM rodado desde a última troca).
- Motorista: menu lateral com iniciais, resumo da viatura com medidor e cartões de ação maiores para o celular.
- Relatório impresso com cabeçalho institucional e situação colorida.
- Brasão reduzido de 1,7 MB para 175 KB.

## v12
- Interface no computador reduzida para 60% (variável `--escala` no fim do styles.css).

## v11 — correções
- Botão **Viaturas** voltava sozinho para o Painel a cada sincronização do Firebase. Agora a tela atual é mantida.
- Menu inexistente no celular/tablet: criado menu inferior para administrador e motorista.
- Unidades com apóstrofo no nome (ex.: D'Oeste) quebravam os botões.
- Cancelar a "Troca de óleo" registrava uma troca no KM 0.
- Aviso de troca **vencida** aparecia em branco para o motorista.
- Filtro "Todas as unidades" não removia o filtro da unidade.
- Gravações simultâneas de dois usuários podiam apagar lançamentos (agora usa transação).
- Datas no fuso UTC (após 20h aparecia o dia seguinte).
- Brasão não aparecia no relatório; situação "ALERTA" sem cor no relatório.
- Senha inicial informada errada quando o administrador alterava a senha padrão.

## v11 — melhorias
- KM, troca de óleo e senha em janelas próprias com validação (no lugar das caixas do navegador).
- Excluir viatura, renomear unidade, excluir registro de manutenção.
- Filtro por viatura e total gasto em Manutenções.
- Motorista: viaturas da própria unidade primeiro; histórico "somente os meus".
- Motorista desativado perde o acesso na hora.
- Entrar com a tecla Enter; mensagens de erro mais claras.
- Brasão reduzido de 1,7 MB para 210 KB (carrega mais rápido no 4G da fronteira).
