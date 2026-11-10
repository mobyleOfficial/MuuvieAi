---
date: 2026-11-09
author: Bruno Bacelar Abe
status: draft
related:
  - .claude/skills/muuvie-feature-map/features/movie-detail.md
tags: [frontend, backend, flutter, flame, recommendations, roadmap]
---

# Universo de Filmes — Roadmap

## Executive Summary

O "Universo de Filmes" é uma tela onde um filme escolhido vira uma estrela e os filmes parecidos com ele aparecem como planetas em órbita. Ao navegar até um planeta, ele vira um novo sistema solar e o universo cresce sob demanda, carregado em chunks como no Minecraft. Este documento divide a feature em fases entregáveis e define o que precisa ser validado antes de cada uma.

Recomendação: renderizar em **2.5D com Flame**, reaproveitar a fonte de "Filmes Similares" que já existe para o MVP e só depois criar um endpoint dedicado com score de similaridade. A primeira entrega é um **spike técnico (Fase 0)**, que decide se vale a pena seguir com a stack escolhida.

## Problem Statement

Hoje a descoberta de filmes por afinidade aparece só como uma fileira de "Filmes Similares" na aba Sobre do detalhe do filme. Cada item abre outro `MovieDetailRoute` [Source: .claude/skills/muuvie-feature-map/features/movie-detail.md, line 35]. Essa navegação é linear: o usuário perde o contexto de onde veio e não enxerga a relação entre os filmes.

### Como os similares funcionam hoje

- **Origem:** o backend pede ao TMDB o detalhe do filme com `append_to_response=…,similar,…,keywords` [Source: backend/src/main/kotlin/org/mobyle/data/remote/tmdb/TmdbDataSourceImpl.kt, line 20]. Ou seja, vem do `/movie/{id}/similar` do TMDB, não do `/recommendations`.
- **Limite:** só os 10 primeiros similares são mantidos [Source: backend/src/main/kotlin/org/mobyle/data/remote/tmdb/Mappers.kt, line 94].
- **Cache:** ficam na tabela `movie_similars`, com uma linha por par (filme, similar) [Source: backend/src/main/kotlin/org/mobyle/data/local/database/Tables.kt, lines 121-131]. São considerados velhos depois de 7 dias e então atualizados [Source: backend/src/main/kotlin/org/mobyle/data/local/movies/MovieCatalogDataSourceImpl.kt, lines 527-540; MoviesRepositoryImpl.kt, lines 34-37]. Cada similar também é inserido em `movies` para ganhar um id interno [Source: MovieCatalogDataSourceImpl.kt, lines 473-492].
- **Exposição:** não existe endpoint próprio. Os similares vêm embutidos no `GET /movies/{id}`, junto com elenco, vídeos, provedores e reviews [Source: backend/src/main/kotlin/org/mobyle/routing/MoviesRouting.kt, lines 96-109; backend/src/main/kotlin/org/mobyle/domain/model/MovieDetail.kt, line 28].
- **Keywords já são salvas:** a tabela `movie_keywords` existe para os desafios de maratona [Source: backend/src/main/kotlin/org/mobyle/data/local/database/Tables.kt, lines 78-84; backend/src/main/kotlin/org/mobyle/data/service/MovieEnrichmentService.kt, line 124]. Isso serve de base para calcular um score de similaridade sem chamadas novas ao TMDB, mas só para filmes que já passaram pelo enriquecimento.
- **App:** `RemoteMovieDetail.similarMovies` é mapeado para `MovieInfo.similarMovies` [Source: muuvie/features/movies/data/lib/models/remote/remote_movie_detail.dart, lines 104, 175; muuvie/features/movies/domain/lib/models/movie_info.dart, line 33]. O caso de uso é o `GetMovieDetail` [Source: muuvie/features/movies/domain/lib/usecases/get_movie_detail.dart]. A tela exibe a fileira em `_SimilarMoviesSection` [Source: muuvie/ui/movies_ui/lib/movie_detail/movie_detail_screen.dart, lines 351-352].
- **Stack do app:** `flutter_bloc`, `auto_route` e `get_it` já são usados, e o `flame` ainda não é dependência [Source: muuvie/pubspec.yaml, lines 39, 129-130].

