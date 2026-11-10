---
date: 2026-11-09
author: Bruno Bacelar Abe
status: approved
related:
  - research/features/movie-universe/roadmap.md
tags: [frontend, flutter, flame, performance, spike]
---

# Universo de Filmes — Fase 0 (spike de desempenho)

## Executive Summary

A tela do universo, em Flame, roda a **60 fps estáveis** num moto g9 plus com 10 planetas: órbitas animadas e arrastos contínuos, raster médio de 4–6 ms e memória estável (~177 MB de PSS). **O gate da Fase 0 passou.** O spike também encontrou e corrigiu três defeitos que só aparecem no aparelho, e o principal deles define como as órbitas devem ser desenhadas daqui em diante (malha de triângulos, não caminhos com traço).

## Problem Statement

O roadmap pedia uma medição num Android de entrada antes de investir no universo (Fase 0, gate de 60 fps). Em vez de um protótipo descartável, o spike mediu o próprio módulo da Fase 1 (`muuvie/ui/universe`), rodando com filmes mockados.

## Método

- **Aparelho:** moto g9 plus (Snapdragon 662 / Adreno 610, Android 11, tela de 1080×2400), Flutter 3.47.9 com Impeller, build `--profile`, flavor `dev`.
- **Entrada:** `muuvie/lib/main_universe_spike.dart`, que não vai para o repositório. Ela abre a `MovieUniverseScreen` com N planetas mockados (`--dart-define=PLANETS=N`) e pôsteres de rede (picsum.photos, 185×278).
- **Métrica:** `SchedulerBinding.addTimingsCallback`, resumida a cada 5 s em `UNIVERSE_PERF`: quadros, médias e máximos de build e raster, e quadros com `totalSpan` acima de 16,7 ms. A memória vem de `dumpsys meminfo`.
- **Interação:** 16 arrastos via `adb shell input swipe` e um toque via `input tap`. O aparelho vinha com as escalas de animação do Android em 0, o que liga o "reduzir movimento" e para as órbitas. Para medir o caso animado, coloquei as escalas em 1 durante o teste e depois as voltei para 0.

## Resultados

Cada linha é uma janela típica de 5 s. Todas as janelas tiveram ~300 quadros (60 fps de vazão).

| Cenário | Build médio | Raster médio | Quadros > 16 ms | PSS |
|---|---|---|---|---|
| 10 planetas, órbitas paradas, arrastando | 1,7–3,5 ms | 3,7–5,7 ms | 0–1 | — |
| 10 planetas, órbitas animadas, arrastando | 1,7–3,3 ms | 4,3–5,7 ms | 0–4 | 177 MB |
| 60 planetas, anéis como `Path` com traço, sistema inteiro na tela | 4,3–6,1 ms | 10–16,4 ms | 126–304 | 211 MB |
| 60 planetas, **sem anéis** (diagnóstico) | 5,4–6,1 ms | 6,5–6,9 ms | 20–32 | — |
| 60 planetas, **anéis como malha de triângulos** | 5,5–6,2 ms | 7,2–7,8 ms | 60–99 | 210 MB |
| 60 planetas, malha, arrastando | 2,9–4,4 ms | 4,1–6,0 ms | 2–15 | — |

Analysis: com 10 planetas, o caso da Fase 1, a tela tem folga de cerca de 3× no orçamento de 16 ms. Com 60 planetas o sistema inteiro passa a caber no orçamento depois da malha. Os quadros acima de 16 ms que sobram vêm do `totalSpan` (build e raster somados em pipeline), não da vazão, que fica em 60 fps. Isso já é a escala das Fases 2 e 3.

## Defeitos encontrados no aparelho (e corrigidos)

1. **Anéis grandes sumiam.** `canvas.drawCircle` com `PaintingStyle.stroke` não desenhava as órbitas acima de ~270 unidades do mundo nesse GPU, enquanto as 4 internas apareciam. Engrossar o traço não resolveu, e `Path.addOval` resolveu.
2. **Anéis como `Path` custam caro.** Com o traço no `Path`, o Impeller retessela a geometria a cada quadro: o raster caiu de ~16 para ~7 ms só por remover os anéis. A versão final desenha todas as órbitas como uma malha de triângulos (`Canvas.drawVertices`), reconstruída só quando o zoom muda mais de 2% [Source: muuvie/ui/universe/lib/movie_universe/map/orbit_rings.dart].
3. **A câmera escapava do sistema.** No Flame 1.38, `Viewfinder.position` devolve um vetor novo (`-transform.offset`), então o `clampScalar` mexia numa cópia [Source: ~/.pub-cache/hosted/pub.dev/flame-1.38.2/lib/src/camera/viewfinder.dart, line 36]. A correção atribui o valor já limitado.

