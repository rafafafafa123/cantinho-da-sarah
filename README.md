# Cantinho da Sarah — edição mobile

Mini arcade em HTML, CSS e JavaScript puro. Funciona localmente e no GitHub Pages.

## Imagens dos personagens

Adicione os arquivos abaixo à pasta `assets/` (mantenha estes nomes):

- `imagem1.png` — Zenitsu
- `imagem2.png` — Nezuko
- `imagem3.png` — Sky
- `imagem4.png` — Shadow

PNG com fundo transparente funciona melhor. Caso alguma imagem ainda não tenha sido colocada, o jogo mostra um ícone substituto em vez de deixar um espaço vazio.

## Os três jogos

### Foge, Nezuko!
- Movimento por toque e arraste no celular; mouse no computador.
- Zenitsu persegue a posição da Nezuko com velocidade controlada e dificuldade gradual.
- A Respiração do Trovão só pode acontecer durante uma partida ativa. Primeiro há um aviso visual, depois vem a arrancada.
- Dash com botão grande, custo de fôlego e tempo de recarga.
- Pétalas aparecem durante a fuga e recuperam parte do fôlego.
- A partida pausa ao sair da aba/aplicativo.

### Sky vs Shadow
- Escolha jogar com Sky ou Shadow.
- Combate por turnos contra o outro gato, com HP, dano variável, combos, bote, esquiva, petiscos limitados e encarada.
- O Despertar/Chaos Control é exclusivo do Shadow. Quando ele está sob controle da IA, também pode ativar a habilidade.
- Ações ficam bloqueadas durante o turno do adversário para evitar cliques duplicados.

### Cadê o Shadow?
- Dez cenários com decoração e esconderijos que mudam.
- Três chances para concluir a busca.
- Alvos falsos reduzem o tempo, e o Shadow se movimenta nas últimas rodadas.
- Duas pistas por partida, combo e pontuação por velocidade.
- Áreas de toque dos personagens maiores para uso confortável no celular.

## Publicar no GitHub Pages

1. Extraia o ZIP.
2. Envie o conteúdo da pasta do projeto para um repositório GitHub.
3. Em **Settings → Pages**, selecione a branch e a pasta de publicação.
4. Abra o endereço publicado no celular.

Não há dependências de servidor, bibliotecas JavaScript ou chamadas de API. Os efeitos sonoros são sintetizados pelo navegador e podem ser desligados no botão de som.