Analysis: o MVP (um sistema) pode usar o `GetMovieDetail` como está. Já a navegação entre sistemas (Fase 2) faria uma chamada de detalhe completo a cada salto e a cada prefetch, um payload muito maior que o necessário. Por isso o endpoint leve foi antecipado para a Fase 2.

A proposta é transformar essa descoberta numa exploração espacial contínua. Esta feature cobre:

- Uma tela nova no app Flutter (`muuvie/`) e, nas fases seguintes, um endpoint novo no backend (`backend/`).
- Fora de escopo agora: 3D real, recomendações por IA ou embeddings (ficam na Fase 6, exploratória) e multiplayer.

## Options Evaluated

### Opção 1: Flame (engine 2D sobre Flutter)
**Description**: Usar o `flame` com `World` e `CameraComponent`, com planetas e estrelas como componentes.

**Pros**:
- Câmera, mundo sem limites, componentes e eventos de toque já vêm prontos [Source: https://docs.flame-engine.org/latest/flame/camera.html].
- Roda dentro de um widget comum (`GameWidget`), então dá para colocar a tela dentro do roteamento atual [Source: https://docs.flame-engine.org/latest/flame/game_widget.html].

**Cons**:
- É uma dependência nova e grande no app.
- A semântica de acessibilidade precisa ser feita à mão, porque o canvas não expõe nós para leitores de tela.

**Verdict**: Escolhida. É o caminho mais curto para câmera, gestos e culling, e o custo de acessibilidade existe em qualquer opção baseada em canvas.

### Opção 2: `CustomPainter` + câmera própria
**Description**: Desenhar tudo num `CustomPainter`, com pan e zoom via `InteractiveViewer` ou uma matriz própria.

**Pros**:
- Nenhuma dependência nova e controle total.

**Cons**:
- Câmera, hit-testing, culling e laço de animação ficam por nossa conta. Isso é reconstruir o que o Flame já oferece.

**Verdict**: Rejeitada para a feature, mas pode servir de comparação no spike.

### Opção 3: 3D real (`flutter_gpu` / `flutter_scene`)
**Description**: Renderizar uma cena 3D de verdade.

**Pros**:
- É o resultado visual mais impressionante.

**Cons**:
- As APIs ainda são experimentais e só funcionam em alguns backends do Impeller [Source: https://github.com/flutter/flutter/blob/master/docs/engine/impeller/Flutter-GPU.md].

**Verdict**: Rejeitada por enquanto. Pode ser reavaliada na Fase 6.

### Fonte de similaridade
- **MVP (Fase 1):** reaproveitar `MovieInfo.similarMovies` via `GetMovieDetail`. São até 10 filmes por sistema, numa lista ordenada, então a distância da órbita vem da posição na lista.
- **Fase 2:** o endpoint leve `GET /api/v1/movies/{id}/similar`, **já implementado** (veja "Endpoint de similares" abaixo). Ele lê o mesmo cache `movie_similars` e devolve só os filmes, sem o resto do detalhe.
- **Fase 3:** esse endpoint passa a devolver um `score` por vizinho, calculado pela sobreposição de keywords (`movie_keywords`) e gêneros [Source: https://developer.themoviedb.org/reference/movie-keywords], [Source: https://developer.themoviedb.org/reference/movie-similar]. Os similares que ainda não têm keywords salvas precisam ser enriquecidos sob demanda ou recebem um score neutro.

## Recommended Approach — Roadmap

Tamanhos: **P** ≈ até 1 semana, **M** ≈ 1 a 2 semanas, **G** ≈ 3 semanas ou mais (estimativa, para validar no spike).

### Fase 0 — Spike técnico (P)
**Objetivo:** provar que a ideia roda bem antes de investir.
- Protótipo isolado em Flame com dados mockados: 1 estrela, cerca de 12 planetas com pôster, starfield com parallax, pan e zoom.
- Geração de chunks simulada, com 200 ou mais planetas carregados e descarregados durante a navegação.
- Medir FPS e memória num Android de entrada e no web (CanvasKit).

**Gate:** 60 fps estáveis no aparelho de referência e memória sem crescer sem limite durante a navegação. Se falhar, reavaliar a Opção 2 ou reduzir o escopo visual.

**Status (2026-11-09):** ✅ gate aprovado num moto g9 plus: 60 fps estáveis com 10 planetas (raster de 4 a 6 ms) e com 60 planetas (raster de ~7,5 ms, depois da correção dos anéis). Os números e os três defeitos que só apareceram no aparelho estão em [spike.md](spike.md). A geração de chunks com 200 ou mais planetas fica para a Fase 3.

### Fase 1 — MVP: um sistema solar (M)
**Objetivo:** o usuário abre o universo de um filme e vê os similares dele.
- Entrada pela tela de detalhe do filme: um botão "Explorar universo" ou um item na actions sheet [Source: movie-detail.md, line 26].
- Estrela central com o filme escolhido. Planetas em órbita com os similares, animados lentamente.
- Tocar num planeta mostra um card com o título e "Ver detalhes" (abre `MovieDetailRoute`).
- Estados de carregamento, vazio e erro.
- **Acessibilidade:** um modo "Ver como lista" com os mesmos filmes, `Semantics` nos planetas e áreas de toque de 48dp (exigido pela regra de acessibilidade).
- Textos via `AppLocalizations`, nos três ARBs do app (pt, en e es).
- Módulo de UI novo (`ui/universe`) com cubit testado. A feature consome a fonte de similares existente.

**Critério de sucesso:** um usuário sai de um filme e chega ao detalhe de um similar pelo universo, inclusive com TalkBack ou VoiceOver.

**Status (2026-11-09):** ✅ implementado e commitado no branch `feature/movie-universe` do `muuvie/`.
- **Mudança em relação ao plano:** o MVP já usa o endpoint leve `GET /movies/{id}/similar` em vez do `GetMovieDetail`, porque o endpoint ficou pronto antes.
- **Dados:** caso de uso `GetSimilarMovies` na feature `movies`, com datasource, repositório e DI.
- **UI:** módulo `ui/universe` (`universe_ui`), com Flame 1.38. A tela `MovieUniverseRoute` é aberta pelo item "Explorar universo" do menu "Ações" do detalhe, que não exige login. Ela é chamada via `MovieDetailLinks.openUniverse`, para que o `movies_ui` não dependa do `universe_ui`.
- **Mapa:** estrela com brilho pulsante, até 10 planetas em órbitas por ordem de similaridade (`OrbitLayout`), céu de fundo com parallax em 3 camadas gerado pelo id do filme, arrastar para mover e pinça para zoom. Tocar num planeta abre um card com "Ver detalhes".
- **Acessibilidade:**
  - Botão "Ver como lista" / "Ver como universo".
  - A lista abre direto quando há leitor de tela ativo.
  - O mapa tem um rótulo para o leitor de tela.
  - A área de toque dos planetas tem no mínimo 48dp em qualquer zoom.
  - O planeta selecionado fica maior e ganha um anel mais grosso, além da cor.
  - Com "reduzir movimento" ativado, as órbitas param.
- **Textos:** em pt, en e es, porque o app tem os três ARBs.
- **Testes:** cubit (6 cenários com `bloc_test`), `OrbitLayout` (4) e datasource (2).

### Fase 2 — Navegação entre sistemas (M)
**Objetivo:** o universo deixa de ser uma tela e passa a ser um lugar.
- "Viajar" até um planeta transforma ele num novo sistema, com os similares dele em órbita.
- O sistema novo é posicionado na direção oposta à do sistema pai, para o mapa se espalhar sem sobrepor sistemas.
- **Grafo com deduplicação:** um filme que já está no universo não é recriado. Uma "rota" liga os sistemas.
- Indicadores de "distância da origem" (número de saltos) e "voltar à origem".
- Estado do universo mantido na sessão: voltar a um sistema já visitado não refaz chamadas.
- **Backend:** ✅ `GET /api/v1/movies/{id}/similar` (veja "Endpoint de similares").
- **App:** ✅ o caso de uso `GetSimilarMovies` já existe (feito na Fase 1).

**Critério de sucesso:** 10 saltos seguidos sem sobreposição de sistemas nem filmes duplicados.

**Status (2026-11-09):** ✅ implementado e commitado no branch `feature/movie-universe` do `muuvie/`. O critério de sucesso é coberto por teste.
- **Grafo** (`ui/universe/lib/movie_universe/graph/`): `UniverseGraph` é imutável e guarda cada sistema com centro, saltos e pai.
  - O planeta que vira sistema sai da órbita do pai; as outras órbitas não mudam.
  - Um filme já presente no universo, como estrela ou planeta, nunca é repetido.
  - Cada sistema novo nasce na direção da órbita de onde veio, dentro de um cone de 120° voltado para fora do avô. Se o lugar estiver ocupado, ele gira em passos de 20° e, sem espaço, se afasta.
- **Cubit:**
  - `travelTo` (um sistema já visitado só recebe o foco, sem nova chamada), `focusSystem` e `backToOrigin`.
  - Uma falha de viagem aparece uma única vez, num SnackBar.
- **Mapa:**
  - Um `SystemComponent` por sistema.
  - Rotas entre os sistemas desenhadas como malha.
  - A câmera desliza até o sistema em foco, ou salta direto com "reduzir movimento".
  - O arraste fica limitado à área já explorada.
  - Tocar na estrela de outro sistema leva até ele.
- **Interface:**
  - O card do planeta ganha o botão "Viajar".
  - Uma barra mostra "N saltos da origem", com "Voltar à origem".
  - No modo lista, cada planeta tem um botão "Viajar até {título}".
- **Testes:**
  - Grafo (7), incluindo 10 saltos seguidos sem sobreposição nem repetição e todos os planetas de um sistema virando sistemas.
  - Cubit (10), incluindo que revisitar um sistema não refaz a chamada.
- **No aparelho:**
  - Dois saltos pelo modo lista, a volta à origem pelo mapa e o deslize da câmera.
  - Com 3 sistemas abertos: 60 fps (raster de ~4 ms) e ~203 MB de PSS.
  - Ficou sem teste no aparelho o toque na estrela de outro sistema, porque não deu para mirar só com `adb`.

### Fase 3 — Universo infinito e similaridade com score (G)
**Objetivo:** escalar para exploração longa e tornar as distâncias significativas.
- **Frontend:**
  - Grade de chunks com prefetch quando a câmera se aproxima da borda e descarregamento dos chunks distantes (os dados ficam em cache, as imagens saem da memória).
  - Seed determinística `hash(movieId, chunkX, chunkY)` para a decoração (estrelas, nebulosas, cor e tamanho dos planetas), para que um lugar revisitado fique igual.
  - Nível de detalhe nos pôsteres (`w92` de longe, `w185` ou mais de perto) e cache LRU de imagens.
  - Fragment shaders para nebulosas e brilho [Source: https://docs.flutter.dev/ui/design/graphics/fragment-shaders]. `Canvas.drawAtlas` para o starfield.
- **Backend:**
  - `GET /movies/{id}/similar` passa a devolver `score` (0 a 1) e os motivos (gêneros e keywords em comum), calculados a partir de `movie_keywords`.
  - Avaliar se o limite de 10 similares (`take(10)` em `Mappers.kt`) deve subir para dar mais densidade a cada sistema.
  - O cache de 7 dias do `movie_similars` já existe. Falta garantir que filmes ainda não salvos sejam buscados sem estourar o limite do TMDB durante a exploração.
- A órbita passa a usar o score: quanto mais parecido, mais perto da estrela.

**Critério de sucesso:** 5 minutos de exploração contínua sem travar, com memória estável e nenhuma tela de loading bloqueante.

**Status (2026-11-09):** ✅ implementado (commits nos branches `feature/movie-universe` do `backend/` e do `muuvie/`, sem PR). Medido no moto g9 plus por 6 minutos (veja [spike.md](spike.md)).
- **Backend — score:** `GET /movies/{id}/similar` agora devolve `affinities` (`movieId`, `score`, `sharedGenres`, `sharedKeywords`), uma por filme de `results`, na mesma ordem, e `results` vem ordenado do mais parecido para o menos.
  - O `SimilarityScorer` mistura três sinais: a ordem do TMDB (de 0,7 a 0,3, peso 0,2), a sobreposição de gêneros (0,35) e a de keywords (0,45). A sobreposição é `|A ∩ B| / min(|A|, |B|)`.
  - Um sinal só conta quando os dois filmes têm o dado. Sem gêneros nem keywords, o score fica só com a ordem, em torno de 0,5 (o "score neutro" previsto).
  - O `GET /movies/{id}` passou a salvar as keywords do filme aberto, que já vinham na mesma resposta do TMDB. Os similares ganham gêneros e keywords pelo enriquecimento em segundo plano que já existia.
  - O limite de 10 similares foi mantido: o layout das órbitas foi pensado para até 10.
  - **Testes:** `SimilarityScorerTest` (5), `GetSimilarMoviesTest` (4) e a rota passa a conferir `affinities`.
- **App — órbitas por score:** `GetSimilarMovies` devolve `SimilarMovie` (filme, score e o que têm em comum). Sem `affinities` (backend antigo), o app usa o mesmo score neutro pela ordem. A órbita segue o rank, e cada ponto de score perdido afasta o planeta 120 unidades a mais (`OrbitLayout.scoreGap`).
- **App — prefetch:** ao abrir um sistema, o cubit já busca os similares dos 3 planetas mais próximos, e também o do planeta cujo card foi aberto. Uma viagem até eles não espera a rede. Um prefetch que falhou é refeito na viagem.
- **App — streaming:** só os sistemas perto da câmera ficam no mundo do Flame (`SystemStreaming`): entram a 800 unidades da tela e saem a 2400, e o sistema em foco nunca sai. O grafo guarda todos, então um sistema que volta é recriado da memória, sem chamada.
- **App — pôsteres:** `PosterCache` (LRU de 80 imagens; quem usa recebe um clone). Planetas usam `w92` de longe e `w185` de perto; a estrela usa `w185` e `w342`. O carregador tira cada pôster do `ImageCache` global do Flutter, que antes guardava até 100 MB por fora do LRU.
- **App — decoração determinística:** grade de chunks de 1600 unidades (`ChunkGrid`), com seed `hash(movieId, x, y)`. O céu de fundo é gerado por bloco (não se repete mais) e cada chunk tem até duas nebulosas em gradiente radial.
- **Mudanças em relação ao plano:**
  - Nebulosas com `Gradient.radial` em vez de fragment shader, e estrelas com `drawRawPoints` em vez de `drawAtlas`. Os dois atendem ao orçamento medido; shaders ficam para quando houver um efeito que gradiente não faça.
  - Os sistemas entram e saem por distância da câmera, com histerese, e não por chunk. A grade de chunks é usada para a decoração.
  - A cor e o tamanho dos planetas continuam vindo do pôster e do rank, não da seed.
- **Testes do app:** `ChunkGrid` (3), `SystemStreaming` (5), `PosterCache` (4), órbitas (7), grafo (+2, incluindo 30 saltos com scores baixos sem sobreposição), cubit (+4 de prefetch) e datasource (+1).
- **Itens fechados depois (2026-11-10):**
  - **Cache negativo:** `movies.similars_checked_at` (migração V21) guarda quando o TMDB foi consultado, mesmo sem resultado. Um filme sem similares não é consultado de novo por 7 dias.
  - **Enriquecimento antecipado:** os similares sem gêneros nem keywords passam na frente do loop de enriquecimento (`enrichAhead`, até 10 por chamada, com o mesmo espaçamento). A próxima visita já os pontua de verdade.

### Fase 4 — Personalização (M)
**Objetivo:** o universo reflete o que o usuário já fez.
- Planetas já assistidos com outro visual (por exemplo, um anel) e um ícone além da cor, porque a regra proíbe depender só de cor. Integra com [watch-logs](../../../.claude/skills/muuvie-feature-map/features/watch-logs.md).
- Marcar "quero ver" ou adicionar a uma estante a partir do card do planeta ([shelves](../../../.claude/skills/muuvie-feature-map/features/shelves.md)).
- Filtros que viram "constelações": gênero, década, só os não assistidos.
- Mostrar no card *por que* o filme está ali ("3 temas em comum: viagem no tempo, …").

**Status (2026-11-09):** ✅ implementado (commits nos branches `feature/movie-universe` do `backend/` e do `muuvie/`, sem PR). Validado no moto g9 plus com dados mockados.
- **Backend:** cada item de `affinities` ganhou `genres`, todos os gêneros do próprio similar (vazio enquanto ele não foi enriquecido). É o que permite filtrar por gênero sem outra chamada.
- **Selos:** o `me` que já vinha no endpoint vira um selo na borda do planeta: um ✓ verde para "Já assisti" e um marcador âmbar para "Quero ver" (`StatusBadge`). O símbolo carrega o significado e a cor só repete. O selo tem no mínimo 7 px de raio na tela, em qualquer zoom.
- **Card:** mostra o status em texto, "Em comum: …" (até 4 gêneros e keywords compartilhados) e as ações "Quero ver" (`AddMovieToWatchlist`, que já existia para Notícias) e "Adicionar à estante" (`AddToShelvesRoute`). As duas pedem login antes (`AuthGate`). "Quero ver" muda o planeta na hora e volta se a chamada falhar.
- **Filtros ("constelações"):** botão "Filtrar planetas" na barra, com "Só os que não assisti", uma década e um gênero. Só aparecem décadas e gêneros que existem no universo. No mapa, os planetas que não combinam ficam esmaecidos, sem selo e sem toque, mas não saem do lugar. Na lista, eles somem. Uma barra mostra "N de M planetas combinam" com "Limpar filtros". O filtro sobrevive a um recarregamento.
- **Lista:** cada planeta mostra ano, status e "Em comum", e ganha um menu "Mais ações para {título}" com as mesmas ações do card.
- **Mudanças em relação ao plano:** os planetas que não combinam esmaecem em vez de serem ligados por linhas de constelação. Um filme só combina com um filtro de década ou gênero quando o ano ou os gêneros são conhecidos.
- **Testes:** cubit (+4: "Quero ver" otimista e revertido, filtro mantido no recarregamento, card fechado quando o planeta sai do filtro), `UniverseFilter` e grafo (6) e datasource (gêneros).
- **No aparelho:** 60 fps com o filtro ativo (raster de ~6,5 ms). Com o sheet de filtros aberto sobre o mapa, o raster sobe para 11–15 ms e volta ao fechar.
- **Itens fechados depois:**
  - Depois de "Adicionar à estante", o estado do filme é buscado de novo (`GET /movies/{id}/me`). Um login feito pelo `AuthGate` busca de novo os similares de todos os sistemas, de 4 em 4, e aplica só os estados, sem mexer nas posições. Uma mudança feita durante esse refresh não é sobrescrita por ele.
  - **TalkBack (moto g9 plus):** o Android só avisa que há leitor de tela um ou dois quadros depois de o app abrir, então a lista não abria sozinha. Esse defeito vinha da Fase 1. Agora a tela passa para a lista quando o aviso chega, a menos que o usuário já tenha escolhido a vista.
    - Lida pelo `uiautomator`, a árvore de acessibilidade mostra cada planeta com ano, status e "Em comum", seguido de "Mais ações para…" e "Viajar até…".
    - O sheet de filtros é modal, com switch marcável, chips com estado e títulos de seção.
    - Testes de widget conferem alvo de toque, rótulos e contraste nos dois temas.

### Fase 5 — Social e gamificação (M)
- Compartilhar a rota percorrida ("da origem *A* até *B* em 7 saltos").
- Conquistas de explorador ligadas à [gamification](../../../.claude/skills/muuvie-feature-map/features/gamification.md) (por exemplo, visitar 50 sistemas).
- Estantes públicas exibidas como constelações.

**Status (2026-11-10):** ✅ implementado (commits nos branches `feature/movie-universe` do `backend/` e do `muuvie/`, sem PR). Conferido no moto g9 plus com dados mockados.
- **Rota:** a barra de saltos ganhou "Compartilhar rota". Ela compartilha um texto como "Fui de *A* até *B* em N saltos no Universo de Filmes do Muuvie: A → … → B", montado por `UniverseGraph.routeTo`.
- **Vaquinhas exploradoras:**
  - **Backend:** `POST /users/me/universe/visits` recebe de 1 a 50 ids e guarda cada sistema uma vez por usuário (tabela `universe_visits`, migração V20). A regra nova `universe_systems` desbloqueia o **Foguete** (comum, 10 sistemas) e o **Astronauta** (raro, 50 sistemas), pelo mesmo `PetUnlocker` das outras vaquinhas.
  - **App:** a origem e cada sistema novo são registrados. Visitar de novo não conta. Deslogado, a chamada falha e é ignorada. Depois de um login, todos os sistemas abertos são enviados. Um desbloqueio aparece uma vez num SnackBar com "Ver", que abre a Bombonière. A arte das duas vaquinhas segue o estilo das outras.
- **Constelações:** o sheet de filtros lista as estantes públicas que têm a estrela em foco (`GET /movies/{id}/shelves/public`). Escolher uma lê até 10 páginas dos filmes dela (`GET /shelves/{id}/movies`) e vira um filtro: os planetas da estante acendem, os outros apagam, e uma linha liga os que acenderam, sistema por sistema (`ConstellationLines`, um único `drawRawPoints` por quadro). A barra mostra "*Estante*: N de M planetas". Escolher de novo desfaz.
- **Testes:** backend (visitas contadas uma vez, desbloqueio aos 10, ids desconhecidos ignorados). App: cubit (+5: visitas, aviso único, rota, constelação, falha da constelação) e tela (seção de constelações).
- **No aparelho:** 60 fps com a constelação ligada e arrastando (raster de ~7,5 ms).
- **Mudança em relação ao plano:** as constelações saem de estantes públicas que têm a estrela em foco, e não de todas as estantes do usuário. Assim, qualquer pessoa vê constelações sem precisar ter estantes.

### Fase 6 — Exploratório (sem compromisso)
- Similaridade semântica por embeddings de sinopse.
- Reavaliar 3D real (Opção 3) se o `flutter_gpu` estiver estável.

**Status (2026-11-10):** ✅ avaliada em [phase6-exploration.md](phase6-exploration.md).
- **Embeddings:** recomenda um experimento de cerca de 1 semana. Um modelo local multilíngue de 384 dimensões em ONNX no backend, vetores no pgvector, e a sinopse como quarto sinal do `SimilarityScorer`. Só vira produto se ganhar um teste cego.
- **3D:** fica no Flame. O `flutter_scene` roda no Flutter 3.47 estável, mas o Flutter GPU ainda é *preview* e precisa ser ligado por plataforma.
- **Não houve protótipo** com sinopses reais, porque não havia `TMDB_API_KEY` no ambiente.

## Endpoint de similares

Implementado no branch `feature/movie-universe` do `backend/` (commitado, ainda sem PR). O score da Fase 3 está descrito na própria fase.

**Contrato:** `GET /api/v1/movies/{id}/similar`, público.

- `{id}` é o **id do banco do Muuvie**, o mesmo das outras sub-rotas `/movies/{id}/…` (`community`, `timeline`, `logs`). Não é o id do TMDB usado em `GET /movies/{id}`. Os similares devolvidos já trazem `id` e `tmdbId`, então o app pode pular de sistema em sistema só com o `id`.
- Resposta: `{ "movieId": 1, "results": [Movie, …] }`. É um objeto, e não uma lista solta, para que a Fase 3 possa acrescentar `score` sem quebrar clientes.
- Com token, cada filme traz `me` (`status` e `rating`), que já serve para marcar planetas assistidos na Fase 4.
- `404` para id desconhecido, `400` para id inválido e lista vazia para um filme importado sem id do TMDB.

**Comportamento:**
1. Busca o filme pelo id. Se não existe, responde 404.
2. Se o cache `movie_similars` tem dados, responde com eles. Se estiverem com mais de 7 dias, dispara a atualização em segundo plano.
3. Se o cache está vazio, busca o detalhe no TMDB pelo mesmo caminho do `GET /movies/{id}`, que já salva os similares com ids do banco. Se o TMDB falhar, responde com a lista vazia.

**Arquivos:**
- `domain/model/SimilarMovies.kt`
- `domain/usecase/movies/GetSimilarMovies.kt`
- `MoviesRepository.getSimilarMovies` / `MoviesRepositoryImpl`
- `di/AppModule.kt`
- `routing/MoviesRouting.kt`
- `README.md` (tabela de endpoints)

**Testes:** `GetSimilarMoviesTest` (3), `MoviesRepositorySimilarTest` (4) e `MoviesSimilarRoutingTest` (4). A suíte completa do backend passa.

**Limitação conhecida:** um filme para o qual o TMDB não lista nenhum similar não deixa linhas no cache, então cada chamada refaz a busca no TMDB. Isso deve ser resolvido na Fase 3, junto com o cache para filmes ainda não salvos.

## Alternative Approaches

- **Criar o endpoint com score já no MVP:** rejeitado porque atrasa a validação da experiência. A lista ordenada que já existe basta para testar se a exploração espacial é divertida.
- **Usar `GetMovieDetail` em todas as fases:** rejeitado a partir da Fase 2, porque cada salto e cada prefetch baixaria o detalhe completo (elenco, vídeos, provedores, reviews) só para usar os similares.
- **Trocar `/similar` por `/recommendations` do TMDB:** fica em aberto para a Fase 3. Mudar a fonte afeta também a fileira "Filmes Similares" do detalhe do filme.
- **Universo totalmente procedural, sem grafo:** rejeitado porque o conteúdo vem da API. Só a decoração é procedural, e as posições dos filmes dependem das relações entre eles.

## Riscos

- **Performance em aparelhos fracos:** mitigado pelo gate da Fase 0 e pelo nível de detalhe na Fase 3.
- **Acessibilidade de um canvas:** o modo lista é obrigatório desde a Fase 1, não um extra.
- **Desvio de tema após muitos saltos:** tratado como parte da graça, deixando a distância da origem visível na interface.
- **Volume de chamadas ao TMDB:** cache no backend na Fase 3 e prefetch limitado no app.

## Next Steps

- [ ] Aprovar este roadmap (decision gate: Bruno).
- [x] Endpoint `GET /api/v1/movies/{id}/similar` no backend (branch `feature/movie-universe`, sem commit).
- [x] Revisar o endpoint e commitar no `backend` (branch `feature/movie-universe`).
- [ ] Abrir o PR do `backend` para `dev`.
- [x] Fase 1 implementada no `muuvie/` (branch `feature/movie-universe`).
- [x] Fase 0 medida no moto g9 plus ([spike.md](spike.md)). O gate passou.
- [x] Fase 1 validada no aparelho: mapa, toque, card e modo lista.
- [x] Fase 2 implementada e validada no aparelho.
- [x] Testar com TalkBack ligado (árvore de acessibilidade lida no aparelho).
- [x] Tocar na estrela de outro sistema no aparelho: o foco vai para aquele sistema.
- [x] Exploração de 15 minutos: memória estável ([spike.md](spike.md)).
- [ ] Commitar e abrir os PRs do `backend` e do `muuvie` para `dev`. Depois, atualizar as refs dos submódulos e a página `movie-detail` do feature map (`/map-features`).
- [x] Fase 3: score de similaridade no endpoint e universo em chunks (commits, sem PR).
- [x] Fase 4: personalização (selos, "Quero ver", estantes, filtros e "Em comum"; commits, sem PR).
- [x] Fase 4: atualizar os selos depois de "Adicionar à estante" e do login.
- [x] Fase 5: rota compartilhada, vaquinhas exploradoras e constelações (commits, sem PR).
- [x] Fase 3: cache negativo de similares e enriquecimento antecipado.
- [x] Fase 6: avaliação de embeddings e 3D ([phase6-exploration.md](phase6-exploration.md)).
- [ ] Fase 6: decidir sobre o experimento de embeddings (decision gate: Bruno).
