# Controle de Viaturas — CPA-7

Sistema de controle de viaturas do Comando de Policiamento da Fronteira Bioceânica (PMMS).
Desenvolvido por **ST Galassi**.

## Arquivos
- `index.html`, `app.js`, `styles.css` — aplicativo
- `assets/brasao_pmms.png` — brasão (otimizado)
- `manifest.json`, `sw.js`, `icon-*.png` — instalação como aplicativo no celular

Os dados ficam no Firebase (documento `app/state`), no mesmo formato da versão anterior.

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