Também troquei o pôster recortado com `clipPath` por um `ImageShader` em cache, pintado num `drawCircle` com preenchimento. Isso não mudou os números de forma mensurável, mas evita uma camada de recorte por planeta. Por fim, deixei o destaque do planeta selecionado mais forte, porque ficava apagado no fundo escuro.

## Fase 3: exploração longa

Com o autopiloto da entrada do spike (`--dart-define=AUTOPILOT=true`), que viaja até um planeta aleatório do sistema em foco a cada 4 s, durante 6 minutos e ~92 saltos, com órbitas animadas:

| Medida | 1ª rodada | Depois das correções |
|---|---|---|
| Vazão | ~298 quadros a cada 5 s | ~300 quadros a cada 5 s |
| Build médio | 3,4 → 6,5 ms | 3,2 → 8,7 ms (segue o nº de sistemas carregados) |
| Raster médio | 7,1 ms | 7,5 ms (picos de 13 ms nas janelas com deslize da câmera) |
| PSS | ~350 MB aos 113 saltos | 207 → 247 MB, subindo cada vez mais devagar |

Analysis: a vazão ficou em 60 fps durante toda a exploração e não houve tela de loading (o prefetch cobre a maioria dos saltos). A 1ª rodada achou dois defeitos, corrigidos:

1. **Pôsteres presos no `ImageCache` do Flutter.** O `PosterImageLoader` passava pelo cache global, que guardava cada pôster decodificado (até 100 MB) mesmo depois de o mapa soltar. Agora o pôster sai desse cache assim que o `PosterCache` recebe o clone.
2. **Malha das rotas refeita a cada 0,2 s.** O streaming chamava `showRoutesOf` em todo ciclo. Agora rotas, áreas e planetas só são recalculados quando o grafo muda.

Uma instrumentação temporária mostrou o streaming funcionando: de 47 sistemas, ficaram carregados entre 2 e 11 (quase sempre 5 ou 6), e o cache de pôsteres parou em 80. O build médio acompanha esse número. A memória que ainda cresce vem do grafo, que guarda todos os sistemas por desenho, e dos caches limitados enchendo. Ela não chegou a estabilizar em 6 minutos, então o critério de "memória estável" está **quase** atendido: a rodada de 15 minutos abaixo confirmou que ela estabiliza.

Os quadros com `totalSpan` acima de 16,7 ms ficaram em ~29%, contra ~23% na 1ª rodada, concentrados nas janelas em que a câmera desliza até um sistema novo. Como na Fase 0, isso é latência de pipeline e não perda de quadros.

### Exploração de 15 minutos (depois das Fases 4 e 5)

Mesma entrada, com autopiloto e órbitas animadas: 15 minutos e 229 saltos, com selos de status e o registro de visitas ligados (2026-11-10).

| Medida | Resultado |
|---|---|
| Vazão | 298–300 quadros a cada 5 s em toda a rodada |
| Build médio | 5,5–7,1 ms por bloco de 3 minutos |
| Raster médio | 7,8–9,0 ms (picos de 33–38 ms só nos 6 primeiros minutos) |
| Quadros com `totalSpan` > 16,7 ms | 35–57% por bloco de 3 minutos |
| PSS | 178 MB → 243 MB aos 6 minutos, depois estável entre 224 e 237 MB até os 15 |

Analysis: a memória **estabiliza**, então o critério de "memória estável" da Fase 3 está atendido. A vazão continua em 60 fps. A fatia de quadros com `totalSpan` acima de 16,7 ms subiu de ~29% para 35–57%. Como na Fase 3, é latência de pipeline (build e raster em sequência) e não perda de quadros, mas é o próximo ponto a olhar se o universo crescer em componentes por planeta.

## Recommended Approach

- O gate da Fase 0 passou. Seguir para a Fase 2.
- **Regra para as próximas fases:** nada de círculos com traço desenhados como caminho a cada quadro. Linhas grandes e estáticas (órbitas, rotas entre sistemas) viram malha de triângulos em cache.
- Para a Fase 3, com muitos sistemas: o custo de build cresce com o número de componentes (~6 ms com 60 planetas). Planetas de sistemas fora da tela devem sair do mundo (chunks), não só ficar invisíveis.

## Next Steps

- [x] Medir 10 e 60 planetas no moto g9 plus.
- [x] Repetir a medição no fim da Fase 2: com 3 sistemas abertos e arrastando, ~300 quadros a cada 5 s, raster médio de 4,0 a 4,2 ms, 0 a 3 quadros acima de 16 ms e 203 MB de PSS. O spike também pegou um defeito: o enquadramento inicial não era aplicado no `onLoad` do jogo (corrigido).
- [x] Exploração longa da Fase 3 (6 minutos, ~92 saltos).
- [x] Repetir a exploração longa por 15 minutos: a memória estabiliza entre 224 e 237 MB.
- [x] Testar com TalkBack ligado no aparelho. Achou e corrigiu um defeito: a lista não abria sozinha, porque o Android avisa o leitor de tela com atraso.
